import { barTone } from '@/lib/gantt';

export const ds = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// 월~일 7열 그리드 (5~6주)
export function monthGrid(month) {
  const [y, mo] = month.split('-').map(Number);
  const first = new Date(y, mo - 1, 1);
  const start = new Date(y, mo - 1, 1 - first.getDay()); // 일요일 시작
  const last = new Date(y, mo, 0);
  const days = [];
  for (let d = new Date(start); d <= last || days.length % 7; d.setDate(d.getDate() + 1)) {
    days.push({ key: ds(d), day: d.getDate(), inMonth: d.getMonth() === mo - 1 });
  }
  return days;
}

export const shiftMonth = (month, n) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return ds(d).slice(0, 7);
};

export function holidayOn(holidays, key) {
  const h = holidays.find((x) => x.start_date <= key && key <= x.end_date);
  return {
    name: h?.name,
    makeup: holidays.some((x) => (x.makeup_workdays || []).includes(key)),
    cutoff: holidays.some((x) => x.order_cutoff_date === key),
  };
}

// 단계 → 달력 칩 (점선 칩 = 원래 계획일)
export function buildEvents(milestones, cardsById, holidays, closures = []) {
  const out = [];
  milestones.forEach((m) => {
    const card = cardsById[m.card_id];
    if (!card || m.status === 'skipped') return;
    const date = m.status === 'done' ? m.actual_date : m.planned_date;
    if (!date) return;
    const closed = closures.some((c) => c.factory_id && c.factory_id === card.factory_id && c.start_date <= date && date <= c.end_date);
    const conflict = m.status !== 'done' && (!!holidayOn(holidays, date).name || closed);
    out.push({ id: m.id, date, m, card, tone: barTone(m), conflict });
    if (m.baseline_date && m.planned_date && m.baseline_date !== m.planned_date) {
      out.push({ id: `${m.id}-b`, date: m.baseline_date, m, card, ghost: true });
    }
  });
  return out;
}