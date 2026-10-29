// 관리자 할 일(/admin-inbox) 목록을 만드는 순수 함수. 화면과 scripts/check-admin-inbox.mjs 가 함께 쓴다.
import { REMITTANCE_FOR_STAGE } from '../components/files/documentTypes.js';
import { factoryWait, compensationState } from './claimTracking.js';

const DAY = 86400000;
export const daysSince = (iso, now = Date.now()) => (iso ? Math.max(0, Math.floor((now - Date.parse(iso)) / DAY)) : null);
// 'YYYY-MM-DD'(한국 날짜) 기한까지 남은 날. 오늘이 기한이면 0, 지났으면 음수
export const daysUntil = (ymd, now = Date.now()) => {
  if (!ymd) return null;
  const today = new Date(now + 9 * 3600000).toISOString().slice(0, 10);
  return Math.round((Date.parse(ymd) - Date.parse(today)) / DAY);
};

// 입금 확인 대기: 아직 확인하지 않았고, 입금일이 적혔거나 송금확인증이 올라왔거나 고객이 '송금했어요'를 누른 단계만
// (입금 전 단계는 할 일이 아니다). 입금일(없으면 고객이 적은 송금일) 빠른 순
export function paymentQueue(stages = [], attachments = []) {
  const has = new Set(attachments.map((a) => `${a.card_id}:${a.document_type}`));
  const when = (s) => String(s.paid_date || s.client_reported_paid_date || '9999');
  return stages
    .filter((s) => s.approval_status === 'PENDING')
    .map((s) => ({ ...s, has_receipt: has.has(`${s.card_id}:${REMITTANCE_FOR_STAGE[s.stage_type]}`), reported: !!s.client_reported_paid_at }))
    .filter((s) => s.paid_date || s.has_receipt || s.reported)
    .sort((a, b) => when(a).localeCompare(when(b)));
}

// 결제 기한이 지났는데 고객이 아직 송금했다고 알리지 않은 결제 요청. 오래 지난 순
export function overdueQueue(stages = [], now = Date.now()) {
  return stages
    .filter((s) => s.approval_status === 'PENDING' && s.requested_at && !s.client_reported_paid_at && s.due_date)
    .map((s) => ({ ...s, left: daysUntil(s.due_date, now) }))
    .filter((s) => s.left < 0)
    .sort((a, b) => a.left - b.left);
}

export const OPEN_CLAIM = ['SUBMITTED', 'REVIEWING', 'FACTORY_CONFIRMED'];
// 열린 불량 신고와 다음 주문에 아직 반영하지 않은 보상 약속.
// 공장 회신 3영업일이 지난 건 → 접수 후 2일 넘게 그대로인 건(SUBMITTED) → 나머지 순
export function claimQueue(claims = [], now = Date.now()) {
  return claims
    .filter((c) => OPEN_CLAIM.includes(c.status) || compensationState(c) === 'PROMISED')
    .map((c) => ({ ...c, age: daysSince(c.submitted_at || c.created_date, now), wait: factoryWait(c, now), promise: compensationState(c) === 'PROMISED' }))
    .map((c) => ({ ...c, stale: c.status === 'SUBMITTED' && c.age > 2, factory_overdue: !!c.wait?.overdue }))
    .sort((a, b) => Number(b.factory_overdue) - Number(a.factory_overdue) || Number(b.stale) - Number(a.stale) || Number(OPEN_CLAIM.includes(b.status)) - Number(OPEN_CLAIM.includes(a.status)) || (b.age ?? 0) - (a.age ?? 0));
}

// 전자서명: 고객 수정 요청, 기한 지남, 기한 3일 이내 서명 대기
export function signatureQueue(sig = {}, now = Date.now()) {
  const soon = (sig.waiting || []).map((r) => ({ ...r, left: daysUntil(r.due_date, now) })).filter((r) => r.left != null && r.left <= 3);
  return [
    ...(sig.declined || []).map((r) => ({ ...r, kind: 'DECLINED' })),
    ...(sig.expired || []).map((r) => ({ ...r, kind: 'EXPIRED' })),
    ...soon.sort((a, b) => a.left - b.left).map((r) => ({ ...r, kind: 'DUE_SOON' })),
  ];
}

export function inboxCounts({ accounts = [], payments = [], overdue = [], comparisons = [], signatures = [], costs = { cards: [], shipments: [] }, claims = [] }) {
  return {
    accounts: accounts.length,
    payments: payments.length,
    overdue: overdue.length,
    comparisons: comparisons.length,
    signatures: signatures.length,
    costs: costs.cards.length + costs.shipments.length,
    claims: claims.length,
  };
}
