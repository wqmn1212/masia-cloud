// 결제 요청·송금 알림 검산: 요청 검사, 고객에게 보내는 결제 단계(계좌는 등록된 것만), 송금 알림 검사, 기한 알림 단계를 확인한다.
// 실행: npm run check:payment-request
import assert from 'node:assert/strict';
import { paymentRequestPatch, paymentReportPatch, clientPaymentStage, dueReminder, paymentRequestState, CLEARED_REPORT, REMITTANCE_FOR_STAGE } from '../base44/shared/paymentRequest.ts';
import { REMITTANCE_FOR_STAGE as SCREEN_REMITTANCE } from '../src/components/files/documentTypes.js';

const today = '2026-10-28';
const usd = { id: 'acc-usd', tenant_id: 't1', currency: 'USD', label: '이지스 USD', bank_name: '예시은행', account_holder: 'AEGIS TRADE', account_no: '123-456', swift_code: 'EXAMKRSE', bank_address: '서울', active: true, note: '송금 메모에 프로젝트명을 적어 주세요' };
const stage = { id: 'p1', stage_type: 'DOWN_PAYMENT', percentage: 30, approval_status: 'PENDING' };
const input = { amount: '3150.555', currency: 'USD', due_date: '2026-11-04', payee: 'AEGIS', note: '  선금 30%  ' };

// 요청 검사: 금액은 소수 둘째 자리, 메모는 앞뒤 공백 제거, 이지스 계좌 ID를 남긴다
let r = paymentRequestPatch(input, { stage, account: usd, today });
assert.deepEqual(r.patch, { amount: 3150.56, currency: 'USD', due_date: '2026-11-04', payee: 'AEGIS', payee_account_id: 'acc-usd', request_note: '선금 30%' });
assert.match(paymentRequestPatch({ ...input, amount: 0 }, { stage, account: usd, today }).error, /금액/);
assert.match(paymentRequestPatch({ ...input, currency: 'EUR' }, { stage, account: usd, today }).error, /통화/);
assert.match(paymentRequestPatch({ ...input, due_date: '2026-10-27' }, { stage, account: usd, today }).error, /오늘/, '지난 날짜는 기한이 될 수 없다');
assert.equal(paymentRequestPatch({ ...input, due_date: today }, { stage, account: usd, today }).error, undefined, '오늘 기한은 된다');
assert.match(paymentRequestPatch(input, { stage, account: null, today }).error, /받는 계좌/);
assert.match(paymentRequestPatch(input, { stage, account: { ...usd, active: false }, today }).error, /받는 계좌/, '꺼진 계좌는 못 고른다');
assert.match(paymentRequestPatch({ ...input, currency: 'KRW' }, { stage, account: usd, today }).error, /USD 계좌/, '통화가 다른 계좌');
assert.match(paymentRequestPatch(input, { stage: { ...stage, approval_status: 'APPROVED' }, account: usd, today }).error, /입금 확인/);
// 공장 직접 송금: 확인된 공장 계좌가 있을 때만, 이지스 계좌 ID는 비운다
assert.match(paymentRequestPatch({ ...input, payee: 'FACTORY' }, { stage, factoryVerified: false, today }).error, /공장 계좌/);
assert.equal(paymentRequestPatch({ ...input, payee: 'FACTORY' }, { stage, factoryVerified: true, today }).patch.payee_account_id, '');
assert.match(paymentRequestPatch({ ...input, payee: '' }, { stage, account: usd, today }).error, /받는 곳/);
assert.match(paymentRequestPatch({ ...input, note: 'x'.repeat(501) }, { stage, account: usd, today }).error, /500자/);

// 고객에게 보내는 결제 단계: 요청이 있을 때만 기한·계좌, 계좌는 같은 ID·켜진 것만
const requested = { ...stage, ...r.patch, requested_at: '2026-10-28T01:00:00Z' };
let c = clientPaymentStage(requested, [usd]);
assert.equal(c.request_state, 'REQUESTED');
assert.equal(c.due_date, '2026-11-04');
assert.deepEqual(c.payee_account, { label: '이지스 USD', currency: 'USD', bank_name: '예시은행', account_holder: 'AEGIS TRADE', account_no: '123-456', swift_code: 'EXAMKRSE', bank_address: '서울', note: '송금 메모에 프로젝트명을 적어 주세요' });
assert.equal('tenant_id' in c.payee_account, false, '내부 필드는 보내지 않는다');
assert.equal(clientPaymentStage({ ...requested, payee_account_id: 'forged' }, [usd]).payee_account, null, '등록되지 않은 계좌 ID 는 보여 주지 않는다');
assert.equal(clientPaymentStage(requested, [{ ...usd, active: false }]).payee_account, null, '꺼진 계좌는 보여 주지 않는다');
c = clientPaymentStage({ ...stage, due_date: '2026-11-04', payee: 'AEGIS', payee_account_id: 'acc-usd' }, [usd]);
assert.equal(c.request_state, 'NONE');
assert.equal(c.due_date, '', '요청 전에는 기한을 보내지 않는다');
assert.equal(c.payee_account, null);
assert.equal(clientPaymentStage({ ...requested, payee: 'FACTORY', payee_account_id: '' }, [usd]).payee_account, null, '공장 직접 송금은 공장 계좌 상자로 따로');

// 송금 알림 검사
const now = '2026-10-28T05:00:00Z';
r = paymentReportPatch({ paid_date: '2026-10-28', note: ' 국민은행에서 보냄 ' }, { stage: requested, today, by: '김담당', now });
assert.deepEqual(r.patch, { client_reported_paid_at: now, client_reported_paid_date: '2026-10-28', client_reported_by_name: '김담당', client_report_note: '국민은행에서 보냄' });
assert.match(paymentReportPatch({ paid_date: '2026-10-29' }, { stage: requested, today, by: 'x', now }).error, /오늘/, '앞날 송금일은 안 된다');
assert.match(paymentReportPatch({ paid_date: '' }, { stage: requested, today, by: 'x', now }).error, /송금한 날/);
assert.match(paymentReportPatch({ paid_date: today }, { stage, today, by: 'x', now }).error, /결제 요청이 없는/);
assert.match(paymentReportPatch({ paid_date: today }, { stage: { ...requested, approval_status: 'APPROVED' }, today, by: 'x', now }).error, /입금 확인/);
const reported = { ...requested, ...r.patch };
assert.equal(paymentRequestState(reported), 'REPORTED');
c = clientPaymentStage(reported, [usd]);
assert.equal(c.reported_paid_date, '2026-10-28');
assert.equal(c.reported_by_name, '김담당');
assert.equal(paymentReportPatch({ paid_date: '2026-10-27' }, { stage: reported, today, by: '김담당', now }).patch.client_reported_paid_date, '2026-10-27', '송금 알림은 고칠 수 있다');
assert.equal(paymentRequestState({ ...reported, ...CLEARED_REPORT }), 'REQUESTED', '요청을 다시 보내면 송금 알림을 비운다');

// 기한 알림: 3일 안 D3 → 당일 D0 → 지나면 직원(OVERDUE), 같은 단계는 한 번만, 송금 알림·입금 확인 뒤에는 없음
const due = (d, extra = {}) => ({ ...requested, due_date: d, ...extra });
assert.equal(dueReminder(due('2026-11-04'), today), null, '7일 남음');
assert.deepEqual(dueReminder(due('2026-10-31'), today), { step: 'D3', left: 3, key: '2026-10-31:D3' });
assert.equal(dueReminder(due('2026-10-31', { reminder_sent_for: '2026-10-31:D3' }), today), null, '이미 보냄');
assert.deepEqual(dueReminder(due(today, { reminder_sent_for: '2026-10-28:D3' }), today), { step: 'D0', left: 0, key: '2026-10-28:D0' });
assert.deepEqual(dueReminder(due('2026-10-25'), today), { step: 'OVERDUE', left: -3, key: '2026-10-25' });
assert.equal(dueReminder(due('2026-10-25', { overdue_notified_for: '2026-10-25' }), today), null);
assert.equal(dueReminder(due('2026-10-31', { reminder_sent_for: '2026-10-24:D3' }), today).step, 'D3', '기한이 바뀌면 다시 알린다');
assert.equal(dueReminder({ ...reported, due_date: '2026-10-25' }, today), null, '송금 알림 뒤에는 직원 확인 차례');
assert.equal(dueReminder({ ...stage, due_date: '2026-10-25' }, today), null, '요청 전');

// 송금확인증 종류: 화면과 서버가 같다 (중도금 포함)
assert.deepEqual(REMITTANCE_FOR_STAGE, SCREEN_REMITTANCE);

console.log('payment-request: 결제 요청·송금 알림 검산 통과');
