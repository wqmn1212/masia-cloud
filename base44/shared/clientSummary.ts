// 고객 대시보드 '주문 현황판'의 프로젝트 한 줄 요약 · 정렬 · 입고 달력 일정.
// 고객에게 공개된 단계·선적·결제만 쓴다. 지연 일수와 내부 '다음 할 일'은 넣지 않고, 지연은 '일정 변경'과 공개 사유로만 알린다.
// 화면 src/components/client/ClientOrderBoard.jsx 가 이 값을 그대로 그린다. 검산: npm run check:client-summary
import { STAGE_LABEL, paymentRequestState } from './paymentRequest.ts';

export { paymentRequestState };
const STATUS_LABEL: Record<string, string> = { TODO: '대기 중', IN_PROGRESS: '소싱 중', REVIEW: '견적 검토', PRODUCTION: '발주 · 제작', DONE: '완료', CANCELLED: '취소' };
// 공장이 손을 움직이는 단계 (샘플·양산·제작·출고). 그 밖의 단계는 이지스 차례로 본다
export const FACTORY_STEPS = ['sample1', 'mass', 'build', 'ship_out'];
export const ARRIVED_STATUSES = ['ARRIVED', 'CUSTOMS', 'CLEARED', 'DELIVERED'];

const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);

// 고객이 할 일 목록(listClientTodos 의 항목들) → 카드별 할 일 { label, tab } (tab = 눌렀을 때 열 카드 탭).
// 보류한 검수는 이미 고객이 판단했으므로 뺀다
export function todosByCard(t: any) {
  const map = new Map<string, any[]>();
  const add = (cardId: string, label: string, tab: string) => { if (cardId) map.set(cardId, [...(map.get(cardId) || []), { label, tab }]); };
  (t.signature_pending || []).forEach((r: any) => add(r.card_id, '계약서 서명', 'overview'));
  (t.payment_pending || []).forEach((p: any) => add(p.card_id, `${STAGE_LABEL[p.stage_type] || '대금'} 결제`, 'settlement'));
  (t.comparison_pending || []).forEach((c: any) => add(c.card_id, '견적안 선택', 'quotation'));
  (t.spec_pending || []).forEach((s: any) => add(s.card_id, '기준서 확인', 'qc'));
  (t.dest_cost_pending || []).forEach((d: any) => add(d.card_id, '도착지 비용 확인', 'overview'));
  (t.qc_pending || []).filter((q: any) => q.decision !== 'ON_HOLD').forEach((q: any) => add(q.card_id, q.inspection_type === 'SAMPLE' ? '샘플 승인' : '출고 승인', 'qc'));
  return map;
}

const publicReason = (m: any) => (m?.delay_reason_public && m.delay_reason ? String(m.delay_reason) : '');

/**
 * @param card  TaskCard (status, plan_confirmed_at)
 * @param milestones  이 카드의 CardMilestone (계획 확정 전이면 쓰지 않는다)
 * @param shipments  고객 공개 선적
 * @param stages  결제 단계
 * @param todos  이 카드에서 고객이 할 일 [{ label, tab }] (todosByCard)
 * @param hasQuote  고객에게 공개된 견적서가 있는지
 * @param today  한국 날짜 YYYY-MM-DD
 */
export function clientCardSummary({ card, milestones = [], shipments = [], stages = [], todos = [], hasQuote = false, today }: any) {
  const closed = ['DONE', 'CANCELLED'].includes(card.status);
  const steps = card.plan_confirmed_at
    ? milestones.filter((m: any) => m.client_visible !== false && m.status !== 'skipped').sort((a: any, b: any) => (Number(a.seq) || 0) - (Number(b.seq) || 0))
    : [];
  const open = steps.filter((m: any) => m.status !== 'done');
  const current = open[0] || null;
  const next = open[1] || null;

  // 일정: 납품 단계가 처음 계획(기준일)보다 늦어졌거나, 계획일이 지난 단계가 남아 있으면 '일정 변경'. 선적 보류는 '보류'
  const delivery = steps.find((m: any) => m.key === 'delivery') || steps[steps.length - 1] || null;
  const deliveryDate = delivery ? (delivery.status === 'done' ? delivery.actual_date : delivery.planned_date) || '' : '';
  const moved = !!delivery?.baseline_date && deliveryDate > delivery.baseline_date;
  const late = open.filter((m: any) => m.planned_date && m.planned_date < today);
  const schedule = closed ? 'ON_TRACK' : shipments.some((s: any) => s.status === 'ON_HOLD') ? 'HOLD' : moved || late.length ? 'CHANGED' : 'ON_TRACK';
  const scheduleReason = schedule === 'CHANGED' ? publicReason(late[0]) || [...steps].reverse().map(publicReason).find(Boolean) || '' : '';

  // 도착: 아직 도착 전인 선적 중 가장 이른 도착 예정. 모두 도착했으면 가장 최근 도착
  const coming = shipments.filter((s: any) => s.eta && !ARRIVED_STATUSES.includes(s.status)).sort((a: any, b: any) => a.eta.localeCompare(b.eta));
  const arrived = shipments.filter((s: any) => ARRIVED_STATUSES.includes(s.status) && (s.ata || s.eta)).sort((a: any, b: any) => (b.ata || b.eta).localeCompare(a.ata || a.eta));
  const arrival = coming[0]
    ? { label: coming[0].label || '선적', date: coming[0].eta, state: 'ETA', days_left: days(today, coming[0].eta) }
    : arrived[0] ? { label: arrived[0].label || '선적', date: arrived[0].ata || arrived[0].eta, state: 'ARRIVED', days_left: null } : null;

  // 결제: 입금 확인된 비율 + 아직 끝나지 않은 결제 요청 중 기한이 가장 이른 것
  const paidPercent = stages.length ? stages.filter((s: any) => s.approval_status === 'APPROVED').reduce((n: number, s: any) => n + (Number(s.percentage) || 0), 0) : null;
  const request = stages
    .filter((s: any) => ['REQUESTED', 'REPORTED'].includes(paymentRequestState(s)))
    .sort((a: any, b: any) => (a.due_date || '9999-12-31').localeCompare(b.due_date || '9999-12-31'))[0];
  const payment = request ? {
    stage_type: request.stage_type, label: STAGE_LABEL[request.stage_type] || '대금', state: paymentRequestState(request),
    due_date: request.due_date || '', days_left: request.due_date ? days(today, request.due_date) : null,
    amount: request.amount ?? null, currency: request.currency || '',
  } : null;

  // 차례: 고객이 할 일이 있으면 고객님 → 계획이 없으면 견적 검토 단계만 고객님 → 공장 단계면 공장 → 그 외 이지스
  const turn = closed ? 'DONE'
    : todos.length ? 'CLIENT'
      : !steps.length ? (card.status === 'REVIEW' && hasQuote ? 'CLIENT' : 'AEGIS')
        : current && FACTORY_STEPS.includes(current.key) ? 'FACTORY' : 'AEGIS';

  return {
    stage_label: current ? current.label : STATUS_LABEL[card.status] || card.status || '',
    stage_due: current?.planned_date || '',
    next_label: next?.label || '',
    next_date: next?.planned_date || '',
    turn,
    turn_reason: turn === 'CLIENT' ? todos[0]?.label || '견적 검토' : '',
    // 눌렀을 때 열 탭: 고객 할 일의 탭, 견적 검토는 견적서, 결제 요청이 걸려 있으면 결제, 그 외 진행 정보
    open_tab: turn === 'CLIENT' ? todos[0]?.tab || 'quotation' : payment ? 'settlement' : 'overview',
    todo_count: todos.length,
    schedule,
    schedule_reason: scheduleReason,
    arrival,
    paid_percent: paidPercent,
    payment,
  };
}

// 정렬 순위: 고객님 차례 → 일정 변경·보류 → 2주 안 도착 → 나머지
export function summaryRank(s: any) {
  if (s.turn === 'CLIENT') return 0;
  if (s.schedule !== 'ON_TRACK') return 1;
  if (s.arrival?.state === 'ETA' && s.arrival.days_left != null && s.arrival.days_left <= 14) return 2;
  return 3;
}

// rows: [{ card, summary }] (최근 수정 순으로 받는다). 같은 순위 안에서 도착 임박은 도착일 순, 나머지는 받은 순서
export function orderRows(rows: any[]) {
  return rows
    .map((r, i) => ({ r, i, rank: summaryRank(r.summary) }))
    .sort((a, b) => a.rank - b.rank || (a.rank === 2 ? a.r.summary.arrival.date.localeCompare(b.r.summary.arrival.date) : 0) || a.i - b.i)
    .map((x) => x.r);
}

// 입고 달력: 공개된 단계 예정·완료일, 공개 선적의 도착 예정·실제 도착일 (from~to, 한국 날짜)
export function calendarEvents({ cards = [], milestones = [], shipments = [], from, to }: any) {
  const titles = new Map(cards.map((c: any) => [c.id, c.title]));
  const confirmed = new Set(cards.filter((c: any) => c.plan_confirmed_at).map((c: any) => c.id));
  const events: any[] = [];
  for (const m of milestones) {
    if (!confirmed.has(m.card_id) || m.client_visible === false || m.status === 'skipped') continue;
    const done = m.status === 'done';
    const date = done ? m.actual_date || m.planned_date : m.planned_date;
    if (!date || date < from || date > to) continue;
    events.push({ id: `m-${m.id}`, card_id: m.card_id, card_title: titles.get(m.card_id), kind: 'STEP', label: m.label, date, done });
  }
  for (const s of shipments) {
    if (!titles.has(s.card_id) || s.client_visible !== true) continue;
    const arrived = ARRIVED_STATUSES.includes(s.status);
    const date = arrived ? s.ata || s.eta : s.eta;
    if (!date || date < from || date > to) continue;
    events.push({ id: `s-${s.id}`, card_id: s.card_id, card_title: titles.get(s.card_id), kind: arrived ? 'ARRIVED' : 'ETA', label: `${s.label || '선적'} ${arrived ? '도착' : '도착 예정'}`, date, done: arrived });
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
}
