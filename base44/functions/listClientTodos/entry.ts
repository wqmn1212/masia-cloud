import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireClient } from '../../shared/clientAccess.ts';
import { clientOverview } from '../../shared/clientOverview.ts';

// 고객 대시보드 데이터 — 계산은 shared/clientOverview.ts (주간 요약 메일과 같은 계산)
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireClient(base44, req);
    if (auth.error) return auth.error;
    return Response.json(await clientOverview(base44.asServiceRole, { user: auth.user, companyId: auth.companyId }));
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
