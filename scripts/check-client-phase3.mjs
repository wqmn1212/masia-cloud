// 3단계 서버 함수 검산: 상품 원가(발주→도착 일수·품질 이력·재고 계획), 재고 저장, 일일 점검(재주문 시점·공장 회신 지연),
// 문의 양식 접수, 소싱 진행률, 주간 요약 메일.
// 실행: npm run check:client-phase3
import assert from 'node:assert/strict';
const R = new URL('../base44/functions/', import.meta.url).href;
const call = async (fn, body) => { const m = await import(R + fn + '/entry.ts'); const res = await m.default(new Request('https://x', { method: 'POST', body: JSON.stringify(body) })); return { status: res.status, data: await res.json() }; };
const kst = (d = 0) => new Date(Date.now() + 9 * 3600000 + d * 86400000).toISOString().slice(0, 10);
const iso = (d = 0) => new Date(Date.now() + d * 86400000).toISOString();
const CLIENT = { id: 'cu1', full_name: '김담당', account_tier: 'client', tenant_id: 'ct1', company_id: 'co1', is_active: true, email: 'client@buyer.example' };
const QUIET = { id: 'cu2', full_name: '박조용', account_tier: 'client', tenant_id: 'ct1', company_id: 'co1', is_active: true, email: 'quiet@buyer.example', notification_prefs: { weekly: { email: false } } };
const STAFF = { id: 's1', full_name: '이호민', account_tier: 'service', tenant_id: 't1', is_active: true, email: 'staff@aegis.example' };
globalThis.__db = {
  User: [CLIENT, QUIET, STAFF], Tenant: [{ id: 'ct1', company_id: 'co1', tenant_type: 'client', hq_tenant_id: 't1' }],
  Company: [{ id: 'co1', tenant_id: 't1', company_type: 'CLIENT', company_name: '바이어상사' }],
  TaskCard: [
    { id: 'c1', tenant_id: 't1', title: '휴대용 선풍기', client_id: 'co1', client_visible: true, status: 'DONE', advance_paid_date: kst(-200) },
    { id: 'c2', tenant_id: 't1', title: '[재주문] 휴대용 선풍기', client_id: 'co1', client_visible: true, status: 'DONE', reorder_of: 'c1', advance_paid_date: kst(-100) },
    { id: 'c3', tenant_id: 't1', title: '드립백 포장재', client_id: 'co1', client_visible: true, status: 'IN_PROGRESS', candidate_factory_ids: ['f1', 'f2'], candidate_factory_names: ['비밀공장', '다른공장'], quote_deadline: kst(5), quote_deadline_client_visible: true, plan_confirmed_at: iso(-10) },
  ],
  LandedCostRecord: [
    { id: 'l1', tenant_id: 't1', card_id: 'c1', client_id: 'co1', product_key: 'c1', product_name: '휴대용 선풍기', order_date: kst(-200), units: 3000, per_unit_krw: 1180, goods_krw: 3000000, logistics_krw: 450000, other_krw: 90000, total_krw: 3540000, goods_foreign: { currency: 'USD', amount: 2300 }, status: 'CONFIRMED', lines: [] },
    { id: 'l2', tenant_id: 't1', card_id: 'c2', client_id: 'co1', product_key: 'c1', product_name: '휴대용 선풍기', order_date: kst(-100), units: 3000, per_unit_krw: 1230, goods_krw: 3150000, logistics_krw: 480000, other_krw: 60000, total_krw: 3690000, goods_foreign: { currency: 'USD', amount: 2300 }, status: 'CONFIRMED', lines: [] },
  ],
  Shipment: [
    { id: 's1', card_id: 'c1', client_visible: true, status: 'DELIVERED', ata: kst(-148), label: '1차' },
    { id: 's2', card_id: 'c2', client_visible: true, status: 'DELIVERED', ata: kst(-42), label: '1차' },
    { id: 's3', card_id: 'c3', client_visible: true, status: 'ARRIVED', ata: kst(-3), label: '샘플 선적' },
  ],
  QCReport: [{ id: 'q1', card_id: 'c1', client_visible: true, inspection_type: 'MASS', qc_result: 'PASS' }, { id: 'q2', card_id: 'c2', client_visible: true, inspection_type: 'MASS', qc_result: 'CONDITIONAL_PASS' }],
  QualityClaim: [
    { id: 'cl1', tenant_id: 't1', card_id: 'c1', client_id: 'co1', title: '버튼 불량', status: 'RESOLVED', resolution: 'DISCOUNT', defect_qty: 120, received_qty: 3000, compensation: { kind: 'DISCOUNT', amount: 150000, currency: 'KRW', note: '다음 발주 할인' } },
    { id: 'cl2', tenant_id: 't1', card_id: 'c2', client_id: 'co1', title: '포장 찢김', status: 'REVIEWING', resolution: 'PENDING', defect_qty: 30, received_qty: 3000, factory_requested_at: iso(-9) },
  ],
  ExchangeRate: [{ id: 'x1', rate_date: kst(-1), usd_krw: 1400, usd_cny: 7.2 }],
  ChinaHoliday: [], ProductPlan: [], Notification: [], ProjectAuditLog: [], PaymentStage: [{ id: 'p1', card_id: 'c3', stage_type: 'DOWN_PAYMENT', approval_status: 'APPROVED', paid_date: kst(-2) }],
  Quotation: [{ id: 'qt1', card_id: 'c3', client_id: 'co1', quote_title: '공장 A 견적' }, { id: 'qt2', card_id: 'c3', client_id: 'co1', quote_title: '공장 B 견적', client_published_at: iso(-2) }],
  QuoteComparison: [], CardMilestone: [{ id: 'm1', card_id: 'c3', label: '요구사항 확정', status: 'done', actual_date: kst(-4), client_visible: true }],
  SignatureRequest: [], FileReview: [], ClientApproval: [], CardAttachment: [], PendingInvitation: [],
};
const db = globalThis.__db;
globalThis.__user = CLIENT;

// ── 상품 원가: 발주→도착 일수, 품질 이력, 환율 ──
let r = await call('getClientLandedCosts', {});
assert.equal(r.status, 200);
const recs = r.data.records;
assert.deepEqual(recs.map((x) => x.lead_days).sort(), [52, 58], '선금일 → 마지막 도착일');
assert.equal(r.data.krw_per_now.USD, 1400);
const q1 = recs.find((x) => x.card_id === 'c1').quality;
assert.equal(q1.qc.qc_result, 'PASS');
assert.equal(q1.claims[0].compensation.state, 'PROMISED', '보상 약속 미반영');
const q2 = recs.find((x) => x.card_id === 'c2').quality;
assert.ok(q2.claims[0].factory_wait_days >= 9, '공장 회신 대기 일수');
assert.equal(JSON.stringify(r.data).includes('factory_response'), false, '공장 회신(내부)은 보내지 않는다');

// ── 재고 저장 ──
r = await call('manageProductPlan', { action: 'save', product_key: 'c9', stock_qty: 10, monthly_usage: 5 });
assert.equal(r.status, 404, '원가가 없는 상품');
r = await call('manageProductPlan', { action: 'save', product_key: 'c1', stock_qty: 'abc', monthly_usage: 5 });
assert.equal(r.status, 400);
r = await call('manageProductPlan', { action: 'save', product_key: 'c1', stock_qty: 6000, monthly_usage: 3000, stock_as_of: kst(0) });
assert.equal(r.status, 200);
assert.equal(db.ProductPlan[0].tenant_id, 't1');
assert.equal(db.ProductPlan[0].stock_qty, 6000);

// ── 일일 점검: 재고 6,000 / 월 3,000 → 60일 뒤 소진, 평균 55일 전 주문 → 5일 뒤 주문 권장, 알림일 지남 → 알림 ──
globalThis.__user = null;
r = await call('dailyClientChecks', {});
assert.equal(r.status, 200);
assert.equal(r.data.reorder_alerts, 1);
assert.equal(r.data.factory_overdue, 1, '보낸 지 9일 · 회신 없음');
const reorderNotes = db.Notification.filter((n) => n.type === 'reorder_due');
assert.deepEqual(reorderNotes.map((n) => n.recipient_id).sort(), ['cu1', 'cu2', 's1']);
assert.match(reorderNotes.find((n) => n.recipient_id === 'cu1').title, new RegExp(kst(5)));
assert.equal(db.ProductPlan[0].alerted_for, kst(5));
assert.equal(db.Notification.find((n) => n.type === 'claim_factory_overdue').recipient_id, 's1');
assert.ok(db.QualityClaim[1].factory_overdue_notified_at);
r = await call('dailyClientChecks', {});
assert.deepEqual([r.data.reorder_alerts, r.data.factory_overdue], [0, 0], '같은 날짜로 두 번 보내지 않는다');

// ── 문의 양식 ──
globalThis.__user = CLIENT;
r = await call('submitClientInquiry', { title: '보조배터리', detail: '1만mAh', categories: ['전자 · 전기'], spec_answers: { '충전 단자': 'USB-C' } });
assert.equal(r.status, 400, '사양 질문에 답해야');
assert.match(r.data.error, /모름/);
r = await call('submitClientInquiry', { title: '보조배터리', detail: '1만mAh', categories: ['전자 · 전기'], spec_answers: { '전원 방식 (어댑터·배터리)': '배터리', '무선 기능 (블루투스·와이파이)': '없음', '충전 단자': 'USB-C', '정격 전압·전력': '모름' }, certifications: ['KC_ELEC', 'BATTERY'], sample: 'NEED', desired_date: kst(60), destination: '김포' });
assert.equal(r.status, 200);
const inq = db.TaskCard.find((c) => c.id === r.data.card_id);
assert.equal(inq.inquiry_details.sample, 'NEED');
assert.equal(inq.due_date, kst(60), '희망 입고일 → 목표일');
assert.deepEqual(inq.import_requirements.map((x) => x.key), ['KC_ELEC', 'BATTERY']);
assert.match(inq.hq_requirements, /정격 전압·전력: 모름/);

// ── 소싱 진행률 (공장 이름 없이) ──
r = await call('listClientTodos', {});
const sp = r.data.summaries.c3.sourcing;
assert.deepEqual(sp.steps.map((x) => x.label), ['요구사항 확인', '공장 후보 2곳', '견적 2건 받음', '비교표 준비']);
assert.equal(sp.due, kst(5));
assert.equal(JSON.stringify(r.data).includes('비밀공장'), false);

// ── 주간 요약 ──
globalThis.__emails = [];
globalThis.__user = null;
r = await call('sendWeeklyDigest', {});
assert.equal(r.status, 200);
assert.equal(r.data.sent, 1, '주간 요약을 끈 계정은 빼고');
const mail = globalThis.__emails[0];
assert.equal(mail.to, 'client@buyer.example');
assert.match(mail.body, /지난주 바뀐 것/);
assert.match(mail.body, /샘플 선적 도착 · 드립백 포장재/);
assert.match(mail.body, /선금 입금 확인 · 드립백 포장재/);
assert.match(mail.body, /견적서 발행 · 드립백 포장재/);
assert.match(mail.body, /요구사항 확정 완료/);
console.log('client-phase3: 3단계 서버 함수 검산 통과');
