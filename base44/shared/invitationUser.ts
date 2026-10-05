export async function findUserByEmail(base44, email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const exact = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail });
  if (exact[0]) return exact[0];

  const users = await base44.asServiceRole.entities.User.list('-created_date', 1000);
  return users.find((item) => String(item.email || '').trim().toLowerCase() === normalizedEmail) || null;
}

// 초대 참여 메일: Join AEGIS Trade 버튼 → /join?email=<초대 이메일> 비밀번호 설정 화면
export async function sendJoinEmail(base44, email, label = '') {
  const base = (Deno.env.get('APP_BASE_URL') || 'https://aegistrade.biz').replace(/\/$/, '');
  const url = `${base}/join?email=${encodeURIComponent(email)}`;
  await base44.asServiceRole.integrations.Core.SendEmail({
    to: email,
    from_name: 'AEGIS Trade',
    subject: 'AEGIS Trade 초대 · 비밀번호를 설정해 주세요',
    body: `<div style="font-family:Arial,sans-serif;color:#171719;max-width:560px">
<h2 style="margin:0 0 12px">AEGIS Trade 에 초대되었습니다</h2>
<p style="color:#70737c;line-height:1.6">${label ? `${label} 팀에서 ` : ''}${email} 계정으로 초대했습니다. 아래 버튼을 눌러 비밀번호를 설정하면 바로 시작할 수 있습니다.</p>
<p style="margin:24px 0"><a href="${url}" style="background:#0066ff;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;display:inline-block">Join AEGIS Trade</a></p>
<p style="color:#70737c;font-size:12px">버튼이 열리지 않으면 이 주소를 브라우저에 붙여넣으세요: ${url}</p></div>`,
  });
  return url;
}

// 아직 가입하지 않은 이메일은 비밀번호 재설정 대상이 아니다 (계정이 없어 설정 화면이 열리지 않는다).
export async function requestPasswordSetup(base44, email, requested, registered = true) {
  if (!requested) return { requested: false, sent: false };
  if (!registered) return { requested: true, sent: false, pending_signup: true };
  try {
    await base44.auth.resetPasswordRequest(email);
    return { requested: true, sent: true };
  } catch (error) {
    return { requested: true, sent: false, error: error.message };
  }
}