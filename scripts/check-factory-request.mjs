// 공장 업로드 링크 검산: 토큰·PIN, PIN 잠금, 항목 정리, 제출·채택·재요청, 공장에게 보이는 필드, 화면 사본 일치,
// 그리고 서버 함수 흐름(만들기 → 열기 → 제출 → 채택 → 카드 파일·마일스톤·사전 QC 반영, 연장·회수·다시 만들기).
// 실행: npm run check:factory-request
import assert from 'node:assert/strict';
import * as S from '../base44/shared/factoryRequest.ts';
import * as F from '../src/lib/factoryRequest.js';

// ── 토큰·PIN ──
const tk = S.newToken();
assert.ok(S.validToken(tk) && tk.length === 43, '32바이트 base64url');
assert.notEqual(S.newToken(), tk);
for (let i = 0; i < 50; i++) assert.ok(S.validPin(S.newPin()));
assert.notEqual(await S.pinHash('a'.repeat(43), '123456'), await S.pinHash('b'.repeat(43), '123456'), 'PIN 해시는 링크마다 다르다');
assert.equal(S.validToken('../etc'), false);

// ── PIN 잠금: 5번째 실패에 30분 ──
const t0 = new Date('2026-10-30T01:00:00Z');
let req = { failed_pin_count: 0 };
for (let n = 1; n <= 4; n++) { const r = S.checkPin(req, false, t0); assert.equal(r.left, 5 - n); req = { ...req, ...r.patch }; }
let r = S.checkPin(req, false, t0);
assert.equal(r.locked, true);
assert.equal(r.locked_until, '2026-10-30T01:30:00.000Z');
req = { ...req, ...r.patch };
assert.equal(S.checkPin(req, true, new Date('2026-10-30T01:10:00Z')).ok, false, '잠금 중에는 맞는 PIN도 거절');
r = S.checkPin(req, true, new Date('2026-10-30T01:31:00Z'));
assert.equal(r.ok, true);
assert.deepEqual(r.patch, { failed_pin_count: 0, locked_until: '' });
r = S.checkPin(req, false, new Date('2026-10-30T01:31:00Z'));
assert.equal(r.left, 4, '잠금이 풀리면 실패 수를 새로 센다');

// ── 항목 정리 ──
const items = S.cleanItems([
  { kind: 'PHOTO', label_ko: '인쇄 공정 사진', label_cn: '印刷工序照片' },
  { kind: 'PHOTO', label_ko: '인쇄 공정 사진' },
  { kind: 'DOC', label_ko: '패킹 리스트', label_cn: '装箱单', doc_type: 'PACKING_LIST' },
  { kind: 'DOC', label_ko: '이상한 서류', doc_type: 'HACK' },
  { kind: 'MILESTONE', milestone_id: 'm1' },
  { kind: 'MILESTONE', milestone_id: 'm-other' },
  { kind: 'ANSWER', label_ko: '코팅 여부', label_cn: '纸张表面是否涂布？', precheck_item_key: 'pq1' },
  { kind: 'ANSWER', label_ko: '모르는 질문 키', precheck_item_key: 'nope' },
  { kind: 'BAD', label_ko: 'x' },
], { milestones: [{ id: 'm1', label: '인쇄', label_cn: '印刷' }], precheckKeys: ['pq1'] });
assert.deepEqual(items.map((i) => i.kind), ['PHOTO', 'DOC', 'DOC', 'MILESTONE', 'ANSWER', 'ANSWER']);
assert.equal(items[2].doc_type, 'GENERAL', '모르는 문서 종류는 일반');
assert.equal(items[3].label_cn, '印刷 完成报告');
assert.equal(items[4].precheck_item_key, 'pq1');
assert.equal(items[5].precheck_item_key, '', '카드에 없는 사전 QC 항목은 연결하지 않는다');
assert.equal(items[5].label_cn, '모르는 질문 키', '중국어가 없으면 한국어를 보여 준다');
assert.ok(items.every((i, n) => i.key === `i${n + 1}` && i.status === 'WAITING'));
assert.equal(S.cleanItems(Array.from({ length: 30 }, (_, n) => ({ kind: 'PHOTO', label_ko: `p${n}` }))).length, S.MAX_ITEMS);

// ── 상태 ──
const base = { status: 'OPEN', expires_at: '2026-11-13T01:00:00Z', items: items.slice(0, 2).map((i) => ({ ...i })), submissions: [] };
assert.equal(S.effectiveStatus(base, '2026-11-01T00:00:00Z'), 'OPEN');
assert.equal(S.effectiveStatus(base, '2026-11-14T00:00:00Z'), 'EXPIRED');
assert.equal(S.effectiveStatus({ ...base, status: 'REVOKED' }), 'REVOKED');
assert.equal(S.effectiveStatus({ ...base, items: base.items.map((i) => ({ ...i, status: 'ACCEPTED' })) }, '2026-12-01T00:00:00Z'), 'DONE', '다 채택하면 기한과 상관없이 완료');

// ── 파일 ──
assert.equal(S.fileAllowed('a.jpg', 100), '');
assert.match(S.fileAllowed('a.exe', 100), /사진·PDF·엑셀/);
assert.match(S.fileAllowed('a.pdf', S.MAX_FILE_BYTES + 1), /10MB/);

// ── 제출·검토 ──
const now = new Date('2026-11-01T02:00:00Z');
assert.match(S.submitPatch(base, 'i1', { answer: '사진은 내일' }, now).error, /파일/, '사진 항목은 파일이 있어야 한다');
let out = S.submitPatch(base, 'i1', { file_name: 'p.jpg', file_uri: 'private://p.jpg' }, now);
let cur = { ...base, ...out.patch };
assert.equal(cur.items[0].status, 'SUBMITTED');
assert.match(S.reviewPatch(cur, 'i1', 'REDO', '').error, /사유/);
out = S.reviewPatch(cur, 'i1', 'REDO', '사진이 흐립니다', '이호민', now.toISOString());
cur = { ...cur, ...out.patch };
assert.equal(cur.items[0].redo_reason, '사진이 흐립니다');
assert.equal(S.factoryView(cur, {}).items[0].redo_reason, '사진이 흐립니다', '재요청 사유는 공장에 보인다');
out = S.submitPatch(cur, 'i1', { file_name: 'p2.jpg', file_uri: 'private://p2.jpg' }, now);
cur = { ...cur, ...out.patch };
out = S.reviewPatch(cur, 'i1', 'ACCEPT', '', '이호민', now.toISOString());
assert.deepEqual(out.accepted.map((s) => s.file_name), ['p2.jpg'], '재요청한 이전 제출물은 채택하지 않는다');
cur = { ...cur, ...out.patch };
assert.match(S.submitPatch(cur, 'i1', { file_uri: 'x' }, now).error, /이미 확인/);
assert.match(S.submitPatch({ ...cur, expires_at: '2026-10-01T00:00:00Z' }, 'i2', { file_uri: 'x' }, now).error, /기한/);
const flood = { ...base, submissions: Array.from({ length: S.DAILY_SUBMIT_LIMIT }, () => ({ item_key: 'i2', submitted_at: '2026-11-01T01:00:00Z' })) };
assert.match(S.submitPatch(flood, 'i2', { file_uri: 'x', file_name: 'a.pdf' }, now).error, /오늘/);

// ── 공장에게 보이는 것 ──
const view = S.factoryView({ ...cur, factory_name: '선전 인쇄', card_id: 'c1', tenant_id: 't1', token_hash: 'h', pin_hash: 'p' }, { title: '휴대용 선풍기 박스', title_cn: '便携风扇包装盒', client_name: '바이어상사', client_id: 'co1' }, now.toISOString());
assert.equal(view.product, '便携风扇包装盒', '공장용 중국어 제목');
const vs = JSON.stringify(view);
for (const bad of ['바이어상사', 'co1', 'token_hash', 'pin_hash', 'tenant_id', 'private://']) assert.equal(vs.includes(bad), false, `공장 화면에 ${bad} 없음`);

// ── 화면 사본 일치 ──
assert.deepEqual(F.ITEM_KINDS, S.ITEM_KINDS);
assert.deepEqual(F.KIND_LABEL, S.KIND_LABEL);
assert.deepEqual(F.DOC_TYPES, S.DOC_TYPES);
assert.equal(F.DEFAULT_DAYS, S.DEFAULT_DAYS);
assert.equal(F.MAX_FILE_BYTES, S.MAX_FILE_BYTES);
for (const x of [base, cur, { ...base, status: 'REVOKED' }]) { assert.equal(F.effectiveStatus(x, now.toISOString()), S.effectiveStatus(x, now.toISOString())); assert.deepEqual(F.counts(x), S.counts(x)); }
const inv = { link: 'https://a/f/x', pin: '123456', product: '박스', expires_at: '2026-11-13T00:00:00Z', items };
assert.equal(F.inviteText(inv), S.inviteText(inv));
assert.match(S.inviteText(inv), /验证码（PIN）：123456/);
assert.ok(F.PRESETS.every((p) => S.ITEM_KINDS.includes(p.kind) && (!p.doc_type || S.DOC_TYPES.includes(p.doc_type))));
console.log('factory-request pure ok');

// ── 서버 함수 흐름 (가짜 SDK) ──
const R = new URL('../base44/functions/', import.meta.url).href;
const call = async (fn, body) => { const m = await import(R + fn + '/entry.ts'); const res = await m.default(new Request('https://x', { method: 'POST', body: JSON.stringify(body) })); return { status: res.status, data: await res.json() }; };
const STAFF = { id: 's1', full_name: '이호민', account_tier: 'service', tenant_id: 't1', is_active: true, email: 'staff@aegis.example' };
const OWNER = { id: 's2', full_name: '왕리', account_tier: 'sub', tenant_id: 't1', is_active: true, email: 'wang@aegis.example' };
const OTHER = { id: 's9', full_name: '남의팀', account_tier: 'service', tenant_id: 't2', is_active: true };
globalThis.__db = {
  User: [STAFF, OWNER, OTHER],
  TaskCard: [{ id: 'c1', tenant_id: 't1', title: '휴대용 선풍기 박스', title_cn: '便携风扇包装盒', client_id: 'co1', client_name: '바이어상사', factory_id: 'f1', factory_name: '선전 인쇄', owner_id: 's2', status: 'IN_PROGRESS' }],
  CardMilestone: [{ id: 'm1', card_id: 'c1', seq: 3, label: '인쇄', label_cn: '印刷', status: 'pending' }],
  QCPrecheck: [{ id: 'pc1', card_id: 'c1', version: 1, items: [{ key: 'pq1', kind: 'QUESTION', decision: 'QUESTION', title: '코팅', question_cn: '纸张表面是否涂布？' }, { key: 'pq2', kind: 'RISK', decision: 'PENDING' }] }],
  FactoryRequest: [], CardAttachment: [], Notification: [], ProjectAuditLog: [], Company: [],
};
const db = globalThis.__db;
globalThis.__user = OTHER;
let res = await call('manageFactoryRequest', { action: 'create', card_id: 'c1', items: [{ kind: 'PHOTO', label_ko: 'x' }] });
assert.equal(res.status, 403, '다른 팀 카드');
globalThis.__user = STAFF;
res = await call('manageFactoryRequest', { action: 'create', card_id: 'c1', items: [] });
assert.equal(res.status, 400);
res = await call('manageFactoryRequest', { action: 'create', card_id: 'c1', items: [
  { kind: 'PHOTO', label_ko: '인쇄 공정 사진', label_cn: '印刷工序照片' },
  { kind: 'DOC', label_ko: '패킹 리스트', label_cn: '装箱单', doc_type: 'PACKING_LIST' },
  { kind: 'MILESTONE', milestone_id: 'm1' },
  { kind: 'ANSWER', label_ko: '코팅 여부', label_cn: '纸张表面是否涂布？', precheck_item_key: 'pq1' },
] });
assert.equal(res.status, 200);
const { token, pin, request_id } = res.data;
const stored = db.FactoryRequest[0];
assert.equal(JSON.stringify(stored).includes(token), false, '토큰 원문은 저장하지 않는다');
assert.equal(JSON.stringify(stored).includes(`"${pin}"`), false, 'PIN 원문은 저장하지 않는다');
assert.equal(stored.items.length, 4);
assert.ok(Date.parse(stored.expires_at) - Date.now() > 13.9 * 86400000, '기본 14일');

// 공장: 로그인 없이
globalThis.__user = null;
res = await call('getFactoryRequest', { token: S.newToken() });
assert.equal(res.status, 404);
res = await call('getFactoryRequest', { token });
assert.deepEqual([res.status, res.data.needs_pin], [200, true]);
assert.equal(res.data.request, undefined, 'PIN 전에는 항목을 보여 주지 않는다');
const wrong = pin === '000000' ? '111111' : '000000';
res = await call('getFactoryRequest', { token, pin: wrong });
assert.deepEqual([res.status, res.data.code, res.data.left], [403, 'wrong_pin', 4]);
res = await call('getFactoryRequest', { token, pin });
assert.equal(res.status, 200);
assert.equal(db.FactoryRequest[0].failed_pin_count, 0, '맞으면 실패 수를 지운다');
assert.ok(db.FactoryRequest[0].last_opened_at);
const fv = JSON.stringify(res.data);
for (const bad of ['바이어상사', 'co1', 'token_hash', 'pin_hash', 'tenant_id']) assert.equal(fv.includes(bad), false, `응답에 ${bad} 없음`);
assert.equal(res.data.request.product, '便携风扇包装盒');

const jpg = Buffer.from('fake-jpeg-bytes').toString('base64');
res = await call('submitFactoryRequest', { token, pin: wrong, item_key: 'i1', file: { name: 'a.jpg', type: 'image/jpeg', data: jpg } });
assert.equal(res.status, 403, '제출도 PIN을 다시 확인');
res = await call('submitFactoryRequest', { token, pin, item_key: 'i1', file: { name: 'virus.exe', type: 'application/octet-stream', data: jpg } });
assert.equal(res.status, 400);
res = await call('submitFactoryRequest', { token, pin, item_key: 'i1', file: { name: 'print1.jpg', type: 'image/jpeg', data: jpg } });
assert.equal(res.status, 200);
assert.equal(res.data.request.items[0].status, 'SUBMITTED');
assert.equal(res.data.request.items[0].submitted[0].name, 'print1.jpg');
assert.equal(JSON.stringify(res.data).includes('private://'), false, '저장 주소는 공장에 돌려주지 않는다');
const note = db.Notification.at(-1);
assert.equal(note.recipient_id, 's2', '카드 책임자에게 알림');
assert.equal(note.type, 'factory_submission');
assert.equal(db.CardAttachment.length, 0, '채택 전에는 카드 파일에 넣지 않는다');
await call('submitFactoryRequest', { token, pin, item_key: 'i2', file: { name: 'packing.pdf', type: 'application/pdf', data: jpg } });
await call('submitFactoryRequest', { token, pin, item_key: 'i3', answer: '10월 31일 인쇄 끝났습니다', file: undefined });
await call('submitFactoryRequest', { token, pin, item_key: 'i4', answer: '是，覆哑膜 (무광 코팅)' });

// 직원 검토
globalThis.__user = STAFF;
res = await call('manageFactoryRequest', { action: 'review', request_id, item_key: 'i1', decision: 'REDO', reason: '' });
assert.equal(res.status, 400);
res = await call('manageFactoryRequest', { action: 'review', request_id, item_key: 'i1', decision: 'REDO', reason: '사진이 흐립니다. 가까이 다시 찍어 주세요' });
assert.equal(res.status, 200);
res = await call('manageFactoryRequest', { action: 'review', request_id, item_key: 'i2', decision: 'ACCEPT' });
assert.equal(res.status, 200);
const att = db.CardAttachment[0];
assert.deepEqual([att.document_type, att.client_visible, att.file_url, att.factory_request_id], ['PACKING_LIST', false, 'private://packing.pdf', request_id], '서류는 그 종류로, 기본 비공개');
await call('manageFactoryRequest', { action: 'review', request_id, item_key: 'i3', decision: 'ACCEPT' });
assert.equal(db.CardMilestone[0].factory_report_note, '10월 31일 인쇄 끝났습니다');
assert.ok(db.CardMilestone[0].factory_reported_at);
assert.equal(db.CardMilestone[0].status, 'pending', '완료 처리는 직원이 평소대로');
await call('manageFactoryRequest', { action: 'review', request_id, item_key: 'i4', decision: 'ACCEPT' });
assert.equal(db.QCPrecheck[0].items[0].factory_answer, '是，覆哑膜 (무광 코팅)');

// 재제출 → 채택하면 완료
globalThis.__user = null;
res = await call('getFactoryRequest', { token, pin });
assert.equal(res.data.request.items[0].redo_reason, '사진이 흐립니다. 가까이 다시 찍어 주세요');
await call('submitFactoryRequest', { token, pin, item_key: 'i1', file: { name: 'print2.jpg', type: 'image/jpeg', data: jpg } });
globalThis.__user = STAFF;
await call('manageFactoryRequest', { action: 'review', request_id, item_key: 'i1', decision: 'ACCEPT', client_visible: true });
assert.deepEqual(db.CardAttachment.filter((a) => a.file_name.startsWith('print')).map((a) => [a.file_name, a.client_visible]), [['print2.jpg', true]], '흐린 첫 사진은 넣지 않는다');
assert.equal(db.FactoryRequest[0].status, 'DONE');

// 연장·회수·다시 만들기
res = await call('manageFactoryRequest', { action: 'create', card_id: 'c1', items: [{ kind: 'PHOTO', label_ko: '포장 사진' }], days: 3 });
const r2 = res.data;
res = await call('manageFactoryRequest', { action: 'extend', request_id: r2.request_id, days: 7 });
assert.ok(Date.parse(res.data.expires_at) - Date.now() > 9.9 * 86400000);
res = await call('manageFactoryRequest', { action: 'reissue', request_id: r2.request_id });
globalThis.__user = null;
assert.equal((await call('getFactoryRequest', { token: r2.token })).status, 404, '다시 만들면 이전 링크는 막힌다');
assert.equal((await call('getFactoryRequest', { token: res.data.token, pin: res.data.pin })).status, 200);
globalThis.__user = STAFF;
await call('manageFactoryRequest', { action: 'revoke', request_id: r2.request_id });
globalThis.__user = null;
res = await call('getFactoryRequest', { token: res.data.token });
assert.deepEqual([res.status, res.data.status], [410, 'REVOKED']);

// 잠금은 저장된다: 5번 틀리면 맞는 PIN도 거절
globalThis.__user = STAFF;
const r3 = (await call('manageFactoryRequest', { action: 'create', card_id: 'c1', items: [{ kind: 'PHOTO', label_ko: '사진' }] })).data;
globalThis.__user = null;
const bad3 = r3.pin === '000000' ? '111111' : '000000';
for (let i = 0; i < 5; i++) await call('getFactoryRequest', { token: r3.token, pin: bad3 });
res = await call('getFactoryRequest', { token: r3.token, pin: r3.pin });
assert.deepEqual([res.status, res.data.code], [403, 'locked']);
console.log('factory-request functions ok');
