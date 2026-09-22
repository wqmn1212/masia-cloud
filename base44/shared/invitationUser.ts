export async function findUserByEmail(base44, email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const exact = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail });
  if (exact[0]) return exact[0];

  const users = await base44.asServiceRole.entities.User.list('-created_date', 1000);
  return users.find((item) => String(item.email || '').trim().toLowerCase() === normalizedEmail) || null;
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