// 중국 휴무 계산 공용 규칙 (프런트 src/lib/chinaHolidays.js 와 동일하게 유지)
const DAY = 86400000;
export const shiftDate = (s: string, n: number) => new Date(Date.parse(s + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
export const kstToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

// 공장이 실제로 쉬는 기간 = 공식 휴일 앞뒤로 factory_extra_days 만큼 확장
export function holidayRange(h) {
  const x = Number(h.factory_extra_days) || 0;
  return { start: shiftDate(h.start_date, -x), end: shiftDate(h.end_date, x) };
}

// 조휴 근무일은 근무, 휴무 기간은 휴무, 그 외 일요일만 휴무
export function isWorkday(date: string, holidays = []) {
  if (holidays.some((h) => (h.makeup_workdays || []).includes(date))) return true;
  if (holidays.some((h) => { const r = holidayRange(h); return date >= r.start && date <= r.end; })) return false;
  return new Date(date + 'T00:00:00Z').getUTCDay() !== 0;
}

export const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) => aStart <= bEnd && bStart <= aEnd;