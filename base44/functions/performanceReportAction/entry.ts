import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { buildPerformanceReport, draftHighlights, periodLabel, validDate } from '../../shared/performanceReport.ts';
import { notifyUsers, clientUsersOfCompany } from '../../shared/notify.ts';

// 고객 성과 리포트 (직원 전용, master·service)
//  'build'   {company_id, period_start, period_end} → 초안을 만들거나 초안의 숫자를 다시 집계 (담당자 문구는 유지, 비어 있으면 자동 초안)
//  'save'    {report_id, highlights?, next_plan?, hidden_metrics?} → 초안 문구·뺄 숫자 저장
//  'publish' {report_id} → 고객에게 발행하고 고객 담당자에게 알림. 발행한 숫자는 다시 집계하지 않는다
//  'delete'  {report_id} → 초안만 지운다
const MAX_DAYS = 400;
const clean = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.is_active === false || !['master', 'service'].includes(user.account_tier)) return Response.json({ error: '대표·팀 관리자만 사용할 수 있습니다.' }, { status: 403 });
    const input = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole, db = svc.entities;
    const allowedTenant = (t: string) => user.account_tier === 'master' || t === user.tenant_id;
    const by = user.full_name || user.email || '';

    if (input.action === 'build') {
      const { period_start: start, period_end: end } = input;
      if (!validDate(start) || !validDate(end) || start > end) return Response.json({ error: '기간(시작일·끝일)을 확인하세요.' }, { status: 400 });
      if ((Date.parse(end) - Date.parse(start)) / 86400000 > MAX_DAYS) return Response.json({ error: '기간은 1년 남짓까지 고를 수 있습니다.' }, { status: 400 });
      const company = typeof input.company_id === 'string' ? await db.Company.get(input.company_id).catch(() => null) : null;
      if (!company || company.company_type !== 'CLIENT' || !allowedTenant(company.tenant_id)) return Response.json({ error: '고객사 접근 권한이 없습니다.' }, { status: 403 });
      const existing = (await db.PerformanceReport.filter({ company_id: company.id, period_start: start, period_end: end }, '-created_date', 10))
        .find((r: any) => r.company_id === company.id && r.period_start === start && r.period_end === end);
      if (existing?.status === 'PUBLISHED') return Response.json({ error: '이미 발행한 리포트입니다. 발행한 숫자는 바꾸지 않습니다.', report_id: existing.id }, { status: 409 });
      const label = periodLabel(start, end);
      const built = await buildPerformanceReport(svc, { company, start, end });
      const data: any = { ...built, period_label: label, generated_at: new Date().toISOString() };
      if (!String(existing?.highlights || '').trim()) data.highlights = draftHighlights(built.metrics, label);
      const report = existing
        ? await db.PerformanceReport.update(existing.id, data)
        : await db.PerformanceReport.create({ tenant_id: company.tenant_id, company_id: company.id, company_name: company.company_name || '', period_start: start, period_end: end, status: 'DRAFT', next_plan: '', hidden_metrics: [], created_by_name: by, ...data });
      return Response.json({ report: { ...existing, ...data, ...report } });
    }

    const report = typeof input.report_id === 'string' ? await db.PerformanceReport.get(input.report_id).catch(() => null) : null;
    if (!report || !allowedTenant(report.tenant_id)) return Response.json({ error: '리포트 접근 권한이 없습니다.' }, { status: 403 });
    if (report.status === 'PUBLISHED') return Response.json({ error: '이미 발행한 리포트입니다.' }, { status: 409 });

    if (input.action === 'save') {
      const patch: any = {};
      if (typeof input.highlights === 'string') patch.highlights = clean(input.highlights, 4000);
      if (typeof input.next_plan === 'string') patch.next_plan = clean(input.next_plan, 4000);
      if (Array.isArray(input.hidden_metrics)) patch.hidden_metrics = [...new Set(input.hidden_metrics.filter((k: unknown) => typeof k === 'string' && /^[a-z_]{2,40}$/.test(k as string)))].slice(0, 60);
      const saved = await db.PerformanceReport.update(report.id, patch);
      return Response.json({ report: { ...report, ...patch, ...saved } });
    }

    if (input.action === 'publish') {
      if (!String(report.highlights || '').trim()) return Response.json({ error: '주요 성과를 적은 뒤 발행하세요.' }, { status: 400 });
      const patch = { status: 'PUBLISHED', published_at: new Date().toISOString(), published_by_name: by };
      const published = await db.PerformanceReport.update(report.id, patch);
      let sent = 0;
      try {
        const clients = await clientUsersOfCompany(svc, report.company_id);
        sent = await notifyUsers(svc, clients, {
          type: 'performance_report',
          title: `[AEGIS] ${report.period_label || '기간'} 성과 리포트`,
          body: `${report.period_label || '이번 기간'} 동안 진행한 품목·견적·검수·일정 성과를 정리했습니다. 고객 대시보드에서 확인하고 PDF로 저장하실 수 있습니다.`,
          link: `/client/dashboard?perf=${report.id}`,
        });
      } catch (_e) { /* 알림 실패가 발행을 막지 않는다 */ }
      return Response.json({ report: { ...report, ...patch, ...published }, sent });
    }

    if (input.action === 'delete') {
      await db.PerformanceReport.delete(report.id);
      return Response.json({ ok: true });
    }

    return Response.json({ error: '알 수 없는 작업입니다.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
