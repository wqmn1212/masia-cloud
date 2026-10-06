export async function findUserByEmail(base44, email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const exact = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail });
  if (exact[0]) return exact[0];

  const users = await base44.asServiceRole.entities.User.list('-created_date', 1000);
  return users.find((item) => String(item.email || '').trim().toLowerCase() === normalizedEmail) || null;
}

const button = (url, label) => `<p style="margin:24px 0"><a href="${url}" style="background:#0066ff;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;display:inline-block">${label}</a></p>`;
const wrap = (inner, url) => `<div style="font-family:Arial,sans-serif;color:#171719;max-width:560px;line-height:1.6">${inner}<p style="color:#70737c;font-size:12px">버튼이 열리지 않으면 아래 주소를 브라우저에 붙여 넣으세요.<br>${url}</p></div>`;

// 기존 계정에 팀 권한이 추가되었을 때 한국어 안내 메일 (로그인 화면으로 연결)
// 신규 계정 초대 메일은 플랫폼 초대 메일(base44/emails/UserInvite.html, 한국어)이 담당한다.
export async function sendJoinEmail(base44, email, teamName = '') {
  const base = (Deno.env.get('APP_BASE_URL') || 'https://aegistrade.biz').replace(/\/$/, '');
  const url = `${base}/join?email=${encodeURIComponent(email)}&mode=login`;
  const team = teamName || 'AEGIS 팀';
  await base44.asServiceRole.integrations.Core.SendEmail({
    to: email,
    from_name: 'AEGIS',
    subject: `AEGIS Cloud · ${team}에 추가되었습니다`,
    body: wrap(`<h2 style="margin:0 0 12px">${team}에 추가되었습니다</h2>
<p style="color:#70737c">${email} 계정에 ${team}의 권한이 적용되었습니다. 기존 비밀번호로 로그인하세요.</p>
${button(url, '로그인하기')}
<p style="color:#70737c;font-size:13px">비밀번호가 기억나지 않으면 로그인 화면의 ‘비밀번호 재설정’을 눌러 주세요.</p>`, url),
  });
  return url;
}

// 기존 계정: 한국어 안내 메일 발송. 신규 계정: 플랫폼 초대 메일이 이미 발송되므로 추가 메일 없음.
export async function requestPasswordSetup(base44, email, requested, registered = true, teamName = '') {
  if (!requested) return { requested: false, sent: false };
  if (!registered) return { requested: true, sent: true, via: 'invite' };
  try {
    await sendJoinEmail(base44, email, teamName);
    return { requested: true, sent: true };
  } catch (error) {
    return { requested: true, sent: false, error: error.message };
  }
}