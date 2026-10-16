import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { buildMonthlyReport, previousMonth } from '../../shared/monthlyReport.ts';
import { notifyUsers } from '../../shared/notify.ts';

// 매월 1일 09:00 KST: 진행 중인 월 계약마다 지난달 리포트 초안을 만들고 배정 팀원에게 앱 알림을 보낸다.
// 고객에게는 담당자가 문구를 쓰고 발행해야 보인다. 이미 있는 초안·발행본은 건드리지 않는다.
const THROTTLE_MS = 5 * 60 * 1000;
let lastAnonRun = 0;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.account_tier !== 'master') return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (!user) { if (Date.now() - lastAnonRun < THROTTLE_MS) return Response.json({ throttled: true }); lastAnonRun = Date.now(); }
    const svc = base44.asServiceRole, db = svc.entities;
    const month = previousMonth();
    const agreements = await db.ServiceAgreement.filter({ status: 'ACTIVE' }, 'start_date', 500);
    let created = 0;
    for (const a of agreements) {
      if (a.start_date && a.start_date.slice(0, 7) > month) continue; // 지난달 이후 시작한 계약
      const exists = (await db.MonthlyReport.filter({ company_id: a.company_id, month }, '-created_date', 20)).some((r) => r.agreement_id === a.id);
      if (exists) continue;
      const company = await db.Company.get(a.company_id).catch(() => null);
      if (!company || company.tenant_id !== a.tenant_id) continue;
      const built = await buildMonthlyReport(svc, { company, agreement: a, month });
      await db.MonthlyReport.create({ tenant_id: a.tenant_id, company_id: company.id, company_name: company.company_name || a.company_name || '', agreement_id: a.id, month, status: 'DRAFT', highlights: '', next_plan: '', ...built, generated_at: new Date().toISOString() });
      created++;
      const assigned = (await Promise.all((a.assigned_user_ids || []).map((id) => db.User.get(id).catch(() => null)))).filter((u) => u && u.is_active !== false);
      if (assigned.length) {
        await notifyUsers(svc, assigned, {
          type: 'monthly_report',
          title: `[리포트 초안] ${company.company_name || ''} ${month}`,
          body: '지난달 숫자를 집계해 월간 리포트 초안을 만들었습니다. 주요 내용과 다음 달 계획을 적고 고객에게 발행해 주세요.',
          link: '/agreements',
        }, { email: false });
      }
    }
    return Response.json({ month, agreements: agreements.length, created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
