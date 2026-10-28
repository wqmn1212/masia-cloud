import React, { createContext, useContext } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { toast } from '@/components/ui/use-toast';

// 카드 안의 결정(출고 승인·기준서 승인·비교표 선택·견적 수락·디자인 승인)이 사내 결재를 거치는지 알려 준다.
// getClientCardDetail 의 approvals(이 카드의 결재 중 요청)와 team(내 권한·켜진 규칙)을 ClientCardModal 이 넣는다.
const Ctx = createContext({ cardId: null, approvals: [], team: null });

export function ClientDecisionProvider({ cardId, approvals = [], team = null, children }) {
  return <Ctx.Provider value={{ cardId, approvals, team }}>{children}</Ctx.Provider>;
}

/**
 * kind: comparison_choice | quote_accept | qc_decision | spec_decision | file_review
 * targetId: 결정 대상 id (비교표는 카드에 하나라 생략 가능)
 * → pending: 이 대상의 결재 중 요청 · canDecide: 지금 결정 버튼을 눌러도 되는지
 *   financeOnly: 재무 역할만 있어 결정할 수 없음 · viaApproval: 내 결정이 결재 요청이 될 수 있음
 */
export function useDecisionGate(kind, targetId) {
  const { cardId, approvals, team } = useContext(Ctx);
  const { user } = useAuth();
  const isClient = user?.account_tier === 'client';
  const pending = approvals.find((a) => a.kind === kind && (!targetId || a.target_id === targetId)) || null;
  const financeOnly = isClient && team?.can_decide === false;
  return {
    cardId,
    pending,
    financeOnly,
    canDecide: isClient && !financeOnly && !pending,
    viaApproval: (team?.rules_on || []).includes(kind) && !team?.direct,
  };
}

// 결정 결과 알림: 결재 요청이 되었으면 그렇게 알린다
export function decisionToast(data, done) {
  if (data?.pending_approval) {
    toast({ title: '결재권자에게 결재를 요청했습니다', description: '결재가 끝나면 담당자에게 전달됩니다. 진행은 팀·결재 화면에서 볼 수 있습니다.' });
    return;
  }
  toast(done);
}

export const financeOnlyText = '재무 역할만 있는 계정은 결정할 수 없습니다. 실무자나 결재권자에게 요청해 주세요.';
export const viaApprovalText = '회사 결재 규칙에 따라 결재권자가 승인하면 담당자에게 전달됩니다.';
