import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { kstToday } from '../../shared/chinaHoliday.ts';
import { notifyUsers, internalUsersOfTenant } from '../../shared/notify.ts';
import { cardSummary } from '../../shared/milestoneSummary.ts';

// 매일 08:00 KST: 확정 계획 카드의 지연 요약을 갱신하고, 계획일이 지난 미완료 단계를 팀에 알린다.
// 같은 계획일로는 1회만 알리고, 계획일이 바뀐 뒤 또 지나면 다시 알린다.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.account_tier !== 'master') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const svc = base44.asServiceRole, db = svc.entities;
    const today = kstToday();
    const all = await db.CardMilestone.list('seq', 5000);
    const byCard = new Map();
    for (const m of all) { if (!byCard.has(m.card_id)) byCard.set(m.card_id, []); byCard.get(m.card_id).push(m); }
    const masters = (await db.User.filter({ account_tier: 'master' })).filter((u) => u.is_active !== false);
    let updated = 0, sent = 0;
    for (const [cardId, list] of byCard) {
      const card = await db.TaskCard.get(cardId).catch(() => null);
      if (!card || !card.plan_confirmed_at || ['DONE', 'CANCELLED'].includes(card.status)) continue;
      const s = cardSummary(list, today, true);
      if (s.delay_days !== (card.delay_days || 0) || s.overdue_steps !== (card.overdue_steps || 0) || s.current_milestone_label !== card.current_milestone_label) {
        await db.TaskCard.update(card.id, s); updated++;
      }
      const due = list.filter((m) => ['pending', 'in_progress'].includes(m.status) && m.planned_date && m.planned_date < today && m.overdue_notified_for !== m.planned_date);
      if (!due.length) continue;
      for (const m of due) await db.CardMilestone.update(m.id, { overdue_notified_for: m.planned_date });
      const staffAll = [...masters, ...await internalUsersOfTenant(svc, card.tenant_id)];
      const staff = staffAll.filter((u, i) => staffAll.findIndex((x) => x.id === u.id) === i);
      await notifyUsers(svc, staff, {
        type: 'milestone_overdue', title: `${card.title} · 기한 지난 단계 ${due.length}개`,
        body: due.map((m) => `${m.label}: 계획일 ${m.planned_date}${m.owner_name ? ` (담당 ${m.owner_name})` : ''}`).join('\n'),
        link: '/task-board', task_card_id: card.id, card_title: card.title,
      });
      sent++;
    }
    return Response.json({ cards: byCard.size, updated, sent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}