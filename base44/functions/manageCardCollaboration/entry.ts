import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { schedulePatch, scheduleDiff, deliveryDate, validDate } from '../../shared/cardSchedule.ts';
import { sendCollaborationEmail } from '../../shared/collaborationEmail.ts';
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req), user = await base44.auth.me();
    if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    if (user.is_active === false || !['master', 'service', 'sub'].includes(user.account_tier)) return Response.json({ error: '직원만 변경할 수 있습니다.' }, { status: 403 });
    const input = await req.json();
    if (!['initialize', 'schedule', 'payment', 'retry_email'].includes(input.action) || typeof input.card_id !== 'string' || !input.card_id) return Response.json({ error: '카드와 작업을 지정하세요.' }, { status: 400 });
    const svc = base44.asServiceRole;
    const card = await svc.entities.TaskCard.get(input.card_id);
    if (!card || !card.tenant_id || (user.account_tier !== 'master' && card.tenant_id !== user.tenant_id)) return Response.json({ error: '카드 접근 권한이 없습니다.' }, { status: 403 });
    if (input.action === 'retry_email') {
      if (typeof input.change_id !== 'string') return Response.json({ error: '이력을 지정하세요.' }, { status: 400 });
      const change = await svc.entities.CollaborationChange.get(input.change_id);
      if (!change || change.card_id !== card.id || change.tenant_id !== card.tenant_id) return Response.json({ error: '이력 접근 권한이 없습니다.' }, { status: 403 });
      return Response.json(await sendCollaborationEmail(svc, change));
    }
    if (input.action === 'initialize') {
      const existing = await svc.entities.PaymentStage.filter({ card_id: card.id });
      const missing = ['DOWN_PAYMENT', 'BALANCE_PAYMENT'].filter(type => !existing.some(stage => stage.stage_type === type));
      if (missing.length) await svc.entities.PaymentStage.bulkCreate(missing.map(stage_type => ({ tenant_id: card.tenant_id, card_id: card.id, stage_type, percentage: 50, approval_status: 'PENDING' })));
      return Response.json({ saved: true });
    }
    if (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 1000) return Response.json({ error: '변경 사유를 1000자 이내로 입력하세요.' }, { status: 400 });
    let lines = [], patch = {}, title = '', kind = '';
    if (input.action === 'schedule') {
      if (!input.expected_updated_date || input.expected_updated_date !== card.updated_date) return Response.json({ error: '다른 변경이 먼저 저장되었습니다. 최신 내용을 다시 불러오세요.' }, { status: 409 });
      if (!input.data || typeof input.data !== 'object' || Array.isArray(input.data)) return Response.json({ error: '일정을 입력하세요.' }, { status: 400 });
      patch = schedulePatch(input.data);
      lines = scheduleDiff(card, patch);
      if (!lines.length) return Response.json({ saved: true, unchanged: true });
      title = `[AEGIS] ${card.title} 일정 변경`; kind = 'SCHEDULE';
    } else {
      if (typeof input.stage_id !== 'string' || typeof input.confirmed !== 'boolean') return Response.json({ error: '입금 단계를 확인하세요.' }, { status: 400 });
      const stage = await svc.entities.PaymentStage.get(input.stage_id);
      if (!stage || stage.card_id !== card.id || (stage.tenant_id && stage.tenant_id !== card.tenant_id)) return Response.json({ error: '입금 단계 접근 권한이 없습니다.' }, { status: 403 });
      if (input.expected_updated_date !== stage.updated_date) return Response.json({ error: '입금 상태가 변경되었습니다. 다시 불러오세요.' }, { status: 409 });
      const next = input.confirmed ? 'APPROVED' : 'PENDING';
      if (stage.approval_status === next) return Response.json({ saved: true, unchanged: true });
      if (input.confirmed && !validDate(input.paid_date)) return Response.json({ error: '실제 입금일을 입력하세요.' }, { status: 400 });
      const label = { DOWN_PAYMENT: '선금', INTERIM_PAYMENT: '중도금', BALANCE_PAYMENT: '잔금' }[stage.stage_type];
      lines = [`${label} ${stage.percentage}%: ${stage.approval_status === 'APPROVED' ? '입금 확인' : '미확인'} → ${input.confirmed ? '입금 확인' : '확인 취소'}`];
      if (stage.stage_type === 'DOWN_PAYMENT') {
        patch.advance_paid_date = input.confirmed ? input.paid_date : '';
        if (card.delivery_date_mode !== 'MANUAL') patch.delivery_date = deliveryDate(patch.advance_paid_date, card.delivery_business_days);
        lines.push(...scheduleDiff(card, { ...card, ...patch }));
      }
      await svc.entities.PaymentStage.update(stage.id, { tenant_id: card.tenant_id, approval_status: next, paid_date: input.confirmed ? input.paid_date : '', ...(input.confirmed ? { approved_at: new Date().toISOString(), approved_by_id: user.id, approved_by_name: user.full_name || user.email } : {}) });
      title = `[AEGIS] ${card.title} ${label} ${input.confirmed ? '입금 확인' : '확인 취소'}`; kind = 'PAYMENT';
    }
    if (Object.keys(patch).length) await svc.entities.TaskCard.update(card.id, patch);
    const change = await svc.entities.CollaborationChange.create({ tenant_id: card.tenant_id, card_id: card.id, company_id: card.client_id || '', kind, title, body: `${card.title}\n${lines.join('\n')}`, reason: input.reason.trim(), actor_id: user.id, actor_name: user.full_name || user.email, email_status: card.client_visible === true && card.client_id ? 'PENDING' : 'SKIPPED', sent_user_ids: [], email_error: card.client_visible === true && card.client_id ? '' : '비공개 카드 또는 고객사 미연결' });
    return Response.json({ saved: true, change_id: change.id, email_status: change.email_status });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}