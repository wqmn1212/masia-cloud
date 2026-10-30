// 재주문 예측 (3단계 F). 견적이 아니라 '예상'이다: 이미 고객에게 공개된 확정 도착 원가와 지난 주문의 발주→도착 일수만 쓴다.
//  reorderForecast — 수량을 넣으면 개당·합계 예상 범위와 예상 도착일
//  orderTiming     — 재고·월 사용량으로 예상 소진일, 주문 권장일, 알림일
// 서버 base44/shared/reorderForecast.ts 와 같은 규칙 (화면용 사본). 검산: npm run check:reorder-forecast
export const ARRIVED = ['ARRIVED', 'CUSTOMS', 'CLEARED', 'DELIVERED'];
const DAY = 86400000;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
export const addDays = (ymd, days) => new Date(Date.parse(`${ymd}T00:00:00Z`) + Math.round(days) * DAY).toISOString().slice(0, 10);
export const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
// 1,000원 미만(소모품)은 소수 둘째 자리까지 (orderCost.js roundUnit 과 같다)
const roundUnit = (v) => (Math.abs(v) < 1000 ? Math.round(v * 100) / 100 : Math.round(v));

const BASE_SPREAD = 0.05;
const MAX_SPREAD = 0.3;
const QTY_SPREAD = 0.1;
const LEAD_PAD = 7;

// 지난 주문 한 건의 발주→도착 일수: 선금 입금일(없으면 주문일) → 마지막 선적의 실제 도착일
export function leadDays(card, shipments, orderDate = '') {
  const start = card?.advance_paid_date || orderDate;
  const arrived = (shipments || []).filter((s) => ARRIVED.includes(s.status) && s.ata).map((s) => s.ata).sort();
  if (!start || !arrived.length) return null;
  const d = daysBetween(start, arrived[arrived.length - 1]);
  return d > 0 ? d : null;
}

// 기간 [from, to] 와 겹치는 중국 공장 휴무 (holidays: { name, factory_start, factory_end, order_cutoff_date })
export function overlappingHoliday(holidays, from, to) {
  const hit = (holidays || []).filter((h) => h.factory_start && h.factory_end && h.factory_start <= to && h.factory_end >= from)
    .sort((a, b) => a.factory_start.localeCompare(b.factory_start))[0];
  if (!hit) return null;
  const s = hit.factory_start > from ? hit.factory_start : from;
  const e = hit.factory_end < to ? hit.factory_end : to;
  return { name: hit.name || '중국 휴무', factory_start: hit.factory_start, factory_end: hit.factory_end, order_cutoff_date: hit.order_cutoff_date || '', days: daysBetween(s, e) + 1 };
}

/**
 * orders: 같은 상품의 확정 원가 기록 (주문일 순) { order_date, units, per_unit_krw, goods_krw, logistics_krw, other_krw, goods_foreign, lead_days }
 * quantity: 이번 수량 · krwPerNow: { USD, CNY } 지금 환율(1단위 = 원) · today: 한국 날짜 · holidays: 공장 휴무
 */
export function reorderForecast({ orders = [], quantity, krwPerNow = {}, today, holidays = [] }) {
  const list = (orders || []).filter((o) => num(o.units) > 0 && num(o.per_unit_krw) > 0);
  const qty = Math.round(num(quantity));
  if (!list.length || qty <= 0) return null;
  const last = list[list.length - 1];
  const units = num(last.units);
  const reasons = [];

  // 상품 대금은 외화 기준이면 지금 환율로 다시 계산하고, 물류·기타는 지난번 개당 금액을 쓴다
  let goodsU = num(last.goods_krw) / units;
  const restU = (num(last.logistics_krw) + num(last.other_krw)) / units;
  let fx = null;
  const cur = last.goods_foreign?.currency;
  const fxThen = cur && num(last.goods_foreign.amount) > 0 ? num(last.goods_krw) / num(last.goods_foreign.amount) : 0;
  const fxNow = cur ? num(krwPerNow[cur]) : 0;
  if (fxThen > 0 && fxNow > 0) {
    goodsU = goodsU * (fxNow / fxThen);
    fx = { currency: cur, then: Math.round(fxThen * 100) / 100, now: Math.round(fxNow * 100) / 100 };
  } else if (cur && cur !== 'KRW') reasons.push('지금 환율을 알 수 없어 지난번 환율로 계산했습니다');
  const goodsOrRest = goodsU + restU;
  const mid = goodsOrRest > 0 ? goodsOrRest : num(last.per_unit_krw);

  // 범위: 기본 ±5%, 최근 주문들 사이 개당 원가가 더 흔들렸으면 그만큼, 수량이 지난번의 절반 이하·두 배 이상이면 더 넓게
  let spread = BASE_SPREAD;
  const recent = list.slice(-4).map((o) => num(o.per_unit_krw));
  if (recent.length >= 2) {
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    spread = Math.max(spread, (Math.max(...recent) - Math.min(...recent)) / avg / 2);
  }
  const ratio = qty / units;
  if (ratio >= 2 || ratio <= 0.5) {
    spread += QTY_SPREAD;
    reasons.push(`수량이 지난번(${units.toLocaleString('ko-KR')})과 크게 달라 공장 단가와 개당 물류비가 달라질 수 있습니다`);
  }
  spread = Math.min(MAX_SPREAD, Math.round(spread * 1000) / 1000);
  const per = { low: roundUnit(mid * (1 - spread)), mid: roundUnit(mid), high: roundUnit(mid * (1 + spread)) };

  // 도착: 지난 주문들의 발주→도착 일수. 한 번뿐이면 ±7일, 중국 휴무가 걸리면 그만큼 늦춘다
  const leads = list.map((o) => num(o.lead_days)).filter((d) => d > 0);
  let lead = null, eta = null, holiday = null;
  if (leads.length && today) {
    const avg = Math.round(leads.reduce((a, b) => a + b, 0) / leads.length);
    const lo = leads.length > 1 ? Math.min(...leads) : Math.max(1, avg - LEAD_PAD);
    const hi = leads.length > 1 ? Math.max(...leads) : avg + LEAD_PAD;
    lead = { days: avg, min: lo, max: hi, orders: leads.length };
    holiday = overlappingHoliday(holidays, today, addDays(today, hi));
    const extra = holiday ? holiday.days : 0;
    eta = { low: addDays(today, lo + extra), high: addDays(today, hi + extra) };
  }

  return {
    quantity: qty,
    per_unit: per,
    total: { low: Math.round(per.low * qty), high: Math.round(per.high * qty) },
    spread,
    basis: { order_date: last.order_date || '', units, per_unit_krw: num(last.per_unit_krw) },
    fx, lead, eta, holiday, reasons,
  };
}

/**
 * 재고·월 사용량으로 주문 시점: 재고가 안전재고에 닿는 날 − 지난 발주→도착 일수 = 주문 권장일, 그 2주 전에 알린다.
 * 그 사이에 중국 휴무가 걸리면 휴무 기간만큼 앞당기고 발주 마감일을 함께 알린다.
 * 입고 예정 수량은 재고에 더하고, 안전재고(주)를 적지 않으면 0 (소진일 기준 — 3단계와 같다).
 * 권장 발주량 = 월 사용량 × 발주 주기(기본 3개월), MOQ가 더 크면 MOQ (몇 개월치인지 함께).
 * 권장일이 지났으면 항공으로 바꿀 때 운송이 약 9일 줄어 언제까지 주문하면 되는지 보여 준다 (해상 LCL 14일 → 항공 5일).
 */
export const ALERT_DAYS_BEFORE = 14;
export const DEFAULT_CYCLE_MONTHS = 3;
export const AIR_SAVING_DAYS = 9;
export function orderTiming({ stock_qty, monthly_usage, stock_as_of, lead_days, today, holidays = [], incoming_qty = 0, safety_weeks = 0, cycle_months = 0, moq = 0 }) {
  const usage = num(monthly_usage);
  const stock = num(stock_qty);
  if (usage <= 0 || stock < 0 || !stock_as_of) return null;
  const daily = usage / 30;
  const have = stock + Math.max(0, num(incoming_qty));
  const safety = Math.round(daily * Math.max(0, num(safety_weeks)) * 7);
  const runout = addDays(stock_as_of, have / daily);
  const reorderPoint = addDays(stock_as_of, Math.max(0, have - safety) / daily);
  const cycle = num(cycle_months) > 0 ? num(cycle_months) : DEFAULT_CYCLE_MONTHS;
  const minQty = Math.max(0, Math.round(num(moq)));
  const base = Math.ceil(usage * cycle);
  const recommended_qty = Math.max(base, minQty);
  const moq_months = minQty > base ? Math.round((minQty / usage) * 10) / 10 : null;
  const lead = Math.round(num(lead_days));
  const extra = { safety_qty: safety, recommended_qty, moq_months };
  if (lead <= 0) return { runout, order_by: null, alert_on: null, holiday: null, overdue: false, no_lead: true, air: null, ...extra };
  let orderBy = addDays(reorderPoint, -lead);
  const holiday = overlappingHoliday(holidays, orderBy, reorderPoint);
  if (holiday) orderBy = addDays(orderBy, -holiday.days);
  const overdue = !!today && today > orderBy;
  const airBy = addDays(orderBy, AIR_SAVING_DAYS);
  return {
    runout,
    order_by: orderBy,
    alert_on: addDays(orderBy, -ALERT_DAYS_BEFORE),
    holiday,
    overdue,
    no_lead: false,
    air: overdue ? { saving_days: AIR_SAVING_DAYS, order_by: airBy, still_possible: today <= airBy } : null,
    ...extra,
  };
}
