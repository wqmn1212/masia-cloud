import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { kstToday } from '../../shared/chinaHoliday.ts';
import { notifyUsers } from '../../shared/notify.ts';

// 매일 08:10 KST: 진행 중인 월 계약의 만료 30일·7일 전에 배정 팀원과 팀 관리자(service)에게 알린다.
// 같은 종료일·단계로는 한 번만 보낸다 (renewal_notices 에 '종료일:단계' 기록).
const THROTTLE_MS = 5 * 60 * 1000;
const STEPS = [7, 30];
let lastAnonRun = 0;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.account_tier !== 'master') return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (!user) { if (Date.now() - lastAnonRun < THROTTLE_MS) return Response.json({ throttled: true }); lastAnonRun = Date.now(); }
    const svc = base44.asServiceRole, db = svc.entities;
    const today = kstToday();
    const list = await db.ServiceAgreement.filter({ status: 'ACTIVE' }, 'end_date', 500);
    const serviceCache = new Map<string, any[]>();
    const serviceOf = async (t: string) => {
      if (!serviceCache.has(t)) serviceCache.set(t, (await db.User.filter({ tenant_id: t, account_tier: 'service' })).filter((u) => u.is_active !== false));
      return serviceCache.get(t);
    };
    let sent = 0;
    for (const a of list) {
      if (!a.end_date) continue;
      const left = daysBetween(today, a.end_date);
      if (left < 0) continue;
      const step = STEPS.find((s) => left <= s);
      if (step == null) continue;
      const key = `${a.end_date}:${step}`;
      if ((a.renewal_notices || []).includes(key)) continue;
      const assigned = (await Promise.all((a.assigned_user_ids || []).map((id: string) => db.User.get(id).catch(() => null))))
        .filter((u) => u && u.is_active !== false && u.tenant_id === a.tenant_id);
      const recipients = [...new Map([...assigned, ...(await serviceOf(a.tenant_id))].map((u) => [u.id, u])).values()];
      if (recipients.length) {
        await notifyUsers(svc, recipients, {
          type: 'agreement_renewal',
          title: `[계약 만료 D-${left}] ${a.company_name || '고객사'} · ${a.title || a.agreement_no || '월 계약'}`,
          body: `계약 종료일은 ${a.end_date} 입니다. 고객과 갱신 여부를 확인하고, 갱신하면 월 계약 관리에서 갱신 계약을 만들어 주세요.`,
          link: '/agreements',
        });
      }
      await db.ServiceAgreement.update(a.id, { renewal_notices: [...(a.renewal_notices || []), key] });
      sent++;
    }
    return Response.json({ checked: list.length, sent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
