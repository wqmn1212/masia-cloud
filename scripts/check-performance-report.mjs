// 고객 성과 리포트 검산: 기간 집계(진행·견적 속도·검토 공장 수·절감률·일정·검수·불량·보상·도착 원가),
// 고객에게 원가·공장 이름이 나가지 않는지, 초안·발행 흐름과 담당자가 뺀 숫자.
// 실행: npm run check:performance-report
import assert from 'node:assert/strict';
import { summarizePerformance, periodLabel, draftHighlights } from '../base44/shared/performanceReport.ts';

const call = async (fn, body) => { const m = await import('../base44/functions/' + fn + '/entry.ts'); const res = await m.default(new Request('https://x', { method: 'POST', body: JSON.stringify(body) })); return { status: res.status, data: await res.json() }; };
const P = { start: '2026-07-01', end: '2026-09-30' };

// ── 기간 이름
assert.equal(periodLabel('2026-07-01', '2026-09-30'), '2026년 3분기');
assert.equal(periodLabel('2026-01-01', '2026-06-30'), '2026년 상반기');
assert.equal(periodLabel('2026-01-01', '2026-12-31'), '2026년');
assert.equal(periodLabel('2026-10-01', '2026-10-31'), '2026년 10월');
assert.equal(periodLabel('2026-07-15', '2026-09-30'), '2026-07-15 ~ 2026-09-30');

// ── 집계
const card = (id, o) => ({ id, client_visible: true, client_id: 'co1', tenant_id: 't1', title: id, status: 'IN_PROGRESS', created_date: '2026-07-01T01:00:00Z', updated_date: '2026-09-01T01:00:00Z', ...o });
const data = {
  cards: [
    card('a', { title: '타정기', status: 'DONE', updated_date: '2026-09-10T01:00:00Z' }),
    card('b', { title: '라벨기', status: 'PRODUCTION', created_date: '2026-08-01T01:00:00Z' }),
    card('old', { status: 'DONE', created_date: '2026-01-01T00:00:00Z', updated_date: '2026-03-01T00:00:00Z' }), // 기간 전에 끝남
    card('hidden', { client_visible: false }), // 고객 비공개
    card('x', { status: 'CANCELLED' }),
  ],
  quotes: [
    // a: 공장 3곳, 가장 비싼 1000 대비 고른 800 → 20% 절감, 요청 7/1 → 첫 견적 7/8 (7일)
    { id: 'qa1', card_id: 'a', factory_name: '운용 (云涌)', factory_total_cost: 1000, client_published_at: '2026-07-08T03:00:00Z' },
    { id: 'qa2', card_id: 'a', factory_name: '운용(云涌)', factory_total_cost: 900 }, // 같은 공장 (띄어쓰기·괄호 무시)
    { id: 'qa3', card_id: 'a', factory_name: '광저우 C', factory_total_cost: 800, client_published_at: '2026-07-10T03:00:00Z', client_accepted_at: '2026-07-20T03:00:00Z', status: 'ACCEPTED' },
    { id: 'qa4', card_id: 'a', factory_name: '선전 A', quote_options: [{ unit_price: 50, quantity: 20, currency: 'CNY' }] }, // 1000
    // b: 견적 1건 → 절감 계산 없음. 요청 8/1 → 8/4 (3일)
    { id: 'qb1', card_id: 'b', factory_name: '동관 B', factory_total_cost: 500, client_published_at: '2026-08-04T03:00:00Z' },
    { id: 'qh', card_id: 'hidden', factory_name: 'Z', factory_total_cost: 1, client_published_at: '2026-08-04T03:00:00Z' },
  ],
  comparisons: [{ id: 'cmp', card_id: 'a', version: 1, published_at: '2026-07-12T00:00:00Z' }],
  milestones: [
    { card_id: 'a', status: 'done', actual_date: '2026-07-20', planned_date: '2026-07-25' },
    { card_id: 'a', status: 'done', actual_date: '2026-08-20', baseline_date: '2026-08-10', planned_date: '2026-08-25' }, // 기준일보다 늦음
    { card_id: 'b', status: 'done', actual_date: '2026-09-01' }, // 기한 없음 → 비율에서 뺀다
    { card_id: 'b', status: 'done', actual_date: '2026-09-02', planned_date: '2026-09-05', client_visible: false },
    { card_id: 'a', status: 'done', actual_date: '2026-10-02', planned_date: '2026-10-05' }, // 기간 밖
  ],
  qc: [
    { card_id: 'a', qc_result: 'FAIL', created_date: '2026-08-01T00:00:00Z', checklist: [1, 2, 3] },
    { card_id: 'a', qc_result: 'PASS', created_date: '2026-08-05T00:00:00Z', checklist: [1, 2] },
    { card_id: 'b', qc_result: 'CONDITIONAL_PASS', created_date: '2026-09-05T00:00:00Z', checklist: [1] },
  ],
  shipments: [
    { card_id: 'a', atd: '2026-09-01', eta: '2026-09-05', ata: '2026-09-04', dest_cost_estimate: { buyer_ex_vat: 1000000 }, dest_cost_sent_at: '2026-08-20T00:00:00Z', dest_cost_actual: 1100000 },
    { card_id: 'b', atd: '2026-09-10', eta: '2026-09-12', ata: '2026-09-15' },
  ],
  claims: [
    { card_id: 'a', status: 'RESOLVED', submitted_at: '2026-09-06T00:00:00Z', resolved_at: '2026-09-20T00:00:00Z', defect_qty: 5, received_qty: 500, compensation: { kind: 'DISCOUNT', amount: 300, currency: 'USD', promised_at: '2026-09-20T00:00:00Z' } },
    { card_id: 'b', status: 'REJECTED', submitted_at: '2026-09-07T00:00:00Z', compensation: { amount: 999, currency: 'USD', promised_at: '2026-09-20T00:00:00Z' } },
  ],
  landed: [
    { card_id: 'old', product_key: 'p1', status: 'CONFIRMED', order_date: '2026-02-01', per_unit_krw: 10000, product_name: '타정기' },
    { card_id: 'a', product_key: 'p1', status: 'CONFIRMED', order_date: '2026-08-01', per_unit_krw: 9000, product_name: '타정기' },
    { card_id: 'b', product_key: 'p2', status: 'WITHDRAWN', order_date: '2026-08-01', per_unit_krw: 5000 },
  ],
  meetings: [{ card_id: 'a', meeting_date: '2026-08-02', meeting_type: 'OFFLINE' }, { card_id: 'b', meeting_date: '2026-08-03', meeting_type: 'ONLINE' }],
};
const r = summarizePerformance(data, P);
const m = r.metrics;
assert.deepEqual([m.projects_active, m.projects_done, m.projects_ordered], [2, 1, 2], '기간에 살아 있던 공개 카드만');
assert.deepEqual([m.quotes_sent, m.quoted_products], [3, 2], '고객에게 보낸 견적 (비공개 카드 제외)');
assert.equal(m.factories_reviewed, 4, 'a 3곳 + b 1곳 (같은 공장 이름은 하나로)');
assert.equal(m.factories_per_product, 2);
assert.equal(m.first_quote_days_avg, 5, '(7 + 3) / 2');
assert.equal(m.comparisons_published, 1);
assert.deepEqual([m.savings_products, m.savings_pct_avg], [1, 20], '가장 비싼 견적 1000 대비 고른 800');
assert.deepEqual([m.steps_done, m.steps_on_time_pct], [3, 50], '비공개 단계·기간 밖 제외, 기한 있는 2개 중 1개');
assert.deepEqual([m.shipments_departed, m.shipments_arrived, m.arrival_on_time_pct], [2, 2, 50]);
assert.deepEqual([m.qc_reports, m.qc_items_checked, m.qc_issues_caught], [3, 6, 2]);
assert.deepEqual([m.claims, m.claims_resolved, m.defect_rate_pct], [1, 1, 1], '반려한 신고는 빼고, 불량률 5/500');
assert.deepEqual(m.compensation, { USD: 300 }, '반려 신고 보상은 빼고');
assert.equal(m.landed_confirmed, 1, '확정한 도착 원가만');
assert.equal(m.dest_cost_accuracy_pct, 90, '예상 100만 · 실제 110만');
assert.deepEqual([m.meetings, m.site_visits], [2, 1]);
assert.deepEqual(r.trends.map((t) => [t.product_name, t.first_krw, t.last_krw, t.change_pct]), [['타정기', 10000, 9000, -10]], '재주문 개당 원가 변화');
assert.deepEqual(r.products.map((p) => [p.title, p.status, p.quotes_sent, p.first_quote_days, p.qc, p.arrived, p.per_unit_krw]), [
  ['라벨기', '발주 · 제작', 1, 3, '조건부 합격', '2026-09-15', null],
  ['타정기', '완료', 2, 7, '합격', '2026-09-04', 9000],
]);
const json = JSON.stringify(r);
for (const secret of ['운용', '광저우', '동관', '선전', 'factory_total_cost', '"cost', 'margin']) assert.ok(!json.includes(secret), `고객용 결과에 ${secret} 없음`);

const text = draftHighlights(m, '2026년 3분기');
assert.match(text, /2026년 3분기 동안 2개 품목을 진행했고, 1개를 마무리했습니다/);
assert.match(text, /평균 20% 낮은 조건/);
assert.match(text, /출고 전에 2건의 문제를 찾아/);
assert.equal(draftHighlights({ projects_active: 0 }, 'x'), '', '숫자가 없으면 문장도 없다');
assert.equal(summarizePerformance({}, P).metrics.savings_pct_avg, null, '빈 데이터');

// ── 서버: 초안·저장·발행·고객 조회
const BOSS = { id: 'u9', full_name: '이호민', account_tier: 'service', tenant_id: 't1' };
const SUB = { id: 'u1', full_name: '왕리', account_tier: 'sub', tenant_id: 't1' };
const CLIENT = { id: 'c1', full_name: '김고객', account_tier: 'client', company_id: 'co1', tenant_id: 'tc', email: 'kim@client.example' };
globalThis.__db = {
  Company: [{ id: 'co1', tenant_id: 't1', company_type: 'CLIENT', company_name: '예시상사' }, { id: 'co2', tenant_id: 't2', company_type: 'CLIENT', company_name: '남의 고객' }],
  User: [BOSS, SUB, CLIENT],
  TaskCard: data.cards.map((c) => ({ ...c })), Quotation: data.quotes, QuoteComparison: data.comparisons, LandedCostRecord: data.landed, QualityClaim: data.claims,
  QCReport: data.qc, Shipment: data.shipments, CardMilestone: data.milestones, MeetingLog: data.meetings, PerformanceReport: [], Notification: [],
};
globalThis.__emails = [];
globalThis.__user = SUB;
assert.equal((await call('performanceReportAction', { action: 'build', company_id: 'co1', period_start: P.start, period_end: P.end })).status, 403, '팀원은 못 만든다');
globalThis.__user = BOSS;
assert.equal((await call('performanceReportAction', { action: 'build', company_id: 'co2', period_start: P.start, period_end: P.end })).status, 403, '다른 팀 고객사');
assert.equal((await call('performanceReportAction', { action: 'build', company_id: 'co1', period_start: '2026-09-30', period_end: '2026-07-01' })).status, 400);
let res = await call('performanceReportAction', { action: 'build', company_id: 'co1', period_start: P.start, period_end: P.end });
assert.equal(res.status, 200, JSON.stringify(res.data));
const id = res.data.report.id;
const row = () => globalThis.__db.PerformanceReport.find((x) => x.id === id);
assert.equal(row().period_label, '2026년 3분기');
assert.equal(row().metrics.savings_pct_avg, 20);
assert.match(row().highlights, /2개 품목을 진행/, '자동 초안');
res = await call('performanceReportAction', { action: 'save', report_id: id, highlights: '담당자가 고친 문장', next_plan: '4분기 재주문 2건', hidden_metrics: ['savings_pct_avg', 'savings_products', 'section_trends', 'BAD KEY'] });
assert.deepEqual(row().hidden_metrics, ['savings_pct_avg', 'savings_products', 'section_trends']);
await call('performanceReportAction', { action: 'build', company_id: 'co1', period_start: P.start, period_end: P.end });
assert.equal(row().highlights, '담당자가 고친 문장', '다시 집계해도 담당자 문구는 그대로');
assert.equal(globalThis.__db.PerformanceReport.length, 1, '같은 기간은 하나');

globalThis.__user = CLIENT;
assert.deepEqual((await call('getClientPerformanceReports', {})).data.reports, [], '초안은 고객에게 안 보인다');
globalThis.__user = BOSS;
res = await call('performanceReportAction', { action: 'publish', report_id: id });
assert.equal(res.status, 200, JSON.stringify(res.data));
assert.equal(row().status, 'PUBLISHED');
const note = globalThis.__db.Notification.find((n) => n.type === 'performance_report');
assert.equal(note.recipient_id, 'c1');
assert.equal(note.link, `/client/dashboard?perf=${id}`);
assert.equal((await call('performanceReportAction', { action: 'build', company_id: 'co1', period_start: P.start, period_end: P.end })).status, 409, '발행한 숫자는 바꾸지 않는다');
assert.equal((await call('performanceReportAction', { action: 'delete', report_id: id })).status, 409, '발행한 리포트는 지우지 않는다');

globalThis.__user = CLIENT;
res = await call('getClientPerformanceReports', {});
const rep = res.data.reports[0];
assert.equal(rep.period_label, '2026년 3분기');
assert.equal(rep.metrics.savings_pct_avg, undefined, '담당자가 뺀 숫자는 응답에서 지운다');
assert.equal(rep.metrics.qc_issues_caught, 2);
assert.deepEqual(rep.trends, [], '뺀 구역');
assert.equal(rep.products.length, 2);
assert.equal(rep.products[0].card_id, undefined);
assert.equal(rep.next_plan, '4분기 재주문 2건');
for (const secret of ['운용', '광저우', 'tenant_id', 'hidden_metrics', 'created_by_name']) assert.ok(!JSON.stringify(res.data).includes(secret), `고객 응답에 ${secret} 없음`);

// 초안 지우기
globalThis.__user = BOSS;
res = await call('performanceReportAction', { action: 'build', company_id: 'co1', period_start: '2026-10-01', period_end: '2026-10-31' });
assert.equal((await call('performanceReportAction', { action: 'delete', report_id: res.data.report.id })).status, 200);
assert.equal(globalThis.__db.PerformanceReport.length, 1);
console.log('performance-report ok');
