export async function findUserByEmail(base44, email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const exact = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail });
  if (exact[0]) return exact[0];

  const users = await base44.asServiceRole.entities.User.list('-created_date', 1000);
  return users.find((item) => String(item.email || '').trim().toLowerCase() === normalizedEmail) || null;
}

export async function requestPasswordSetup(base44, email, requested) {
  if (!requested) return { requested: false, sent: false };
  try {
    await base44.auth.resetPasswordRequest(email);
    return { requested: true, sent: true };
  } catch (error) {
    return { requested: true, sent: false, error: error.message };
  }
}