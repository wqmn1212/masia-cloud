// 공장 견적 요청 검산: 견적서(QUOTE) 항목, 제출 → 읽기 대기 표시, 견적 초안 만들기(공장 원가·조건·환율·내부 메모),
// 동시 실행 중복 방지, 읽기 실패와 다시 읽기, 권한, 채택하면 카드 파일(견적서), 알림.
// 실행: npm run check:factory-quote
import assert from 'node:assert/strict';
import * as F from '../base44/shared/factoryRequest.ts';
import * as Q from '../base44/shared/factoryQuote.ts';
import * as FL from '../src/lib/factoryRequest.js';

// 항목·제출 규칙
const items = F.cleanItems([{ kind: 'QUOTE', label_ko: '공장 견적서', label_cn: '报价单' }, { kind: 'PHOTO', label_ko: '사진', label_cn: '照片' }]);
assert.equal(items[0].kind, 'QUOTE');
assert.equal(items[0].doc_type, 'QUOTATION', '채택하면 카드 파일에 견적서 종류로 들어간다');
assert.equal(F.fileAllowed('报价单.docx', 1000), '', '워드(.docx) 견적서도 받는다');
assert.match(F.fileAllowed('报价单.doc', 1000), /docx/);
const req0 = { status: 'OPEN', expires_at: '2099-01-01T00:00:00Z', items, submissions: [] };
assert.match(F.submitPatch(req0, 'i1', { answer: '见附件' }).error, /견적서 파일/);
const sp = F.submitPatch(req0, 'i1', { file_name: 'ZP-5B报价单.xlsx', file_uri: 'private://zp', answer: '含税价' });
assert.equal(sp.patch.quote_import_pending, true, '견적서가 올라오면 읽기 대기');
assert.equal(F.submitPatch(req0, 'i2', { file_name: 'a.jpg', file_uri: 'private://a' }).patch.quote_import_pending, undefined, '사진은 읽지 않는다');
assert.deepEqual(FL.ITEM_KINDS, F.ITEM_KINDS);
assert.deepEqual(FL.KIND_LABEL, F.KIND_LABEL);
assert.ok(FL.PRESETS.some((p) => p.kind === 'QUOTE'));

// 읽을 제출물 고르기
const now = new Date('2026-11-02T03:00:00Z');
const subs = [
  { item_key: 'i1', file_uri: 'private://a', submitted_at: '2026-11-02T01:00:00Z' },
  { item_key: 'i1', file_uri: 'private://b', submitted_at: '2026-11-02T01:10:00Z', quotation_id: 'q9' },
  { item_key: 'i1', file_uri: 'private://c', submitted_at: '2026-11-02T01:20:00Z', import_error: '읽지 못함' },
  { item_key: 'i1', file_uri: 'private://d', submitted_at: '2026-11-02T01:30:00Z', import_started_at: '2026-11-02T02:55:00Z' },
  { item_key: 'i1', file_uri: 'private://e', submitted_at: '2026-11-02T01:40:00Z', import_started_at: '2026-11-02T02:00:00Z' },
  { item_key: 'i2', file_uri: 'private://f', submitted_at: '2026-11-02T01:50:00Z' },
];
const r0 = { items, submissions: subs };
assert.deepEqual(Q.pendingQuoteSubs(r0, now).map((s) => s.file_uri), ['private://a', 'private://e'], '초안 있음·실패·방금 집어 감·사진은 뺀다 (10분 넘게 멈춘 것은 다시)');
assert.deepEqual(Q.pendingQuoteSubs(r0, now, { retry: true }).map((s) => s.file_uri), ['private://a', 'private://c', 'private://e'], '다시 읽기는 실패한 것도');

// 초안 레코드
const normalized = {
  form: {
    factory_name: '운용(云涌)', product_name: '회전식 타정기', model_name: 'ZP-5B', quote_title: '회전식 타정기 ZP-5B', incoterms: 'exw', logistics_cost: 0,
    quote_options: [
      { option_name: '본체', option_name_cn: '主机', quantity: 1, unit_label: '대', unit_price: 16000, currency: 'CNY' },
      { option_name: '이형 금형', quantity: 5, unit_label: '세트', unit_price: 200, currency: 'CNY' },
      { option_name: '플라즈마 도금', quantity: 5, unit_price: 340, currency: 'CNY', optional: true },
    ],
    spec_table: [{ label: '생산량', value: '6,000정/시간' }], remarks: '부가세 별도', internal_notes: '원문: 含税另计',
    lead_time_business_days: 20, validity_days: 30, payment_terms_pending: true, factory_quote_date: '2026-10-29', factory_cost_currency: 'CNY',
  },
  checks: [{ level: 'warn', text: '합계가 견적서 합계와 다릅니다' }, { level: 'info', text: '선택 사양 1개' }],
};
const card = { id: 'c1', tenant_id: 't1', title: '타정기 5구', client_id: 'co1', client_name: '도깨비산업기계', factory_name: '기존 공장', factory_id: 'f0', owner_id: 'u9' };
const request = { id: 'fr1', factory_name: '운용(云涌)', factory_id: '' };
const sub = { file_name: 'ZP-5B报价单.xlsx', submitted_at: '2026-11-02T01:00:00Z', answer: '含税价另加13%' };
const rec = Q.draftQuotation(normalized, { card, request, sub, rates: { rate_date: '2026-11-02', usd_krw: 1390, usd_cny: 7.1 } });
assert.equal(rec.status, 'DRAFT');
assert.equal(rec.factory_name, '운용(云涌)', '링크를 만든 공장 이름이 우선');
assert.equal(rec.factory_id, '', '다른 공장이면 카드의 공장 ID를 쓰지 않는다');
assert.equal(rec.client_id, 'co1');
assert.equal(rec.incoterms, 'EXW');
assert.equal(rec.factory_total_cost, 17000, '선택 사양은 공장 원가에서 뺀다');
assert.equal(rec.factory_cost_currency, 'CNY');
assert.equal(rec.quote_options.length, 3);
assert.equal(rec.quote_options[2].optional, true);
assert.equal(rec.quote_options[0].margin_percent, undefined, '마진은 비워 둔다');
assert.equal(rec.lead_time_business_days, 20);
assert.equal(rec.exchange_rate_usd_cny, 7.1);
assert.equal(rec.factory_request_id, 'fr1');
assert.match(rec.internal_notes, /공장 업로드 링크로 받은 견적서: ZP-5B报价单.xlsx \(2026-11-02\)/);
assert.match(rec.internal_notes, /공장 메모: 含税价另加13%/);
assert.match(rec.internal_notes, /읽기 확인:\n· 합계가 견적서 합계와 다릅니다/);
assert.doesNotMatch(rec.internal_notes, /선택 사양 1개/, '안내는 메모에 넣지 않는다');
assert.equal(Q.draftLine(rec), '품목 2개 (+선택 사양 1개) · 공장 원가 ¥17,000 · 납기 20영업일');
assert.equal(Q.draftQuotation({ form: { quote_options: [{ option_name: 'A', quantity: 1, unit_price: 10, currency: 'USD' }, { option_name: 'B', quantity: 1, unit_price: 10, currency: 'CNY' }] } }, { card, request, sub }).factory_total_cost, undefined, '통화가 섞이면 원가 합계를 비운다');
console.log('factory-quote module ok');

// 서버 함수
const R = '../base44/functions/';
const call = async (fn, body) => { const m = await import(R + fn + '/entry.ts'); const res = await m.default(new Request('https://x', { method: 'POST', body: JSON.stringify(body) })); return { status: res.status, data: await res.json() }; };
const STAFF = { id: 'u9', full_name: '이호민', account_tier: 'service', tenant_id: 't1', email: 'lee@aegis.example' };
const OTHER = { id: 'u8', account_tier: 'service', tenant_id: 't2' };
const RAW = {
  supplier_name: '运涌', quote_date: '2026-10-29', currency: '人民币', title: '旋转式压片机 ZP-5B 报价单', product_name: '회전식 타정기', model_name: 'ZP-5B',
  items: [{ name_ko: '본체', name_cn: '主机', quantity: 1, unit_label: '대', unit_price: 16000, amount: 16000 }, { name_ko: '금형', quantity: 5, unit_price: 200, amount: 1000 }],
  stated_total: 17000, terms: [{ text_ko: '선금 입금 후 20영업일 출고', kind: 'LEAD_TIME' }],
};
let llmCalls = 0;
globalThis.__llm = async () => { llmCalls++; return RAW; };
globalThis.fetch = async (url) => (String(url).startsWith('https://files.example/') ? new Response('품목,수량,단가\n본체,1,16000\n금형,5,200\n') : new Response('nope', { status: 404 }));
globalThis.__signed = (uri) => `https://files.example/${uri.replace('private://', '')}?sig=1`;
const quoteItems = F.cleanItems([{ kind: 'QUOTE', label_ko: '공장 견적서', label_cn: '报价单' }]);
globalThis.__db = {
  TaskCard: [card], User: [STAFF, OTHER], Notification: [], ProjectAuditLog: [], Quotation: [], CardAttachment: [],
  ExchangeRate: [{ id: 'x1', rate_date: '2026-11-02', usd_krw: 1390, usd_cny: 7.1 }],
  FactoryRequest: [{ id: 'fr1', tenant_id: 't1', card_id: 'c1', factory_name: '운용(云涌)', status: 'OPEN', expires_at: '2099-01-01T00:00:00Z', items: quoteItems, quote_import_pending: true,
    submissions: [{ item_key: 'i1', file_name: 'ZP-5B报价单.csv', file_uri: 'private://zp.csv', answer: '', submitted_at: '2026-11-02T01:00:00Z', review: '' }] }],
};
globalThis.__emails = [];
const FR = () => globalThis.__db.FactoryRequest[0];

globalThis.__user = OTHER;
assert.equal((await call('importFactoryQuote', { request_id: 'fr1' })).status, 404, '다른 팀은 안 된다');
globalThis.__user = { id: 'c', account_tier: 'client' };
assert.equal((await call('importFactoryQuote', { request_id: 'fr1' })).status, 403);

// 워크플로우(로그인 없음)로 읽기
globalThis.__user = null;
let r = await call('importFactoryQuote', { request_id: 'fr1' });
assert.equal(r.status, 200, JSON.stringify(r.data));
assert.equal(r.data.created, 1, JSON.stringify(r.data));
const q = globalThis.__db.Quotation[0];
assert.equal(q.status, 'DRAFT');
assert.equal(q.card_id, 'c1');
assert.equal(q.factory_name, '운용(云涌)');
assert.equal(q.factory_total_cost, 17000);
assert.equal(q.exchange_rate_usd, 1390);
assert.equal(FR().submissions[0].quotation_id, q.id);
assert.equal(FR().quote_import_pending, false);
const note = globalThis.__db.Notification.find((n) => n.type === 'factory_quote_imported');
assert.equal(note.recipient_id, 'u9', '카드 책임자에게');
assert.match(note.title, /\[공장 견적 도착\] 타정기 5구 · 운용/);
assert.match(note.body, /견적 초안을 만들었습니다: .* · 품목 2개 · 공장 원가 ¥17,000/);
assert.match(note.body, /"검토 요청"/);
assert.equal(note.link, '/task-board?card=c1&tab=quotation');
assert.deepEqual(globalThis.__db.ProjectAuditLog.map((a) => a.event_type), ['FACTORY_QUOTE_IMPORTED']);

// 다시 불러도 같은 견적서로 초안을 또 만들지 않는다
r = await call('importFactoryQuote', { request_id: 'fr1' });
assert.equal(r.data.created, 0);
assert.equal(globalThis.__db.Quotation.length, 1);
assert.equal(llmCalls, 1);

// 두 번째 공장 견적: 읽기 실패 → 직원이 다시 읽기, 공장이 둘이면 비교표 안내
globalThis.__db.Quotation.push({ id: 'q-old', card_id: 'c1', factory_name: '기존 공장', status: 'DRAFT' });
FR().submissions.push({ item_key: 'i1', file_name: 'v2.csv', file_uri: 'private://v2.csv', answer: '', submitted_at: '2026-11-02T02:00:00Z', review: '' });
FR().quote_import_pending = true;
globalThis.__llm = async () => { llmCalls++; throw new Error('AI 응답 없음'); };
r = await call('importFactoryQuote', { request_id: 'fr1' });
assert.equal(r.data.failed, 1);
assert.match(FR().submissions[1].import_error, /AI 응답 없음/);
assert.match(globalThis.__db.Notification.at(-1).body, /읽지 못한 견적서: v2.csv/);
r = await call('importFactoryQuote', { request_id: 'fr1', retry: true });
assert.equal(r.data.created, 0, '로그인 없이 다시 읽기는 안 된다');
globalThis.__llm = async () => { llmCalls++; return RAW; };
globalThis.__user = STAFF;
r = await call('importFactoryQuote', { request_id: 'fr1', retry: true });
assert.equal(r.data.created, 1, JSON.stringify(r.data));
assert.equal(FR().submissions[1].import_error, '');
assert.match(globalThis.__db.Notification.at(-1).body, /공장 2곳의 견적이 있습니다/);

// 공장 제출: 견적서를 올리면 읽기 대기 + 직원 알림 문구
globalThis.__user = null;
const token = F.newToken(), pin = '123456';
globalThis.__db.FactoryRequest.push({ id: 'fr2', tenant_id: 't1', card_id: 'c1', factory_name: '광저우 신화', status: 'OPEN', expires_at: '2099-01-01T00:00:00Z', items: quoteItems, submissions: [], token_hash: await F.sha256Hex(token), pin_hash: await F.pinHash(token, pin) });
r = await call('submitFactoryRequest', { token, pin, item_key: 'i1', file: { name: '报价单.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: btoa('PK fake') }, answer: '交期25天' });
assert.equal(r.status, 200, JSON.stringify(r.data));
const fr2 = globalThis.__db.FactoryRequest.find((x) => x.id === 'fr2');
assert.equal(fr2.quote_import_pending, true);
assert.match(globalThis.__db.Notification.at(-1).body, /견적서를 올렸습니다. 자동으로 읽어 견적 초안을 만들고 있습니다/);

// 직원 채택: 카드 파일에 견적서 종류로
globalThis.__user = STAFF;
r = await call('manageFactoryRequest', { action: 'review', request_id: 'fr2', item_key: 'i1', decision: 'ACCEPT' });
assert.equal(r.status, 200, JSON.stringify(r.data));
assert.equal(globalThis.__db.CardAttachment.at(-1).document_type, 'QUOTATION');
assert.equal(globalThis.__db.CardAttachment.at(-1).client_visible, false);

// 링크 만들 때 공장 이름을 따로 줄 수 있다 (같은 카드, 여러 공장)
r = await call('manageFactoryRequest', { action: 'create', card_id: 'c1', factory_name: '선전 정밀', items: [{ kind: 'QUOTE', label_ko: '공장 견적서', label_cn: '报价单' }] });
assert.equal(r.status, 200, JSON.stringify(r.data));
const fr3 = globalThis.__db.FactoryRequest.at(-1);
assert.equal(fr3.factory_name, '선전 정밀');
assert.equal(fr3.factory_id, '');
assert.equal(fr3.items[0].doc_type, 'QUOTATION');
console.log('factory-quote functions ok');
