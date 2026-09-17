import { clientUsersOfCompany } from './notify.ts';
export async function sendCollaborationEmail(svc, change) {
  if (['SENT', 'SKIPPED', 'SENDING'].includes(change.email_status)) return { status: change.email_status };
  const card = await svc.entities.TaskCard.get(change.card_id);
  if (!card || !change.company_id || card.client_id !== change.company_id || card.tenant_id !== change.tenant_id || card.client_visible !== true) {
    await svc.entities.CollaborationChange.update(change.id, { email_status: 'SKIPPED', email_error: '비공개 카드 또는 고객사 연결 변경으로 발송하지 않았습니다.' });
    return { status: 'SKIPPED' };
  }
  const targets = await clientUsersOfCompany(svc, change.company_id);
  if (!targets.length) {
    await svc.entities.CollaborationChange.update(change.id, { email_status: 'SKIPPED', email_error: '가입된 활성 고객 담당자가 없습니다.' });
    return { status: 'SKIPPED' };
  }
  const token = crypto.randomUUID();
  await svc.entities.CollaborationChange.updateMany({ id: change.id, email_status: { $in: ['PENDING', 'FAILED'] } }, { $set: { email_status: 'SENDING', email_lock_token: token, email_error: '' } });
  const locked = await svc.entities.CollaborationChange.get(change.id);
  if (locked.email_lock_token !== token) return { status: locked.email_status };
  const sent = [...(locked.sent_user_ids || [])];
  for (const target of targets) {
    if (sent.includes(target.id) || !target.email) continue;
    try {
      await svc.integrations.Core.SendEmail({ to: target.email, from_name: 'AEGIS', subject: change.title, text: `${change.body}\n\n변경 사유: ${change.reason || '미입력'}\n변경일시: ${new Date(change.created_date).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (한국시간)\n\nAEGIS 고객 포털에서 최신 일정을 확인하세요.` });
    } catch (error) {
      await svc.entities.CollaborationChange.update(change.id, { email_status: 'FAILED', sent_user_ids: sent, email_error: String(error.message || '이메일 발송 실패').slice(0, 1000) });
      return { status: 'FAILED' };
    }
    sent.push(target.id);
    await svc.entities.CollaborationChange.update(change.id, { sent_user_ids: sent });
  }
  await svc.entities.CollaborationChange.update(change.id, { email_status: 'SENT', email_error: '' });
  return { status: 'SENT' };
}