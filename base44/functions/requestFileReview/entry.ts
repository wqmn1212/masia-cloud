import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { notifyUsers, clientUsersOfCompany } from '../../shared/notify.ts';
import { reviewRequestPatch } from '../../shared/fileReview.ts';
import { kstToday } from '../../shared/chinaHoliday.ts';

// 직원: 디자인·도면 파일의 고객 확인 요청 보내기·거두기.
//  action 'request' {card_id, attachment_id, question, due_date, previous_attachment_id?} — 파일을 고객에게 공개하고 확인을 요청한다
//  action 'cancel' {review_id} — 답하기 전의 요청을 거둔다
// 고객의 승인·수정 요청은 clientCardAction(file_review_decision)이 받는다.
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_active === false || !['master', 'service', 'sub'].includes(user.account_tier)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole;
    const by = user.full_name || user.email || '';
    const now = new Date().toISOString();
    const staffCan = (card: any) => !!card && (user.account_tier === 'master' || (!!user.tenant_id && card.tenant_id === user.tenant_id));
    const audit = async (card: any, event_type: string, details: string) => {
      try { await svc.entities.ProjectAuditLog.create({ tenant_id: card.tenant_id, card_id: card.id, event_type, actor_id: user.id, actor_name: by, details }); } catch (_e) { /* 기록 실패가 요청을 막지 않는다 */ }
    };

    if (body.action === 'cancel') {
      const review = typeof body.review_id === 'string' ? await svc.entities.FileReview.get(body.review_id).catch(() => null) : null;
      const card = review ? await svc.entities.TaskCard.get(review.card_id).catch(() => null) : null;
      if (!review || !staffCan(card)) return Response.json({ error: '확인 요청을 찾을 수 없습니다' }, { status: 404 });
      if (review.status !== 'PENDING') return Response.json({ error: '고객이 이미 답했거나 거둔 요청입니다' }, { status: 409 });
      await svc.entities.FileReview.update(review.id, { status: 'CANCELED', decided_by_name: by, decided_at: now });
      await svc.entities.CardAttachment.update(review.attachment_id, { client_review_status: 'CANCELED' }).catch(() => null);
      await audit(card, 'FILE_REVIEW_CANCELED', `${review.file_name || '파일'} 고객 확인 요청을 거둠`);
      return Response.json({ ok: true });
    }

    if (body.action !== 'request') return Response.json({ error: '지원하지 않는 동작입니다' }, { status: 400 });
    const card = typeof body.card_id === 'string' ? await svc.entities.TaskCard.get(body.card_id).catch(() => null) : null;
    if (!staffCan(card)) return Response.json({ error: '카드에 접근할 수 없습니다' }, { status: 403 });
    if (!card.client_id || card.client_visible !== true) return Response.json({ error: '카드를 고객사에 연결하고 고객 공개를 켠 뒤 요청하세요' }, { status: 400 });
    const file = typeof body.attachment_id === 'string' ? await svc.entities.CardAttachment.get(body.attachment_id).catch(() => null) : null;
    if (!file || file.card_id !== card.id || file.tenant_id !== card.tenant_id) return Response.json({ error: '파일을 찾을 수 없습니다' }, { status: 404 });
    if (file.client_review_status === 'PENDING') return Response.json({ error: '이미 고객이 확인 중인 파일입니다' }, { status: 409 });
    if (file.client_approved_at) return Response.json({ error: '고객이 이미 승인한 판입니다. 고친 파일을 올려 새로 요청하세요' }, { status: 409 });
    const checked = reviewRequestPatch(body, { file, today: kstToday(), by, now });
    if (checked.error) return Response.json({ error: checked.error }, { status: 400 });
    // 비교할 이전 판은 같은 카드 파일만
    if (checked.patch.previous_attachment_id) {
      const prev = await svc.entities.CardAttachment.get(checked.patch.previous_attachment_id).catch(() => null);
      if (!prev || prev.card_id !== card.id || prev.id === file.id) checked.patch.previous_attachment_id = '';
    }
    const review = await svc.entities.FileReview.create({ tenant_id: card.tenant_id, company_id: card.client_id, card_id: card.id, ...checked.patch });
    await svc.entities.CardAttachment.update(file.id, { client_visible: true, client_review_id: review.id, client_review_status: 'PENDING' });
    await audit(card, 'FILE_REVIEW_REQUESTED', `${file.file_name || '파일'} 고객 확인 요청${checked.patch.due_date ? ` (기한 ${checked.patch.due_date})` : ''}: ${checked.patch.question}`);
    let sent = 0;
    try {
      sent = await notifyUsers(svc, await clientUsersOfCompany(svc, card.client_id), {
        type: 'file_review_requested',
        title: `[디자인 확인 요청] ${card.title}`,
        body: `${file.file_name || '파일'}을 확인해 주세요.${checked.patch.due_date ? ` 기한 ${checked.patch.due_date}` : ''}\n${checked.patch.question.slice(0, 300)}`,
        link: `/client/dashboard?card=${card.id}&tab=files`,
        task_card_id: card.id,
        card_title: card.title,
      });
    } catch (_e) { /* 알림 실패가 요청을 막지 않는다 */ }
    return Response.json({ ok: true, review_id: review.id, sent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
