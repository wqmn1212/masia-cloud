// 실시간 디자인 리뷰 방 서버 함수 검산: 직원 방 만들기·판 올리기·3D 방, 공유 링크 + PIN, 이메일 초대·취소,
// 팀원·카드 고객·손님 입장과 차단, 커서·접속자, 댓글·답글·해결, 손님에게 이메일 숨김, 닫힌 방.
// 실행: npm run check:design-room
import assert from 'node:assert/strict';
const R = new URL('../base44/functions/', import.meta.url).href;
const call = async (body) => { const m = await import(R + 'designRoom/entry.ts'); const res = await m.default(new Request('https://x', { method: 'POST', body: JSON.stringify(body) })); return { status: res.status, data: await res.json() }; };
const as = (u) => { globalThis.__user = u; };

const STAFF = { id: 's1', full_name: '이호민', account_tier: 'service', tenant_id: 't1', is_active: true, email: 'staff@aegis.example' };
const SUB = { id: 's2', full_name: '왕리', account_tier: 'sub', tenant_id: 't1', is_active: true, email: 'wang@aegis.example' };
const OTHER_STAFF = { id: 's9', full_name: '남의직원', account_tier: 'service', tenant_id: 't9', is_active: true };
const KIM = { id: 'u-kim', full_name: '김담당', account_tier: 'client', company_id: 'co1', is_active: true, email: 'kim@buyer.example' };
const OTHER = { id: 'u-x', full_name: '남의고객', account_tier: 'client', company_id: 'co9', is_active: true, email: 'x@other.example' };
globalThis.__db = {
  TaskCard: [{ id: 'c1', tenant_id: 't1', title: '휴대용 선풍기', client_id: 'co1', client_visible: true }],
  CardAttachment: [
    { id: 'a1', tenant_id: 't1', card_id: 'c1', file_name: '박스_v1.png', file_type: 'png', file_url: 'private://a1' },
    { id: 'a2', tenant_id: 't1', card_id: 'c1', file_name: '박스_v2.pdf', file_type: 'pdf', file_url: 'private://a2' },
    { id: 'a3', tenant_id: 't1', card_id: 'c1', file_name: '견적.xlsx', file_type: 'xlsx', file_url: 'private://a3' },
  ],
  ProtoProject: [{ id: 'p1', tenant_id: 't1', title: '무니스 조명', card_id: 'c1', dev: {} }],
  DesignRoom: [], DesignComment: [], DesignPresence: [], Notification: [],
};
const db = globalThis.__db;
globalThis.__emails = [];
const room = (id) => db.DesignRoom.find((r) => r.id === id);

// ── 직원: 방 만들기 ──
as(KIM);
let r = await call({ action: 'create', card_id: 'c1', attachment_id: 'a1' });
assert.equal(r.status, 403, '고객은 방을 만들 수 없다');
as(OTHER_STAFF);
r = await call({ action: 'create', card_id: 'c1', attachment_id: 'a1' });
assert.equal(r.status, 404, '다른 팀');
as(STAFF);
r = await call({ action: 'create', card_id: 'c1', attachment_id: 'a3' });
assert.equal(r.status, 400, '엑셀은 리뷰 불가');
r = await call({ action: 'create', card_id: 'c1', attachment_id: 'a1' });
assert.equal(r.status, 200, JSON.stringify(r.data));
const R1 = r.data.room.id;
assert.equal(r.data.room.versions[0].file_type, 'image');
r = await call({ action: 'create', card_id: 'c1', attachment_id: 'a1' });
assert.equal(r.data.room.id, R1, '같은 파일은 같은 방');
r = await call({ action: 'add_version', room_id: R1, attachment_id: 'a2' });
assert.equal(r.data.room.versions.length, 2);
assert.equal(r.data.room.versions[1].file_type, 'pdf');
r = await call({ action: 'add_version', room_id: R1, attachment_id: 'a2' });
assert.equal(r.status, 409);

// 3D 방
r = await call({ action: 'create', project_id: 'p1', snapshot: { dev: { features: [{ id: 'f1', kind: 'button', name: '버튼', note: '내부' }], hw: { lcsc: { U1: 'C1' } } }, parts: [{ id: 'b1', name: '본체' }] } });
assert.equal(r.status, 200);
const R3 = r.data.room.id;
assert.equal(r.data.room.kind, 'model');
assert.equal(r.data.room.model.dev.hw, undefined, 'LCSC 비공개');
assert.equal(r.data.room.model.dev.features[0].note, undefined);

// ── 입장: 팀원·고객·남의 고객·비로그인 ──
as(SUB);
r = await call({ action: 'join', room_id: R1, sid: 'tabSub' });
assert.equal(r.status, 200);
assert.equal(r.data.me.kind, 'staff');
as(KIM);
r = await call({ action: 'join', room_id: R1, sid: 'tabKim' });
assert.equal(r.data.me.kind, 'client');
assert.equal(r.data.me.manage, false);
assert.equal(r.data.presence.length, 1, '팀원이 보인다');
as(OTHER);
r = await call({ action: 'join', room_id: R1, sid: 'x' });
assert.equal(r.status, 403);
as(null);
r = await call({ action: 'join', room_id: R1, sid: 'x' });
assert.equal(r.status, 401);

// ── 공유 링크 + PIN ──
as(KIM);
r = await call({ action: 'set_link', room_id: R1, on: true });
assert.equal(r.status, 403, '고객은 링크를 만들 수 없다');
as(STAFF);
r = await call({ action: 'set_link', room_id: R1, on: true, days: 7 });
const { token, pin, url } = r.data;
assert.match(url, new RegExp(`/design/${R1}\\?k=`));
assert.ok(!JSON.stringify(room(R1).link).includes(pin), 'PIN 원문은 저장하지 않는다');
as(null);
r = await call({ action: 'join', room_id: R1, token, sid: 'g1' });
assert.equal(r.data.needs_pin, true);
r = await call({ action: 'join', room_id: R1, token, pin: '000000', name: '박디자이너', sid: 'g1' });
assert.equal(r.status, 403);
assert.match(r.data.error, /남음/);
r = await call({ action: 'join', room_id: R1, token, pin, sid: 'g1' });
assert.equal(r.status, 400, '이름 필요');
r = await call({ action: 'join', room_id: R1, token, pin, name: '박디자이너', sid: 'g1' });
assert.equal(r.status, 200);
assert.equal(r.data.me.kind, 'guest');
r = await call({ action: 'join', room_id: R3, token, pin, name: '박디자이너', sid: 'g1' });
assert.equal(r.status, 403, '링크는 그 방에만');

// ── 이메일 초대 ──
as(STAFF);
r = await call({ action: 'invite', room_id: R1, emails: 'lee@studio.example, bad-email, lee@studio.example', note: '로고 위치 봐 주세요' });
assert.deepEqual(r.data.sent, ['lee@studio.example']);
const mail = globalThis.__emails.at(-1);
assert.equal(mail.to, 'lee@studio.example');
const inviteToken = /\?i=([A-Za-z0-9_-]+)/.exec(mail.body)[1];
as(null);
r = await call({ action: 'join', room_id: R1, invite: inviteToken, sid: 'g2' });
assert.equal(r.status, 200);
assert.equal(r.data.me.name, 'lee');
assert.ok(room(R1).invites[0].last_seen_at, '들어온 때 기록');

// ── 커서·댓글 ──
as(KIM);
r = await call({ action: 'sync', room_id: R1, sid: 'tabKim', version: 2, cursor: { page: 2, x: 0.5, y: 0.25 } });
const t0 = r.data.now;
assert.ok(r.data.presence.some((p) => p.name === '박디자이너'), '손님 접속 보임');
assert.ok(r.data.presence.every((p) => p.sid !== 'tabKim'), '나는 빼고');
r = await call({ action: 'comment', room_id: R1, version: 2, spot: { page: 2, x: 0.5, y: 0.25 }, text: '로고를 2mm 위로' });
assert.equal(r.status, 200);
const C1 = r.data.comment.id;
assert.equal(r.data.comment.page, 2);
r = await call({ action: 'comment', room_id: R1, version: 2, spot: { page: 1, x: 3, y: 0 }, text: '잘못된 위치' });
assert.equal(r.data.comment.x, null, '범위를 벗어난 위치는 위치 없는 댓글');
as(null);
r = await call({ action: 'sync', room_id: R1, invite: inviteToken, sid: 'g2', since: t0 });
assert.ok(r.data.comments.some((c) => c.id === C1), '새 댓글이 손님에게 온다');
assert.equal(r.data.comments[0].author_email, undefined, '손님에게 이메일 숨김');
const kimCursor = r.data.presence.find((p) => p.name === '김담당');
assert.deepEqual(kimCursor.cursor, { page: 2, x: 0.5, y: 0.25 }, '커서가 보인다');
r = await call({ action: 'comment', room_id: R1, invite: inviteToken, sid: 'g2', parent_id: C1, text: '2mm 맞습니다', spot: { page: 1, x: 0.1, y: 0.1 } });
assert.equal(r.data.comment.parent_id, C1);
assert.equal(r.data.comment.x, null, '답글은 위치 없음');
r = await call({ action: 'resolve', room_id: R1, invite: inviteToken, comment_id: C1 });
assert.equal(r.status, 403, '손님은 남의 댓글 해결 불가');
as(STAFF);
r = await call({ action: 'resolve', room_id: R1, comment_id: C1 });
assert.equal(r.data.comment.resolved, true);
assert.equal(room(R1).comment_count, 3);
assert.equal(room(R1).open_count, 1);

// 3D 댓글
as(KIM);
r = await call({ action: 'comment', room_id: R3, spot: { point: [1.234, 2, 3] }, part_name: '본체', text: '모서리 둥글게' });
assert.deepEqual(r.data.comment.point, [1.2, 2, 3]);
r = await call({ action: 'file', room_id: R1, v: 1 });
assert.match(r.data.url, /a1/);

// ── 초대 취소·링크 끄기·방 닫기 ──
as(STAFF);
r = await call({ action: 'revoke_invite', room_id: R1, email: 'lee@studio.example' });
assert.equal(r.data.invites[0].revoked, true);
r = await call({ action: 'set_link', room_id: R1, on: false });
as(null);
r = await call({ action: 'sync', room_id: R1, invite: inviteToken, sid: 'g2' });
assert.equal(r.status, 403, '취소된 초대');
r = await call({ action: 'sync', room_id: R1, token, pin, name: '박디자이너', sid: 'g1' });
assert.equal(r.status, 403, '꺼진 링크');
as(STAFF);
r = await call({ action: 'share_info', room_id: R1 });
assert.equal(r.data.link.on, false);
assert.equal(r.data.invites[0].email, 'lee@studio.example');
assert.equal(JSON.stringify(r.data).includes('token_hash'), false);
await call({ action: 'set_status', room_id: R1, status: 'CLOSED' });
as(KIM);
r = await call({ action: 'join', room_id: R1, sid: 'tabKim' });
assert.equal(r.status, 410, '닫힌 방은 고객이 못 들어온다');
r = await call({ action: 'list', card_id: 'c1' });
assert.equal(r.data.rooms.length, 1, '고객 목록에는 열린 방만');
as(STAFF);
r = await call({ action: 'list', card_id: 'c1' });
assert.equal(r.data.rooms.length, 2);
assert.equal(db.DesignComment.length, 4, '댓글은 지우지 않는다');
console.log('design-room functions ok');
