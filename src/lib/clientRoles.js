// 고객사 역할·결재 규칙 화면용 사본. 서버 base44/shared/clientRoles.ts 와 같은 규칙 (검산: npm run check:client-roles).
// 판정은 서버가 다시 하므로, 여기서는 화면에 보여 줄 이름과 저장 전 안내에만 쓴다.
export const CLIENT_ROLES = ['ADMIN', 'APPROVER', 'MEMBER', 'FINANCE'];
export const ROLE_LABEL = { ADMIN: '고객 관리자', APPROVER: '결재권자', MEMBER: '실무자', FINANCE: '재무' };
export const ROLE_DESC = {
  ADMIN: '동료 초대·역할·결재 규칙',
  APPROVER: '최종 승인과 결재, 계약서 서명',
  MEMBER: '검토·선택·승인 요청',
  FINANCE: '결제·서류 (결정은 못 함)',
};

export const APPROVAL_KIND_LABEL = {
  comparison_choice: '비교표 선택', quote_accept: '견적 수락', qc_decision: '출고 승인', spec_decision: '기준서 승인', file_review: '디자인 승인',
};
export const AMOUNT_KINDS = ['comparison_choice', 'quote_accept'];
export const APPROVAL_STATUS_LABEL = { PENDING: '결재 중', APPROVED: '승인', REJECTED: '반려', CANCELED: '거둠', STALE: '무효' };

const anyOn = (rules) => Object.keys(APPROVAL_KIND_LABEL).some((k) => rules?.kinds?.[k]?.on === true);

// 저장 전에 팀 구성이 규칙을 지킬 수 있는지 (서버 validateTeam 과 같은 문장)
export function validateTeam(members, rules) {
  const list = (members || []).filter((m) => (m.roles || []).length);
  if (!list.length) return anyOn(rules) ? '결재 규칙을 켜려면 결재권자를 먼저 정하세요' : null;
  if (!list.some((m) => m.roles.includes('ADMIN'))) return '고객 관리자가 한 명 이상 있어야 합니다';
  const approvers = list.filter((m) => m.roles.includes('APPROVER')).length;
  if (anyOn(rules) && approvers === 0) return '결재 규칙을 켜려면 결재권자가 한 명 이상 있어야 합니다';
  if (anyOn(rules) && rules?.block_self_approval === true && approvers < 2) return '자기 요청 결재를 막으려면 결재권자가 두 명 이상 있어야 합니다';
  return null;
}
