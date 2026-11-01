// 영업 데모 환경 검산: 데모 팀 안에만 만들고 지우는지, 다시 초기화해도 늘어나지 않는지,
// 예시 데이터가 성과 리포트까지 이어지는지, 팀 관리자·팀원이 데모 고객사 포털만 읽기 전용으로 여는지.
// 실행: npm run check:demo-environment
import assert from 'node:assert/strict';
import { demoDataset, DEMO_ENTITIES } from '../base44/shared/demoSeed.ts';

const call = async (fn, body) => { const m = await import('../base44/functions/' + fn + '/entry.ts'); const res = await m.default(new Request('https://x', { method: 'POST', body: JSON.stringify(body) })); return { status: res.status, data: await res.json() }; };

// ── 예시 데이터 자체
const ds = demoDataset('2026-11-01');
const cardRefs = new Set(ds.cards.map((c) => c.ref));
for (const k of ['quotes', 'milestones', 'qcReports', 'shipments', 'stages', 'landed', 'claims', 'meetings']) for (const r of ds[k]) assert.ok(cardRefs.has(r.card), `${k} → 없는 카드 ${r.card}`);
for (const q of ds.quotes) { assert.ok(ds.factories.some((f) => f.ref === q.factory), q.ref); assert.ok(q.final_total > 0 && q.price_lines.length, q.ref); }
assert.ok(ds.cards.some((c) => c.status === 'IN_PROGRESS') && ds.cards.some((c) => c.status === 'REVIEW') && ds.cards.some((c) => c.status === 'PRODUCTION') && ds.cards.some((c) => c.status === 'DONE'), '단계마다 카드가 있다');
assert.equal(demoDataset('2027-03-10').cards.find((c) => c.ref === 'c:box').quote_deadline, '2027-03-12', '날짜는 오늘 기준');

// ── 서버
const MASTER = { id: 'm1', full_name: '대표', account_tier: 'master', tenant_id: 'hq' };
const BOSS = { id: 'u9', full_name: '이호민', account_tier: 'service', tenant_id: 'hq' };
const SUB = { id: 'u1', full_name: '왕리', account_tier: 'sub', tenant_id: 'hq' };
const CLIENT = { id: 'c1', account_tier: 'client', company_id: 'real-co', tenant_id: 'ct' };
const REAL = { TaskCard: [{ id: 'real-card', tenant_id: 'hq', client_id: 'real-co', client_visible: true, title: '실제 카드', status: 'IN_PROGRESS' }], Company: [{ id: 'real-co', tenant_id: 'hq', company_type: 'CLIENT', company_name: '실제 고객사' }], Quotation: [{ id: 'real-q', tenant_id: 'hq', card_id: 'real-card' }] };
globalThis.__db = { User: [MASTER, BOSS, SUB, CLIENT], Tenant: [{ id: 'hq', name: '본사', slug: 'hq', is_hq: true }], Notification: [], ExchangeRate: [] };
for (const [k, v] of Object.entries(REAL)) globalThis.__db[k] = v.map((x) => ({ ...x }));
globalThis.__emails = [];

globalThis.__user = SUB;
assert.equal((await call('demoEnvironment', { action: 'status' })).data.ready, false);
assert.equal((await call('demoEnvironment', { action: 'reset' })).status, 403, '팀원은 초기화 못 한다');

globalThis.__user = BOSS;
let r = await call('demoEnvironment', { action: 'reset' });
assert.equal(r.status, 200, JSON.stringify(r.data));
const demo = globalThis.__db.Tenant.find((t) => t.slug === 'aegis-demo');
assert.equal(demo.is_demo, true);
assert.equal(r.data.ready, true);
assert.equal(r.data.cards, ds.cards.length);
let companyId = r.data.company_id;
const counts = () => Object.fromEntries(DEMO_ENTITIES.map((n) => [n, (globalThis.__db[n] || []).filter((x) => x.tenant_id === demo.id).length]));
const first = counts();
assert.equal(first.TaskCard, ds.cards.length);
assert.equal(first.Quotation, ds.quotes.length);
assert.equal(first.Company, 1 + ds.factories.length);
assert.equal(first.PerformanceReport, 1);
assert.equal(globalThis.__db.Notification.length + globalThis.__emails.length, 0, '데모는 아무에게도 알리지 않는다');
const cards = globalThis.__db.TaskCard.filter((c) => c.tenant_id === demo.id);
assert.ok(cards.every((c) => c.client_id === companyId && c.is_demo === true && c.client_visible === true));
let reorder = cards.find((c) => c.title === '휴대용 미니 선풍기 3,000개');
assert.equal(globalThis.__db.TaskCard.find((c) => c.id === reorder.reorder_of).title, '휴대용 미니 선풍기 2,000개 (첫 주문)', '재주문 연결');
const claim = globalThis.__db.QualityClaim.find((c) => c.tenant_id === demo.id);
assert.equal(globalThis.__db.TaskCard.find((c) => c.id === claim.compensation.applied_card_id).title, '실리콘 주방 집게 5,000개', '보상 반영 카드 연결');
const rep = globalThis.__db.PerformanceReport.find((x) => x.tenant_id === demo.id);
assert.equal(rep.status, 'PUBLISHED');
const m = rep.metrics;
assert.ok(m.projects_active >= 4 && m.quotes_sent >= 5 && m.qc_reports >= 4, JSON.stringify(m));
assert.ok(m.savings_products >= 2 && m.savings_pct_avg > 0, '비교 견적 절감이 보인다');
assert.ok(m.qc_issues_caught >= 2 && m.claims_resolved >= 1 && m.compensation.USD === 450);
assert.ok(m.first_quote_days_avg > 0, '요청일 기준으로 첫 견적까지 걸린 날');
assert.equal(rep.trends.length, 1, '재주문 개당 원가 변화');
assert.ok(rep.trends[0].change_pct < 0, '재주문 때 개당 원가가 내려감');
assert.match(rep.highlights, /최근 6개월 동안/);

// 다시 초기화해도 늘어나지 않고, 실제 팀 데이터는 그대로
r = await call('demoEnvironment', { action: 'reset' });
assert.deepEqual(counts(), first, '초기화는 지우고 다시 만든다');
assert.notEqual(r.data.company_id, companyId, '고객사도 새로 만든다');
companyId = r.data.company_id;
reorder = globalThis.__db.TaskCard.find((c) => c.tenant_id === demo.id && c.title === '휴대용 미니 선풍기 3,000개');
assert.equal(globalThis.__db.Tenant.filter((t) => t.slug === 'aegis-demo').length, 1);
for (const [k, v] of Object.entries(REAL)) for (const x of v) assert.ok(globalThis.__db[k].some((y) => y.id === x.id), `실제 ${k} ${x.id} 남아 있음`);
assert.ok(demo.demo_reset_at && demo.demo_reset_by_name === '이호민');

// 데모 고객사 포털: 팀원도 읽기 전용으로 열 수 있다, 실제 고객사는 못 연다
globalThis.__user = SUB;
r = await call('getClientPerformanceReports', { view_company_id: companyId });
assert.equal(r.status, 200, JSON.stringify(r.data));
assert.equal(r.data.reports.length, 1);
assert.equal((await call('getClientPerformanceReports', { view_company_id: 'real-co' })).status, 403, '실제 고객사 포털은 못 연다');
assert.equal((await call('getClientPerformanceReports', {})).status, 403, '팀원은 고객 포털 직접 접근 불가');
r = await call('listClientCards', { view_company_id: companyId });
assert.equal(r.status, 200, JSON.stringify(r.data));
assert.ok((r.data.cards || []).length >= ds.cards.length - 1, '데모 카드가 보인다');
assert.equal((await call('clientCardAction', { view_company_id: companyId, action: 'accept_quote', card_id: reorder.id })).status, 403, '쓰기는 막힌다');

// 진짜 고객은 데모를 못 본다
globalThis.__user = CLIENT;
assert.equal((await call('getClientPerformanceReports', { view_company_id: companyId })).data.reports.length, 0, '고객은 자기 회사만');

// 지우기
globalThis.__user = BOSS;
r = await call('demoEnvironment', { action: 'remove' });
assert.ok(Object.values(counts()).every((n) => n === 0), JSON.stringify(counts()));
assert.equal((await call('demoEnvironment', { action: 'status' })).data.ready, false);
for (const [k, v] of Object.entries(REAL)) for (const x of v) assert.ok(globalThis.__db[k].some((y) => y.id === x.id), `지운 뒤에도 실제 ${k} 남아 있음`);
console.log('demo-environment ok');
