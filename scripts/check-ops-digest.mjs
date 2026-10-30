// 직원 일일 운영 요약 검산: 묶음별 계산(오늘 마감·지연 위험·고객 대기·공장 대기·확인할 것·영업 기회), 담당자별 범위,
// 관리자 팀 숫자, 빈 날 생략, 중국어 글, 그리고 서버 함수(하루 한 번, 권한, 메일 설정).
// 실행: npm run check:ops-digest
import assert from 'node:assert/strict';
import * as D from '../base44/shared/opsDigest.ts';

const today = '2026-11-02';
const now = '2026-11-01T23:30:00Z'; // 11/2 08:30 KST
const ME = { id: 'u1', full_name: '이호민', account_tier: 'sub', tenant_id: 't1' };
const BOSS = { id: 'u9', full_name: '대표', account_tier: 'service', tenant_id: 't1' };
const data = {
  cards: [
    { id: 'c1', title: '휴대용 선풍기 박스', title_cn: '便携风扇包装盒', status: 'IN_PROGRESS', owner_id: 'u1', owner_name: '이호민', client_id: 'co1', holiday_conflicts: [{ name: '춘절', start: '2027-02-05', end: '2027-02-17' }] },
    { id: 'c2', title: '드립백 포장재', status: 'IN_PROGRESS', owner_id: 'u2', owner_name: '왕리', client_id: 'co1' },
    { id: 'c3', title: '완료된 카드', status: 'DONE', owner_id: 'u1' },
    { id: 'c4', title: '책임자 없는 카드', status: 'TODO', owner_id: '' },
  ],
  milestones: [
    { id: 'm1', card_id: 'c1', label: '인쇄', label_cn: '印刷', status: 'pending', planned_date: '2026-11-02' },
    { id: 'm2', card_id: 'c1', label: '샘플', status: 'pending', planned_date: '2026-10-28' },
    { id: 'm3', card_id: 'c1', label: '포장', status: 'pending', planned_date: '2026-11-04' },
    { id: 'm4', card_id: 'c1', label: '선적', status: 'pending', planned_date: '2026-11-20' },
    { id: 'm5', card_id: 'c2', label: '금형', status: 'pending', planned_date: '2026-10-30', owner_ids: ['u1'] },
    { id: 'm6', card_id: 'c2', label: '남의 단계', status: 'pending', planned_date: '2026-10-25' },
    { id: 'm7', card_id: 'c1', label: '끝난 단계', status: 'done', planned_date: '2026-10-01' },
  ],
  tasks: [
    { id: 't1', card_id: 'c1', title: '공장 견적 다시 받기', status: 'TODO', due_date: '2026-11-02' },
    { id: 't2', card_id: 'c2', title: '왕리 업무', status: 'TODO', due_date: '2026-11-02', assignee_name: '왕리' },
    { id: 't3', card_id: 'c2', title: '내게 맡긴 업무', status: 'TODO', due_date: '2026-10-31', assignee_name: '이호민' },
  ],
  clientWaits: [
    { card_id: 'c1', ko: '견적 비교표 선택', cn: '比价表选择', since: '2026-10-27' },
    { card_id: 'c1', ko: '출고 승인', cn: '出货批准', since: '2026-11-01' },
  ],
  signatures: [{ id: 's1', card_id: 'c1', status: 'OUT', created_date: '2026-10-20T01:00:00Z' }],
  factoryRequests: [
    { id: 'f1', card_id: 'c1', status: 'OPEN', created_date: '2026-10-29T01:00:00Z', expires_at: '2026-11-12T01:00:00Z', items: [{ status: 'WAITING' }, { status: 'SUBMITTED' }] },
    { id: 'f2', card_id: 'c1', status: 'OPEN', created_date: '2026-10-28T01:00:00Z', last_opened_at: '2026-10-29T01:00:00Z', expires_at: '2026-11-11T01:00:00Z', items: [{ status: 'REDO' }] },
    { id: 'f3', card_id: 'c1', status: 'REVOKED', created_date: '2026-10-01T01:00:00Z', expires_at: '2026-11-11T01:00:00Z', items: [{ status: 'WAITING' }] },
    { id: 'f4', card_id: 'c2', status: 'OPEN', created_date: '2026-10-28T01:00:00Z', expires_at: '2026-11-11T01:00:00Z', items: [{ status: 'SUBMITTED' }, { status: 'SUBMITTED' }] },
  ],
  chats: [
    { card_id: 'c1', sender_role: 'HQ', created_date: '2026-10-30T01:00:00Z' },
    { card_id: 'c1', sender_role: 'CLIENT', sender_name: '김담당', created_date: '2026-11-01T02:00:00Z' },
    { card_id: 'c2', sender_role: 'CLIENT', created_date: '2026-10-31T01:00:00Z' },
    { card_id: 'c2', sender_role: 'AGENT', created_date: '2026-11-01T01:00:00Z' },
  ],
  plans: [
    { product_key: 'c3', product_name: '선풍기', company_name: '바이어상사', order_by: '2026-11-10' },
    { product_key: 'c3', product_name: '먼 상품', company_name: '바이어상사', order_by: '2026-12-30' },
    { product_key: 'c2', product_name: '드립백', company_name: '바이어상사', order_by: '2026-10-30' },
  ],
};
const me = D.buildOpsDigest({ user: ME, today, now, data });
const s = me.sections;
assert.deepEqual(s.due_today.map((x) => x.ko), ['인쇄 (일정)', '공장 견적 다시 받기 (업무)']);
assert.deepEqual(s.risk.map((x) => x.ko), ['샘플 · 5일 지남', '포장 · 11/4까지 (2일 남음)', '금형 · 3일 지남', '내게 맡긴 업무 · 업무 2일 지남', '춘절 겹침 (2/5~2/17)'], '남의 카드라도 내가 맡은 단계·업무는 들어온다');
assert.deepEqual(s.client_wait.map((x) => x.ko), ['견적 비교표 선택 · 6일째', '계약서 서명 · 13일째'], '3일 이하는 아직 아니다');
assert.deepEqual(s.factory_wait.map((x) => x.ko), ['공장이 업로드 링크를 4일째 열어 보지 않음', '공장 미제출 1건 (기한 11/11)'], '회수한 링크는 뺀다');
assert.deepEqual(s.to_check.map((x) => x.ko), ['공장 제출 1건 확인 대기', '고객 새 메시지 · 김담당'], '남의 카드 제출·답한 메시지는 뺀다');
assert.deepEqual(s.opportunity.map((x) => [x.card_title, x.ko]), [['바이어상사', '선풍기 11/10까지 주문 권장']], '완료된 첫 카드의 책임자에게, 14일 넘게 남은 것은 빼고');
assert.equal(me.team, null);
assert.equal(me.empty, false);

const boss = D.buildOpsDigest({ user: BOSS, admin: true, today, now, data });
assert.equal(boss.sections.due_today.length, 0, '관리자 본인 카드는 없다');
assert.equal(boss.sections.opportunity.length, 2, '관리자는 팀 전체 재주문 시점');
assert.deepEqual(boss.team.late.map((x) => [x.card_title, x.days]), [['드립백 포장재', 8], ['휴대용 선풍기 박스', 5]]);
assert.deepEqual([boss.team.active, boss.team.client_waits, boss.team.factory_submissions, boss.team.no_owner], [3, 1, 3, 1]);

const nobody = D.buildOpsDigest({ user: { id: 'u5', full_name: '신입', account_tier: 'sub' }, today, now, data });
assert.equal(nobody.empty, true, '맡은 것이 없으면 보내지 않는다');

const ko = D.digestText(me, { name: '이호민' });
assert.match(ko.subject, /^\[오늘 업무\] 11\/2 · 14건$/);
assert.match(ko.body, /■ 지연 위험 \(5\)\n- 휴대용 선풍기 박스 · 샘플 · 5일 지남/);
const zh = D.digestText(boss, { name: '王', lang: 'zh' });
assert.match(zh.subject, /^\[今日工作\]/);
assert.match(zh.body, /团队概况：进行中3张 · 延误2张/);
assert.match(D.digestText(me, { name: '王', lang: 'zh' }).body, /便携风扇包装盒 · 印刷（进度）/);

// 고객 대기 줄 만들기 (clientOverview 결과)
const waits = D.clientWaitsFrom({ comparison_pending: [{ card_id: 'c1', card_title: 'x', published_at: '2026-10-27T15:30:00Z' }], qc_pending: [{ card_id: 'c1', inspection_type: 'SAMPLE', published_at: '2026-10-20T00:00:00Z' }, { card_id: 'c1', decision: 'ON_HOLD', published_at: '2026-10-20T00:00:00Z' }], file_review_pending: [{ card_id: 'c2', file_name: '박스.png', requested_at: '' }] });
assert.deepEqual(waits.map((w) => [w.ko, w.since]), [['견적 비교표 선택', '2026-10-28'], ['샘플 승인', '2026-10-20']], '한국 날짜로, 보류·날짜 없는 것은 빼고');
assert.equal(D.wantsDaily({ account_tier: 'sub' }), true);
assert.equal(D.wantsDaily({ account_tier: 'sub', notification_prefs: { daily: { email: false } } }), false);
assert.equal(D.wantsDaily({ account_tier: 'client' }), false);
console.log('ops-digest pure ok');

// ── 서버 함수 ──
const R = new URL('../base44/functions/', import.meta.url).href;
const call = async (fn, body) => { const m = await import(R + fn + '/entry.ts'); const res = await m.default(new Request('https://x', { method: 'POST', body: JSON.stringify(body) })); return { status: res.status, data: await res.json() }; };
const kstNow = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const STAFF = { id: 's1', full_name: '이호민', account_tier: 'sub', tenant_id: 't1', is_active: true, email: 'lee@aegis.example' };
const ZH = { id: 's2', full_name: '王丽', account_tier: 'sub', tenant_id: 't1', is_active: true, email: 'wang@aegis.example', preferred_language: 'zh' };
const OFF = { id: 's3', full_name: '끈사람', account_tier: 'sub', tenant_id: 't1', is_active: true, email: 'off@aegis.example', notification_prefs: { daily: { email: false } } };
const IDLE = { id: 's4', full_name: '한가', account_tier: 'sub', tenant_id: 't1', is_active: true, email: 'idle@aegis.example' };
const BOSS2 = { id: 's9', full_name: '대표', account_tier: 'service', tenant_id: 't1', is_active: true, email: 'boss@aegis.example' };
globalThis.__db = {
  User: [STAFF, ZH, OFF, IDLE, BOSS2, { id: 'cl', account_tier: 'client', company_id: 'co1', is_active: true, email: 'c@x' }],
  TaskCard: [
    { id: 'c1', tenant_id: 't1', title: '선풍기 박스', title_cn: '风扇盒', status: 'IN_PROGRESS', owner_id: 's1', client_id: '' },
    { id: 'c2', tenant_id: 't1', title: '드립백', title_cn: '挂耳包', status: 'IN_PROGRESS', owner_id: 's2', client_id: '' },
    { id: 'c3', tenant_id: 't1', title: '끈 사람 카드', status: 'IN_PROGRESS', owner_id: 's3', client_id: '' },
    { id: 'x1', tenant_id: 't2', title: '다른 팀', status: 'IN_PROGRESS', owner_id: 's1' },
  ],
  CardMilestone: [
    { id: 'm1', card_id: 'c1', label: '인쇄', status: 'pending', planned_date: kstNow },
    { id: 'm2', card_id: 'c2', label: '금형', label_cn: '模具', status: 'pending', planned_date: '2020-01-01' },
    { id: 'm3', card_id: 'c3', label: '샘플', status: 'pending', planned_date: kstNow },
    { id: 'mx', card_id: 'x1', label: '다른 팀 단계', status: 'pending', planned_date: kstNow },
  ],
  TaskItem: [], FactoryRequest: [], CardChat: [], SignatureRequest: [], ProductPlan: [], Company: [], Notification: [],
};
globalThis.__emails = [];
globalThis.__user = STAFF;
let res = await call('sendDailyOpsDigest', {});
assert.equal(res.status, 403, '직원이 직접 부를 수 없다');
res = await call('getOpsDigest', {});
assert.equal(res.status, 200);
assert.deepEqual(res.data.digest.sections.due_today.map((x) => x.ko), ['인쇄 (일정)'], '내 업무 화면: 다른 팀 카드 없음');
assert.equal(res.data.receives_email, true);
globalThis.__user = null;
res = await call('sendDailyOpsDigest', {});
assert.equal(res.status, 200);
assert.deepEqual(globalThis.__emails.map((m) => m.to).sort(), ['boss@aegis.example', 'lee@aegis.example', 'wang@aegis.example'], '끈 사람·할 일 없는 사람·고객 제외');
assert.match(globalThis.__emails.find((m) => m.to === 'wang@aegis.example').subject, /今日工作/);
assert.match(globalThis.__emails.find((m) => m.to === 'wang@aegis.example').body, /挂耳包 · 模具 · 已逾期/);
assert.match(globalThis.__emails.find((m) => m.to === 'boss@aegis.example').body, /팀 전체: 진행 3건 · 지연 카드 1건/);
assert.equal(globalThis.__db.Notification.filter((n) => n.type === 'daily_digest').length, 3);
assert.equal(globalThis.__db.Notification[0].link, '/my-work');
res = await call('sendDailyOpsDigest', {});
assert.equal(res.data.sent, 0, '같은 날 다시 불러도 다시 보내지 않는다');
assert.equal(globalThis.__emails.length, 3);
console.log('ops-digest functions ok');
const F = await import('../src/lib/opsDigest.js');
assert.deepEqual(F.SECTIONS, D.SECTIONS);
assert.deepEqual(F.SECTION_LABEL, D.SECTION_LABEL);
console.log('ops-digest mirror ok');
