import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { MILESTONE_TEMPLATES, buildPlan, cardSummary, deliveryMilestone, countWorkdays } from '@/lib/milestones';
import { addWorkdays, isWorkday } from '@/lib/chinaHolidays';

const askReason = (fallback) => fallback || window.prompt('예정 납품일이 바뀝니다. 변경 사유를 입력하세요 (고객 공개 카드는 고객에게 안내됩니다).') || '마일스톤 일정 조정';

export default function useCardMilestones(card) {
  const qc = useQueryClient();
  const key = ['card-milestones', card.id];
  const { data: list = [], isLoading } = useQuery({ queryKey: key, queryFn: () => base44.entities.CardMilestone.filter({ card_id: card.id }, 'seq', 100) });
  const { data: holidays = [] } = useQuery({ queryKey: ['china-holidays'], queryFn: () => base44.entities.ChinaHoliday.list('-start_date', 200) });

  const refresh = () => ['task-cards', 'card-schedule', 'collaboration-history', 'client-card-detail'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  // 카드 요약값 동기화. 납품일은 확정 후에만, 서버 경로(이력·고객 알림)로 반영한다.
  const syncCard = async (items, confirmed, reason) => {
    await base44.entities.TaskCard.update(card.id, cardSummary(items, confirmed));
    if (confirmed) {
      const d = deliveryMilestone(items);
      const next = d ? d.actual_date || d.planned_date : '';
      if (next && next !== card.delivery_date) {
        await base44.functions.invoke('manageCardCollaboration', { action: 'milestone_delivery', card_id: card.id, reason: askReason(reason ?? d.delay_reason) });
      }
    }
    qc.invalidateQueries({ queryKey: key });
    refresh();
  };

  const create = async (tplKey, start, includeOptional) => {
    const steps = MILESTONE_TEMPLATES[tplKey].steps.filter((st) => includeOptional || !st.optional);
    const plan = buildPlan(steps, start, holidays);
    const rows = await base44.entities.CardMilestone.bulkCreate(plan.map((p) => ({
      ...p, tenant_id: card.tenant_id, card_id: card.id, client_id: card.client_id, template_key: tplKey, status: 'pending',
    })));
    await base44.entities.TaskCard.update(card.id, {
      milestone_template_id: tplKey, plan_confirmed_at: null,
      pre_milestone_schedule: { delivery_date: card.delivery_date || '', delivery_date_mode: card.delivery_date_mode || 'AUTO' },
    });
    await syncCard(rows, false);
  };

  const confirmed = !!card.plan_confirmed_at;

  const update = async (m, patch) => {
    await base44.entities.CardMilestone.update(m.id, patch);
    if ('planned_date' in patch || 'status' in patch) await syncCard(list.map((x) => (x.id === m.id ? { ...x, ...patch } : x)), confirmed);
    else qc.invalidateQueries({ queryKey: key });
  };

  const confirm = async () => {
    await base44.entities.CardMilestone.bulkUpdate(list.map((m) => ({ id: m.id, baseline_date: m.planned_date })));
    await base44.entities.TaskCard.update(card.id, { plan_confirmed_at: new Date().toISOString() });
    await syncCard(list.map((m) => ({ ...m, baseline_date: m.planned_date })), true, '마일스톤 계획 확정');
  };

  // 완료: 계획보다 늦으면 뒤 단계를 같은 근무일 수만큼 민다
  const complete = async (m, actual, shift, qcId) => {
    if (qcId) await base44.entities.CardMilestone.update(m.id, { qc_report_id: qcId });
    const late = m.planned_date && actual > m.planned_date ? countWorkdays(m.planned_date, actual, (d) => isWorkday(d, holidays)) : 0;
    const next = list.map((x) => {
      if (x.id === m.id) return { ...x, status: 'done', actual_date: actual };
      if (shift && late && x.seq > m.seq && x.status !== 'done' && x.planned_date) return { ...x, planned_date: addWorkdays(x.planned_date, late, holidays) };
      return x;
    });
    await base44.entities.CardMilestone.bulkUpdate(next.filter((x) => x.id === m.id || (x.planned_date !== list.find((o) => o.id === x.id).planned_date))
      .map((x) => ({ id: x.id, status: x.status, actual_date: x.actual_date || null, planned_date: x.planned_date })));
    await syncCard(next, confirmed, late ? m.delay_reason || null : undefined);
  };

  const reset = async () => {
    await base44.entities.CardMilestone.deleteMany({ card_id: card.id });
    await base44.entities.TaskCard.update(card.id, { milestone_template_id: null, plan_confirmed_at: null, current_milestone_label: null, delay_days: 0, overdue_steps: 0 });
    // 확정 후 다시 만들기: 원래 납품일·방식으로 되돌리고 이력을 남긴다
    if (confirmed) await base44.functions.invoke('manageCardCollaboration', { action: 'milestone_reset', card_id: card.id, reason: '마일스톤 계획 다시 만들기' });
    qc.invalidateQueries({ queryKey: key });
    refresh();
  };

  return { list, isLoading, create, update, confirm, complete, reset };
}