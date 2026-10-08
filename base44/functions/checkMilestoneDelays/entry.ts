import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { kstToday } from '../../shared/chinaHoliday.ts';
import { notifyUsers } from '../../shared/notify.ts';
import { cardSummary } from '../../shared/milestoneSummary.ts';

// 매일 08:00 KST: 진행 중·계획 확정 카드의 지연 요약을 갱신하고, 기한 지난 단계를 한 사람에게만 알린다.
// 수신자: 단계 담당자 → 카드 책임자 → 그 팀 service. 같은 계획일로는 1회, 계획일이 바뀌면 다시.
const THROTTLE_MS = 5 * 60 * 1000;
let lastAnonRun = 0;

async function readAll(fetchPage: (skip: number) => Promise<any[]>, size: number) {
  const out: any[] = [];
  for (let skip = 0; ; skip += size) { const page = await fetchPage(skip); out.push(...page); if (page.length < size) return out; }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.account_tier !== 'master') return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (!user) { if (Date.now() - lastAnonRun < THROTTLE_MS) return Response.json({ throttled: true }); lastAnonRun = Date.now(); }
    const svc = base44.asServiceRole, db = svc.entities;
    const today = kstToday();
    const cards = (await readAll((skip) => db.TaskCard.filter({ status: { $nin: ['DONE', 'CANCELLED'] }, milestone_template_id: { $nin: [null, ''] } }, 'created_date', 500, skip), 500))
      .filter((c) => c.plan_confirmed_at);
    const byCard = new Map(cards.map((c) => [c.id, [] as any[]]));
    const ids = cards.map((c) => c.id);
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const ms = await readAll((skip) => db.CardMilestone.filter({ card_id: { $in: chunk } }, 'seq', 1000, skip), 1000);
      for (const m of ms) byCard.get(m.card_id)?.push(m);
    }
    const userCache = new Map<string, any>();
    const getUser = async (id: string) => { if (!userCache.has(id)) userCache.set(id, await db.User.get(id).catch(() => null)); return userCache.get(id); };
    const serviceCache = new Map<string, any[]>();
    const serviceOf = async (t: string) => { if (!serviceCache.has(t)) serviceCache.set(t, (await db.User.filter({ tenant_id: t, account_tier: 'service' })).filter((u) => u.is_active !== false)); return serviceCache.get(t); };
    let updated = 0, sent = 0;
    for (const card of cards) {
      const list = byCard.get(card.id) || [];
      if (!list.length) continue;
      const s = cardSummary(list, today, true);
      if (s.delay_days !== (card.delay_days || 0) || s.overdue_steps !== (card.overdue_steps || 0) || s.current_milestone_label !== card.current_milestone_label) { await db.TaskCard.update(card.id, s); updated++; }
      const due = list.filter((m) => ['pending', 'in_progress'].includes(m.status) && m.planned_date && m.planned_date < today && m.overdue_notified_for !== m.planned_date);
      if (!due.length) continue;
      const groups = new Map<string, { users: any[]; steps: any[] }>();
      for (const m of due) {
        let users: any[] = [];
        for (const id of [m.owner_id, card.owner_id]) { const u = id && await getUser(id); if (u && u.is_active !== false) { users = [u]; break; } }
        if (!users.length) users = await serviceOf(card.tenant_id);
        const key = users.map((u) => u.id).sort().join(',');
        if (!groups.has(key)) groups.set(key, { users, steps: [] });
        groups.get(key).steps.push(m);
      }
      for (const { users, steps } of groups.values()) {
        if (users.length) {
          await notifyUsers(svc, users, {
            type: 'milestone_overdue', title: `${card.title} · 기한 지난 단계 ${steps.length}개`,
            body: steps.map((m) => `${m.label}: 계획일 ${m.planned_date}${m.owner_name ? ` (담당 ${m.owner_name})` : ''}`).join('\n'),
            link: '/task-board', task_card_id: card.id, card_title: card.title,
          });
          sent++;
        }
        for (const m of steps) await db.CardMilestone.update(m.id, { overdue_notified_for: m.planned_date });
      }
    }
    return Response.json({ cards: cards.length, updated, sent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});