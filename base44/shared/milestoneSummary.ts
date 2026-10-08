// 마일스톤 → 카드 요약값 (src/lib/milestones.js 의 cardSummary 와 같은 규칙)
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export function deliveryMilestone(list: any[]) {
  const live = list.filter((m) => m.status !== 'skipped');
  return live.find((m) => m.key === 'delivery') || [...live].sort((a, b) => a.seq - b.seq).pop() || null;
}

// 완료: 실제일 − 기준일 / 미완료: max(계획일, 오늘) − 기준일
export function delayDays(m: any, today: string) {
  if (!m?.baseline_date) return 0;
  if (m.status === 'done') return m.actual_date ? days(m.baseline_date, m.actual_date) : 0;
  const ref = m.planned_date && m.planned_date > today ? m.planned_date : today;
  return days(m.baseline_date, ref);
}

export function cardSummary(list: any[], today: string, confirmed: boolean) {
  const sorted = [...list].sort((a, b) => a.seq - b.seq);
  const current = sorted.find((m) => m.status !== 'done' && m.status !== 'skipped');
  const delivery = deliveryMilestone(sorted);
  return {
    current_milestone_label: current?.label || '완료',
    current_milestone_label_cn: current ? (current.label_cn || current.label) : '完成',
    delay_days: confirmed && delivery ? Math.max(0, delayDays(delivery, today)) : 0,
    overdue_steps: confirmed ? sorted.filter((m) => m.status === 'pending' || m.status === 'in_progress').filter((m) => m.planned_date && m.planned_date < today).length : 0,
  };
}