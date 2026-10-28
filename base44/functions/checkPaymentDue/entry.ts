import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { notifyUsers, clientUsersOfCompany, internalUsersOfTenant } from '../../shared/notify.ts';
import { dueReminder, STAGE_LABEL } from '../../shared/paymentRequest.ts';
import { kstToday } from '../../shared/chinaHoliday.ts';

// 매일 09:40 KST: 결제 요청 기한 3일 안·당일에 고객에게 알리고, 기한이 지나도록 송금 알림이 없으면 직원에게 알린다
// (관리자 할 일 '결제 기한 지남'에도 뜬다). 같은 기한·단계로는 한 번만 보낸다 (reminder_sent_for / overdue_notified_for).
const THROTTLE_MS = 5 * 60 * 1000;
let lastAnonRun = 0;
const money = (amount: any, currency: string) => (amount == null ? '' : `${currency} ${Number(amount).toLocaleString('en-US', { maximumFractionDigits: 2 })}`);

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.account_tier !== 'master') return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (!user) { if (Date.now() - lastAnonRun < THROTTLE_MS) return Response.json({ throttled: true }); lastAnonRun = Date.now(); }
    const svc = base44.asServiceRole, db = svc.entities;
    const today = kstToday();
    const stages = (await db.PaymentStage.filter({ approval_status: 'PENDING' }, 'due_date', 500)).filter((s: any) => s.requested_at && s.due_date);
    const cards = new Map();
    let reminded = 0, overdue = 0;
    for (const s of stages) {
      const step = dueReminder(s, today);
      if (!step) continue;
      if (!cards.has(s.card_id)) cards.set(s.card_id, await db.TaskCard.get(s.card_id).catch(() => null));
      const card = cards.get(s.card_id);
      if (!card) continue;
      const label = STAGE_LABEL[s.stage_type] || '대금';
      if (step.step === 'OVERDUE') {
        await notifyUsers(svc, await internalUsersOfTenant(svc, card.tenant_id), {
          type: 'payment_overdue',
          title: `[결제 기한 지남] ${card.title} ${label}`,
          body: `결제 기한 ${s.due_date}이 ${-step.left}일 지났는데 고객이 아직 송금했다고 알리지 않았습니다. 고객에게 연락하거나 기한을 고쳐 다시 보내 주세요.`,
          link: `/task-board?card=${card.id}&tab=settlement`, task_card_id: card.id, card_title: card.title,
        }).catch(() => 0);
        await db.PaymentStage.update(s.id, { overdue_notified_for: step.key });
        overdue++;
        continue;
      }
      // 고객에게 공개되지 않은 카드는 고객 알림을 보내지 않는다 (같은 단계로 다시 보지 않게 기록은 남긴다)
      if (card.client_visible === true && card.client_id) {
        await notifyUsers(svc, await clientUsersOfCompany(svc, card.client_id), {
          type: 'payment_due',
          title: `[결제 기한 ${step.left === 0 ? '오늘' : `${step.left}일 남음`}] ${card.title} ${label}`,
          body: `${label} ${money(s.amount, s.currency)} · 결제 기한 ${s.due_date}\n계좌는 포털 결제 탭에서만 확인해 주세요. 송금하신 뒤 '송금했어요'를 누르면 담당자가 입금을 확인합니다.`,
          link: `/client/board?card=${card.id}&tab=settlement`, task_card_id: card.id, card_title: card.title,
        }).catch(() => 0);
        reminded++;
      }
      await db.PaymentStage.update(s.id, { reminder_sent_for: step.key });
    }
    return Response.json({ checked: stages.length, reminded, overdue });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
