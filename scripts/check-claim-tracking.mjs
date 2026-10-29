// 클레임 추적 검산: 영업일 세기, 공장 회신 대기·기한 초과, 보상 약속·반영, 상품 품질 이력, 화면 사본 일치.
// 실행: npm run check:claim-tracking
import assert from 'node:assert/strict';
import * as S from '../base44/shared/claimTracking.ts';
import * as F from '../src/lib/claimTracking.js';

// 2026-10-29(목) 10:00 KST 기준. 10/26(월) 보냄 → 화·수·목 3영업일, 10/23(금) 보냄 → 월~목 4영업일
const now = Date.parse('2026-10-29T01:00:00Z');
assert.equal(S.businessDaysSince('2026-10-26T02:00:00Z', now), 3);
assert.equal(S.businessDaysSince('2026-10-23T02:00:00Z', now), 4, '토·일은 세지 않는다');
assert.equal(S.businessDaysSince('2026-10-28T16:00:00Z', now), 0, '한국 날짜로 같은 날');
assert.deepEqual(S.factoryWait({ status: 'REVIEWING', factory_requested_at: '2026-10-26T02:00:00Z' }, now), { days: 3, business: 3, overdue: false });
assert.equal(S.factoryWait({ status: 'REVIEWING', factory_requested_at: '2026-10-23T02:00:00Z' }, now).overdue, true);
assert.equal(S.factoryWait({ status: 'REVIEWING', factory_requested_at: '2026-10-23T02:00:00Z', factory_responded_at: '2026-10-27T00:00:00Z' }, now), null, '회신이 오면 끝');
assert.equal(S.factoryWait({ status: 'RESOLVED', factory_requested_at: '2026-10-01T00:00:00Z' }, now), null);
assert.equal(S.factoryWait({ status: 'SUBMITTED' }, now), null, '아직 안 보낸 신고');

// 보상
assert.equal(S.compensationState({ resolution: 'DISCOUNT', status: 'RESOLVED' }), 'PROMISED');
assert.equal(S.compensationState({ resolution: 'REPLACE', compensation: { applied_card_id: 'c9' } }), 'APPLIED');
assert.equal(S.compensationState({ resolution: 'REFUND' }), null, '환불은 다음 주문 반영 대상이 아니다');
assert.equal(S.compensationState({ resolution: 'DISCOUNT', status: 'REJECTED' }), null);
const at = '2026-10-29T01:00:00Z';
assert.match(S.compensationPatch({ amount: 10 }, { claim: { resolution: 'REFUND' }, by: 'a', now: at }).error, /재생산/);
const p1 = S.compensationPatch({ amount: '150000', currency: 'KRW', note: '다음 발주 5% 할인' }, { claim: { id: 'q1', card_id: 'c1', resolution: 'DISCOUNT' }, by: '이호민', now: at }).compensation;
assert.deepEqual([p1.kind, p1.amount, p1.applied_card_id, p1.promised_at], ['DISCOUNT', 150000, '', at]);
assert.match(S.compensationPatch({ applied_card_id: 'c1' }, { claim: { card_id: 'c1', resolution: 'DISCOUNT' }, by: 'a', now: at }).error, /다음 주문/);
const later = '2026-11-20T01:00:00Z';
const p2 = S.compensationPatch({ applied_card_id: 'c2', applied_card_title: '[재주문] 선풍기' }, { claim: { card_id: 'c1', resolution: 'DISCOUNT', compensation: p1 }, by: '김직원', now: later }).compensation;
assert.deepEqual([p2.amount, p2.promised_at, p2.applied_card_id, p2.applied_at, p2.applied_by_name], [150000, at, 'c2', later, '김직원'], '약속 시각·금액은 그대로, 반영 정보만 더한다');

// 품질 이력
const q = S.qualitySummary([
  { card_id: 'c1', qc: { qc_result: 'PASS' }, claims: [{ status: 'RESOLVED', resolution: 'DISCOUNT', defect_qty: 120, received_qty: 2000 }] },
  { card_id: 'c2', qc: { qc_result: 'FAIL' }, claims: [{ status: 'REVIEWING', defect_qty: 30, received_qty: 3000 }, { status: 'REJECTED', defect_qty: 500, received_qty: 500 }] },
  { card_id: 'c3', qc: null, claims: [] },
]);
assert.deepEqual(q, { orders: 3, inspected: 2, failed: 1, claims: 2, open_claims: 1, defect_rate: 0.03, promised: 1 });
assert.equal(S.qualitySummary([]).defect_rate, null);

// 화면 사본
assert.deepEqual(F.factoryWait({ status: 'REVIEWING', factory_requested_at: '2026-10-23T02:00:00Z' }, now), S.factoryWait({ status: 'REVIEWING', factory_requested_at: '2026-10-23T02:00:00Z' }, now));
assert.deepEqual(F.compensationPatch({ amount: 1 }, { claim: { card_id: 'c1', resolution: 'REPLACE' }, by: 'a', now: at }), S.compensationPatch({ amount: 1 }, { claim: { card_id: 'c1', resolution: 'REPLACE' }, by: 'a', now: at }));
console.log('claim-tracking: 클레임 추적 검산 통과');
