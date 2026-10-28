// 결제 요청 서버 함수 검산: 직원 요청(팀 계좌만·동시 수정 막기·메일에 계좌 번호 없음) → 고객 송금 알림 → 기한 알림 → 대시보드 할 일·요약 → 요청 취소.
// 실행: npm run check:payment-functions
import assert from 'node:assert/strict';
const R = new URL('../base44/functions/', import.meta.url).href;
const call = async (fn, body) => { const m = await import(R + fn + '/entry.ts'); const res = await m.default(new Request('https://x', { method: 'POST', body: JSON.stringify(body) })); return { status: res.status, data: await res.json() }; };
const kst = (d = 0) => new Date(Date.now() + 9 * 3600000 + d * 86400000).toISOString().slice(0, 10);
const STAFF = { id: 'u1', full_name: '이호민', account_tier: 'service', tenant_id: 't1', is_active: true, email: 'staff@example.com' };
const CLIENT = { id: 'cu1', full_name: '김담당', account_tier: 'client', company_id: 'co1', is_active: true, email: 'client@example.com' };
const MASTER = { id: 'm1', full_name: '마스터', account_tier: 'master', tenant_id: 't0', is_active: true };
globalThis.__db = {
  TaskCard: [
    { id: 'c1', tenant_id: 't1', title: '휴대용 선풍기', client_id: 'co1', client_visible: true, status: 'PRODUCTION' },
    { id: 'c2', tenant_id: 't2', title: '남의 카드', client_id: 'co9', client_visible: true, status: 'PRODUCTION' },
  ],
  PaymentStage: [
    { id: 'p1', tenant_id: 't1', card_id: 'c1', stage_type: 'DOWN_PAYMENT', percentage: 30, approval_status: 'PENDING', updated_date: 'v1' },
    { id: 'p2', tenant_id: 't1', card_id: 'c1', stage_type: 'BALANCE_PAYMENT', percentage: 70, approval_status: 'PENDING', updated_date: 'v1' },
  ],
  PayeeAccount: [
    { id: 'a-usd', tenant_id: 't1', currency: 'USD', label: '이지스 USD', bank_name: '예시은행', account_holder: 'AEGIS', account_no: '9988-7766', active: true },
    { id: 'a-t2', tenant_id: 't2', currency: 'USD', bank_name: '남의 은행', account_holder: 'X', account_no: '1111', active: true },
  ],
  User: [STAFF, CLIENT],
  Notification: [], ProjectAuditLog: [], CardAttachment: [], SignatureRequest: [], QCReport: [], QualitySpec: [], CardMilestone: [], Shipment: [], QuoteComparison: [], Quotation: [],
};
const db = globalThis.__db;
const stage = (id) => db.PaymentStage.find((s) => s.id === id);
const notes = (type) => db.Notification.filter((n) => n.type === type);
const base = { action: 'payment_request', card_id: 'c1', stage_id: 'p1', expected_updated_date: 'v1', amount: 3150, currency: 'USD', due_date: kst(7), payee: 'AEGIS', payee_account_id: 'a-usd', note: '선금 30%' };

// ── 직원 결제 요청 ──
globalThis.__user = STAFF;
let r = await call('manageCardCollaboration', { ...base, payee_account_id: 'a-t2' });
assert.equal(r.status, 400, '다른 팀 계좌는 고를 수 없다');
assert.match(r.data.error, /받는 계좌/);
r = await call('manageCardCollaboration', { ...base, expected_updated_date: 'old' });
assert.equal(r.status, 409, '그 사이 바뀐 단계는 다시 불러와야 한다');
r = await call('manageCardCollaboration', { ...base, payee: 'FACTORY' });
assert.equal(r.status, 400, '공장 직접 송금으로 설정되지 않은 카드');
r = await call('manageCardCollaboration', { ...base, card_id: 'c2', stage_id: 'p1' });
assert.equal(r.status, 403, '다른 팀 카드');
r = await call('manageCardCollaboration', base);
assert.equal(r.status, 200);
assert.equal(r.data.sent, 1, '고객사 계정에 알림');
assert.equal(stage('p1').payee_account_id, 'a-usd');
assert.equal(stage('p1').due_date, kst(7));
assert.equal(stage('p1').requested_by_name, '이호민');
assert.ok(stage('p1').requested_at);
const reqNote = notes('payment_requested')[0];
assert.equal(reqNote.recipient_id, 'cu1');
assert.match(reqNote.body, /USD 3,150/);
assert.equal(reqNote.body.includes('9988-7766'), false, '알림·메일에 계좌 번호를 넣지 않는다');
assert.equal((globalThis.__emails || []).some((m) => m.body.includes('9988-7766')), false);
assert.ok((globalThis.__emails || []).some((m) => m.to === 'client@example.com' && m.subject.includes('결제 요청')), '결제 요청은 메일도 보낸다');
assert.equal(db.ProjectAuditLog.at(-1).event_type, 'PAYMENT_REQUESTED');

// ── 고객: 대시보드 할 일·요약 ──
globalThis.__user = CLIENT;
r = await call('listClientTodos', {});
assert.equal(r.status, 200);
assert.deepEqual(r.data.payment_pending.map((p) => [p.stage_id, p.amount, p.due_date]), [['p1', 3150, kst(7)]]);
assert.equal(r.data.summaries.c1.turn, 'CLIENT');
assert.equal(r.data.summaries.c1.turn_reason, '선금 결제');
assert.equal(r.data.summaries.c1.open_tab, 'settlement');
assert.deepEqual(r.data.order, ['c1']);

// ── 고객 송금 알림 ──
r = await call('clientCardAction', { card_id: 'c1', action: 'payment_reported', stage_id: 'p2', paid_date: kst(0) });
assert.equal(r.status, 400, '요청 없는 단계');
r = await call('clientCardAction', { card_id: 'c1', action: 'payment_reported', stage_id: 'p1', paid_date: kst(1) });
assert.equal(r.status, 400, '앞날 송금일');
r = await call('clientCardAction', { card_id: 'c2', action: 'payment_reported', stage_id: 'p1', paid_date: kst(0) });
assert.equal(r.status, 403, '남의 고객사 카드');
r = await call('clientCardAction', { card_id: 'c1', action: 'payment_reported', stage_id: 'p1', paid_date: kst(0), note: '기업은행 송금', attachments: [{ name: '송금확인증.pdf', type: 'application/pdf', data: Buffer.from('%PDF-1').toString('base64') }] });
assert.equal(r.status, 200);
assert.equal(r.data.files, 1);
assert.equal(stage('p1').client_reported_paid_date, kst(0));
assert.equal(stage('p1').client_reported_by_name, '김담당');
assert.equal(stage('p1').approval_status, 'PENDING', '송금 알림은 입금 확인이 아니다');
assert.equal(db.CardAttachment.at(-1).document_type, 'REMITTANCE_DOWN');
assert.equal(db.CardAttachment.at(-1).client_visible, true);
assert.equal(notes('payment_reported')[0].recipient_id, 'u1', '직원에게 알림');
assert.equal(db.ProjectAuditLog.at(-1).event_type, 'PAYMENT_REPORTED');
r = await call('listClientTodos', {});
assert.equal(r.data.payment_pending.length, 0, '송금 알림 뒤에는 고객 할 일이 아니다');
assert.equal(r.data.summaries.c1.payment.state, 'REPORTED');

// ── 기한 알림 (매일 점검) ──
globalThis.__user = MASTER;
Object.assign(stage('p2'), { requested_at: new Date().toISOString(), due_date: kst(2), amount: 7350, currency: 'USD', payee: 'AEGIS', payee_account_id: 'a-usd' });
r = await call('checkPaymentDue', {});
assert.deepEqual([r.data.reminded, r.data.overdue], [1, 0]);
assert.equal(stage('p2').reminder_sent_for, `${kst(2)}:D3`);
assert.match(notes('payment_due')[0].title, /2일 남음/);
r = await call('checkPaymentDue', {});
assert.equal(r.data.reminded, 0, '같은 단계는 한 번만');
stage('p2').due_date = kst(-1);
r = await call('checkPaymentDue', {});
assert.equal(r.data.overdue, 1);
assert.equal(stage('p2').overdue_notified_for, kst(-1));
assert.equal(notes('payment_overdue')[0].recipient_id, 'u1', '기한 지남은 직원에게');
r = await call('checkPaymentDue', {});
assert.equal(r.data.overdue, 0);
globalThis.__user = STAFF;
r = await call('checkPaymentDue', {});
assert.equal(r.status, 403, '마스터·예약 실행만');

// ── 요청 취소 ──
r = await call('manageCardCollaboration', { action: 'payment_request_cancel', card_id: 'c1', stage_id: 'p2', expected_updated_date: 'v1' });
assert.equal(r.status, 200);
assert.equal(stage('p2').requested_at, '');
assert.equal(stage('p2').payee_account_id, '');
assert.equal(stage('p2').overdue_notified_for, '', '알림 기록도 비운다');
assert.equal(notes('payment_request_canceled').length, 1);
assert.equal(db.ProjectAuditLog.at(-1).event_type, 'PAYMENT_REQUEST_CANCELED');

// ── 고객 메일 알림 설정: 끈 묶음은 앱 알림만, 결제 요청은 항상 메일 ──
const { notifyUsers } = await import('../base44/shared/notify.ts');
const { createClientFromRequest } = await import('npm:@base44/sdk@0.8.44');
const svc = createClientFromRequest().asServiceRole;
const quiet = { ...CLIENT, id: 'cu2', email: 'quiet@example.com', notification_prefs: { progress: { email: false } } };
globalThis.__emails = [];
await notifyUsers(svc, [quiet], { type: 'card_moved', title: '[진행 상황] 휴대용 선풍기', body: 'x', task_card_id: 'c1' });
assert.equal(db.Notification.filter((n) => n.recipient_id === 'cu2' && n.type === 'card_moved').length, 1, '앱 알림은 그대로');
assert.equal(globalThis.__emails.length, 0, '끈 묶음은 메일을 보내지 않는다');
await notifyUsers(svc, [quiet], { type: 'payment_requested', title: '[결제 요청] 휴대용 선풍기', body: 'x', task_card_id: 'c1' });
assert.equal(globalThis.__emails.length, 1, '결제 요청은 끌 수 없다');

console.log('payment-functions: 결제 요청 서버 함수 검산 통과');
