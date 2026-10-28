// 주문 현황판 요약 검산: 지금 단계·차례·일정 변경·도착 예정·입금 비율·결제 요청과 정렬, 입고 달력 일정을 확인한다.
// 실행: npm run check:client-summary
import assert from 'node:assert/strict';
import { clientCardSummary, todosByCard, paymentRequestState, orderRows, summaryRank, calendarEvents } from '../base44/shared/clientSummary.ts';

const today = '2026-10-28';
const ms = (seq, key, label, status, planned, extra = {}) => ({ id: `${key}`, card_id: 'c1', seq, key, label, status, planned_date: planned, client_visible: true, ...extra });
const plan = [
  ms(0, 'spec', '사양 확정', 'done', '2026-10-01', { actual_date: '2026-10-01', baseline_date: '2026-10-01' }),
  ms(1, 'factory', '공장 확정', 'done', '2026-10-05', { client_visible: false }),
  ms(2, 'sample1', '1차 샘플', 'in_progress', '2026-11-05', { baseline_date: '2026-11-05' }),
  ms(3, 'sample_ok', '샘플 승인', 'pending', '2026-11-12'),
  ms(4, 'skip', '건너뛴 단계', 'skipped', '2026-11-13'),
  ms(5, 'delivery', '납품', 'pending', '2026-12-10', { baseline_date: '2026-12-10' }),
];
const card = { id: 'c1', status: 'PRODUCTION', plan_confirmed_at: '2026-10-01T00:00:00Z' };

// 지금 단계·다음 일정: 공개·건너뛰지 않은 단계만. 공장 샘플 단계면 공장 차례
let s = clientCardSummary({ card, milestones: plan, today });
assert.equal(s.stage_label, '1차 샘플');
assert.equal(s.stage_due, '2026-11-05');
assert.equal(s.next_label, '샘플 승인');
assert.equal(s.next_date, '2026-11-12');
assert.equal(s.turn, 'FACTORY');
assert.equal(s.schedule, 'ON_TRACK');
assert.equal(s.paid_percent, null, '결제 단계가 없으면 비율 없음');
assert.equal(s.arrival, null);

// 계획 확정 전에는 단계를 쓰지 않는다 (카드 상태 이름으로)
s = clientCardSummary({ card: { ...card, plan_confirmed_at: '' }, milestones: plan, today });
assert.equal(s.stage_label, '발주 · 제작');
assert.equal(s.turn, 'AEGIS');

// 고객이 할 일이 있으면 무조건 고객님 차례, 첫 할 일을 이유로
s = clientCardSummary({ card, milestones: plan, todos: [{ label: '샘플 승인', tab: 'qc' }, { label: '선금 결제', tab: 'settlement' }], today });
assert.equal(s.turn, 'CLIENT');
assert.equal(s.turn_reason, '샘플 승인');
assert.equal(s.open_tab, 'qc', '첫 할 일의 탭을 연다');
assert.equal(s.todo_count, 2);

// 견적 검토 단계: 공개 견적이 있으면 고객님(견적 검토), 없으면 이지스
assert.equal(clientCardSummary({ card: { id: 'c2', status: 'REVIEW' }, hasQuote: true, today }).turn_reason, '견적 검토');
assert.equal(clientCardSummary({ card: { id: 'c2', status: 'REVIEW' }, hasQuote: true, today }).open_tab, 'quotation');
assert.equal(clientCardSummary({ card: { id: 'c2', status: 'REVIEW' }, hasQuote: false, today }).turn, 'AEGIS');
assert.equal(clientCardSummary({ card: { id: 'c2', status: 'DONE' }, todos: [{ label: '출고 승인', tab: 'qc' }], today }).turn, 'DONE', '끝난 프로젝트는 차례 없음');

// 일정 변경: 계획일이 지난 단계가 남았거나 납품 예정일이 기준일보다 늦어졌을 때. 공개 사유만, 지연 일수는 내보내지 않는다
const late = plan.map((m) => (m.key === 'sample1' ? { ...m, planned_date: '2026-10-20', delay_reason: '금형 수정', delay_reason_public: true } : m));
s = clientCardSummary({ card, milestones: late, today });
assert.equal(s.schedule, 'CHANGED');
assert.equal(s.schedule_reason, '금형 수정');
assert.equal('delay_days' in s, false, '지연 일수는 요약에 없다');
const hiddenReason = late.map((m) => (m.key === 'sample1' ? { ...m, delay_reason_public: false } : m));
assert.equal(clientCardSummary({ card, milestones: hiddenReason, today }).schedule_reason, '', '비공개 사유는 보내지 않는다');
const moved = plan.map((m) => (m.key === 'delivery' ? { ...m, planned_date: '2026-12-20' } : m));
assert.equal(clientCardSummary({ card, milestones: moved, today }).schedule, 'CHANGED', '납품 예정일이 기준일보다 늦어짐');
const earlier = plan.map((m) => (m.key === 'delivery' ? { ...m, planned_date: '2026-12-01' } : m));
assert.equal(clientCardSummary({ card, milestones: earlier, today }).schedule, 'ON_TRACK', '앞당겨진 것은 변경 아님');

// 선적: 보류면 보류, 도착 예정은 아직 도착 전 중 가장 이른 것
const ships = [
  { id: 's1', label: '2차 선적', status: 'BOOKED', eta: '2026-11-20' },
  { id: 's2', label: '1차 선적', status: 'DEPARTED', eta: '2026-11-03' },
  { id: 's3', label: '샘플', status: 'DELIVERED', eta: '2026-10-10', ata: '2026-10-12' },
];
s = clientCardSummary({ card, milestones: plan, shipments: ships, today });
assert.deepEqual(s.arrival, { label: '1차 선적', date: '2026-11-03', state: 'ETA', days_left: 6 });
s = clientCardSummary({ card, milestones: plan, shipments: [ships[2]], today });
assert.equal(s.arrival.state, 'ARRIVED');
assert.equal(s.arrival.date, '2026-10-12', '도착했으면 실제 도착일');
assert.equal(clientCardSummary({ card, milestones: plan, shipments: [{ ...ships[0], status: 'ON_HOLD' }], today }).schedule, 'HOLD');

// 결제: 입금 확인 비율 + 끝나지 않은 결제 요청 중 기한이 가장 이른 것
const stages = [
  { id: 'p1', stage_type: 'DOWN_PAYMENT', percentage: 30, approval_status: 'APPROVED', requested_at: '2026-10-01T00:00:00Z' },
  { id: 'p2', stage_type: 'INTERIM_PAYMENT', percentage: 30, approval_status: 'PENDING', requested_at: '2026-10-20T00:00:00Z', due_date: '2026-11-15', client_reported_paid_at: '2026-10-27T00:00:00Z', amount: 9000, currency: 'USD' },
  { id: 'p3', stage_type: 'BALANCE_PAYMENT', percentage: 40, approval_status: 'PENDING', requested_at: '2026-10-25T00:00:00Z', due_date: '2026-10-31', amount: 12000, currency: 'USD' },
];
s = clientCardSummary({ card, milestones: plan, stages, today });
assert.equal(s.paid_percent, 30);
assert.deepEqual(s.payment, { stage_type: 'BALANCE_PAYMENT', label: '잔금', state: 'REQUESTED', due_date: '2026-10-31', days_left: 3, amount: 12000, currency: 'USD' });
assert.equal(s.open_tab, 'settlement', '결제 요청이 걸려 있으면 결제 탭');
assert.equal(paymentRequestState(stages[0]), 'PAID');
assert.equal(paymentRequestState(stages[1]), 'REPORTED');
assert.equal(paymentRequestState(stages[2]), 'REQUESTED');
assert.equal(paymentRequestState({ approval_status: 'PENDING' }), 'NONE', '요청 전');

// 카드별 할 일: 보류한 검수는 고객 차례가 아니다
const map = todosByCard({
  signature_pending: [{ card_id: 'c1' }, { card_id: '' }],
  payment_pending: [{ card_id: 'c1', stage_type: 'DOWN_PAYMENT' }],
  qc_pending: [{ card_id: 'c2', inspection_type: 'SAMPLE', decision: 'PENDING' }, { card_id: 'c3', inspection_type: 'FINAL', decision: 'ON_HOLD' }],
  comparison_pending: [{ card_id: 'c4' }],
});
assert.deepEqual(map.get('c1'), [{ label: '계약서 서명', tab: 'overview' }, { label: '선금 결제', tab: 'settlement' }]);
assert.deepEqual(map.get('c2'), [{ label: '샘플 승인', tab: 'qc' }]);
assert.equal(map.has('c3'), false);
assert.deepEqual(map.get('c4'), [{ label: '견적안 선택', tab: 'quotation' }]);
assert.equal(map.has(''), false, '카드 없는 서명 요청은 카드에 붙지 않는다');

// 정렬: 고객님 차례 → 일정 변경 → 2주 안 도착(도착일 순) → 나머지(받은 순)
const row = (id, summary) => ({ card: { id }, summary });
const base = { turn: 'AEGIS', schedule: 'ON_TRACK', arrival: null };
const rows = [
  row('a', base),
  row('b', { ...base, arrival: { state: 'ETA', date: '2026-11-08', days_left: 11 } }),
  row('c', { ...base, schedule: 'CHANGED' }),
  row('d', { ...base, arrival: { state: 'ETA', date: '2026-11-01', days_left: 4 } }),
  row('e', { ...base, turn: 'CLIENT' }),
  row('f', { ...base, arrival: { state: 'ETA', date: '2026-12-30', days_left: 63 } }),
];
assert.deepEqual(orderRows(rows).map((r) => r.card.id), ['e', 'c', 'd', 'b', 'a', 'f']);
assert.equal(summaryRank({ ...base, schedule: 'HOLD' }), 1);

// 입고 달력: 공개 단계(계획 확정 카드만)·공개 선적, 기간 안만
const ev = calendarEvents({
  cards: [{ id: 'c1', title: '드립백', plan_confirmed_at: 'x' }, { id: 'c9', title: '초안', plan_confirmed_at: '' }],
  milestones: [...plan, { id: 'draft', card_id: 'c9', seq: 0, label: '초안 단계', status: 'pending', planned_date: '2026-11-01', client_visible: true }],
  shipments: [{ ...ships[1], card_id: 'c1', client_visible: true }, { ...ships[2], card_id: 'c1', client_visible: true }, { id: 'hid', card_id: 'c1', status: 'BOOKED', eta: '2026-11-04', client_visible: false }],
  from: '2026-10-01', to: '2026-11-30',
});
assert.deepEqual(ev.map((e) => `${e.date} ${e.kind} ${e.label}`), [
  '2026-10-01 STEP 사양 확정',
  '2026-10-12 ARRIVED 샘플 도착',
  '2026-11-03 ETA 1차 선적 도착 예정',
  '2026-11-05 STEP 1차 샘플',
  '2026-11-12 STEP 샘플 승인',
]);
assert.equal(ev.find((e) => e.kind === 'ARRIVED').done, true);

console.log('client-summary: 주문 현황판 요약 검산 통과');
