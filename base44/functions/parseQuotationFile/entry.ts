import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { extractQuotation } from '../../shared/quoteExtract.ts';

// 공장 견적서 파일(엑셀·워드·PDF·이미지) 읽기 → 우리 견적 양식 값과 검산 결과. 저장은 하지 않는다 (직원이 확인 후 적용).
//  { file_url, file_name } → { kind, import: { form, checks, summary }, data(예전 형식) }
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['master', 'service', 'sub'].includes(user.account_tier) || user.is_active === false) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    if (typeof body.file_url !== 'string' || !body.file_url) return Response.json({ error: 'file_url is required' }, { status: 400 });
    let out;
    try { out = await extractQuotation(base44.asServiceRole, { file_url: body.file_url, file_name: typeof body.file_name === 'string' ? body.file_name : '' }); }
    catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
    return Response.json({ success: true, kind: out.kind, import: out.normalized, data: out.legacy });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
