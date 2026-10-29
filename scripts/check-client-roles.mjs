// 고객사 역할·결재 규칙 검산: 역할 없는 고객사는 지금처럼, 재무 전용은 결정 불가, 결재 필요 판정(금액 기준·자기 결재), 팀 구성 확인, 알림 받는 사람.
// 실행: npm run check:client-roles
import assert from 'node:assert/strict';
import { can, approvalNeeded, canApprove, validateTeam, normalizeRules, normalizeMembers, notificationAudience, toKrw, effectiveRoles, quoteAmount } from '../base44/shared/clientRoles.ts';
import * as front from '../src/lib/clientRoles.js';

const none = { client_roles: [] };
const team = {
  client_roles: [
    { email: 'Boss@Ex.com', roles: ['ADMIN', 'APPROVER'] },
    { email: 'cfo@ex.com', roles: ['APPROVER', 'FINANCE'] },
    { email: 'kim@ex.com', roles: ['MEMBER'] },
    { email: 'pay@ex.com', roles: ['FINANCE'] },
  ],
  approval_rules: { kinds: { comparison_choice: { on: true, min_amount_krw: 10_000_000 }, qc_decision: { on: true } } },
};

// 역할을 정하지 않은 고객사: 누구나 결정, 결재 없음, 관리 불가(직원이 첫 고객 관리자를 정한다)
assert.equal(can(none, 'a@ex.com', 'decide'), true);
assert.equal(can(none, 'a@ex.com', 'manage'), false);
assert.equal(approvalNeeded({ company: { ...none, approval_rules: team.approval_rules }, kind: 'qc_decision', email: 'a@ex.com', positive: true }), false, '역할이 없으면 규칙이 있어도 결재 없음');

// 역할
assert.deepEqual(effectiveRoles(team, 'boss@ex.com'), ['ADMIN', 'APPROVER'], '메일은 대소문자 구분 없음');
assert.deepEqual(effectiveRoles(team, 'new@ex.com'), ['MEMBER'], '역할 없는 새 계정은 실무자');
assert.equal(can(team, 'pay@ex.com', 'decide'), false, '재무만 가진 계정은 결정할 수 없다');
assert.equal(can(team, 'cfo@ex.com', 'decide'), true, '결재권자를 함께 가지면 결정 가능');
assert.equal(can(team, 'boss@ex.com', 'manage'), true);
assert.equal(can(team, 'kim@ex.com', 'manage'), false);

// 결재 필요 판정
const need = (o) => approvalNeeded({ company: team, positive: true, ...o });
assert.equal(need({ kind: 'qc_decision', email: 'kim@ex.com' }), true, '실무자의 출고 승인은 결재');
assert.equal(need({ kind: 'qc_decision', email: 'kim@ex.com', positive: false }), false, '보류는 결재 없이 전달');
assert.equal(need({ kind: 'spec_decision', email: 'kim@ex.com' }), false, '꺼진 결정은 바로 실행');
assert.equal(need({ kind: 'qc_decision', email: 'boss@ex.com' }), false, '결재권자 본인 결정은 바로 실행');
assert.equal(need({ kind: 'comparison_choice', email: 'kim@ex.com', amountKrw: 5_000_000 }), false, '금액 기준 아래는 바로 실행');
assert.equal(need({ kind: 'comparison_choice', email: 'kim@ex.com', amountKrw: 12_000_000 }), true);
assert.equal(need({ kind: 'comparison_choice', email: 'kim@ex.com', amountKrw: null }), true, '금액을 모르면 기준 이상으로 본다');
const strict = { ...team, approval_rules: { ...team.approval_rules, block_self_approval: true } };
assert.equal(approvalNeeded({ company: strict, kind: 'qc_decision', email: 'boss@ex.com', positive: true }), true, '자기 결재를 막으면 결재권자도 다른 결재권자에게');
assert.equal(canApprove(strict, 'boss@ex.com', { requested_by_email: 'BOSS@ex.com' }), false);
assert.equal(canApprove(strict, 'cfo@ex.com', { requested_by_email: 'boss@ex.com' }), true);
assert.equal(canApprove(team, 'kim@ex.com', { requested_by_email: 'x@ex.com' }), false, '실무자는 결재할 수 없다');
const lonely = { client_roles: [{ email: 'boss@ex.com', roles: ['ADMIN', 'APPROVER'] }, { email: 'kim@ex.com', roles: ['MEMBER'] }], approval_rules: { kinds: { qc_decision: { on: true } }, block_self_approval: true } };
assert.equal(approvalNeeded({ company: lonely, kind: 'qc_decision', email: 'boss@ex.com', positive: true }), false, '다른 결재권자가 없으면 바로 실행');

// 팀 구성 확인
const m = normalizeMembers(team.client_roles);
assert.equal(validateTeam(m, team.approval_rules), null);
assert.match(validateTeam(m.filter((x) => !x.roles.includes('ADMIN')), {}), /고객 관리자/);
assert.match(validateTeam([{ email: 'a@ex.com', roles: ['ADMIN'] }], team.approval_rules), /결재권자/);
assert.match(validateTeam([{ email: 'a@ex.com', roles: ['ADMIN', 'APPROVER'] }], { ...team.approval_rules, block_self_approval: true }), /두 명/);
assert.equal(validateTeam([], {}), null, '역할을 모두 지우면 지금처럼');
assert.deepEqual(normalizeMembers([{ email: 'x@ex.com', roles: ['HACKER'] }, { email: 'y@ex.com', roles: ['finance'] }]), [{ email: 'y@ex.com', roles: ['FINANCE'] }]);
assert.equal(normalizeRules({ kinds: { qc_decision: { on: true, min_amount_krw: 5 } } }).kinds.qc_decision.min_amount_krw, null, '금액이 없는 결정에는 금액 기준 없음');

// 원화 환산
assert.equal(toKrw(1000, 'USD', { usd_krw: 1400 }), 1_400_000);
assert.equal(toKrw(7200, 'CNY', { usd_krw: 1400, usd_cny: 7.2 }), 1_400_000);
assert.equal(toKrw(1000, 'USD', {}), null);
assert.deepEqual(quoteAmount({ rounding_version: 2, final_total: 5000, final_currency: 'KRW' }).amount, 5000);

// 알림 받는 사람
const users = ['boss@ex.com', 'cfo@ex.com', 'kim@ex.com', 'pay@ex.com', 'new@ex.com'].map((email, i) => ({ id: `u${i}`, email }));
const to = (type) => notificationAudience(team, users, type).map((u) => u.email).sort();
assert.deepEqual(to('payment_requested'), ['cfo@ex.com', 'kim@ex.com', 'new@ex.com', 'pay@ex.com'], '결제는 재무·실무자');
assert.deepEqual(to('card_moved'), ['kim@ex.com', 'new@ex.com'], '진행은 실무자');
assert.deepEqual(to('qc_published'), ['boss@ex.com', 'cfo@ex.com', 'kim@ex.com', 'new@ex.com'], '결정 요청은 실무자·결재권자');
assert.deepEqual(to('client_approval_requested'), ['boss@ex.com', 'cfo@ex.com'], '결재 요청은 결재권자');
assert.equal(notificationAudience(none, users, 'card_moved').length, 5, '역할 없는 고객사는 전원');
assert.equal(notificationAudience(team, [users[0]], 'card_moved').length, 1, '좁혀서 아무도 없으면 그대로');

// 화면 사본이 같은 규칙인지
assert.deepEqual(front.CLIENT_ROLES, ['ADMIN', 'APPROVER', 'MEMBER', 'FINANCE']);
assert.deepEqual(Object.keys(front.APPROVAL_KIND_LABEL), ['comparison_choice', 'quote_accept', 'qc_decision', 'spec_decision', 'file_review']);
assert.equal(front.validateTeam(m, team.approval_rules), null);
assert.match(front.validateTeam([{ email: 'a@ex.com', roles: ['ADMIN', 'APPROVER'] }], { ...team.approval_rules, block_self_approval: true }), /두 명/);
console.log('client-roles: 고객사 역할·결재 규칙 검산 통과');
