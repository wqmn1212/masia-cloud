// 고객 메일 알림 설정 검산: 직원은 설정과 상관없이, 고객은 끈 묶음 메일만 빠지고, 결정 요청·결제 요청·기한·공장 계좌 변경은 항상.
// 실행: npm run check:notification-prefs
import assert from 'node:assert/strict';
import { wantsEmail, bundleOf, EMAIL_BUNDLES } from '../base44/shared/notificationPrefs.ts';

const off = { progress: { email: false }, payment: { email: false }, shipment: { email: false }, quality: { email: false } };
const client = { account_tier: 'client', notification_prefs: off };
const staff = { account_tier: 'service', notification_prefs: off };

assert.equal(wantsEmail(staff, 'card_moved'), true, '직원 계정은 설정을 보지 않는다');
assert.equal(wantsEmail({ account_tier: 'client' }, 'card_moved'), true, '설정이 없으면 모두 받는다');
assert.equal(wantsEmail(client, 'card_moved'), false, '진행 묶음을 끄면 단계 변경 메일이 빠진다');
assert.equal(wantsEmail(client, 'shipment_updated'), false);
assert.equal(wantsEmail(client, 'claim_updated'), false);
assert.equal(wantsEmail(client, 'payment_confirmed'), false, '입금 확인은 끌 수 있다');
for (const t of ['payment_requested', 'payment_due', 'factory_account_changed', ...EMAIL_BUNDLES.decision]) {
  assert.equal(wantsEmail(client, t), true, `${t} 는 끌 수 없다`);
}
assert.equal(wantsEmail(client, 'unknown_type'), true, '묶음 밖 알림은 그대로');
assert.equal(bundleOf('chat_message'), 'progress');
assert.equal(bundleOf('landed_cost_confirmed'), 'shipment');
// 같은 알림이 두 묶음에 들어가지 않는다
const all = Object.values(EMAIL_BUNDLES).flat();
assert.equal(new Set(all).size, all.length);
console.log('notification-prefs: 메일 알림 설정 검산 통과');
