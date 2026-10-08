// 중국 휴무 계산 규칙 (백엔드 base44/shared/chinaHoliday.ts 와 동일하게 유지)
const DAY = 86400000;
const shiftDate = (s, n) => new Date(Date.parse(s + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);

export function holidayRange(h) {
  const x = Number(h.factory_extra_days) || 0;
  return { start: shiftDate(h.start_date, -x), end: shiftDate(h.end_date, x) };
}

export function isWorkday(date, holidays = []) {
  if (holidays.some((h) => (h.makeup_workdays || []).includes(date))) return true;
  if (holidays.some((h) => { const r = holidayRange(h); return date >= r.start && date <= r.end; })) return false;
  return new Date(date + 'T00:00:00Z').getUTCDay() !== 0;
}

// 입금일 다음 날부터 근무일만 센 납품일
export function addWorkdays(start, days, holidays = []) {
  const date = new Date(start + 'T00:00:00Z');
  for (let n = days; n > 0;) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (isWorkday(date.toISOString().slice(0, 10), holidays)) n--;
  }
  return date.toISOString().slice(0, 10);
}