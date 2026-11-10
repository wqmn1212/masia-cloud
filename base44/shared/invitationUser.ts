import { emailLayout, p, esc, strong, button, linkFallback } from './emailLayout.ts';
export async function findUserByEmail(base44, email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const exact = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail });
  if (exact[0]) return exact[0];

  const users = await base44.asServiceRole.entities.User.list('-created_date', 1000);
  return users.find((item) => String(item.email || '').trim().toLowerCase() === normalizedEmail) || null;
}

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
    body: emailLayout({
      kind: '팀 추가', eyebrow: 'AEGIS Cloud', title: `${team}에 추가되었습니다`, preheader: `${email} 계정에 ${team} 권한이 적용되었습니다`,
      body: p(`${strong(email)} 계정에 ${esc(team)}의 권한이 적용되었습니다. 기존 비밀번호로 로그인하세요.`) +
        button('로그인하기', url) + linkFallback(url) +
        p('비밀번호가 기억나지 않으면 로그인 화면의 ‘비밀번호 재설정’을 눌러 주세요.', 'margin-top:16px;font-size:13.5px;line-height:21px;color:#6F727B'),
      footNote: '팀 추가를 요청한 적이 없다면 이 메일은 무시하셔도 됩니다.',
    }),
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