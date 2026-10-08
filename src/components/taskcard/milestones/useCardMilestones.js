import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { MILESTONE_TEMPLATES, buildPlan, delayDays, countWorkdays } from '@/lib/milestones';
import { addWorkdays, isWorkday } from '@/lib/chinaHolidays';

export default function useCardMilestones(card) {
  const qc = useQueryClient();
  const key = ['card-milestones', card.id];
  const { data: list = [], isLoading } = useQuery({ queryKey: key, queryFn: () => base44.entities.CardMilestone.filter({ card_id: card.id }, 'seq', 100) });
  const { data: holidays = [] } = useQuery({ queryKey: ['china-holidays'], queryFn: () => base44.entities.ChinaHoliday.list('-start_date', 200) });

  // 카드 요약값(현재 단계·지연·납품일) 동기화
  const syncCard = async (items) => {
    const sorted = [...items].sort((a, b) => a.seq - b.seq);
    const current = sorted.find((m) => m.status !== 'done' && m.status !== 'skipped');
    const last = sorted[sorted.length - 1];
    await base44.entities.TaskCard.update(card.id, {
      current_milestone_label: current?.label || '완료',
      delay_days: last ? Math.max(0, delayDays(last)) : 0,
      ...(last?.planned_date ? { delivery_date: last.actual_date || last.planned_date, delivery_date_mode: 'MANUAL' } : {}),
    });
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ['task-cards'] });
  };

  const create = async (tplKey, start) => {
    const plan = buildPlan(MILESTONE_TEMPLATES[tplKey].steps, start, holidays);
    const rows = await base44.entities.CardMilestone.bulkCreate(plan.map((p) => ({
      ...p, tenant_id: card.tenant_id, card_id: card.id, client_id: card.client_id, template_key: tplKey, status: 'pending',
    })));
    await base44.entities.TaskCard.update(card.id, { milestone_template_id: tplKey, plan_confirmed_at: null });
    await syncCard(rows);
  };

  const update = async (m, patch) => {
    await base44.entities.CardMilestone.update(m.id, patch);
    await syncCard(list.map((x) => (x.id === m.id ? { ...x, ...patch } : x)));
  };

  const confirm = async () => {
    await base44.entities.CardMilestone.bulkUpdate(list.map((m) => ({ id: m.id, baseline_date: m.planned_date })));
    await base44.entities.TaskCard.update(card.id, { plan_confirmed_at: new Date().toISOString() });
    await syncCard(list.map((m) => ({ ...m, baseline_date: m.planned_date })));
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
    await syncCard(next);
  };

  const reset = async () => {
    await base44.entities.CardMilestone.deleteMany({ card_id: card.id });
    await base44.entities.TaskCard.update(card.id, { milestone_template_id: null, plan_confirmed_at: null, current_milestone_label: null, delay_days: 0 });
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ['task-cards'] });
  };

  return { list, isLoading, create, update, confirm, complete, reset };
}