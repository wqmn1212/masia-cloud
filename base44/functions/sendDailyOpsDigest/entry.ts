import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { FROM_NAME, emailBody } from '../../shared/notify.ts';
import { kstToday } from '../../shared/chinaHoliday.ts';
import { buildOpsDigest, digestText, wantsDaily } from '../../shared/opsDigest.ts';
import { loadOpsData } from '../../shared/opsDigestData.ts';

// 직원 일일 운영 요약 (워크플로 DailyOpsDigest, 매일 08:30 KST).
// 팀마다 데이터를 한 번 읽고, 직원마다 자기 카드 몫(관리자는 팀 전체 숫자 포함)을 앱 알림 + 메일로 보낸다.
// 예약 실행(로그인 없음)과 마스터만 부를 수 있고, 같은 사람에게 하루 한 번만 보낸다 (User.daily_digest_sent_for).
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (caller && caller.account_tier !== 'master') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const svc = base44.asServiceRole;
    const today = kstToday();
    const now = new Date().toISOString();
    const staff = (await svc.entities.User.filter({ account_tier: { $in: ['service', 'sub'] } })).filter((u: any) => wantsDaily(u) && u.tenant_id && u.daily_digest_sent_for !== today);
    const byTenant = new Map<string, any[]>();
    for (const u of staff) byTenant.set(u.tenant_id, [...(byTenant.get(u.tenant_id) || []), u]);
    let sent = 0, skipped = 0;
    for (const [tenantId, users] of byTenant) {
      const data = await loadOpsData(svc, tenantId, { staffUser: users[0] });
      for (const u of users) {
        const digest = buildOpsDigest({ user: u, admin: u.account_tier === 'service', today, now, data });
        if (digest.empty) { skipped += 1; continue; }
        const lang = u.preferred_language === 'zh' ? 'zh' : 'ko';
        const { subject, body } = digestText(digest, { name: u.full_name || '', lang });
        try {
          await svc.entities.Notification.create({ tenant_id: u.tenant_id, recipient_id: u.id, recipient_email: u.email || '', type: 'daily_digest', title: subject, body, link: '/my-work', task_card_id: '', read: false });
          if (u.email) await svc.integrations.Core.SendEmail({ to: u.email, from_name: FROM_NAME, subject, body: emailBody(body, '', '/my-work') });
          await svc.entities.User.update(u.id, { daily_digest_sent_for: today });
          sent += 1;
        } catch (_e) { /* 한 사람 실패가 다른 사람 발송을 막지 않는다 */ }
      }
    }
    return Response.json({ ok: true, sent, skipped });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
