import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireClient } from '../../shared/clientAccess.ts';
import { clientPerformanceReport } from '../../shared/performanceView.ts';

// 고객 포털 '성과 리포트': 발행된 리포트만, 담당자가 뺀 숫자는 지우고 돌려준다.
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireClient(base44, req);
    if (auth.error) return auth.error;
    const rows = await base44.asServiceRole.entities.PerformanceReport.filter({ company_id: auth.companyId, status: 'PUBLISHED' }, '-period_end', 24);
    return Response.json({ reports: rows.filter((r: any) => r.company_id === auth.companyId && r.status === 'PUBLISHED').map(clientPerformanceReport) });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
