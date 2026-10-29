// 주간 요약 메일 검산: 받을 계정(메일 설정), 할 일·이번 주 일정·지난주 바뀐 것 묶기, 보낼 내용이 없으면 안 보냄.
// 실행: npm run check:weekly-digest
import assert from 'node:assert/strict';
import { weeklyDigest, wantsWeekly, digestTodos } from '../base44/shared/weeklyDigest.ts';

assert.equal(wantsWeekly({ account_tier: 'client', email: 'a@x.com' }), true, '기본은 받음');
assert.equal(wantsWeekly({ account_tier: 'client', email: 'a@x.com', notification_prefs: { weekly: { email: false } } }), false);
assert.equal(wantsWeekly({ account_tier: 'client', email: 'a@x.com', is_active: false }), false);
assert.equal(wantsWeekly({ account_tier: 'service', email: 'a@x.com' }), false, '직원은 받지 않는다');

const overview = {
  approvals: [{ can_approve: true, card_title: '선풍기', target_label: '출고 승인' }, { can_approve: false, card_title: '남의 요청', target_label: 'x' }],
  payment_pending: [{ stage_type: 'BALANCE_PAYMENT', card_title: '선풍기', due_date: '2026-11-04' }],
  qc_pending: [{ inspection_type: 'MASS', card_title: '선풍기', decision: 'PENDING' }, { inspection_type: 'MASS', card_title: '보류건', decision: 'ON_HOLD' }],
  file_review_pending: [{ card_title: '드립백', file_name: '박스.pdf', due_date: '2026-11-03' }],
  upcoming: [{ planned_date: '2026-11-03', label: '출고 전 검수', card_title: '선풍기' }, { planned_date: '2026-11-20', label: '선적', card_title: '선풍기' }],
};
const todos = digestTodos(overview);
assert.equal(todos.length, 4, '내가 결재할 것·결제·출고 승인·디자인 확인 (보류 중·남의 결재 제외)');
assert.match(todos[1], /잔금 결제 · 선풍기 · 기한 11\/4/);
const d = weeklyDigest({ name: '김담당', overview, changes: { arrivals: [{ date: '2026-10-28', label: '1차 선적', card_title: '선풍기' }], payments: [{ date: '2026-10-27', stage_type: 'DOWN_PAYMENT', card_title: '드립백' }] }, today: '2026-11-02', weekEnd: '2026-11-08' });
assert.deepEqual(d.counts, { todos: 4, week: 1, done: 2 }, '이번 주 일정은 일요일까지만');
assert.match(d.subject, /확인하실 일 4건 · 이번 주 일정 1건/);
assert.match(d.text, /■ 지난주 바뀐 것 \(2\)\n- 10\/28 1차 선적 도착 · 선풍기\n- 10\/27 선금 입금 확인 · 드립백/);
assert.match(d.text, /메일 설정/);
assert.equal(weeklyDigest({ name: 'a', overview: {}, changes: {}, today: '2026-11-02', weekEnd: '2026-11-08' }), null, '보낼 내용이 없으면 보내지 않는다');
const many = weeklyDigest({ name: 'a', overview: { comparison_pending: Array.from({ length: 15 }, (_, i) => ({ card_title: `카드${i}` })) }, today: '2026-11-02', weekEnd: '2026-11-08' });
assert.match(many.text, /외 3건은 포털에서/);
console.log('weekly-digest: 주간 요약 메일 검산 통과');
