// AI 비서 견적 자동화 도구 검산: assistantQuote(마진 기준·검토 전 확인·검토 요청·공장 견적 링크),
// assistantStatus(quotes·intake 현황), 팀 범위와 원가·마진은 팀 관리자에게만.
// 실행: npm run check:assistant-quote
import assert from 'node:assert/strict';
import * as F from '../base44/shared/factoryRequest.ts';

const call = async (fn, body) => { const m = await import('../base44/functions/' + fn + '/entry.ts'); const res = await m.default(new Request('https://x', { method: 'POST', body: JSON.stringify(body) })); return { status: res.status, data: await res.json() }; };
const kst = (n) => new Date(Date.now() + 9 * 3600000 + n * 86400000).toISOString().slice(0, 10);
const iso = (n) => new Date(Date.now() + n * 86400000).toISOString();
const SUB = { id: 'u1', full_name: '왕리', account_tier: 'sub', tenant_id: 't1', email: 'wang@aegis.example' };
const BOSS = { id: 'u9', full_name: '이호민', account_tier: 'service', tenant_id: 't1', email: 'lee@aegis.example' };
const OTHER = { id: 'u8', full_name: '남', account_tier: 'service', tenant_id: 't2' };
const card = { id: 'c1', tenant_id: 't1', title: '타정기 5구', title_cn: '5冲压片机', client_id: 'co1', client_name: '예시상사', client_visible: true, status: 'IN_PROGRESS', owner_id: 'u1', factory_name: '기존 공장', quote_deadline: kst(-2), inquiry_details: { categories: ['기계설비'] } };
const quote = { id: 'q1', tenant_id: 't1', card_id: 'c1', status: 'DRAFT', quote_title: 'ZP-5B', rounding_version: 2, final_total: 3000, final_currency: 'USD', exchange_rate_usd_cny: 7, quote_options: [{ option_name: '본체', quantity: 1, unit_price: 19000, currency: 'CNY' }], lead_time_business_days: 20, validity_days: 30 };
globalThis.__db = {
  User: [SUB, BOSS, OTHER], TaskCard: [card, { id: 'c2', tenant_id: 't1', title: '책임자 없는 카드', status: 'TODO', inquiry_details: { categories: ['기계설비'] } }, { id: 'cx', tenant_id: 't2', title: '남의 팀 카드', status: 'TODO' }],
  Quotation: [quote], OperationSetting: [{ id: 'os', tenant_id: 't1', margin_min_pct: 12, margin_rules: [{ scope: 'CATEGORY', category: '기계설비', default_pct: 18 }], intake_rules: [{ scope: 'CATEGORY', category: '기계설비', owner_id: 'u9' }] }],
  FactoryRequest: [], CardMilestone: [], QCPrecheck: [], Notification: [], ProjectAuditLog: [], Company: [], ExchangeRate: [],
};
globalThis.__emails = [];

// 마진 기준
globalThis.__user = SUB;
let r = await call('assistantQuote', { action: 'margin_rule', card_id: 'c1' });
assert.deepEqual([r.data.default_pct, r.data.min_pct, r.data.default_label], [18, 12, '기계설비 카테고리 규칙']);
assert.equal((await call('assistantQuote', { action: 'margin_rule', card_id: 'cx' })).status, 404, '다른 팀 카드');

// 검토 전 확인: 팀원에게는 원가·마진을 주지 않는다
r = await call('assistantQuote', { action: 'check', quotation_id: 'q1' });
assert.equal(r.data.summary.total, 3000);
assert.equal(r.data.summary.margin_pct, undefined, '팀원에게 마진 없음');
assert.equal(r.data.summary.cost_usd, undefined);
assert.ok(!r.data.checks.some((c) => ['low_margin', 'loss'].includes(c.code)));
globalThis.__user = BOSS;
r = await call('assistantQuote', { action: 'check', quotation_id: 'q1' });
assert.equal(r.data.summary.margin_pct, 9.5);
assert.ok(r.data.checks.some((c) => c.code === 'low_margin' && /기준\(12%\)|팀 기본값 12%/.test(c.text)), JSON.stringify(r.data.checks));

// 검토 요청 (화면과 같은 공용 코드)
globalThis.__user = SUB;
r = await call('assistantQuote', { action: 'request_review', quotation_id: 'q1', note: '비서로 요청' });
assert.equal(r.status, 200, JSON.stringify(r.data));
assert.equal(globalThis.__db.Quotation[0].status, 'REVIEW');
assert.equal(globalThis.__db.Quotation[0].review_note, '비서로 요청');
const n = globalThis.__db.Notification.find((x) => x.type === 'quote_review_requested');
assert.equal(n.recipient_id, 'u9');
assert.match(n.body, /메모: 비서로 요청/);
assert.equal((await call('assistantQuote', { action: 'request_review', quotation_id: 'q1' })).status, 400, '이미 검토 중');
assert.equal((await call('assistantQuote', { action: 'approve_send', quotation_id: 'q1' })).status, 400, '승인·발송은 비서 도구에 없다');

// 공장 견적 링크
r = await call('assistantQuote', { action: 'factory_link', card_id: 'c1', factory_name: '운용(云涌)' });
assert.equal(r.status, 200, JSON.stringify(r.data));
const fr = globalThis.__db.FactoryRequest.at(-1);
assert.equal(fr.factory_name, '운용(云涌)');
assert.equal(fr.factory_id, '');
assert.deepEqual(fr.items.map((i) => i.kind), ['QUOTE']);
assert.match(fr.message_cn, /请根据以下产品提供正式报价单/);
assert.match(fr.message_cn, /产品：5冲压片机/, '공장용 중국어 제목');
assert.equal(fr.created_by_name, '왕리 (AI 비서)');
assert.match(r.data.link, /\/f\/[A-Za-z0-9_-]{40,64}$/);
assert.match(r.data.pin, /^\d{6}$/);
assert.equal(fr.pin_hash, await F.pinHash(r.data.link.split('/f/')[1], r.data.pin), 'PIN은 해시로만 저장');
assert.match(r.data.wechat_text, /验证码（PIN）：\d{6}/);
assert.match(r.data.wechat_text, /1\. 报价单/);
assert.equal(globalThis.__db.ProjectAuditLog.at(-1).event_type, 'FACTORY_REQUEST_CREATED');
r = await call('assistantQuote', { action: 'factory_link', card_id: 'c1', with_photo: true });
assert.deepEqual(globalThis.__db.FactoryRequest.at(-1).items.map((i) => i.kind), ['QUOTE', 'PHOTO']);
assert.equal(globalThis.__db.FactoryRequest.at(-1).factory_name, '기존 공장', '공장 이름을 안 주면 카드의 공장');

// 현황: quotes
globalThis.__db.FactoryRequest[0].created_date = iso(-4);
globalThis.__db.Quotation.push(
  { id: 'q2', tenant_id: 't1', card_id: 'c1', status: 'DRAFT', quote_title: '공장 초안', factory_request_id: 'fr', factory_name: '운용' },
  { id: 'q3', tenant_id: 't1', card_id: 'c1', status: 'DRAFT', quote_title: '반려된 것', review_rejected_reason: '마진 올려 주세요' },
  { id: 'q4', tenant_id: 't1', card_id: 'c1', status: 'SENT', quote_title: '보낸 지 5일', client_published_at: iso(-5), validity_days: 30 },
  { id: 'q5', tenant_id: 't1', card_id: 'c1', status: 'SENT', quote_title: '곧 만료', client_published_at: iso(-29), validity_days: 30 },
);
globalThis.__db.Quotation[0].review_requested_at = iso(-2);
globalThis.__user = BOSS;
r = await call('assistantStatus', { topic: 'quotes' });
const Q = r.data.quotes;
assert.deepEqual(Q.approval_waiting.map((x) => [x.title, x.requested_by, x.waiting_days]), [['ZP-5B', '왕리', 2]]);
assert.equal(Q.approval_waiting[0].margin_pct, 9.5, '팀 관리자에게는 마진');
assert.equal(Q.factory_quote_waiting.length, 2);
assert.equal(Q.factory_quote_waiting.find((x) => x.factory_name === '운용(云涌)').days, 4);
assert.deepEqual(Q.factory_drafts.map((x) => x.title), ['공장 초안']);
assert.deepEqual(Q.rejected.map((x) => x.reason), ['마진 올려 주세요']);
assert.deepEqual(Q.awaiting_client_reply.map((x) => x.title), ['보낸 지 5일']);
assert.deepEqual(Q.validity_expiring_or_expired.map((x) => x.title), ['곧 만료']);
assert.equal(r.data.signatures, undefined, 'quotes 만 물으면 다른 현황은 읽지 않는다');
globalThis.__user = SUB;
r = await call('assistantStatus', { topic: 'quotes' });
assert.equal(r.data.quotes.approval_waiting[0].margin_pct, undefined, '팀원에게 마진 없음');
assert.deepEqual(r.data.quotes.approval_waiting[0].warnings, []);
assert.equal(r.data.quotes.costs_visible, false);

// 현황: intake
r = await call('assistantStatus', { topic: 'intake' });
const I = r.data.intake;
assert.deepEqual(I.unassigned.map((x) => [x.card_title, x.suggest]), [['책임자 없는 카드', '이호민 (기계설비 카테고리 규칙)']]);
assert.deepEqual(I.quote_deadline_overdue.map((x) => x.card_title), [], '고객에게 보낸 견적이 있으면 견적 기한 지남이 아니다');
globalThis.__db.Quotation = globalThis.__db.Quotation.filter((q) => !q.client_published_at);
r = await call('assistantStatus', { topic: 'intake' });
assert.deepEqual(r.data.intake.quote_deadline_overdue.map((x) => [x.card_title, x.days_over]), [['타정기 5구', 2]]);
assert.equal(r.data.intake.rules_set, true);
console.log('assistant-quote ok');
