// 상품별 도착 원가 검산: 결제 단계별 환율, 선적 도착 비용, 개당 원가, 직전 주문 대비 변동 원인을 확인한다.
// 실행: npm run check:order-cost
import assert from 'node:assert/strict';
import { buildPrefill, summarize, explainChange, groupByProduct, rootCardId, rateOn, krwPer, quoteUnits, LINE_KIND, LINE_SOURCE } from '../src/lib/orderCost.js';

const rates = [
  { rate_date: '2026-03-02', usd_krw: 1380, cny_krw: 190, usd_cny: 7.26 },
  { rate_date: '2026-03-20', usd_krw: 1390, cny_krw: 191.5, usd_cny: 7.26 },
  { rate_date: '2026-08-03', usd_krw: 1420, cny_krw: 196, usd_cny: 7.24 },
  { rate_date: '2026-08-25', usd_krw: 1435, cny_krw: 198, usd_cny: 7.25 },
];

// ── 환율 찾기 ──
assert.equal(rateOn(rates, '2026-03-10').usd_krw, 1380);
assert.equal(rateOn(rates, '2026-03-20').usd_krw, 1390, '같은 날 기록을 쓴다');
assert.equal(rateOn(rates, '2026-01-01').usd_krw, 1380, '기록보다 이르면 가장 오래된 것');
assert.equal(rateOn([], '2026-03-10'), null);
assert.equal(krwPer('KRW', null), 1);
assert.equal(krwPer('CNY', { usd_krw: 1400, usd_cny: 7 }), 200, 'CNY 환율이 없으면 USD 교차');

// ── 1차 주문: 테이블 상판 500개, USD 견적, 선금 30% / 잔금 70% 모두 입금, 실제 도착 비용 확정 ──
const q1 = { id: 'q1', rounding_version: 2, final_total: 10000, final_currency: 'USD', exchange_rate_usd: 1375, exchange_rate_usd_cny: 7.2,
  price_lines: [{ option_name: '테이블 상판 1200×600', specification: '멜라민', quantity: 500, unit_price: 19, total: 9500 }, { option_name: '포장비', quantity: 1, unit_price: 500, total: 500 }] };
assert.equal(quoteUnits(q1), 500, '금액이 가장 큰 품목 줄의 수량');
const p1 = buildPrefill({
  card: { id: 'c1' }, quotation: q1, today: '2026-04-30',
  stages: [
    { id: 's2', stage_type: 'BALANCE_PAYMENT', percentage: 70, amount: 7000, currency: 'USD', approval_status: 'APPROVED', paid_date: '2026-03-25' },
    { id: 's1', stage_type: 'DOWN_PAYMENT', percentage: 30, amount: 3000, currency: 'USD', approval_status: 'APPROVED', paid_date: '2026-03-05' },
  ],
  shipments: [{ id: 'sh1', label: '1차 선적', status: 'DELIVERED', dest_cost_actual: 1850000, dest_cost_actual_vat: 1560000, dest_cost_estimate: { buyer_ex_vat: 1700000 }, dest_cost_sent_at: '2026-03-01' }],
  rates,
});
assert.deepEqual(p1.lines.map((l) => l.label), ['상품 대금 · 선금 30%', '상품 대금 · 잔금 70%', '한국 도착 비용 · 1차 선적']);
assert.deepEqual(p1.lines.map((l) => l.fx), [1380, 1390, 1], '입금일 환율');
assert.deepEqual(p1.lines.map((l) => l.source), [LINE_SOURCE.PAYMENT, LINE_SOURCE.PAYMENT, LINE_SOURCE.SHIPMENT_ACTUAL], '실제 청구액이 있으면 예상액 대신');
assert.equal(p1.order_date, '2026-03-05');
assert.equal(p1.vat_krw, 1560000);
assert.equal(p1.ready, true);
assert.deepEqual(p1.warnings, []);
const r1 = summarize({ lines: p1.lines, units: p1.units });
assert.equal(r1.goods_krw, 3000 * 1380 + 7000 * 1390); // 13,870,000
assert.equal(r1.logistics_krw, 1850000);
assert.equal(r1.total_krw, 15720000);
assert.equal(r1.per_unit_krw, 31440);
assert.deepEqual(r1.goods_foreign, { currency: 'USD', amount: 10000 });
assert.equal(r1.estimated, false);

// ── 재주문: 단가 5% 인상, 환율 상승, 선금만 입금, 도착 비용은 예상액, 금형 수리비(일회성) ──
const q2 = { ...q1, id: 'q2', final_total: 10500, price_lines: [{ ...q1.price_lines[0], unit_price: 20, total: 10000 }, q1.price_lines[1]] };
const p2 = buildPrefill({
  card: { id: 'c2' }, quotation: q2, today: '2026-08-28',
  stages: [
    { id: 't1', stage_type: 'DOWN_PAYMENT', percentage: 30, approval_status: 'APPROVED', paid_date: '2026-08-05' },
    { id: 't2', stage_type: 'BALANCE_PAYMENT', percentage: 70, approval_status: 'PENDING' },
  ],
  shipments: [{ id: 'sh2', label: '1차 선적', status: 'DEPARTED', dest_cost_estimate: { buyer_ex_vat: 1799999.6, buyer_vat: 1600000 }, dest_cost_sent_at: '2026-08-20' }],
  rates,
});
assert.deepEqual(p2.lines.map((l) => l.amount), [3150, 7350, 1800000], '금액 없는 단계 = 견적가 × 비율');
assert.deepEqual(p2.lines.map((l) => l.fx), [1420, 1435, 1], '입금 전 단계는 오늘 환율');
assert.deepEqual(p2.lines.map((l) => l.estimated), [false, true, true]);
assert.deepEqual(p2.warnings.sort(), ['DEST_ESTIMATE', 'STAGE_NO_AMOUNT', 'UNPAID_STAGE']);
assert.equal(p2.ready, false, '아직 도착 전');
const lines2 = [...p2.lines, { key: 'm', kind: LINE_KIND.OTHER, label: '금형 수리', amount: 2000, currency: 'CNY', fx: 196, one_time: true, source: LINE_SOURCE.MANUAL }];
const r2 = summarize({ lines: lines2, units: 500 });
assert.equal(r2.goods_krw, 3150 * 1420 + 7350 * 1435); // 15,020,250
assert.equal(r2.one_time_krw, 392000);
assert.equal(r2.total_krw, 15020250 + 1800000, '일회성 비용은 개당 원가에서 뺀다');
assert.equal(r2.per_unit_krw, 33641);
assert.equal(r2.estimated, true);

// ── 변동 원인: 네 값의 합 = 개당 차이 ──
const rec1 = { ...r1, product_key: 'c1', card_id: 'c1', product_name: '테이블 상판', order_date: '2026-03-05' };
const rec2 = { ...r2, product_key: 'c1', card_id: 'c2', product_name: '테이블 상판 1200', order_date: '2026-08-05' };
const ch = explainChange(rec1, rec2);
assert.equal(ch.diff, 33641 - 31440);
assert.equal(ch.price + ch.fx + ch.logistics + ch.other, ch.diff, '합이 정확히 맞아야 한다');
assert.equal(ch.price, 1387, '단가 +1 USD × 직전 평균 환율 1387');
assert.equal(ch.logistics, 3600 - 3700, '도착 비용 1,800,000/500 − 1,850,000/500');
assert.ok(ch.fx > 0 && ch.fx === Math.round(21 * (15020250 / 10500 - 1387)), '환율 영향');
assert.equal(ch.currency, 'USD');
// 원화로 산 주문과는 환율을 나누지 않는다
const krw = explainChange(rec1, { ...rec2, goods_foreign: null });
assert.equal(krw.fx, null);
assert.equal(krw.price + krw.logistics + krw.other, krw.diff);

// 소모품처럼 개당 1,000원 미만이면 소수 둘째 자리까지 남겨 변동이 사라지지 않는다
const film = (cny, fx, dest) => summarize({ units: 400000, lines: [{ kind: LINE_KIND.GOODS, amount: cny, currency: 'CNY', fx }, { kind: LINE_KIND.DEST, amount: dest, currency: 'KRW', fx: 1 }] });
const f1 = { ...film(22600, 193.4, 1180000) }; const f2 = { ...film(22840, 198.3, 1260000) };
assert.equal(f1.per_unit_krw, 13.88); assert.equal(f2.per_unit_krw, 14.47);
const fch = explainChange(f1, f2);
assert.equal(fch.diff, 0.59);
assert.equal(Math.round((fch.price + fch.fx + fch.logistics + fch.other) * 100) / 100, fch.diff);
assert.ok(fch.fx > 0 && fch.logistics === 0.2, '물류 (1,260,000 − 1,180,000) / 400,000 = 0.2원');

// ── 상품별 묶음 ──
const other = { ...r1, product_key: 'x', card_id: 'x', product_name: '수축 비닐', order_date: '2026-06-01' };
const groups = groupByProduct([rec2, other, rec1]);
assert.deepEqual(groups.map((g) => g.name), ['테이블 상판 1200', '수축 비닐'], '최근 주문 순, 이름은 최신 기록');
assert.deepEqual(groups[0].orders.map((o) => o.card_id), ['c1', 'c2']);
assert.equal(groups[0].min, 31440);
assert.equal(groups[1].change, null, '주문 1건이면 비교 없음');

// ── 재주문 체인 ──
const cards = new Map([['a', { id: 'a' }], ['b', { id: 'b', reorder_of: 'a' }], ['c', { id: 'c', reorder_of: 'b' }]]);
assert.equal(rootCardId(cards.get('c'), cards), 'a');
assert.equal(rootCardId({ id: 'd', reorder_of: 'gone' }, cards), 'gone', '원래 카드가 안 보이면 그 ID');
const loop = new Map([['p', { id: 'p', reorder_of: 'q' }], ['q', { id: 'q', reorder_of: 'p' }]]);
assert.ok(['p', 'q'].includes(rootCardId(loop.get('p'), loop)), '순환에서 멈춘다');

// ── 경고 ──
const p3 = buildPrefill({ card: {}, quotation: { ...q1, rounding_version: 2, logistics_separate: true, logistics_total: 3000, logistics_cost_currency: 'CNY' }, stages: [], shipments: [{ id: 'z', status: 'PREPARING', dest_cost_estimate: { buyer_ex_vat: 1 }, dest_cost_sent_at: 'x' }, { id: 'y', status: 'PREPARING' }], rates: [] });
assert.deepEqual(p3.warnings.sort(), ['DEST_ESTIMATE', 'DEST_MISSING', 'DOUBLE_FREIGHT', 'NO_STAGES'].sort());
assert.deepEqual(p3.lines.map((l) => [l.kind, l.fx]), [[LINE_KIND.GOODS, 1375], [LINE_KIND.LOGISTICS, 1375 / 7.2], [LINE_KIND.DEST, 1]], '환율 기록이 없으면 견적서 환율');
const noFx = summarize({ lines: [{ kind: LINE_KIND.GOODS, amount: 10, currency: 'USD', fx: null }] });
assert.equal(noFx.missing_fx, true);

console.log('order-cost: 모든 검산 통과');
