// 할일 ↔ Google Tasks 검산: 한 건 반영(등록·수정·완료·다시 열기·삭제), 바뀐 게 없으면 Google 호출 0, 동시 생성 중복 정리,
// 권한, 그리고 전체 동기화(Google 완료 가져오기·앱 수정 우선·예전 연결 할일).
// 실행: npm run check:google-tasks
import assert from 'node:assert/strict';
import * as G from '../base44/shared/googleTaskSync.ts';

// 계산
const card = { id: 'c1', title: '휴대용 선풍기 박스', client_name: '바이어상사' };
const b = G.taskBody({ title: '공장 견적 받기', description: '3종', assignee_name: '이호민', due_date: '2026-11-02', status: 'TODO' }, card);
assert.deepEqual(b, { title: '공장 견적 받기', notes: '프로젝트: 휴대용 선풍기 박스\n고객사: 바이어상사\n3종\n담당자: 이호민', due: '2026-11-02T00:00:00.000Z', status: 'needsAction' });
assert.equal(G.syncHash(b), G.syncHash({ ...b }));
assert.notEqual(G.syncHash(b), G.syncHash({ ...b, due: null }));
assert.equal(G.planPush({ status: 'DONE' }, G.taskBody({ title: 'x', status: 'DONE' })), 'none', '완료된 새 할일은 만들지 않는다');
assert.equal(G.planPush({ status: 'TODO' }, b), 'create');
assert.equal(G.planPush({ google_task_id: 'g', google_sync_hash: G.syncHash(b) }, b), 'none');
assert.equal(G.planPush({ google_task_id: 'g', google_sync_hash: 'old' }, b), 'update');
assert.equal(G.sameAsGoogle({ title: b.title, notes: b.notes, due: '2026-11-02T00:00:00.000Z', status: 'needsAction' }, b), true);
assert.equal(G.sameAsGoogle({ title: b.title, notes: b.notes, status: 'needsAction' }, b), false);

// 서버 함수 (가짜 Google Tasks)
let gseq = 0;
const google = { lists: [{ id: 'L1', title: 'Masia 업무' }], tasks: {} };
const calls = [];
globalThis.fetch = async (url, opt = {}) => {
  const u = new URL(url);
  const method = opt.method || 'GET';
  calls.push(`${method} ${u.pathname.replace('/tasks/v1', '')}`);
  const body = opt.body ? JSON.parse(opt.body) : null;
  const j = (d, status = 200) => new Response(status === 204 ? null : JSON.stringify(d), { status });
  if (u.pathname.endsWith('/users/@me/lists')) return j({ items: google.lists });
  const m = u.pathname.match(/\/lists\/L1\/tasks(?:\/([^/]+))?$/);
  if (!m) return j({ error: 'nope' }, 400);
  const id = m[1];
  if (!id && method === 'GET') return j({ items: Object.values(google.tasks) });
  if (!id && method === 'POST') { const t = { id: `g${++gseq}`, status: 'needsAction', ...body }; google.tasks[t.id] = t; return j(t); }
  if (!google.tasks[id]) return j({ error: 'not found' }, 404);
  if (method === 'PATCH') { Object.assign(google.tasks[id], body); return j(google.tasks[id]); }
  if (method === 'DELETE') { delete google.tasks[id]; return j(null, 204); }
  return j(google.tasks[id]);
};
const R = '../base44/functions/';
const call = async (body) => { const m = await import(R + 'syncGoogleTasks/entry.ts'); const res = await m.default(new Request('https://x', { method: 'POST', body: JSON.stringify(body) })); return { status: res.status, data: await res.json() }; };
const STAFF = { id: 'u9', account_tier: 'service', tenant_id: 't1' };
const CLIENT = { id: 'u5', account_tier: 'client', tenant_id: 't2' };
globalThis.__db = {
  TaskCard: [card],
  TaskItem: [{ id: 'i1', card_id: 'c1', title: '공장 견적 받기', status: 'TODO', due_date: '2026-11-02' }],
};
const item = () => globalThis.__db.TaskItem.find((x) => x.id === 'i1');

// 권한: 고객 계정은 막고, 로그인 없는 전체 동기화도 막는다
globalThis.__user = CLIENT;
assert.equal((await call({ item_id: 'i1' })).status, 403);
globalThis.__user = null;
assert.equal((await call({})).status, 403, '로그인 없이 전체 동기화 불가');

// 워크플로우(로그인 없음): 새 할일 → Google 작업 생성
let r = await call({ item_id: 'i1' });
assert.equal(r.status, 200, JSON.stringify(r.data));
assert.equal(r.data.action, 'created');
const gid = item().google_task_id;
assert.ok(google.tasks[gid]);
assert.equal(google.tasks[gid].notes, '프로젝트: 휴대용 선풍기 박스\n고객사: 바이어상사');
assert.equal(google.tasks[gid].due, '2026-11-02T00:00:00.000Z');

// 동기화가 남긴 기록 수정으로 다시 깨어나도 Google 호출 없음
calls.length = 0;
r = await call({ item_id: 'i1', google_task_id: gid });
assert.equal(r.data.action, 'none');
assert.equal(calls.length, 0, '바뀐 게 없으면 Google API 를 부르지 않는다');

// 번역(title_cn)처럼 Google 에 안 가는 필드만 바뀌어도 호출 없음
item().title_cn = '获取工厂报价';
r = await call({ item_id: 'i1' });
assert.equal(r.data.action, 'none');
assert.equal(calls.length, 0);

// 제목·마감일 수정 → 그 작업만 고친다
Object.assign(item(), { title: '공장 견적 다시 받기', due_date: '' });
r = await call({ item_id: 'i1' });
assert.equal(r.data.action, 'updated');
assert.equal(google.tasks[gid].title, '공장 견적 다시 받기');
assert.equal(google.tasks[gid].due, null, '마감일을 지우면 Google 에서도 지운다');
assert.deepEqual(calls, ['GET /users/@me/lists', `PATCH /lists/L1/tasks/${gid}`]);

// 완료 → Google 체크, 다시 열기 → 체크 해제
item().status = 'DONE';
assert.equal((await call({ item_id: 'i1' })).data.action, 'updated');
assert.equal(google.tasks[gid].status, 'completed');
item().status = 'IN_PROGRESS';
await call({ item_id: 'i1' });
assert.equal(google.tasks[gid].status, 'needsAction');
assert.equal(google.tasks[gid].completed, null);

// Google 에서 지워진 작업을 앱에서 고치면 새로 만든다
delete google.tasks[gid];
item().title = '견적 비교';
r = await call({ item_id: 'i1' });
assert.equal(r.data.action, 'created');
const gid2 = item().google_task_id;
assert.notEqual(gid2, gid);
assert.equal(google.tasks[gid2].title, '견적 비교');

// 완료 상태로 만든 새 할일은 Google 에 올리지 않는다
globalThis.__db.TaskItem.push({ id: 'i2', card_id: 'c1', title: '끝난 일', status: 'DONE' });
assert.equal((await call({ item_id: 'i2' })).data.action, 'none');

// 동시 생성: 다른 실행이 먼저 연결했으면 내가 만든 작업은 지운다
globalThis.__db.TaskItem.push({ id: 'i3', card_id: 'c1', title: '동시', status: 'TODO' });
const realGet = globalThis.__db.TaskItem;
const before = Object.keys(google.tasks).length;
let first = true;
const origFetch = globalThis.fetch;
globalThis.fetch = async (url, opt) => {
  const res = await origFetch(url, opt);
  if (first && opt?.method === 'POST' && String(url).endsWith('/lists/L1/tasks')) { first = false; realGet.find((x) => x.id === 'i3').google_task_id = 'g-other'; }
  return res;
};
r = await call({ item_id: 'i3' });
globalThis.fetch = origFetch;
assert.equal(r.data.action, 'duplicate_skipped');
assert.equal(Object.keys(google.tasks).length, before, '중복 작업이 남지 않는다');
assert.equal(realGet.find((x) => x.id === 'i3').google_task_id, 'g-other');
globalThis.__db.TaskItem = globalThis.__db.TaskItem.filter((x) => x.id !== 'i3');

// 삭제: 워크플로우가 넘긴 google_task_id 로 지운다. 다른 할일이 쓰는 작업은 두고, 이미 없는 작업도 성공
globalThis.__db.TaskItem = globalThis.__db.TaskItem.filter((x) => x.id !== 'i1');
r = await call({ item_id: 'i1', google_task_id: gid2 });
assert.equal(r.data.action, 'deleted');
assert.equal(google.tasks[gid2], undefined);
assert.equal((await call({ item_id: 'i1', google_task_id: gid2 })).data.action, 'deleted', '이미 지워진 작업');
globalThis.__db.TaskItem.push({ id: 'i4', card_id: 'c1', title: '살아 있음', status: 'TODO', google_task_id: 'g-live' });
google.tasks['g-live'] = { id: 'g-live', title: '살아 있음', status: 'needsAction' };
assert.equal((await call({ item_id: 'i-gone', google_task_id: 'g-live' })).data.action, 'none');
assert.ok(google.tasks['g-live']);
assert.equal((await call({ item_id: 'i-gone' })).data.action, 'none', 'Google id 없이 지워진 할일은 할 것 없음');

// 전체 동기화 (직원)
globalThis.__user = STAFF;
const sync = (it) => { const bb = G.taskBody(it, card); it.google_sync_hash = G.syncHash(bb); };
globalThis.__db.TaskItem = [
  { id: 'a', card_id: 'c1', title: 'Google 에서 체크', status: 'TODO', google_task_id: 'ga' },
  { id: 'b', card_id: 'c1', title: '앱에서 고친 뒤 Google 체크', status: 'TODO', google_task_id: 'gb' },
  { id: 'c', card_id: 'c1', title: '예전 연결 · Google 체크', status: 'TODO', google_task_id: 'gc' },
  { id: 'd', card_id: 'c1', title: '예전 연결 · Google 에서 지움', status: 'TODO', google_task_id: 'gd' },
  { id: 'e', card_id: 'c1', title: '예전 연결 · 같은 내용', status: 'TODO', google_task_id: 'ge' },
  { id: 'f', card_id: 'c1', title: '아직 안 올라간 할일', status: 'TODO' },
  { id: 'h', card_id: 'c1', title: '지문 같고 Google 에서 지움', status: 'TODO', google_task_id: 'gh' },
];
const [A, B, , , E, , H] = globalThis.__db.TaskItem;
sync(A); sync(B); sync(H);
B.title = '앱에서 고친 제목';
google.tasks = {
  ga: { id: 'ga', title: A.title, notes: G.taskBody(A, card).notes, status: 'completed' },
  gb: { id: 'gb', title: '앱에서 고친 뒤 Google 체크', notes: '', status: 'completed' },
  gc: { id: 'gc', title: '예전 연결 · Google 체크', status: 'completed' },
  ge: { id: 'ge', title: E.title, notes: G.taskBody(E, card).notes, status: 'needsAction' },
};
calls.length = 0;
r = await call({});
assert.equal(r.status, 200, JSON.stringify(r.data));
const by = Object.fromEntries(globalThis.__db.TaskItem.map((x) => [x.id, x]));
assert.equal(by.a.status, 'DONE', 'Google 체크 → 앱 완료');
assert.equal(by.b.status, 'TODO', '앱에서 고친 쪽이 우선');
assert.equal(google.tasks.gb.title, '앱에서 고친 제목');
assert.equal(google.tasks.gb.status, 'needsAction');
assert.equal(by.c.status, 'DONE', '예전 연결 할일도 Google 완료를 가져온다');
assert.equal(google.tasks.gd, undefined, 'Google 에서 지운 예전 작업은 다시 만들지 않는다');
assert.ok(by.e.google_sync_hash, '같은 내용은 지문만 남긴다');
assert.ok(by.f.google_task_id && google.tasks[by.f.google_task_id]);
assert.equal(google.tasks.gh, undefined, '지문이 같으면 Google 에서 지운 것을 되살리지 않는다');
assert.deepEqual(r.data, { ok: true, list: 'Masia 업무', created: 1, updated: 1, completedInApp: 2 });
assert.equal(calls.filter((c) => c.startsWith('PATCH')).length, 1, '바뀐 할일만 고친다');

// 두 번째 전체 동기화는 목록 조회 말고는 호출 없음
calls.length = 0;
r = await call({});
assert.deepEqual(r.data, { ok: true, list: 'Masia 업무', created: 0, updated: 0, completedInApp: 0 });
assert.deepEqual(calls, ['GET /users/@me/lists', 'GET /lists/L1/tasks']);

// 한도 초과 안내
globalThis.fetch = async () => new Response('quota', { status: 429 });
globalThis.__db.TaskItem.push({ id: 'z', card_id: 'c1', title: '한도', status: 'TODO' });
r = await call({ item_id: 'z' });
assert.equal(r.status, 429);
assert.match(r.data.error, /일일 사용 한도/);

console.log('check:google-tasks OK');
