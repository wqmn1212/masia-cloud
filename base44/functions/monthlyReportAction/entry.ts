import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { buildMonthlyReport, validMonth } from '../../shared/monthlyReport.ts';
import { notifyUsers, clientUsersOfCompany } from '../../shared/notify.ts';

// 월간 업무 리포트 (직원 전용, master·service)
// - build: 고객사·월 기준으로 숫자를 집계해 초안을 만들거나, 초안의 숫자를 다시 집계한다 (담당자 작성 문구는 유지)
// - publish: 초안을 고객에게 발행하고 고객 담당자에게 알린다. 발행한 리포트는 다시 집계하지 않는다.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.is_active === false || !['master', 'service'].includes(user.account_tier)) return Response.json({ error: '대표·팀 관리자만 사용할 수 있습니다.' }, { status: 403 });
    const input = await req.json();
    const svc = base44.asServiceRole, db = svc.entities;
    const allowedTenant = (t) => user.account_tier === 'master' || t === user.tenant_id;

    if (input.action === 'build') {
      if (!validMonth(input.month)) return Response.json({ error: '대상 월(YYYY-MM)을 확인하세요.' }, { status: 400 });
      const company = typeof input.company_id === 'string' ? await db.Company.get(input.company_id).catch(() => null) : null;
      if (!company || company.company_type !== 'CLIENT' || !allowedTenant(company.tenant_id)) return Response.json({ error: '고객사 접근 권한이 없습니다.' }, { status: 403 });
      let agreement = null;
      if (input.agreement_id) {
        agreement = await db.ServiceAgreement.get(input.agreement_id).catch(() => null);
        if (!agreement || agreement.company_id !== company.id) return Response.json({ error: '계약과 고객사가 맞지 않습니다.' }, { status: 400 });
      }
      const existing = (await db.MonthlyReport.filter({ company_id: company.id, month: input.month }, '-created_date', 20))
        .find((r) => (r.agreement_id || '') === (agreement?.id || ''));
      if (existing?.status === 'PUBLISHED') return Response.json({ error: '이미 발행한 리포트입니다. 발행한 숫자는 바꾸지 않습니다.', report_id: existing.id }, { status: 409 });
      const built = await buildMonthlyReport(svc, { company, agreement, month: input.month });
      const data = { ...built, generated_at: new Date().toISOString() };
      const report = existing
        ? await db.MonthlyReport.update(existing.id, data)
        : await db.MonthlyReport.create({ tenant_id: company.tenant_id, company_id: company.id, company_name: company.company_name || '', agreement_id: agreement?.id || '', month: input.month, status: 'DRAFT', highlights: '', next_plan: '', ...data });
      return Response.json({ report: { ...existing, ...report } });
    }

    if (input.action === 'publish') {
      const report = typeof input.report_id === 'string' ? await db.MonthlyReport.get(input.report_id).catch(() => null) : null;
      if (!report || !allowedTenant(report.tenant_id)) return Response.json({ error: '리포트 접근 권한이 없습니다.' }, { status: 403 });
      if (report.status === 'PUBLISHED') return Response.json({ error: '이미 발행한 리포트입니다.' }, { status: 409 });
      if (!String(report.highlights || '').trim()) return Response.json({ error: '이번 달 주요 내용을 적은 뒤 발행하세요.' }, { status: 400 });
      const published = await db.MonthlyReport.update(report.id, { status: 'PUBLISHED', published_at: new Date().toISOString(), published_by_name: user.full_name || user.email });
      const [y, m] = report.month.split('-');
      let sent = 0;
      try {
        const clients = await clientUsersOfCompany(svc, report.company_id);
        sent = await notifyUsers(svc, clients, {
          type: 'monthly_report',
          title: `[AEGIS] ${y}년 ${Number(m)}월 업무 리포트`,
          body: `${y}년 ${Number(m)}월 한 달 동안 진행한 업무를 정리했습니다. 고객 대시보드에서 확인해 주세요.`,
          link: `/client/dashboard?report=${report.id}`,
        });
      } catch (_e) { /* 알림 실패가 발행을 막지 않는다 */ }
      return Response.json({ report: { ...report, ...published }, sent });
    }

    return Response.json({ error: '알 수 없는 작업입니다.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
