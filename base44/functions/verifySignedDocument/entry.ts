import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireClient } from '../../shared/clientAccess.ts';
import { STAFF_TIERS } from '../../shared/signatureServer.ts';

// 문서 확인: 화면이 브라우저에서 계산한 SHA-256 만 받아(파일은 받지 않음) 자기 팀(직원) 또는 자기 회사(고객)의 서명 기록과 비교한다.
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const sha = String(body.sha256 || '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(sha)) return Response.json({ error: '지문값 형식이 아닙니다' }, { status: 400 });
    const db = base44.asServiceRole.entities;
    let scope: any;
    if (STAFF_TIERS.includes(user.account_tier) && !body.view_company_id) {
      if (user.is_active === false) return Response.json({ error: 'Forbidden' }, { status: 403 });
      scope = user.account_tier === 'master' ? {} : { tenant_id: user.tenant_id };
    } else {
      const auth = await requireClient(base44, req);
      if (auth.error) return auth.error;
      scope = { client_id: auth.companyId };
    }
    const inScope = (r: any) => Object.entries(scope).every(([k, v]) => r[k] === v);
    const completed = (await db.SignatureRequest.filter({ ...scope, completed_sha256: sha }, '-created_date', 5)).filter(inScope);
    const original = completed.length ? [] : (await db.SignatureRequest.filter({ ...scope, original_sha256: sha }, '-created_date', 5)).filter(inScope);
    const hit = completed[0] || original[0];
    if (!hit) return Response.json({ match: null });
    return Response.json({
      match: {
        kind: completed.length ? 'COMPLETED' : 'ORIGINAL', document_no: hit.document_no, document_title: hit.document_title, version: hit.version,
        status: hit.status, completed_at: hit.completed_at || '', signed_name: (hit.signers || []).find((s: any) => s.status === 'SIGNED')?.signed_name || '',
      },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
