import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireClient } from '../../shared/clientAccess.ts';

// 고객 포털 '계약·월간 리포트': 계약 기간·담당 팀·청구 상태와 발행된 월간 리포트.
// 월 계약료·공장 페이백 비율 같은 내부 금액은 응답에 넣지 않는다 (청구 금액도 제외, 상태만).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireClient(base44, req);
    if (auth.error) return auth.error;
    const svc = base44.asServiceRole, db = svc.entities;

    const agreements = (await db.ServiceAgreement.filter({ company_id: auth.companyId }, '-start_date', 20))
      .filter((a) => a.status !== 'DRAFT');
    const ids = agreements.map((a) => a.id);
    const invoices = ids.length ? await db.ServiceInvoice.filter({ agreement_id: { $in: ids } }, '-billing_month', 200) : [];
    const cards = ids.length ? await db.TaskCard.filter({ agreement_id: { $in: ids }, client_visible: true }, '-created_date', 500) : [];
    const userIds = [...new Set(agreements.flatMap((a) => a.assigned_user_ids || []))];
    const users = new Map((await Promise.all(userIds.map((id) => db.User.get(id).catch(() => null)))).filter(Boolean).map((u) => [u.id, u.full_name || '']));
    const reports = await db.MonthlyReport.filter({ company_id: auth.companyId, status: 'PUBLISHED' }, '-month', 24);

    return Response.json({
      agreements: agreements.map((a) => ({
        id: a.id,
        title: a.title || '',
        agreement_no: a.agreement_no || '',
        start_date: a.start_date || '',
        end_date: a.end_date || '',
        term_months: a.term_months ?? null,
        status: a.status,
        team: (a.assigned_user_ids || []).map((id) => users.get(id)).filter(Boolean),
        project_count: cards.filter((c) => c.agreement_id === a.id && c.client_id === auth.companyId).length,
        invoices: invoices.filter((i) => i.agreement_id === a.id && i.company_id === auth.companyId && i.status !== 'PENDING')
          .map((i) => ({ id: i.id, billing_month: i.billing_month, status: i.status, issued_at: i.issued_at || '', paid_at: i.paid_at || '' })),
      })),
      reports: reports.filter((r) => r.company_id === auth.companyId).map((r) => ({
        id: r.id, month: r.month, metrics: r.metrics || {}, cards: r.cards || [], highlights: r.highlights || '', next_plan: r.next_plan || '', published_at: r.published_at || '',
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
