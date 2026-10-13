// 마일스톤 → 간트 막대. 시작 = 직전 단계 종료일(첫 단계는 카드 생성일), 종료 = 완료일 또는 계획일.
const DAY = 86400000;
const toMs = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).getTime() : null);
// 로컬(한국) 기준 오늘 날짜 YYYY-MM-DD
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const endOf = (m) => m.actual_date || m.planned_date || '';

export function buildBars(milestones, fallbackStart) {
  const sorted = [...milestones].filter((m) => m.status !== 'skipped').sort((a, b) => a.seq - b.seq);
  let prev = fallbackStart ? String(fallbackStart).slice(0, 10) : '';
  return sorted.map((m) => {
    const end = endOf(m);
    const start = prev && end && prev <= end ? prev : end;
    if (end) prev = end;
    return { m, start, end };
  });
}

export function rangeOf(barGroups) {
  const all = barGroups.flat().flatMap((b) => [toMs(b.start), toMs(b.end)]).filter(Boolean);
  const today = toMs(todayStr());
  if (!all.length) return { min: today - 7 * DAY, max: today + 30 * DAY };
  return { min: Math.min(...all, today) - 2 * DAY, max: Math.max(...all, today) + 3 * DAY };
}

export const pct = (d, { min, max }) => ((toMs(d) - min) / (max - min)) * 100;
export const todayPct = (range) => pct(todayStr(), range);

export function monthTicks({ min, max }) {
  const out = [];
  const d = new Date(min); d.setDate(1);
  while (d.getTime() <= max) {
    if (d.getTime() >= min) out.push({ label: `${d.getMonth() + 1}월`, left: ((d.getTime() - min) / (max - min)) * 100 });
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

export function barTone(m) {
  if (m.status === 'done') return 'bg-primary';
  if (m.planned_date && m.planned_date < todayStr()) return 'bg-destructive';
  if (m.status === 'in_progress') return 'bg-chart-2';
  return 'bg-primary/35';
}