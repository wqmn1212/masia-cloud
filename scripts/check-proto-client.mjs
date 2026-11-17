// 시제품 고객 공개 서버 함수 검산: 직원이 3D·시뮬레이션, 명판·설명서 초안, 설계 변경(ECO)을 공개하면 고객이 보고 결정·의견을 남긴다.
// 남의 고객사·비공개 카드 차단, 재무 전용 계정 결정 불가, 판 번호·중복 결정·반려 이유, 내부 값(LCSC·원가) 비공개를 본다.
// 실행: npm run check:proto-client
import assert from 'node:assert/strict';
const R = new URL('../base44/functions/', import.meta.url).href;
const call = async (fn, body) => { const m = await import(R + fn + '/entry.ts'); const res = await m.default(new Request('https://x', { method: 'POST', body: JSON.stringify(body) })); return { status: res.status, data: await res.json() }; };
const as = (u) => { globalThis.__user = u; };

const STAFF = { id: 's1', full_name: '이호민', account_tier: 'service', tenant_id: 't1', is_active: true, email: 'staff@aegis.example' };
const OTHER_STAFF = { id: 's9', full_name: '남의직원', account_tier: 'service', tenant_id: 't9', is_active: true, email: 'o@x.example' };
const KIM = { id: 'u-kim', full_name: '김실무', account_tier: 'client', tenant_id: 'ct1', company_id: 'co1', is_active: true, email: 'kim@buyer.example' };
const PAY = { id: 'u-pay', full_name: '정재무', account_tier: 'client', tenant_id: 'ct1', company_id: 'co1', is_active: true, email: 'pay@buyer.example' };
const OTHER = { id: 'u-x', full_name: '남의고객', account_tier: 'client', tenant_id: 'ct9', company_id: 'co9', is_active: true, email: 'x@other.example' };
const dev = {
  device_name: 'RENIGHT-L1', mcu: 'esp32s3', supply_v: 5, uuid_base: 'secret-uuid',
  features: [{ id: 'f1', kind: 'button', name: '전원 버튼', pin: 4, part_id: 'p2', note: '내부 메모' }, { id: 'f2', kind: 'light', name: '조명', pin: 5, power_w: 3, cct: [2700, 6500] }],
  rules: [{ id: 'r1', type: 'event', src: 'f1', dst: 'f2', action: 'toggle' }],
  hw: { lcsc: { U1: 'C12345' } }, cost: { unit: 9.9 }, mold_quotes: [{ factory: '갑', price: 1 }],
  freeze: { version: 1 },
  ecos: [
    { no: 'ECO-001', reason: '구배 2° → 3°', status: 'OPEN', need_client: true, from_version: 1, changes: [{ area: '외장', text: '구배 2 → 3 °' }], impact: ['금형 견적·금형 점검 다시 (외장 치수 변경)'] },
    { no: 'ECO-002', reason: '이미 승인', status: 'APPROVED', from_version: 1, changes: [], impact: [] },
  ],
};
globalThis.__db = {
  Company: [{ id: 'co1', tenant_id: 't1', company_type: 'CLIENT', company_name: '바이어상사', client_roles: [{ email: 'kim@buyer.example', roles: ['ADMIN', 'APPROVER'] }, { email: 'pay@buyer.example', roles: ['FINANCE'] }] }, { id: 'co9', tenant_id: 't1', company_type: 'CLIENT' }],
  User: [STAFF, OTHER_STAFF, KIM, PAY, OTHER],
  TaskCard: [
    { id: 'c1', tenant_id: 't1', title: '스마트 조명', client_id: 'co1', client_visible: true, status: 'IN_PROGRESS' },
    { id: 'c2', tenant_id: 't1', title: '내부 카드', client_id: '', client_visible: false, status: 'TODO' },
  ],
  ProtoProject: [
    { id: 'p1', tenant_id: 't1', title: '무니스 조명', stage: 'DESIGN', card_id: 'c1', dev },
    { id: 'p2', tenant_id: 't1', title: '카드 없는 시제품', stage: 'DESIGN', card_id: 'c2', dev: {} },
  ],
  Notification: [], NotificationSetting: [], OperationSetting: [],
};
const db = globalThis.__db;
const proj = () => db.ProtoProject.find((p) => p.id === 'p1');
const notes = (type) => db.Notification.filter((n) => n.type === type);
const parts = [{ id: 'p1', name: '앞 하우징', layer: 'SHELL', shape: 'cylinder', size: { x: 150, y: 16, z: 150 } }, { id: 'p2', name: '버튼', layer: 'UI', shape: 'cylinder', size: { x: 10, y: 4, z: 10 } }];

// ── 공개 전: 고객 목록은 비어 있다 ──
as(KIM);
let r = await call('protoClient', { action: 'list', card_id: 'c1' });
assert.equal(r.status, 200);
assert.equal(r.data.projects.length, 0, '공개 전에는 보이지 않는다');
r = await call('protoClient', { action: 'list', card_id: 'c2' });
assert.equal(r.status, 403, '비공개 카드');
r = await call('protoClient', { action: 'share_model', project_id: 'p1', snapshot: {} });
assert.equal(r.status, 403, '고객은 공개할 수 없다');

// ── 직원 공개 ──
as(OTHER_STAFF);
r = await call('protoClient', { action: 'share_doc', project_id: 'p1', doc: 'nameplate', text: 'x' });
assert.equal(r.status, 404, '다른 팀 직원');
as(STAFF);
r = await call('protoClient', { action: 'share_model', project_id: 'p2', snapshot: { dev, parts } });
assert.equal(r.status, 409, '고객사 없는 카드');
r = await call('protoClient', { action: 'share_model', project_id: 'p1', snapshot: { dev, parts, render_url: 'javascript:alert(1)' } });
assert.equal(r.status, 200, JSON.stringify(r.data));
const m = proj().client_share.model;
assert.equal(m.on, true);
assert.equal(m.dev.features.length, 2);
assert.equal(m.dev.features[0].note, undefined, '내부 메모 비공개');
assert.equal(m.dev.hw, undefined, 'LCSC 번호 비공개');
assert.equal(m.dev.cost, undefined, '원가 비공개');
assert.equal(m.dev.uuid_base, undefined, 'UUID 비공개');
assert.equal(m.render_url, '', 'https 아닌 주소는 버린다');
assert.ok(notes('proto_client_share').length >= 1 && notes('proto_client_share').every((n) => ['u-kim', 'u-pay'].includes(n.recipient_id)), '그 고객사 계정에만 알림');
assert.match(notes('proto_client_share')[0].link, /tab=dev/);

r = await call('protoClient', { action: 'share_doc', project_id: 'p1', doc: 'nameplate', text: '모델명: RENIGHT-L1\n정격 입력: DC 5 V' });
assert.equal(r.status, 200);
assert.equal(proj().client_share.docs.nameplate.version, 1);
r = await call('protoClient', { action: 'share_doc', project_id: 'p1', doc: 'nameplate', text: '모델명: RENIGHT-L1\n정격 입력: DC 5 V' });
assert.equal(r.status, 409, '같은 내용은 다시 보내지 않는다');
r = await call('protoClient', { action: 'share_doc', project_id: 'p1', doc: 'other', text: 'x' });
assert.equal(r.status, 400);
r = await call('protoClient', { action: 'share_eco', project_id: 'p1', no: 'ECO-002' });
assert.equal(r.status, 409, '처리된 ECO');
r = await call('protoClient', { action: 'share_eco', project_id: 'p1', no: 'ECO-009' });
assert.equal(r.status, 404);
r = await call('protoClient', { action: 'share_eco', project_id: 'p1', no: 'ECO-001' });
assert.equal(r.status, 200);
r = await call('protoClient', { action: 'share_eco', project_id: 'p1', no: 'ECO-001' });
assert.equal(r.status, 409, '두 번 보내지 않는다');

// ── 고객 보기 ──
as(KIM);
r = await call('protoClient', { action: 'list', card_id: 'c1' });
assert.equal(r.data.projects.length, 1);
const v = r.data.projects[0];
assert.ok(v.model && v.model.parts.length === 2);
assert.equal(v.ecos[0].no, 'ECO-001');
assert.deepEqual(v.pending, { eco: 1, doc: 1 });
assert.equal(JSON.stringify(v).includes('C12345'), false, '어디에도 LCSC 번호 없음');
assert.equal(JSON.stringify(v).includes('이호민'), false, '직원 이름 없음');
as(OTHER);
r = await call('protoClient', { action: 'list', card_id: 'c1' });
assert.equal(r.status, 403, '남의 고객사');
r = await call('protoClient', { action: 'eco_decide', project_id: 'p1', no: 'ECO-001', decision: 'APPROVED' });
assert.equal(r.status, 404, '남의 고객사는 결정 불가');

// 재무 전용 계정은 결정 불가, 의견은 가능
as(PAY);
r = await call('protoClient', { action: 'eco_decide', project_id: 'p1', no: 'ECO-001', decision: 'APPROVED' });
assert.equal(r.status, 403);
r = await call('protoClient', { action: 'comment', project_id: 'p1', part_id: 'p2', point: [1, 2, 3.04], text: '버튼이 너무 작아요' });
assert.equal(r.status, 200);
assert.equal(proj().client_review.comments[0].part_name, '버튼');
assert.deepEqual(proj().client_review.comments[0].point, [1, 2, 3]);

as(KIM);
r = await call('protoClient', { action: 'eco_decide', project_id: 'p1', no: 'ECO-001', decision: 'REJECTED' });
assert.equal(r.status, 400, '반려 이유 필요');
r = await call('protoClient', { action: 'eco_decide', project_id: 'p1', no: 'ECO-001', decision: 'APPROVED', note: '좋습니다' });
assert.equal(r.status, 200);
assert.equal(proj().client_review.ecos['ECO-001'].decision, 'APPROVED');
r = await call('protoClient', { action: 'eco_decide', project_id: 'p1', no: 'ECO-001', decision: 'REJECTED', note: '번복' });
assert.equal(r.status, 409, '중복 결정 불가');
r = await call('protoClient', { action: 'doc_decide', project_id: 'p1', doc: 'nameplate', version: 1, decision: 'CHANGES' });
assert.equal(r.status, 400, '수정 내용 필요');
r = await call('protoClient', { action: 'doc_decide', project_id: 'p1', doc: 'nameplate', version: 1, decision: 'CHANGES', note: '제조국 표기 추가' });
assert.equal(r.status, 200);
assert.deepEqual(r.data.project.pending, { eco: 0, doc: 0 });
assert.ok(notes('proto_client_reply').length >= 3, '직원 알림');
assert.match(notes('proto_client_reply').at(-1).link, /\/prototypes\/p1\/develop/);

// 새 판을 보내면 다시 확인 대기, 예전 판은 남는다
as(STAFF);
r = await call('protoClient', { action: 'share_doc', project_id: 'p1', doc: 'nameplate', text: '모델명: RENIGHT-L1\n정격 입력: DC 5 V\n제조국: 중국' });
assert.equal(proj().client_share.docs.nameplate.version, 2);
assert.equal(proj().client_share.doc_history.length, 1);
as(KIM);
r = await call('protoClient', { action: 'doc_decide', project_id: 'p1', doc: 'nameplate', version: 1, decision: 'APPROVED' });
assert.equal(r.status, 409, '옛 판에는 답할 수 없다');
r = await call('protoClient', { action: 'doc_decide', project_id: 'p1', doc: 'nameplate', version: 2, decision: 'APPROVED' });
assert.equal(r.status, 200);
assert.equal(proj().client_review.docs.nameplate.length, 2, '결정 기록은 쌓인다');

// 직원: 의견 처리, 공개 중단
as(STAFF);
const cid = proj().client_review.comments[0].id;
r = await call('protoClient', { action: 'resolve_comment', project_id: 'p1', comment_id: cid });
assert.equal(proj().client_review.comments[0].resolved, true);
r = await call('protoClient', { action: 'staff_view', project_id: 'p1' });
assert.equal(r.data.review.ecos['ECO-001'].decision, 'APPROVED');
r = await call('protoClient', { action: 'share_model', project_id: 'p1', on: false });
assert.equal(proj().client_share.model.on, false);
as(KIM);
r = await call('protoClient', { action: 'comment', project_id: 'p1', text: '하나 더' });
assert.equal(r.status, 409, '3D 공개 끝나면 위치 의견 불가');
r = await call('protoClient', { action: 'list', card_id: 'c1' });
assert.equal(r.data.projects[0].model, null);
assert.ok(proj().dev.ecos.length === 2 && proj().dev.hw.lcsc.U1 === 'C12345', '설계 데이터는 건드리지 않는다');
console.log('proto-client functions ok');
