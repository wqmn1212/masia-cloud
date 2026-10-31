// 마진 규칙 검산: 규칙 정리, 고객사 → 카테고리 → 팀 기본 → 앱 기본 우선순위(칸마다 따로), 항목 마진 채우기,
// 승인 확인의 최소 마진, 서버 함수(margin_rule · save_margin_rules 권한), 공장 견적 초안에 기준 마진.
// 실행: npm run check:margin-rule
import assert from 'node:assert/strict';
import * as M from '../base44/shared/marginRule.ts';
import * as R from '../base44/shared/quoteReview.ts';

// 규칙 정리
const cleaned = M.cleanRules([
  { scope: 'CLIENT', client_id: 'co1', client_name: '도깨비산업기계', default_pct: '18', min_pct: 12 },
  { scope: 'CATEGORY', category: '기계설비', default_pct: 20 },
  { scope: 'CATEGORY', category: '굿즈 · 조형', min_pct: 25, default_pct: 30 },
  { scope: 'CATEGORY', category: '기계설비', default_pct: 22, note: '나중 것이 이긴다' },
  { scope: 'CLIENT', client_id: '', default_pct: 10 },
  { scope: 'CATEGORY', category: '리빙 · 공구' },
  { scope: 'NOPE', category: 'x', default_pct: 5 },
  { scope: 'CLIENT', client_id: 'co2', default_pct: -3, min_pct: 9999 },
]);
assert.deepEqual(cleaned.map((r) => `${r.scope}:${r.client_id || r.category}:${r.default_pct}:${r.min_pct}`), ['CLIENT:co1:18:12', 'CATEGORY:기계설비:22:null', 'CATEGORY:굿즈 · 조형:30:25']);

// 우선순위
const setting = { margin_default_pct: 16, margin_min_pct: 11, margin_rules: cleaned };
const machine = { client_id: 'co9', client_name: '다른 고객', inquiry_details: { categories: ['기계설비'] } };
let r = M.resolveMargin(setting, { client_id: 'co1', client_name: '도깨비산업기계', inquiry_details: { categories: ['기계설비'] } });
assert.deepEqual([r.default_pct, r.min_pct, r.default_source, r.min_source], [18, 12, 'CLIENT', 'CLIENT']);
assert.equal(r.min_label, '도깨비산업기계 고객사 규칙');
r = M.resolveMargin(setting, machine);
assert.deepEqual([r.default_pct, r.min_pct, r.default_source, r.min_source], [22, 11, 'CATEGORY', 'TEAM'], '카테고리 규칙에 최소가 없으면 팀 기본');
r = M.resolveMargin(setting, { inquiry_details: { categories: ['기타', '굿즈 · 조형', '기계설비'] } });
assert.deepEqual([r.default_pct, r.min_pct, r.default_label], [30, 25, '굿즈 · 조형 카테고리 규칙'], '카드 카테고리 순서대로 첫 규칙');
r = M.resolveMargin({}, {});
assert.deepEqual([r.default_pct, r.min_pct, r.default_source], [15, 10, 'BASE']);
r = M.resolveMargin({ margin_rules: [{ scope: 'CLIENT', client_id: 'co1', min_pct: 8 }] }, { client_id: 'co1', client_name: '도깨비' });
assert.deepEqual([r.default_pct, r.min_pct, r.min_label], [15, 8, '도깨비 고객사 규칙'], '고객사 규칙이 최소만 있으면 기본 마진은 앱 기본');

// 항목 마진 채우기
assert.deepEqual(M.fillMargins([{ margin_percent: '' }, { margin_percent: 5 }, {}], 18).map((o) => o.margin_percent), [18, 5, 18]);

// 승인 확인의 최소 마진
const q = { status: 'DRAFT', rounding_version: 2, final_total: 1150, final_currency: 'USD', exchange_rate_usd_cny: 7, quote_options: [{ option_name: 'A', quantity: 1, unit_price: 7000, currency: 'CNY' }], lead_time_business_days: 10, validity_days: 30 };
const card = { id: 'c1', tenant_id: 't1', title: '타정기', client_id: 'co1', client_name: '도깨비산업기계', client_visible: true, inquiry_details: { categories: ['기계설비'] } };
// 마진 13%: 앱 기본 10% 이상이라 주의 없음, 고객사 규칙 최소 15%면 주의
assert.ok(!R.reviewChecks(q, card, '2026-11-02').some((c) => c.code === 'low_margin'));
const strict = M.resolveMargin({ margin_rules: [{ scope: 'CLIENT', client_id: 'co1', client_name: '도깨비산업기계', min_pct: 15 }] }, card);
const low = R.reviewChecks(q, card, '2026-11-02', strict).find((c) => c.code === 'low_margin');
assert.equal(low.text, '마진이 13%로 기준(도깨비산업기계 고객사 규칙 15%)보다 낮습니다');
assert.equal(R.reviewChecks({ ...q, final_total: 1050 }, card, '2026-11-02', M.resolveMargin({}, card)).find((c) => c.code === 'low_margin').text, '마진이 4.8%로 기준(10%)보다 낮습니다', '앱 기본은 출처를 쓰지 않는다');
const queue = R.approvalQueue([{ ...q, id: 'a', card_id: 'c1', status: 'REVIEW' }], { c1: card }, '2026-11-02', () => strict);
assert.ok(queue.review[0].checks.some((c) => c.code === 'low_margin'), '승인함도 규칙을 따른다');
console.log('margin-rule module ok');

// 서버 함수
const call = async (fn, body) => { const m = await import('../base44/functions/' + fn + '/entry.ts'); const res = await m.default(new Request('https://x', { method: 'POST', body: JSON.stringify(body) })); return { status: res.status, data: await res.json() }; };
const SUB = { id: 'u1', full_name: '왕리', account_tier: 'sub', tenant_id: 't1' };
const BOSS = { id: 'u9', full_name: '이호민', account_tier: 'service', tenant_id: 't1', email: 'lee@aegis.example' };
globalThis.__db = { TaskCard: [card], User: [SUB, BOSS], OperationSetting: [], Quotation: [{ ...q, id: 'q1', card_id: 'c1', tenant_id: 't1', updated_date: 'x' }], Notification: [], ProjectAuditLog: [] };
globalThis.__emails = [];

globalThis.__user = SUB;
assert.equal((await call('quoteApproval', { action: 'save_margin_rules', margin_default_pct: 20 })).status, 403, '직원은 규칙을 못 바꾼다');
r = await call('quoteApproval', { action: 'margin_rule', card_id: 'c1' });
assert.deepEqual([r.data.default_pct, r.data.min_pct], [15, 10], '규칙이 없으면 앱 기본');

globalThis.__user = BOSS;
r = await call('quoteApproval', { action: 'save_margin_rules', margin_default_pct: '17', margin_min_pct: '', margin_rules: [{ scope: 'CLIENT', client_id: 'co1', client_name: '도깨비산업기계', default_pct: 20, min_pct: 15 }, { scope: 'CATEGORY', category: '기계설비' }] });
assert.equal(r.status, 200, JSON.stringify(r.data));
const saved = globalThis.__db.OperationSetting[0];
assert.equal(saved.tenant_id, 't1');
assert.equal(saved.margin_default_pct, 17);
assert.equal(saved.margin_min_pct, null);
assert.equal(saved.margin_rules.length, 1, '숫자 없는 규칙은 버린다');
assert.equal(saved.updated_by, '이호민');

globalThis.__user = SUB;
r = await call('quoteApproval', { action: 'margin_rule', card_id: 'c1' });
assert.deepEqual([r.data.default_pct, r.data.min_pct, r.data.default_label], [20, 15, '도깨비산업기계 고객사 규칙']);
r = await call('quoteApproval', { action: 'preview', quotation_id: 'q1' });
assert.equal(r.data.rule.min_pct, 15);
assert.ok(r.data.checks.some((c) => c.code === 'low_margin' && /고객사 규칙 15%/.test(c.text)), JSON.stringify(r.data.checks));

// 공장 견적 초안에 기준 마진 채우기
globalThis.__db.FactoryRequest = [{ id: 'fr1', tenant_id: 't1', card_id: 'c1', factory_name: '운용', status: 'OPEN', expires_at: '2099-01-01T00:00:00Z', quote_import_pending: true,
  items: [{ key: 'i1', kind: 'QUOTE', label_ko: '공장 견적서', label_cn: '报价单', status: 'SUBMITTED' }],
  submissions: [{ item_key: 'i1', file_name: 'q.csv', file_uri: 'private://q.csv', submitted_at: '2026-11-02T01:00:00Z', review: '' }] }];
globalThis.__db.ExchangeRate = [];
globalThis.__llm = async () => ({ items: [{ name_ko: '본체', quantity: 1, unit_price: 16000, amount: 16000 }, { name_ko: '도금', quantity: 1, unit_price: 500, amount: 500, in_total: false }], stated_total: 16000 });
globalThis.fetch = async () => new Response('품목,단가\n본체,16000\n');
globalThis.__user = null;
r = await call('importFactoryQuote', { request_id: 'fr1' });
assert.equal(r.data.created, 1, JSON.stringify(r.data));
const draft = globalThis.__db.Quotation.at(-1);
assert.deepEqual(draft.quote_options.map((o) => o.margin_percent), [20, 20], '선택 사양까지 같은 기준 마진');
assert.match(draft.internal_notes, /^기준 마진 20% 채움 \(도깨비산업기계 고객사 규칙\)/);
console.log('margin-rule functions ok');
