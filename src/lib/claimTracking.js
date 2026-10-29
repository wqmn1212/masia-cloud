// 불량 신고(클레임) 추적 (3단계 H): 공장 회신 기한, 보상 약속과 반영, 상품별 품질 이력.
// 서버 base44/shared/claimTracking.ts 와 같은 규칙 (화면용 사본). 검산: npm run check:claim-tracking
export const FACTORY_REPLY_DAYS = 3; // 중국어 클레임 문서가 요구하는 회신 기한 (영업일)
export const CLOSED = ['RESOLVED', 'REJECTED'];
// 다음 주문에 반영해야 끝나는 보상 (재생산·교체, 다음 발주 할인)
export const PROMISE_KINDS = ['REPLACE', 'DISCOUNT'];
const DAY = 86400000;
const kstDate = (ms) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// from 다음 날부터 오늘까지 평일 수 (토·일 제외, 한국 날짜 기준)
export function businessDaysSince(fromIso, now = Date.now()) {
  if (!fromIso) return 0;
  const start = Date.parse(`${kstDate(Date.parse(fromIso))}T00:00:00Z`);
  const end = Date.parse(`${kstDate(now)}T00:00:00Z`);
  let n = 0;
  for (let t = start + DAY; t <= end; t += DAY) { const w = new Date(t).getUTCDay(); if (w !== 0 && w !== 6) n += 1; }
  return n;
}

// 공장 회신 대기: 문서를 보냈고 회신 기록이 없는 열린 클레임만. days = 달력 일수(고객 표시), business = 영업일
export function factoryWait(c, now = Date.now()) {
  if (!c?.factory_requested_at || c.factory_responded_at || CLOSED.includes(c.status)) return null;
  const days = Math.max(0, Math.round((Date.parse(`${kstDate(now)}T00:00:00Z`) - Date.parse(`${kstDate(Date.parse(c.factory_requested_at))}T00:00:00Z`)) / DAY));
  const business = businessDaysSince(c.factory_requested_at, now);
  return { days, business, overdue: business > FACTORY_REPLY_DAYS };
}

// 보상 상태: PROMISED(약속, 다음 주문 미반영) · APPLIED(반영됨) · null(반영할 보상 없음)
export function compensationState(c) {
  const kind = c?.compensation?.kind || c?.resolution;
  if (!PROMISE_KINDS.includes(kind) || c?.status === 'REJECTED') return null;
  return c.compensation?.applied_card_id ? 'APPLIED' : 'PROMISED';
}

// 직원이 보상 약속·반영을 저장할 때 바꿀 값 (input: { amount, currency, note, applied_card_id, applied_card_title, applied_note })
export function compensationPatch(input, { claim, by, now }) {
  const kind = claim?.resolution;
  if (!PROMISE_KINDS.includes(kind)) return { error: '처리 방법이 재생산·교체 또는 다음 발주 할인일 때만 보상을 기록합니다' };
  const prev = claim.compensation || {};
  // 비워 보내면 지움, 아예 안 보내면 이전 값 유지
  const amount = input?.amount === undefined ? (prev.amount ?? null) : input.amount === '' || input.amount === null ? null : num(input.amount);
  if (amount != null && amount < 0) return { error: '금액을 확인하세요' };
  const currency = ['KRW', 'USD', 'CNY'].includes(input?.currency) ? input.currency : prev.currency || 'KRW';
  const applied = typeof input?.applied_card_id === 'string' ? input.applied_card_id : prev.applied_card_id || '';
  if (applied && applied === claim.card_id) return { error: '불량이 난 주문이 아닌 다음 주문을 고르세요' };
  return {
    compensation: {
      kind, amount, currency, note: String(input?.note ?? prev.note ?? '').trim().slice(0, 500),
      promised_at: prev.promised_at || now,
      applied_card_id: applied,
      applied_card_title: applied ? String(input?.applied_card_title ?? prev.applied_card_title ?? '').slice(0, 200) : '',
      applied_at: applied ? (applied === prev.applied_card_id ? prev.applied_at || now : now) : '',
      applied_by_name: applied ? (applied === prev.applied_card_id ? prev.applied_by_name || by : by) : '',
      applied_note: applied ? String(input?.applied_note ?? prev.applied_note ?? '').trim().slice(0, 300) : '',
    },
  };
}

/**
 * 상품 한 묶음의 품질 이력 (주문=카드 순). orders: [{ card_id, order_date, qc: {inspection_type, qc_result, decision}|null, claims: [...] }]
 * 불량률 = 신고한 불량 수 ÷ 받은 수 (둘 다 적힌 신고만)
 */
export function qualitySummary(orders = []) {
  let defect = 0, received = 0;
  const all = orders.flatMap((o) => o.claims || []);
  for (const c of all) {
    if (c.status === 'REJECTED') continue;
    if (num(c.defect_qty) > 0 && num(c.received_qty) > 0) { defect += num(c.defect_qty); received += num(c.received_qty); }
  }
  return {
    orders: orders.length,
    inspected: orders.filter((o) => o.qc).length,
    failed: orders.filter((o) => o.qc?.qc_result === 'FAIL').length,
    claims: all.filter((c) => c.status !== 'REJECTED').length,
    open_claims: all.filter((c) => !CLOSED.includes(c.status)).length,
    defect_rate: received > 0 ? Math.round((defect / received) * 10000) / 10000 : null,
    // 고객용으로 줄인 신고는 compensation.state 를 쓴다
    promised: all.filter((c) => (c.compensation?.state || compensationState(c)) === 'PROMISED').length,
  };
}
