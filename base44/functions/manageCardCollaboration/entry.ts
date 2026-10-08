import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { schedulePatch, scheduleDiff, deliveryDate, validDate } from '../../shared/cardSchedule.ts';
import { sendCollaborationEmail } from '../../shared/collaborationEmail.ts';
import { syncCardLedger } from '../../shared/cardLedger.ts';
import { notifyUsers, clientUsersOfCompany } from '../../shared/notify.ts';
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req), user = await base44.auth.me();
    if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    if (user.is_active === false || !['master', 'service', 'sub'].includes(user.account_tier)) return Response.json({ error: '직원만 변경할 수 있습니다.' }, { status: 403 });
    const input = await req.json();
    if (!['initialize', 'schedule', 'payment', 'retry_email', 'notify_holiday', 'milestone_delivery', 'milestone_reset'].includes(input.action) || typeof input.card_id !== 'string' || !input.card_id) return Response.json({ error: '카드와 작업을 지정하세요.' }, { status: 400 });
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
    if (input.action === 'notify_holiday') {
      // 담당자가 조정 납기를 확인한 뒤 고객에게 공휴일 겹침을 안내 (공장 개별 휴무는 고객 비공개)
      const pending = (card.holiday_conflicts || []).filter(c => c.kind === 'holiday' && !c.client_notified_at);
      if (!pending.length) return Response.json({ error: '안내할 휴무 겹침이 없습니다.' }, { status: 400 });
      if (card.client_visible !== true || !card.client_id) return Response.json({ error: '고객 공개 카드만 안내할 수 있습니다.' }, { status: 400 });
      const users = await clientUsersOfCompany(svc, card.client_id);
      const names = pending.map(c => `${c.name}(${c.start}~${c.end})`).join(', ');
      await notifyUsers(svc, users, { type: 'holiday_conflict', title: `[AEGIS] ${card.title} 중국 휴무 일정 안내`, body: `예정 납기가 중국 ${names}과 겹칩니다.\n조정된 예정 납품일: ${card.delivery_date || '미정'}`, link: `/client/board?card=${card.id}`, task_card_id: card.id, card_title: card.title });
      const now = new Date().toISOString();
      await svc.entities.TaskCard.update(card.id, { holiday_conflicts: card.holiday_conflicts.map(c => pending.includes(c) ? { ...c, client_notified_at: now } : c) });
      return Response.json({ sent: users.length });
    }
    const holidays = await svc.entities.ChinaHoliday.list('-start_date', 200);
    if (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 1000) return Response.json({ error: '변경 사유를 1000자 이내로 입력하세요.' }, { status: 400 });
    let lines = [], patch = {}, title = '', kind = '';
    if (input.action === 'schedule') {
      if (!input.expected_updated_date || input.expected_updated_date !== card.updated_date) return Response.json({ error: '다른 변경이 먼저 저장되었습니다. 최신 내용을 다시 불러오세요.' }, { status: 409 });
      if (!input.data || typeof input.data !== 'object' || Array.isArray(input.data)) return Response.json({ error: '일정을 입력하세요.' }, { status: 400 });
      patch = schedulePatch(input.data, holidays);
      // 마일스톤 카드의 납품일은 일정 탭에서만 바꾼다
      if (card.milestone_template_id) Object.assign(patch, { delivery_date: card.delivery_date || '', delivery_date_mode: card.delivery_date_mode || 'AUTO', delivery_business_days: card.delivery_business_days ?? patch.delivery_business_days });
      lines = scheduleDiff(card, patch);
      if (!lines.length) return Response.json({ saved: true, unchanged: true });
      title = `[AEGIS] ${card.title} 일정 변경`; kind = 'SCHEDULE';
    } else if (input.action === 'milestone_delivery') {
      if (!card.plan_confirmed_at) return Response.json({ saved: true, unchanged: true });
      const ms = (await svc.entities.CardMilestone.filter({ card_id: card.id }, 'seq', 100)).filter(m => m.status !== 'skipped');
      const d = ms.find(m => m.key === 'delivery') || ms[ms.length - 1];
      const next = d ? d.actual_date || d.planned_date : '';
      if (!next || next === card.delivery_date) return Response.json({ saved: true, unchanged: true });
      patch = { delivery_date: next, delivery_date_mode: 'MANUAL' };
      lines = scheduleDiff(card, { ...card, ...patch });
      title = `[AEGIS] ${card.title} 예정 납품일 변경`; kind = 'SCHEDULE';
    } else if (input.action === 'milestone_reset') {
      const pre = card.pre_milestone_schedule || {};
      patch = { delivery_date: pre.delivery_date || '', delivery_date_mode: pre.delivery_date_mode || 'AUTO', pre_milestone_schedule: null };
      if (patch.delivery_date_mode === 'AUTO') patch.delivery_date = deliveryDate(card.advance_paid_date, card.delivery_business_days, holidays);
      lines = ['마일스톤 계획을 지우고 다시 만듭니다.', ...scheduleDiff(card, { ...card, ...patch })];
      title = `[AEGIS] ${card.title} 진행 계획 재작성`; kind = 'SCHEDULE';
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
        if (card.delivery_date_mode !== 'MANUAL') patch.delivery_date = deliveryDate(patch.advance_paid_date, card.delivery_business_days, holidays);
        lines.push(...scheduleDiff(card, { ...card, ...patch }));
      }
      await svc.entities.PaymentStage.update(stage.id, { tenant_id: card.tenant_id, approval_status: next, paid_date: input.confirmed ? input.paid_date : '', ...(input.confirmed ? { approved_at: new Date().toISOString(), approved_by_id: user.id, approved_by_name: user.full_name || user.email } : {}) });
      title = `[AEGIS] ${card.title} ${label} ${input.confirmed ? '입금 확인' : '확인 취소'}`; kind = 'PAYMENT';
    }
    if (Object.keys(patch).length) await svc.entities.TaskCard.update(card.id, patch);
    const ledger = kind === 'PAYMENT' ? await syncCardLedger(svc, { ...card, ...patch }) : null;
    const change = await svc.entities.CollaborationChange.create({ tenant_id: card.tenant_id, card_id: card.id, company_id: card.client_id || '', kind, title, body: `${card.title}\n${lines.join('\n')}`, reason: input.reason.trim(), actor_id: user.id, actor_name: user.full_name || user.email, email_status: card.client_visible === true && card.client_id ? 'PENDING' : 'SKIPPED', sent_user_ids: [], email_error: card.client_visible === true && card.client_id ? '' : '비공개 카드 또는 고객사 미연결' });
    // 앱 알림만 생성 (이메일은 CollaborationChange 워크플로가 발송)
    if (card.client_visible === true && card.client_id) {
      try {
        const clients = await clientUsersOfCompany(svc, card.client_id);
        await notifyUsers(svc, clients, { type: kind === 'PAYMENT' ? 'payment_confirmed' : 'schedule_changed', title, body: lines.join('\n').slice(0, 500), link: `/client/board?card=${card.id}`, task_card_id: card.id, card_title: card.title }, { email: false });
      } catch (_e) { /* 알림 실패가 저장을 막지 않는다 */ }
    }
    return Response.json({ saved: true, change_id: change.id, email_status: change.email_status, ledger_id: ledger?.id || null, ledger_status: ledger?.status || null });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}