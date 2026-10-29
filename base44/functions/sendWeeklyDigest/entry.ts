import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { FROM_NAME, emailBody } from '../../shared/notify.ts';
import { clientOverview } from '../../shared/clientOverview.ts';
import { weeklyDigest, wantsWeekly } from '../../shared/weeklyDigest.ts';
import { shiftDate, kstToday } from '../../shared/chinaHoliday.ts';
import { ARRIVED } from '../../shared/reorderForecast.ts';

// 고객 주간 요약 메일 (워크플로 WeeklyClientDigest, 월요일 08:20 KST).
// 고객 계정마다 대시보드와 같은 계산(clientOverview)으로 이번 주 확인하실 일·일정을, 지난 7일의 공개 단계 완료·도착·견적 발행·입금 확인을 모아 한 통 보낸다.
// 보낼 내용이 없거나 메일 설정에서 주간 요약을 끈 계정은 건너뛴다.
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const today = kstToday();
    const from = shiftDate(today, -7);
    const weekEnd = shiftDate(today, 6);
    const users = (await svc.entities.User.filter({ account_tier: 'client' })).filter(wantsWeekly);
    const byCompany = new Map<string, any[]>();
    for (const u of users) if (u.company_id) byCompany.set(u.company_id, [...(byCompany.get(u.company_id) || []), u]);
    let sent = 0, skipped = 0;
    for (const [companyId, list] of byCompany) {
      // 지난 7일 바뀐 것 (고객 공개 카드·공개 단계·공개 선적·공개 견적만)
      const cards = (await svc.entities.TaskCard.filter({ client_id: companyId, client_visible: true }, '-updated_date', 200)).filter((c: any) => c.client_id === companyId && c.client_visible === true);
      const titles = new Map(cards.map((c: any) => [c.id, c.title]));
      const ids = cards.map((c: any) => c.id);
      const planned = cards.filter((c: any) => c.plan_confirmed_at).map((c: any) => c.id);
      const inWeek = (d: string) => !!d && d >= from && d < today;
      const changes = !ids.length ? {} : {
        milestones: planned.length ? (await svc.entities.CardMilestone.filter({ card_id: { $in: planned } }, 'actual_date', 500)).filter((m: any) => planned.includes(m.card_id) && m.client_visible !== false && m.status === 'done' && inWeek(m.actual_date)).map((m: any) => ({ date: m.actual_date, label: m.label, card_title: titles.get(m.card_id) })) : [],
        arrivals: (await svc.entities.Shipment.filter({ card_id: { $in: ids }, client_visible: true }, 'ata', 200)).filter((s: any) => titles.has(s.card_id) && s.client_visible === true && ARRIVED.includes(s.status) && inWeek(s.ata)).map((s: any) => ({ date: s.ata, label: s.label || '선적', card_title: titles.get(s.card_id) })),
        quotes: (await svc.entities.Quotation.filter({ client_id: companyId }, '-client_published_at', 100)).filter((q: any) => titles.has(q.card_id) && q.client_published_at && inWeek(new Date(Date.parse(q.client_published_at) + 9 * 3600000).toISOString().slice(0, 10))).map((q: any) => ({ date: new Date(Date.parse(q.client_published_at) + 9 * 3600000).toISOString().slice(0, 10), card_title: titles.get(q.card_id) })),
        payments: (await svc.entities.PaymentStage.filter({ card_id: { $in: ids } }, 'created_date', 500)).filter((p: any) => titles.has(p.card_id) && p.approval_status === 'APPROVED' && inWeek(p.paid_date || (p.approved_at ? new Date(Date.parse(p.approved_at) + 9 * 3600000).toISOString().slice(0, 10) : ''))).map((p: any) => ({ date: p.paid_date || new Date(Date.parse(p.approved_at) + 9 * 3600000).toISOString().slice(0, 10), stage_type: p.stage_type, card_title: titles.get(p.card_id) })),
      };
      for (const u of list) {
        const overview = await clientOverview(svc, { user: u, companyId });
        const d = weeklyDigest({ name: u.full_name || u.account_label || '', overview, changes, today, weekEnd });
        if (!d) { skipped += 1; continue; }
        try {
          await svc.integrations.Core.SendEmail({ to: u.email, from_name: FROM_NAME, subject: d.subject, body: emailBody(d.text, '', '/client/dashboard') });
          sent += 1;
        } catch (_e) { skipped += 1; }
      }
    }
    return Response.json({ ok: true, sent, skipped });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
