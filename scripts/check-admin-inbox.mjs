// 관리자 할 일 목록 검산: 입금 확인 대기·불량 신고·전자서명 알림을 어떤 기준으로 고르는지 확인한다.
// 실행: npm run check:admin-inbox
import assert from 'node:assert/strict';
import { paymentQueue, overdueQueue, claimQueue, signatureQueue, inboxCounts, daysUntil, daysSince } from '../src/lib/adminInbox.js';

const NOW = Date.parse('2026-10-28T03:00:00Z'); // 한국 시각 10월 28일 낮 12시

// 날짜 계산 (한국 날짜 기준)
assert.equal(daysUntil('2026-10-28', NOW), 0);
assert.equal(daysUntil('2026-10-31', NOW), 3);
assert.equal(daysUntil('2026-10-27', NOW), -1);
assert.equal(daysUntil('', NOW), null);
assert.equal(daysSince('2026-10-25T03:00:00Z', NOW), 3);
assert.equal(daysSince('2026-10-29T03:00:00Z', NOW), 0, '미래 시각은 0일');

// 입금 확인 대기: 입금일이나 송금확인증이 있는 PENDING 만, 입금일 빠른 순
const stages = [
  { id: 'a', card_id: 'c1', stage_type: 'DOWN_PAYMENT', approval_status: 'PENDING', paid_date: '2026-10-20' },
  { id: 'b', card_id: 'c1', stage_type: 'BALANCE_PAYMENT', approval_status: 'PENDING', paid_date: null },
  { id: 'c', card_id: 'c2', stage_type: 'DOWN_PAYMENT', approval_status: 'PENDING', paid_date: null },
  { id: 'd', card_id: 'c3', stage_type: 'DOWN_PAYMENT', approval_status: 'APPROVED', paid_date: '2026-10-01' },
  { id: 'e', card_id: 'c4', stage_type: 'INTERIM_PAYMENT', approval_status: 'PENDING', paid_date: '2026-10-10' },
];
const receipts = [{ card_id: 'c2', document_type: 'REMITTANCE_DOWN' }, { card_id: 'c1', document_type: 'REMITTANCE_DOWN' }];
const pq = paymentQueue(stages, receipts);
assert.deepEqual(pq.map((p) => p.id), ['e', 'a', 'c'], '입금 전(b)·이미 확인(d)은 빼고, 입금일 순, 입금일 없으면 뒤로');
assert.equal(pq.find((p) => p.id === 'a').has_receipt, true);
assert.equal(pq.find((p) => p.id === 'c').has_receipt, true, '입금일 없이 송금확인증만 있어도 대기');
assert.equal(pq.find((p) => p.id === 'e').has_receipt, false, '중도금 송금확인증이 따로 없으면 없음');
assert.equal(paymentQueue([{ id: 'i', card_id: 'c5', stage_type: 'INTERIM_PAYMENT', approval_status: 'PENDING' }], [{ card_id: 'c5', document_type: 'REMITTANCE_INTERIM' }])[0]?.has_receipt, true, '중도금 송금확인증');

// 고객이 '송금했어요'를 누른 단계도 입금 확인 대기 (입금일이 없으면 고객이 적은 송금일로 정렬)
const withReport = paymentQueue([...stages, { id: 'r', card_id: 'c6', stage_type: 'BALANCE_PAYMENT', approval_status: 'PENDING', requested_at: '2026-10-20T00:00:00Z', client_reported_paid_at: '2026-10-27T05:00:00Z', client_reported_paid_date: '2026-10-15' }], receipts);
assert.deepEqual(withReport.map((p) => p.id), ['e', 'r', 'a', 'c']);
assert.equal(withReport.find((p) => p.id === 'r').reported, true);

// 결제 기한 지남: 요청했고, 고객 송금 알림이 없고, 기한이 지난 것만. 오래 지난 순
const oq = overdueQueue([
  { id: 'o1', approval_status: 'PENDING', requested_at: 'x', due_date: '2026-10-27' },
  { id: 'o2', approval_status: 'PENDING', requested_at: 'x', due_date: '2026-10-20' },
  { id: 'o3', approval_status: 'PENDING', requested_at: 'x', due_date: '2026-10-28' },
  { id: 'o4', approval_status: 'PENDING', requested_at: 'x', due_date: '2026-10-01', client_reported_paid_at: 'y' },
  { id: 'o5', approval_status: 'APPROVED', requested_at: 'x', due_date: '2026-10-01' },
  { id: 'o6', approval_status: 'PENDING', due_date: '2026-10-01' },
], NOW);
assert.deepEqual(oq.map((o) => `${o.id}:${o.left}`), ['o2:-8', 'o1:-1'], '오늘 기한·송금 알림·입금 확인·요청 전은 뺀다');

// 불량 신고: 닫힌 건 제외, 2일 넘게 접수 상태인 건이 위로
const cq = claimQueue([
  { id: 'x', status: 'RESOLVED', submitted_at: '2026-10-01T00:00:00Z' },
  { id: 'y', status: 'REVIEWING', submitted_at: '2026-10-10T00:00:00Z' },
  { id: 'z', status: 'SUBMITTED', submitted_at: '2026-10-24T00:00:00Z' },
  { id: 'w', status: 'SUBMITTED', submitted_at: '2026-10-27T00:00:00Z' },
  { id: 'v', status: 'REJECTED', submitted_at: '2026-10-27T00:00:00Z' },
], NOW);
assert.deepEqual(cq.map((c) => c.id), ['z', 'y', 'w']);
assert.equal(cq[0].stale, true);
assert.equal(cq.find((c) => c.id === 'w').stale, false, '1일 된 접수는 아직 늦지 않음');
assert.equal(cq.find((c) => c.id === 'y').stale, false, '확인 중이면 늦음 표시 안 함');

// 전자서명: 수정 요청 → 기한 지남 → 기한 3일 이내(가까운 순)
const sq = signatureQueue({
  waiting: [
    { contract_id: 'k1', due_date: '2026-11-05' },
    { contract_id: 'k2', due_date: '2026-10-30' },
    { contract_id: 'k3', due_date: '2026-10-28' },
  ],
  declined: [{ contract_id: 'k4', decline_reason: '납기 조항 수정' }],
  expired: [{ contract_id: 'k5' }],
}, NOW);
assert.deepEqual(sq.map((r) => `${r.kind}:${r.contract_id}`), ['DECLINED:k4', 'EXPIRED:k5', 'DUE_SOON:k3', 'DUE_SOON:k2']);
assert.equal(sq.find((r) => r.contract_id === 'k3').left, 0);
assert.deepEqual(signatureQueue(undefined, NOW), [], '현황을 못 불러와도 빈 목록');

// 개수
assert.deepEqual(inboxCounts({ accounts: [1], payments: pq, overdue: oq, comparisons: [], signatures: sq, costs: { cards: [1, 2], shipments: [3] }, claims: cq }),
  { accounts: 1, payments: 3, overdue: 2, comparisons: 0, signatures: 4, costs: 3, claims: 3 });
assert.deepEqual(inboxCounts({}), { accounts: 0, payments: 0, overdue: 0, comparisons: 0, signatures: 0, costs: 0, claims: 0 });

console.log('admin-inbox: 모든 검산 통과');
