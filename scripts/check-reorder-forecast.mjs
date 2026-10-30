// 재주문 예측 검산: 지금 환율로 상품 대금 다시 계산, 범위(기본·변동·수량), 발주→도착 일수와 휴무, 주문 시점, 화면 사본 일치.
// 실행: npm run check:reorder-forecast
import assert from 'node:assert/strict';
import * as S from '../base44/shared/reorderForecast.ts';
import * as F from '../src/lib/reorderForecast.js';

const orders = [
  { order_date: '2026-03-02', units: 3000, per_unit_krw: 1180, goods_krw: 3000000, logistics_krw: 450000, other_krw: 90000, goods_foreign: { currency: 'USD', amount: 2300 }, lead_days: 52 },
  { order_date: '2026-07-01', units: 3000, per_unit_krw: 1230, goods_krw: 3150000, logistics_krw: 480000, other_krw: 60000, goods_foreign: { currency: 'USD', amount: 2300 }, lead_days: 58 },
];
const today = '2026-10-29';
const f = S.reorderForecast({ orders, quantity: 3000, krwPerNow: { USD: 1400 }, today });
// 지난번 환율 3,150,000 / 2,300 = 1369.57 → 지금 1,400: 상품 1050 × 1400/1369.57 = 1073.3 + 물류·기타 180 = 1253.3
assert.equal(f.fx.currency, 'USD');
assert.equal(f.per_unit.mid, 1253);
assert.equal(f.spread, 0.05, '두 주문 차이(약 2%)보다 기본 범위가 크다');
assert.deepEqual([f.per_unit.low, f.per_unit.high], [1191, 1316]);
assert.equal(f.total.low, 1191 * 3000);
assert.deepEqual(f.lead, { days: 55, min: 52, max: 58, orders: 2 });
assert.deepEqual(f.eta, { low: '2026-12-20', high: '2026-12-26' });
assert.equal(f.reasons.length, 0);

const big = S.reorderForecast({ orders, quantity: 10000, krwPerNow: { USD: 1400 }, today });
assert.equal(big.spread, 0.15, '수량이 세 배 → 범위를 넓힌다');
assert.match(big.reasons[0], /수량이 지난번/);
const noFx = S.reorderForecast({ orders, quantity: 3000, krwPerNow: {}, today });
assert.equal(noFx.fx, null);
assert.match(noFx.reasons[0], /환율/);
assert.equal(noFx.per_unit.mid, 1230, '환율이 없으면 지난번 개당 원가');
const wobbly = S.reorderForecast({ orders: [{ ...orders[0], per_unit_krw: 1000 }, orders[1]], quantity: 3000, krwPerNow: { USD: 1400 }, today });
assert.equal(wobbly.spread, 0.103, '최근 주문 사이 흔들림만큼 넓힌다');
assert.equal(S.reorderForecast({ orders, quantity: 0, today }), null);
assert.equal(S.reorderForecast({ orders: [], quantity: 10, today }), null);
const single = S.reorderForecast({ orders: [orders[1]], quantity: 3000, krwPerNow: { USD: 1400 }, today });
assert.deepEqual([single.lead.min, single.lead.max], [51, 65], '한 번뿐이면 ±7일');

// 휴무가 걸리면 도착을 늦춘다
const holidays = [{ name: '춘절', factory_start: '2026-12-10', factory_end: '2026-12-20', order_cutoff_date: '2026-11-25' }];
const h = S.reorderForecast({ orders, quantity: 3000, krwPerNow: { USD: 1400 }, today, holidays });
assert.equal(h.holiday.name, '춘절');
assert.equal(h.holiday.days, 11);
assert.equal(h.eta.low, '2026-12-31');

// 발주→도착 일수
assert.equal(S.leadDays({ advance_paid_date: '2026-07-01' }, [{ status: 'DELIVERED', ata: '2026-08-28' }, { status: 'ARRIVED', ata: '2026-08-20' }]), 58);
assert.equal(S.leadDays({}, [{ status: 'DELIVERED', ata: '2026-08-28' }], '2026-07-05'), 54, '선금일이 없으면 주문일');
assert.equal(S.leadDays({ advance_paid_date: '2026-07-01' }, [{ status: 'DEPARTED', ata: '' }]), null);

// 주문 시점: 재고 9,000 · 월 3,000 → 90일 뒤 소진, 55일 전 주문, 그 2주 전 알림
const t = S.orderTiming({ stock_qty: 9000, monthly_usage: 3000, stock_as_of: '2026-10-01', lead_days: 55, today });
assert.deepEqual({ runout: t.runout, order_by: t.order_by, alert_on: t.alert_on, overdue: t.overdue }, { runout: '2026-12-30', order_by: '2026-11-05', alert_on: '2026-10-22', overdue: false });
const th = S.orderTiming({ stock_qty: 9000, monthly_usage: 3000, stock_as_of: '2026-10-01', lead_days: 55, today, holidays });
assert.equal(th.order_by, '2026-10-25', '휴무 11일만큼 앞당긴다');
assert.equal(th.holiday.order_cutoff_date, '2026-11-25');
assert.equal(th.overdue, true, '권장일이 지났다');
assert.equal(S.orderTiming({ stock_qty: 10, monthly_usage: 0, stock_as_of: today, lead_days: 30, today }), null);
assert.equal(S.orderTiming({ stock_qty: 100, monthly_usage: 50, stock_as_of: today, lead_days: 0, today }).no_lead, true);

// 발주 플래너 (4단계): 안전재고·입고 예정·권장 발주량·MOQ·항공 대안. 적지 않으면 3단계와 같다
assert.equal(t.safety_qty, 0);
assert.equal(t.recommended_qty, 9000, '월 3,000 × 기본 3개월');
assert.equal(t.air, null, '권장일 전이면 항공 안내 없음');
const ts = S.orderTiming({ stock_qty: 9000, monthly_usage: 3000, stock_as_of: '2026-10-01', lead_days: 55, today, safety_weeks: 2 });
assert.deepEqual([ts.safety_qty, ts.runout, ts.order_by], [1400, '2026-12-30', '2026-10-22'], '안전재고 1,400(2주)에 닿는 12/16에 도착하도록');
const ti = S.orderTiming({ stock_qty: 9000, monthly_usage: 3000, stock_as_of: '2026-10-01', lead_days: 55, today, incoming_qty: 3000 });
assert.deepEqual([ti.runout, ti.order_by], ['2027-01-29', '2026-12-05'], '입고 예정은 재고에 더한다');
const tm = S.orderTiming({ stock_qty: 9000, monthly_usage: 3000, stock_as_of: '2026-10-01', lead_days: 55, today, cycle_months: 2, moq: 20000 });
assert.deepEqual([tm.recommended_qty, tm.moq_months], [20000, 6.7], 'MOQ가 2개월치보다 크면 MOQ, 약 6.7개월치');
assert.equal(S.orderTiming({ stock_qty: 9000, monthly_usage: 3000, stock_as_of: '2026-10-01', lead_days: 55, today, cycle_months: 2 }).recommended_qty, 6000);
assert.deepEqual(th.air, { saving_days: 9, order_by: '2026-11-03', still_possible: today <= '2026-11-03' }, '권장일이 지나면 항공(운송 약 9일 단축) 기준 마감');
assert.equal(S.orderTiming({ stock_qty: 100, monthly_usage: 50, stock_as_of: today, lead_days: 0, today }).recommended_qty, 150, '도착 일수를 몰라도 권장 발주량은 낸다');

// 화면 사본
for (const args of [{ orders, quantity: 3000, krwPerNow: { USD: 1400 }, today, holidays }, { orders, quantity: 10000, krwPerNow: {}, today }]) assert.deepEqual(F.reorderForecast(args), S.reorderForecast(args));
assert.deepEqual(F.orderTiming({ stock_qty: 9000, monthly_usage: 3000, stock_as_of: '2026-10-01', lead_days: 55, today, holidays }), th);
for (const extra of [{ safety_weeks: 2 }, { incoming_qty: 3000, moq: 20000, cycle_months: 2 }]) assert.deepEqual(F.orderTiming({ stock_qty: 9000, monthly_usage: 3000, stock_as_of: '2026-10-01', lead_days: 55, today, holidays, ...extra }), S.orderTiming({ stock_qty: 9000, monthly_usage: 3000, stock_as_of: '2026-10-01', lead_days: 55, today, holidays, ...extra }));
console.log('reorder-forecast: 재주문 예측 검산 통과');
