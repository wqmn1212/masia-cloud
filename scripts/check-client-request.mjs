// 고객 자료 요청 체크리스트 검산: 템플릿으로 요청 → 고객 알림 → 고객 항목별 제출(파일·답) → 카드 파일 탭 연결 → 직원 확인·다시 요청 → 마감.
// 남의 고객사·다른 팀 차단, 확인 끝난 항목 재제출 불가, 진행률.
// 실행: npm run check:client-request
import assert from 'node:assert/strict';
const R = new URL('../base44/functions/', import.meta.url).href;
const call = async (body) => { const m = await import(R + 'clientRequest/entry.ts'); const res = await m.default(new Request('https://x', { method: 'POST', body: JSON.stringify(body) })); return { status: res.status, data: await res.json() }; };
const as = (u) => { globalThis.__user = u; };
const STAFF = { id: 's1', full_name: '이호민', account_tier: 'service', tenant_id: 't1', is_active: true, email: 'staff@aegis.example' };
const OTHER_STAFF = { id: 's9', full_name: '남의직원', account_tier: 'service', tenant_id: 't9', is_active: true };
const KIL = { id: 'u-kil', full_name: '길상현', account_tier: 'client', company_id: 'co1', is_active: true, email: 'kil@munice.example' };
const OTHER = { id: 'u-x', full_name: '남의고객', account_tier: 'client', company_id: 'co9', is_active: true, email: 'x@o.example' };
globalThis.__db = {
  TaskCard: [{ id: 'c1', tenant_id: 't1', title: '무니스 수면 조명', client_id: 'co1', client_visible: true }],
  User: [STAFF, KIL, OTHER], Company: [{ id: 'co1' }], ClientRequest: [], CardAttachment: [], Notification: [],
};
const db = globalThis.__db;
const b64 = (s) => Buffer.from(s).toString('base64');

as(STAFF);
let r = await call({ action: 'templates', card_id: 'c1' });
assert.ok(r.data.templates.some((t) => t.key === 'design_handoff'));
r = await call({ action: 'create', card_id: 'c1', template: 'design_handoff', due_date: '2026-11-20' });
assert.equal(r.status, 200, JSON.stringify(r.data));
const id = r.data.request.id;
assert.equal(r.data.request.items.length, 6);
assert.equal(r.data.request.progress.required_left, 3);
assert.ok(r.data.notified);
assert.ok(db.Notification.some((n) => n.recipient_id === 'u-kil' && /자료 요청/.test(n.title)), '고객 알림');
r = await call({ action: 'create', card_id: 'c1', template: 'custom', items: [{ label: '' }] });
assert.equal(r.status, 400, '빈 항목');
r = await call({ action: 'create', card_id: 'c1', template: 'custom', title: '추가 자료', items: [{ key: 'a', label: '버튼 위치' }, { key: 'a', label: '로고 파일', kind: 'file' }] });
assert.deepEqual(r.data.request.items.map((x) => x.key), ['a', 'a_1'], 'key 겹치지 않게');
as(OTHER_STAFF);
r = await call({ action: 'list', card_id: 'c1' });
assert.equal(r.status, 403, '다른 팀 직원');

// 고객
as(OTHER);
r = await call({ action: 'list', card_id: 'c1' });
assert.equal(r.status, 403, '남의 고객사');
as(KIL);
r = await call({ action: 'list', card_id: 'c1' });
assert.equal(r.data.requests.length, 2);
r = await call({ action: 'create', card_id: 'c1', template: 'custom', items: [{ label: 'x' }] });
assert.equal(r.status, 400, '고객은 요청을 만들 수 없다');
r = await call({ action: 'submit', id, key: 'renders' });
assert.equal(r.status, 400, '빈 제출');
r = await call({ action: 'submit', id, key: 'renders', attachments: [{ name: '정면.png', type: 'image/png', data: b64('png') }, { name: '측면.png', type: 'image/png', data: b64('png2') }] });
assert.equal(r.status, 200, JSON.stringify(r.data));
assert.equal(r.data.request.items[0].status, 'SUBMITTED');
assert.equal(r.data.request.items[0].files.length, 2);
assert.equal(db.CardAttachment.filter((a) => a.card_id === 'c1' && a.client_visible).length, 2, '카드 파일 탭에도 고객 공개로');
assert.ok(db.Notification.some((n) => /고객 자료/.test(n.title) && n.link.includes('card-client-request')), '직원 알림');
r = await call({ action: 'submit', id, key: 'dims', answer: '지름 150 · 두께 28 · 높이 190 mm' });
assert.equal(r.data.request.progress.submitted, 2);
r = await call({ action: 'file', id, key: 'renders', idx: 1 });
assert.match(r.data.url, /files\.example/);

// 직원 확인
as(STAFF);
r = await call({ action: 'review', id, key: 'dims', decision: 'REDO' });
assert.equal(r.status, 400, '다시 요청 이유 필요');
r = await call({ action: 'review', id, key: 'dims', decision: 'REDO', note: '받침대 높이도 적어 주세요' });
assert.equal(r.data.request.items.find((x) => x.key === 'dims').status, 'REDO');
assert.ok(db.Notification.some((n) => n.recipient_id === 'u-kil' && /다시 요청/.test(n.title)));
r = await call({ action: 'review', id, key: 'renders', decision: 'ACCEPTED' });
assert.equal(r.data.request.progress.done, 1);
as(KIL);
r = await call({ action: 'submit', id, key: 'renders', answer: '추가' });
assert.equal(r.status, 409, '확인 끝난 항목은 다시 올리지 않는다');
r = await call({ action: 'submit', id, key: 'dims', answer: '받침대 높이 36 mm 추가' });
const dims = db.ClientRequest.find((x) => x.id === id).items.find((x) => x.key === 'dims');
assert.equal(dims.status, 'SUBMITTED');
assert.equal(dims.history.length, 3, '기록은 쌓인다');
as(STAFF);
await call({ action: 'close', id });
as(KIL);
r = await call({ action: 'submit', id, key: 'cmf', answer: '오프화이트' });
assert.equal(r.status, 409, '마감된 요청');
console.log('client-request functions ok');

// ── 자동 독촉 규칙 ──
{
  const S = await import(new URL('../base44/shared/clientRequest.ts', import.meta.url).href);
  const items = [{ key: 'a', label: '렌더', status: 'WAITING' }, { key: 'b', label: '치수', status: 'REDO' }, { key: 'c', label: '색', status: 'ACCEPTED' }];
  const base = { status: 'OPEN', sent_at: '2026-11-10T01:00:00Z', due_date: '2026-11-20', items };
  assert.equal(S.reminderDue(base, '2026-11-10'), null, '보낸 날은 조용히');
  assert.equal(S.reminderDue(base, '2026-11-15'), null, '기한 전에는 전날만');
  assert.equal(S.reminderDue(base, '2026-11-19').reason, 'due_tomorrow');
  assert.equal(S.reminderDue(base, '2026-11-19').waiting.length, 2, '확인 끝난 항목은 빼고');
  assert.equal(S.reminderDue({ ...base, reminded_on: '2026-11-19' }, '2026-11-19'), null, '같은 날 두 번 없음');
  assert.equal(S.reminderDue({ ...base, reminded_on: '2026-11-19' }, '2026-11-20'), null, '기한 당일은 조용히');
  assert.equal(S.reminderDue({ ...base, reminded_on: '2026-11-19' }, '2026-11-21').reason, 'overdue', '기한 다음 날');
  assert.equal(S.reminderDue({ ...base, reminded_on: '2026-11-21' }, '2026-11-23'), null, '3일 간격');
  assert.equal(S.reminderDue({ ...base, reminded_on: '2026-11-21' }, '2026-11-24').reason, 'overdue');
  assert.equal(S.reminderDue({ ...base, reminder_count: 5 }, '2026-11-24'), null, '최대 5번');
  assert.equal(S.reminderDue({ ...base, auto_remind: false }, '2026-11-19'), null, '끄면 안 보냄');
  assert.equal(S.reminderDue({ ...base, status: 'CLOSED' }, '2026-11-19'), null);
  assert.equal(S.reminderDue({ ...base, items: [items[2]] }, '2026-11-19'), null, '남은 것 없음');
  const noDue = { ...base, due_date: '' };
  assert.equal(S.reminderDue(noDue, '2026-11-13'), null);
  assert.equal(S.reminderDue(noDue, '2026-11-14').reason, 'nudge', '기한 없으면 4일 뒤');
  assert.equal(S.reminderDue({ ...noDue, reminded_on: '2026-11-14' }, '2026-11-17'), null);
  assert.equal(S.reminderDue({ ...noDue, reminded_on: '2026-11-14' }, '2026-11-18').reason, 'nudge');
  const m = S.reminderMessage(base, '무니스 조명', S.reminderDue(base, '2026-11-21'));
  assert.match(m.title, /기한 지남/);
  assert.match(m.body, /치수 \(다시 요청\)/);

  // 매일 점검 함수: 고객에게 알림, 하루 한 번
  const D = new URL('../base44/functions/dailyClientChecks/entry.ts', import.meta.url).href;
  globalThis.__db = {
    TaskCard: [{ id: 'c1', tenant_id: 't1', title: '무니스 수면 조명', client_id: 'co1', client_visible: true }, { id: 'c2', tenant_id: 't1', title: '비공개', client_id: 'co1', client_visible: false }],
    User: [KIL], Company: [{ id: 'co1' }], Notification: [], ProductPlan: [], QualityClaim: [], ChinaHoliday: [], OperationSetting: [],
    ClientRequest: [{ id: 'r1', card_id: 'c1', title: '디자인 자료', ...base, due_date: '2000-01-01', sent_at: '1999-12-20T00:00:00Z' }, { id: 'r2', card_id: 'c2', title: '숨김', ...base, due_date: '2000-01-01', sent_at: '1999-12-20T00:00:00Z' }],
  };
  globalThis.__user = null;
  const runDaily = async () => { const m2 = await import(D); const res = await m2.default(new Request('https://x', { method: 'POST', body: '{}' })); return res.json(); };
  let out = await runDaily();
  assert.equal(out.request_reminders, 1, JSON.stringify(out));
  assert.ok(globalThis.__db.Notification.some((n) => n.recipient_id === 'u-kil' && /자료 요청 기한 지남/.test(n.title)));
  assert.equal(globalThis.__db.ClientRequest[0].reminder_count, 1);
  assert.ok(!globalThis.__db.ClientRequest[1].reminded_on, '고객 비공개 카드는 보내지 않음');
  out = await runDaily();
  assert.equal(out.request_reminders, 0, '같은 날 다시 돌려도 한 번');
  console.log('client-request reminders ok');
}
