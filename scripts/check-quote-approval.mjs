// 견적 승인 검산: 요약(고객 금액·원가·마진), 확인 항목(막힘·주의·안내), 승인함 목록,
// 그리고 서버 함수(검토 요청 → 승인하고 보내기 / 반려, 권한, 공개 해제, 직원의 승인·발송 상태 변경 차단).
// 실행: npm run check:quote-approval
import assert from 'node:assert/strict';
import * as R from '../base44/shared/quoteReview.ts';

const today = '2026-11-02';
const base = {
  id: 'q1', card_id: 'c1', tenant_id: 't1', status: 'DRAFT', quote_title: 'ZP-5B 타정기', factory_name: '운용',
  rounding_version: 2, final_total: 3000, final_currency: 'USD', exchange_rate_usd_cny: 7, exchange_rate_usd: 1400,
  quote_options: [
    { option_name: '본체', quantity: 1, unit_price: 14000, currency: 'CNY', margin_percent: 20 },
    { option_name: '금형', quantity: 10, unit_price: 200, currency: 'CNY', margin_percent: 20 },
    { option_name: '도금', quantity: 1, unit_price: 700, currency: 'CNY', optional: true },
  ],
  logistics_cost: 700, logistics_cost_currency: 'CNY',
  lead_time_business_days: 20, validity_days: 30, factory_quote_date: '2026-10-30', payment_terms_pending: true,
};
const card = { id: 'c1', tenant_id: 't1', title: '타정기 5구', client_id: 'co1', client_name: '도깨비산업기계', client_visible: true, status: 'IN_PROGRESS' };

// 요약: 원가 = 본체 14000 + 금형 2000 + 물류 700 = 16700 CNY = 2385.71 USD, 선택 사양 제외
let s = R.quoteSummary(base);
assert.equal(s.total, 3000);
assert.equal(s.cost_usd, 2385.71);
assert.equal(s.margin_pct, 20.5);
assert.equal(s.optional_count, 1);
s = R.quoteSummary({ ...base, logistics_separate: true });
assert.equal(s.cost_usd, 2285.71, '물류비 별도 견적은 원가에서 물류비를 뺀다');
s = R.quoteSummary({ ...base, quote_options: [], factory_total_cost: 10000, factory_cost_currency: 'CNY', logistics_cost: 0, final_total: 2000000, final_currency: 'KRW' });
assert.equal(s.cost_usd, 1428.57);
assert.equal(s.margin_pct, 0, '₩2,000,000 = $1428.57 → 마진 0%');
s = R.quoteSummary({ ...base, rounding_version: 1, final_client_price: 21000, exchange_rate_usd_cny: 0 });
assert.equal(s.currency, 'CNY', '예전 견적: 환율이 없으면 위안화 금액');
assert.equal(s.total_usd, null);
assert.equal(s.margin_pct, null);

// 확인 항목
const codes = (q, c = card, d = today) => R.reviewChecks(q, c, d).map((x) => `${x.level}:${x.code}`);
assert.deepEqual(codes(base), ['info:payment_pending', 'info:optional']);
assert.ok(R.canSend(R.reviewChecks(base, card, today)));
assert.deepEqual(codes({ ...base, final_total: 2500 }).slice(0, 1), ['warn:low_margin'], '마진 4.6% < 10%');
assert.deepEqual(codes({ ...base, final_total: 2000 }).slice(0, 1), ['warn:loss']);
assert.deepEqual(codes(base, { ...card, client_visible: false }).slice(0, 1), ['block:card_hidden']);
assert.deepEqual(codes(base, { ...card, client_id: '' }).slice(0, 1), ['block:no_client']);
assert.deepEqual(codes(base, null).slice(0, 1), ['block:no_card']);
assert.deepEqual(codes({ ...base, status: 'ACCEPTED' }).slice(0, 1), ['block:status']);
assert.deepEqual(codes({ ...base, final_total: 0 }).filter((c) => c.startsWith('block')), ['block:no_total']);
assert.ok(codes({ ...base, factory_quote_date: '2026-09-01' }).includes('warn:factory_expired'), '9/1 + 30일 < 11/2');
assert.ok(codes({ ...base, lead_time_business_days: 0 }).includes('warn:no_lead'));
assert.ok(codes({ ...base, validity_days: 0 }).includes('warn:no_validity'));
assert.ok(codes({ ...base, quote_options: [], factory_total_cost: 0, logistics_cost: 0 }).includes('warn:no_cost'));
assert.ok(codes({ ...base, manual_total: 3100, manual_reason: '끝자리 정리' }).includes('info:manual'));
assert.ok(!R.canSend(R.reviewChecks(base, { ...card, client_visible: false }, today)));

// 승인함 목록: 검토 요청 오래된 순, 발송됨인데 공개 빠진 견적은 따로
const quotes = [
  { ...base, id: 'a', status: 'REVIEW', review_requested_at: '2026-11-01T01:00:00Z' },
  { ...base, id: 'b', status: 'REVIEW', review_requested_at: '2026-10-31T01:00:00Z' },
  { ...base, id: 'c', status: 'SENT' },
  { ...base, id: 'd', status: 'SENT', client_published_at: '2026-10-20T00:00:00Z' },
  { ...base, id: 'e', status: 'DRAFT' },
];
const qq = R.approvalQueue(quotes, { c1: card }, today);
assert.deepEqual(qq.review.map((r) => r.id), ['b', 'a']);
assert.deepEqual(qq.unsent.map((r) => r.id), ['c']);
assert.equal(qq.review[0].card_title, '타정기 5구');
assert.equal(qq.review[0].summary.margin_pct, 20.5);
assert.equal(qq.review[0].can_send, true);
console.log('quote-review ok');

// 서버 함수
const call = async (fn, body) => { const m = await import('../base44/functions/' + fn + '/entry.ts'); const res = await m.default(new Request('https://x', { method: 'POST', body: JSON.stringify(body) })); return { status: res.status, data: await res.json() }; };
const SUB = { id: 'u1', full_name: '왕리', account_tier: 'sub', tenant_id: 't1', email: 'wang@aegis.example' };
const BOSS = { id: 'u9', full_name: '이호민', account_tier: 'service', tenant_id: 't1', email: 'lee@aegis.example' };
const OTHER = { id: 'u8', full_name: '다른팀', account_tier: 'service', tenant_id: 't2', email: 'x@other.example' };
const CLIENT = { id: 'u5', full_name: '김담당', account_tier: 'client', company_id: 'co1', tenant_id: 'tc', email: 'kim@client.example' };
globalThis.__db = {
  Quotation: [{ ...base, updated_date: '2026-11-01T00:00:00Z' }, { ...base, id: 'q2', card_id: 'c2', updated_date: '2026-11-01T00:00:00Z' }],
  TaskCard: [card, { ...card, id: 'c2', client_visible: false }],
  User: [SUB, BOSS, OTHER, CLIENT],
  Company: [{ id: 'co1', company_name: '도깨비산업기계' }],
  Notification: [], ProjectAuditLog: [], QuotationRevision: [],
};
globalThis.__emails = [];
const Q = (id) => globalThis.__db.Quotation.find((x) => x.id === id);

globalThis.__user = CLIENT;
assert.equal((await call('quoteApproval', { action: 'preview', quotation_id: 'q1' })).status, 403);
globalThis.__user = OTHER;
assert.equal((await call('quoteApproval', { action: 'preview', quotation_id: 'q1' })).status, 404, '다른 팀 견적은 보이지 않는다');

// 직원: 미리 보기 → 검토 요청 (승인·발송·승인함은 막힘)
globalThis.__user = SUB;
let r = await call('quoteApproval', { action: 'preview', quotation_id: 'q1' });
assert.equal(r.status, 200, JSON.stringify(r.data));
assert.equal(r.data.can_send, true);
assert.equal(r.data.can_approve, false);
assert.equal(r.data.summary.margin_pct, 20.5);
assert.equal((await call('quoteApproval', { action: 'approve_send', quotation_id: 'q1' })).status, 403);
assert.equal((await call('quoteApproval', { action: 'queue' })).status, 403);
r = await call('quoteApproval', { action: 'request_review', quotation_id: 'q1', note: '마진 20% 맞췄습니다' });
assert.equal(r.status, 200, JSON.stringify(r.data));
assert.equal(Q('q1').status, 'REVIEW');
assert.equal(Q('q1').review_requested_by_name, '왕리');
const ask = globalThis.__db.Notification.filter((n) => n.type === 'quote_review_requested');
assert.deepEqual(ask.map((n) => n.recipient_id), ['u9'], '같은 팀 관리자에게만 (요청자·다른 팀 제외)');
assert.match(ask[0].body, /고객 금액 \$3,000 · 마진 20.5%/);
assert.match(ask[0].body, /메모: 마진 20% 맞췄습니다/);
assert.equal(ask[0].link, '/admin-inbox#inbox-quotes');
assert.ok(globalThis.__emails.some((m) => m.to === 'lee@aegis.example' && /견적 승인 요청/.test(m.subject)), '승인 요청은 메일로도 간다');
assert.equal((await call('quoteApproval', { action: 'request_review', quotation_id: 'q1' })).status, 400, '이미 검토 중');

// 관리자: 승인함 → 반려 → 다시 요청 → 승인하고 보내기
globalThis.__user = BOSS;
r = await call('quoteApproval', { action: 'queue' });
assert.deepEqual(r.data.review.map((x) => x.id), ['q1']);
assert.equal(r.data.review[0].review_note, '마진 20% 맞췄습니다');
assert.equal((await call('quoteApproval', { action: 'reject', quotation_id: 'q1' })).status, 400, '반려 사유 필수');
r = await call('quoteApproval', { action: 'reject', quotation_id: 'q1', reason: '납기 다시 확인' });
assert.equal(Q('q1').status, 'DRAFT');
assert.equal(Q('q1').review_rejected_reason, '납기 다시 확인');
assert.match(globalThis.__db.Notification.at(-1).body, /사유: 납기 다시 확인/);
assert.equal(globalThis.__db.Notification.at(-1).recipient_id, 'u1');

globalThis.__user = SUB;
await call('quoteApproval', { action: 'request_review', quotation_id: 'q1' });
assert.equal(Q('q1').review_rejected_reason, '', '다시 요청하면 반려 사유를 지운다');
globalThis.__user = BOSS;
globalThis.__emails = [];
r = await call('quoteApproval', { action: 'approve_send', quotation_id: 'q1' });
assert.equal(r.status, 200, JSON.stringify(r.data));
assert.equal(Q('q1').status, 'SENT');
assert.ok(Q('q1').client_published_at);
assert.equal(Q('q1').client_id, 'co1');
assert.equal(Q('q1').approved_by_name, '이호민');
assert.equal(globalThis.__db.TaskCard[0].status, 'REVIEW', '카드를 견적 검토 단계로 넘긴다');
const pub = globalThis.__db.Notification.find((n) => n.type === 'quote_published');
assert.equal(pub.recipient_id, 'u5');
assert.match(pub.body, /견적 금액 \$3,000 · 납기 선금 후 20영업일 · 유효기간 30일/);
assert.equal(pub.link, '/client/board?card=c1&tab=quotation');
assert.ok(globalThis.__emails.some((m) => m.to === 'kim@client.example'), '고객에게 메일');
assert.ok(globalThis.__db.Notification.some((n) => n.type === 'quote_review_decided' && n.recipient_id === 'u1' && /발송됨/.test(n.title)), '요청자에게 결과 알림');
assert.deepEqual(globalThis.__db.ProjectAuditLog.map((a) => a.event_type), ['QUOTE_REVIEW_REQUESTED', 'QUOTE_REVIEW_REJECTED', 'QUOTE_REVIEW_REQUESTED', 'QUOTE_APPROVED_SENT']);
assert.equal((await call('quoteApproval', { action: 'approve_send', quotation_id: 'q1' })).data.already, true, '두 번 보내지 않는다');

// 카드가 고객에게 공개되지 않았으면 보내지 않는다 (관리자가 바로 보내기)
r = await call('quoteApproval', { action: 'approve_send', quotation_id: 'q2' });
assert.equal(r.status, 400);
assert.match(r.data.error, /카드가 고객에게 공개되지 않았습니다/);
assert.equal(Q('q2').status, 'DRAFT');

// 공개 해제 → 승인됨, 고객이 진행 요청한 견적은 해제 불가
r = await call('quoteApproval', { action: 'unpublish', quotation_id: 'q1' });
assert.equal(Q('q1').client_published_at, '');
assert.equal(Q('q1').status, 'APPROVED');
r = await call('quoteApproval', { action: 'queue' });
assert.deepEqual(r.data.unsent.map((x) => x.id), ['q1'], '승인됐지만 공개가 빠진 견적');
await call('quoteApproval', { action: 'approve_send', quotation_id: 'q1' });
Q('q1').client_accepted_at = '2026-11-02T01:00:00Z';
assert.equal((await call('quoteApproval', { action: 'unpublish', quotation_id: 'q1' })).status, 400);

// 직원은 견적 수정 화면에서도 승인됨·발송됨으로 바꿀 수 없다
globalThis.__user = SUB;
Object.assign(Q('q2'), { status: 'DRAFT' });
r = await call('quotationHistory', { action: 'update', quotation_id: 'q2', data: { status: 'SENT' }, expected_updated_date: Q('q2').updated_date });
assert.equal(r.status, 403);
assert.equal(Q('q2').status, 'DRAFT');
r = await call('quotationHistory', { action: 'create', data: { card_id: 'c1', status: 'SENT', approved_by_name: '가짜', quote_title: '새 견적' } });
const created = globalThis.__db.Quotation.at(-1);
assert.equal(created.status, 'DRAFT');
assert.equal(created.approved_by_name, undefined, '승인 기록은 만들 때 넣을 수 없다');
console.log('quote-approval functions ok');
