// 결제 요청(직원 → 고객)과 송금 알림(고객 → 직원) 규칙. 화면은 서버 응답의 request_state 를 그대로 쓴다.
// '송금했어요'는 입금 확인이 아니라 직원에게 확인을 요청하는 신호이고, 입금 확인은 지금처럼 직원만 한다.
// 검산: npm run check:payment-request
export const STAGE_LABEL: Record<string, string> = { DOWN_PAYMENT: '선금', INTERIM_PAYMENT: '중도금', BALANCE_PAYMENT: '잔금' };
export const CURRENCIES = ['KRW', 'USD', 'CNY'];
// 결제 단계 ↔ 송금확인증 파일 종류 (src/components/files/documentTypes.js 의 REMITTANCE_FOR_STAGE 와 같다)
export const REMITTANCE_FOR_STAGE: Record<string, string> = { DOWN_PAYMENT: 'REMITTANCE_DOWN', INTERIM_PAYMENT: 'REMITTANCE_INTERIM', BALANCE_PAYMENT: 'REMITTANCE_BALANCE' };

const validDate = (s: any) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);

// 결제 요청 상태: 요청 전 · 요청됨 · 고객이 송금했다고 알림(직원 확인 전) · 입금 확인
export function paymentRequestState(s: any) {
  if (s?.approval_status === 'APPROVED') return 'PAID';
  if (!s?.requested_at) return 'NONE';
  return s.client_reported_paid_at ? 'REPORTED' : 'REQUESTED';
}

// 요청을 다시 보내거나 취소하면 고객 송금 알림과 기한 알림 기록을 비운다
export const CLEARED_REPORT = { client_reported_paid_at: '', client_reported_paid_date: '', client_reported_by_name: '', client_report_note: '', reminder_sent_for: '', overdue_notified_for: '' };

/**
 * 직원이 보내는 결제 요청 검사. 통과하면 { patch }, 아니면 { error }.
 * @param account  고른 이지스 받는 계좌 (PayeeAccount, 같은 팀). 공장 직접 송금이면 쓰지 않는다
 * @param factoryVerified  이지스가 확인한 공장 계좌가 있고 변경 요청이 없는지
 */
export function paymentRequestPatch(input: any, { stage, account, factoryVerified, today }: any) {
  if (stage.approval_status === 'APPROVED') return { error: '이미 입금 확인된 단계입니다.' };
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { error: '청구 금액을 입력하세요.' };
  if (!CURRENCIES.includes(input.currency)) return { error: '통화를 고르세요.' };
  if (!validDate(input.due_date)) return { error: '결제 기한을 입력하세요.' };
  if (input.due_date < today) return { error: '결제 기한은 오늘이거나 그 뒤여야 합니다.' };
  if (input.payee === 'AEGIS') {
    if (!account || account.active === false) return { error: '받는 계좌를 고르세요. 계좌는 마스터 계정이 등록합니다.' };
    if (account.currency !== input.currency) return { error: `고른 계좌는 ${account.currency} 계좌입니다. 청구 통화와 같은 계좌를 고르세요.` };
  } else if (input.payee === 'FACTORY') {
    if (!factoryVerified) return { error: '이지스가 확인한 공장 계좌가 없거나 계좌 변경 요청이 있습니다. 공장 계좌부터 확인하세요.' };
  } else {
    return { error: '받는 곳을 고르세요.' };
  }
  const note = String(input.note || '').trim();
  if (note.length > 500) return { error: '메모는 500자 이내로 적어 주세요.' };
  return { patch: { amount: Math.round(amount * 100) / 100, currency: input.currency, due_date: input.due_date, payee: input.payee, payee_account_id: input.payee === 'AEGIS' ? account.id : '', request_note: note } };
}

// 고객이 보내는 송금 알림 검사. 요청이 있는 단계만, 송금일은 오늘까지
export function paymentReportPatch(input: any, { stage, today, by, now }: any) {
  const state = paymentRequestState(stage);
  if (state === 'PAID') return { error: '이미 입금 확인된 단계입니다.' };
  if (state === 'NONE') return { error: '결제 요청이 없는 단계입니다.' };
  if (!validDate(input.paid_date)) return { error: '송금한 날을 입력해 주세요.' };
  if (input.paid_date > today) return { error: '송금한 날은 오늘이거나 그 전이어야 합니다.' };
  const note = String(input.note || '').trim();
  if (note.length > 500) return { error: '메모는 500자 이내로 적어 주세요.' };
  return { patch: { client_reported_paid_at: now, client_reported_paid_date: input.paid_date, client_reported_by_name: by, client_report_note: note } };
}

const ACCOUNT_FIELDS = ['label', 'currency', 'bank_name', 'account_holder', 'account_no', 'swift_code', 'bank_address', 'note'];
export const publicAccount = (a: any) => Object.fromEntries(ACCOUNT_FIELDS.map((k) => [k, a?.[k] || '']));

/**
 * 고객에게 보내는 결제 단계. 이지스 계좌는 저장된 사본이 아니라 마스터가 등록한 계좌를 지금 값으로 붙인다
 * (결제 단계를 고쳐도 마스터가 등록한 계좌 밖으로는 바꿀 수 없다). 공장 직접 송금은 확인된 공장 계좌 상자를 따로 보낸다.
 * @param accounts  카드와 같은 팀의 PayeeAccount
 */
export function clientPaymentStage(s: any, accounts: any[] = []) {
  const state = paymentRequestState(s);
  const open = state === 'REQUESTED' || state === 'REPORTED';
  const account = open && s.payee === 'AEGIS' ? accounts.find((a) => a.id === s.payee_account_id && a.active !== false) : null;
  return {
    id: s.id, stage_type: s.stage_type, percentage: Number(s.percentage) || 0, amount: s.amount ?? null, currency: s.currency || '',
    approval_status: s.approval_status, approved_at: s.approved_at || '', paid_date: s.paid_date || '',
    request_state: state,
    due_date: open ? s.due_date || '' : '',
    payee: open ? s.payee || '' : '',
    request_note: open ? s.request_note || '' : '',
    payee_account: account ? publicAccount(account) : null,
    reported_at: state === 'REPORTED' ? s.client_reported_paid_at : '',
    reported_paid_date: state === 'REPORTED' ? s.client_reported_paid_date || '' : '',
    reported_by_name: state === 'REPORTED' ? s.client_reported_by_name || '' : '',
    report_note: state === 'REPORTED' ? s.client_report_note || '' : '',
  };
}

// 결제 기한 알림: 3일 안(D3)·당일(D0)은 고객에게, 기한이 지나면(OVERDUE) 직원에게. 같은 기한·단계로는 한 번만 보낸다
export function dueReminder(s: any, today: string) {
  if (paymentRequestState(s) !== 'REQUESTED' || !validDate(s.due_date)) return null;
  const left = daysBetween(today, s.due_date);
  if (left < 0) return s.overdue_notified_for === s.due_date ? null : { step: 'OVERDUE', left, key: s.due_date };
  const step = left === 0 ? 'D0' : left <= 3 ? 'D3' : '';
  const key = `${s.due_date}:${step}`;
  if (!step || s.reminder_sent_for === key) return null;
  return { step, left, key };
}
