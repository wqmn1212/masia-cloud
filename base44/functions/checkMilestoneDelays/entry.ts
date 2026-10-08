import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { kstToday } from '../../shared/chinaHoliday.ts';
import { notifyUsers, internalUsersOfTenant } from '../../shared/notify.ts';

// 매일 08:00 KST: 계획일이 지난 미완료 마일스톤을 담당 팀에 알린다 (단계당 1회).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.account_tier !== 'master') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const svc = base44.asServiceRole, db = svc.entities;
    const today = kstToday();
    const pending = (await db.CardMilestone.filter({ status: 'pending' }, 'planned_date', 2000))
      .filter((m) => m.planned_date && m.planned_date < today && !m.overdue_notified_on);
    const masters = (await db.User.filter({ account_tier: 'master' })).filter((u) => u.is_active !== false);
    let sent = 0;
    for (const m of pending) {
      const card = await db.TaskCard.get(m.card_id).catch(() => null);
      await db.CardMilestone.update(m.id, { overdue_notified_on: today });
      if (!card || ['DONE', 'CANCELLED'].includes(card.status)) continue;
      const all = [...masters, ...await internalUsersOfTenant(svc, card.tenant_id)];
      const staff = all.filter((u, i) => all.findIndex((x) => x.id === u.id) === i);
      await notifyUsers(svc, staff, {
        type: 'milestone_overdue', title: `${card.title} · ${m.label} 기한 지남`,
        body: `계획일 ${m.planned_date} 이 지났지만 완료되지 않았습니다.${m.owner_name ? ` 담당: ${m.owner_name}` : ''}`,
        link: '/task-board', task_card_id: card.id, card_title: card.title,
      });
      sent++;
    }
    return Response.json({ checked: pending.length, sent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}