// 고객이 고르는 메일 알림 묶음. 앱 알림(종 모양)은 모두 그대로 두고 메일만 묶음별로 끌 수 있다.
// 결정 요청과 결제 요청·결제 기한·공장 계좌 변경(송금 중지 안내)은 끌 수 없다. 직원 계정은 설정과 상관없이 지금처럼 받는다.
// 화면 src/components/notifications/NotificationPrefsDialog.jsx 와 묶음 이름을 맞춘다. 검산: npm run check:notification-prefs
export const EMAIL_BUNDLES: Record<string, string[]> = {
  decision: ['comparison_published', 'spec_sent', 'qc_published', 'dest_cost_sent', 'contract_sent', 'file_review_requested', 'client_approval_requested', 'client_approval_decided'],
  payment: ['payment_requested', 'payment_due', 'payment_request_canceled', 'payment_confirmed', 'factory_account_changed', 'factory_account_verified'],
  progress: ['card_moved', 'card_shared', 'file_shared', 'schedule_changed', 'chat_message', 'quote_published', 'holiday_conflict', 'holiday_notice', 'monthly_report'],
  shipment: ['shipment_updated', 'landed_cost_confirmed'],
  quality: ['claim_updated'],
};
// 묶음을 꺼도 메일이 가는 알림 (결정 요청 전체 + 돈이 걸린 안내)
export const ALWAYS_EMAIL_TYPES = [...EMAIL_BUNDLES.decision, 'payment_requested', 'payment_due', 'factory_account_changed'];

export const bundleOf = (type: string) => Object.keys(EMAIL_BUNDLES).find((k) => EMAIL_BUNDLES[k].includes(type)) || null;

// 이 사용자에게 이 종류의 메일을 보내도 되는지 (메일 생략 규칙·ALWAYS_EMAIL 은 notify.ts 가 따로 본다)
export function wantsEmail(user: any, type: string) {
  if (user?.account_tier !== 'client') return true;
  if (ALWAYS_EMAIL_TYPES.includes(type)) return true;
  const bundle = bundleOf(type);
  if (!bundle) return true;
  return user.notification_prefs?.[bundle]?.email !== false;
}
