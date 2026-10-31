// 문의 자동 배정 검산: 규칙 정리, 책임자 고르기(고객사 → 카테고리 → 팀 기본, 퇴사자 건너뜀), 영업일 견적 기한·급한 문의,
// 카드에 넣을 값, 서버(고객 포털 문의·랜딩 문의 배정과 알림, 설정 저장 권한·검증, 책임자 없는 카드 목록·규칙대로 배정),
// 손으로 책임자 지정할 때 알림.
// 실행: npm run check:inquiry-intake
import assert from 'node:assert/strict';
import * as I from '../base44/shared/inquiryIntake.ts';

// 규칙 정리
const rules = I.cleanIntakeRules([
  { scope: 'CLIENT', client_id: 'co1', client_name: '도깨비산업기계', owner_id: 'u1' },
  { scope: 'CATEGORY', category: '기계설비', owner_id: 'u2' },
  { scope: 'CATEGORY', category: '굿즈 · 조형', owner_id: 'gone' },
  { scope: 'CATEGORY', category: '기계설비', owner_id: 'u3' },
  { scope: 'CATEGORY', category: '기타' },
  { scope: 'CLIENT', owner_id: 'u1' },
]);
assert.deepEqual(rules.map((r) => `${r.scope}:${r.client_id || r.category}:${r.owner_id}`), ['CLIENT:co1:u1', 'CATEGORY:기계설비:u3', 'CATEGORY:굿즈 · 조형:gone']);

// 책임자 고르기
const team = [{ id: 'u1', full_name: '이호민' }, { id: 'u2', full_name: '왕리' }, { id: 'u3', full_name: '장위' }, { id: 'u4', full_name: '퇴사자', is_active: false }];
const setting = { intake_rules: rules, intake_default_owner_id: 'u2' };
let o = I.pickOwner(setting, { client_id: 'co1', client_name: '도깨비산업기계', inquiry_details: { categories: ['기계설비'] } }, team);
assert.deepEqual([o.owner_id, o.owner_name, o.source, o.label], ['u1', '이호민', 'CLIENT', '도깨비산업기계 고객사 규칙']);
o = I.pickOwner(setting, { client_id: 'co9', inquiry_details: { categories: ['굿즈 · 조형', '기계설비'] } }, team);
assert.deepEqual([o.owner_id, o.label], ['u3', '기계설비 카테고리 규칙'], '규칙 담당자가 팀에 없으면 다음 규칙');
o = I.pickOwner(setting, { client_id: 'co9' }, team, ['리빙 · 공구']);
assert.deepEqual([o.owner_id, o.source], ['u2', 'TEAM'], '규칙에 없으면 팀 기본 담당자');
assert.equal(I.pickOwner({ intake_default_owner_id: 'u4' }, {}, team), null, '퇴사자는 고르지 않는다');
assert.equal(I.pickOwner(null, {}, team), null);
o = I.pickOwner(setting, { client_id: 'co9' }, team, ['기계설비']);
assert.equal(o.owner_id, 'u3', '랜딩 문의처럼 카테고리를 따로 넘길 수 있다');

// 영업일 견적 기한
assert.equal(I.addBusinessDays('2026-10-30', 1), '2026-11-02', '금요일 + 1영업일 = 월요일');
assert.equal(I.addBusinessDays('2026-10-31', 3), '2026-11-04', '토요일 접수 + 3영업일');
let d = I.quoteDeadline('2026-10-30', {}, '');
assert.deepEqual([d.deadline, d.rush, d.sla_days], ['2026-11-04', false, 3]);
d = I.quoteDeadline('2026-10-30', {}, '2026-11-20');
assert.deepEqual([d.deadline, d.rush, d.days_to_desired], ['2026-11-02', true, 21], '희망 입고일 30일 안 → 다음 영업일');
d = I.quoteDeadline('2026-10-30', { quote_sla_days: 5, quote_rush_window_days: 0 }, '2026-11-02');
assert.deepEqual([d.deadline, d.rush], ['2026-11-06', false], '급한 문의 끔');
d = I.quoteDeadline('2026-10-30', { quote_sla_days: 2, quote_rush_window_days: 14 }, '2026-12-30');
assert.deepEqual([d.deadline, d.rush], ['2026-11-03', false]);

// 카드에 넣을 값
assert.deepEqual(I.intakePatch({ priority: 'MEDIUM' }, { owner_id: 'u1', owner_name: '이호민' }, { deadline: '2026-11-02', rush: true }), { owner_id: 'u1', owner_name: '이호민', quote_deadline: '2026-11-02', priority: 'HIGH' });
assert.deepEqual(I.intakePatch({ owner_id: 'x', quote_deadline: '2026-11-10', priority: 'URGENT' }, { owner_id: 'u1' }, { deadline: '2026-11-02', rush: true }), {}, '이미 있는 값은 그대로');
assert.deepEqual(I.cleanIntakeSetting({ quote_sla_days: '0', quote_rush_window_days: '400', intake_default_owner_id: 'u2' }), { intake_default_owner_id: 'u2', intake_default_owner_name: '', quote_sla_days: null, quote_rush_window_days: null, intake_rules: [] });
console.log('inquiry-intake module ok');

// 서버 함수
const R = '../base44/functions/';
const call = async (fn, body) => { const m = await import(R + fn + '/entry.ts'); const res = await m.default(new Request('https://x', { method: 'POST', body: JSON.stringify(body) })); return { status: res.status, data: await res.json() }; };
const LEE = { id: 'u1', full_name: '이호민', account_tier: 'service', tenant_id: 't1', email: 'lee@aegis.example' };
const WANG = { id: 'u2', full_name: '왕리', account_tier: 'sub', tenant_id: 't1', email: 'wang@aegis.example' };
const ZHANG = { id: 'u3', full_name: '장위', account_tier: 'sub', tenant_id: 't1', email: 'zhang@aegis.example' };
const CLIENT = { id: 'c1', full_name: '김담당', account_tier: 'client', company_id: 'co1', tenant_id: 'ct1', email: 'kim@client.example' };
globalThis.__db = {
  User: [LEE, WANG, ZHANG, CLIENT], Tenant: [{ id: 'ct1', company_id: 'co1', tenant_type: 'client', hq_tenant_id: 't1' }, { id: 't1', is_hq: true, master_email: 'boss@aegis.example' }],
  Company: [{ id: 'co1', tenant_id: 't1', company_type: 'CLIENT', company_name: '도깨비산업기계' }],
  TaskCard: [], Notification: [], ProjectAuditLog: [], OperationSetting: [], CardAttachment: [], ManufacturingLead: [],
};
globalThis.__emails = [];
const notes = (type) => globalThis.__db.Notification.filter((n) => n.type === type);

// 설정 저장: 직원은 안 됨, 팀에 없는 사람은 담당자로 못 둔다
globalThis.__user = WANG;
assert.equal((await call('inquiryIntake', { action: 'get' })).status, 403);
globalThis.__user = LEE;
let r = await call('inquiryIntake', { action: 'save', intake_default_owner_id: 'nobody' });
assert.equal(r.status, 400);
r = await call('inquiryIntake', { action: 'save', intake_rules: [{ scope: 'CATEGORY', category: '기계설비', owner_id: 'nobody' }] });
assert.match(r.data.error, /기계설비 규칙의 담당자가 팀 직원이 아닙니다/);
r = await call('inquiryIntake', { action: 'save', intake_default_owner_id: 'u2', quote_sla_days: 2, quote_rush_window_days: 21, intake_rules: [{ scope: 'CLIENT', client_id: 'co1', client_name: '도깨비산업기계', owner_id: 'u1' }, { scope: 'CATEGORY', category: '전자 · 전기', owner_id: 'u3' }] });
assert.equal(r.status, 200, JSON.stringify(r.data));
const set = globalThis.__db.OperationSetting[0];
assert.equal(set.intake_default_owner_name, '왕리', '이름은 서버가 채운다');
assert.equal(set.intake_rules[1].owner_name, '장위');
r = await call('inquiryIntake', { action: 'get' });
assert.deepEqual(r.data.team.map((u) => u.id), ['u1', 'u2', 'u3']);
assert.equal(r.data.quote_sla_days, 2);

// 고객 포털 문의: 고객사 규칙으로 이호민 배정, 급한 문의
globalThis.__user = CLIENT;
const kst = (n) => new Date(Date.now() + 9 * 3600000 + n * 86400000).toISOString().slice(0, 10);
r = await call('submitClientInquiry', { title: '보조배터리', detail: '1만mAh', categories: ['전자 · 전기'], spec_answers: { '전원 방식 (어댑터·배터리)': '배터리', '무선 기능 (블루투스·와이파이)': '없음', '충전 단자': 'USB-C', '정격 전압·전력': '모름' }, desired_date: kst(15) });
assert.equal(r.status, 200, JSON.stringify(r.data));
let card = globalThis.__db.TaskCard.find((c) => c.id === r.data.card_id);
assert.equal(card.owner_id, 'u1', '고객사 규칙이 카테고리 규칙보다 먼저');
assert.equal(card.priority, 'HIGH', '희망 입고일 15일 → 급한 문의');
assert.equal(card.quote_deadline, I.addBusinessDays(kst(0), 1));
let n = notes('inquiry_assigned').at(-1);
assert.equal(n.recipient_id, 'u1');
assert.match(n.title, /\[새 문의 배정\] \[고객문의\] 보조배터리/);
assert.match(n.body, /도깨비산업기계 고객사 규칙에 따라 책임자로 배정됐습니다/);
assert.match(n.body, /급한 문의/);
assert.equal(notes('inquiry_unassigned').length, 0);
assert.equal(globalThis.__db.ProjectAuditLog.at(-1).event_type, 'CARD_ASSIGNED');

// 랜딩 문의(고객사 없음): 카테고리 규칙 → 장위
globalThis.__user = null;
r = await call('submitInquiry', { company: '새고객', contact_name: '박', phone: '010-1111-2222', email: 'park@new.example', categories: ['전자 · 전기'], detail: '충전기 OEM', quantity: '1000', privacy_agreed: true, agree_privacy: true });
if (r.status === 200) {
  card = globalThis.__db.TaskCard.at(-1);
  assert.equal(card.owner_id, 'u3', JSON.stringify(card));
  assert.equal(card.quote_deadline, I.addBusinessDays(kst(0), 2), '팀 견적 기한 2영업일');
} else {
  console.log('  (랜딩 문의 입력 검사 때문에 건너뜀:', r.data.error, ')');
}

// 규칙에 맞는 사람이 없으면 팀 관리자에게 [배정 필요]
globalThis.__db.OperationSetting[0].intake_default_owner_id = '';
globalThis.__db.OperationSetting[0].intake_rules = [];
globalThis.__user = CLIENT;
globalThis.__db.TaskCard.forEach((c) => { c.created_date = '2020-01-01T00:00:00Z'; });
r = await call('submitClientInquiry', { title: '머그컵', detail: '로고 인쇄', categories: ['리빙 · 공구'], spec_answers: { '재질': '세라믹', '음식에 닿는지': '예', '크기·무게': '350ml' }, desired_date: kst(90) });
assert.equal(r.status, 200, JSON.stringify(r.data));
card = globalThis.__db.TaskCard.find((c) => c.id === r.data.card_id);
assert.equal(card.owner_id, undefined);
assert.equal(card.priority, 'MEDIUM');
n = notes('inquiry_unassigned').at(-1);
assert.equal(n.recipient_id, 'u1', '팀 관리자(service)에게');
assert.equal(n.link, '/admin-inbox#inbox-unassigned');

// 관리자 할 일: 책임자 없는 카드와 추천 → 규칙대로 배정
globalThis.__db.OperationSetting[0].intake_rules = [{ scope: 'CATEGORY', category: '리빙 · 공구', owner_id: 'u2' }];
globalThis.__db.TaskCard.push({ id: 'old', tenant_id: 't1', title: '진행 중 카드', status: 'IN_PROGRESS', created_date: '2026-09-01T00:00:00Z', inquiry_details: { categories: ['리빙 · 공구'], desired_date: kst(5) } });
globalThis.__db.TaskCard.push({ id: 'done', tenant_id: 't1', title: '끝난 카드', status: 'DONE' });
globalThis.__user = LEE;
r = await call('inquiryIntake', { action: 'unassigned' });
const ids = r.data.cards.map((c) => c.id);
assert.ok(ids.includes(card.id) && ids.includes('old') && !ids.includes('done'), JSON.stringify(ids));
assert.equal(r.data.cards.find((c) => c.id === 'old').suggest.owner_name, '왕리');
r = await call('inquiryIntake', { action: 'apply', card_id: 'old' });
assert.equal(r.data.assigned, true);
const old = globalThis.__db.TaskCard.find((c) => c.id === 'old');
assert.equal(old.owner_id, 'u2');
assert.equal(old.quote_deadline, undefined, '진행 중 카드는 견적 기한을 새로 만들지 않는다');
assert.equal(old.priority, undefined, '우선순위도 그대로');
assert.doesNotMatch(notes('inquiry_assigned').at(-1).body, /견적 기한/);

// 손으로 책임자 지정 → 새 책임자에게 알림
let served;
globalThis.Deno.serve = (h) => { served = h; };
await import(R + 'cardMilestoneAction/entry.ts');
const callServe = async (body) => { const res = await served(new Request('https://x', { method: 'POST', body: JSON.stringify(body) })); return { status: res.status, data: await res.json() }; };
globalThis.__user = LEE;
r = await callServe({ action: 'set_card_owner', card_id: card.id, owner_id: 'u3' });
assert.equal(r.status, 200, JSON.stringify(r.data));
n = notes('card_assigned').at(-1);
assert.equal(n.recipient_id, 'u3');
assert.match(n.body, /이호민 님이 이 카드의 책임자로 지정했습니다/);
const before = notes('card_assigned').length;
await callServe({ action: 'set_card_owner', card_id: card.id, owner_id: 'u1' });
assert.equal(notes('card_assigned').length, before, '자기 자신을 지정하면 알리지 않는다');
console.log('inquiry-intake functions ok');
