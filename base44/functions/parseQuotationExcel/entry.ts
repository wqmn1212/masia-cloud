import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { extractQuotation } from '../../shared/quoteExtract.ts';

// AI 비서용 견적서 읽기 (예전 이름 유지). 엑셀뿐 아니라 워드(.docx)·PDF·이미지도 읽는다 — parseQuotationFile 과 같은 추출·검산.
// data 는 예전 형식(factory_name·items[option_name·specification·quantity·unit_price·currency])에 unit_label·optional 을 더한 것,
// import 는 검산 결과(checks)와 합계(summary)를 포함한 전체 정리값이다.
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['master', 'service', 'sub'].includes(user.account_tier) || user.is_active === false) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const { file_url, file_name } = await req.json().catch(() => ({}));
    if (!file_url) return Response.json({ error: 'file_url is required' }, { status: 400 });
    let out;
    try { out = await extractQuotation(base44.asServiceRole, { file_url, file_name }); }
    catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
    return Response.json({ success: true, data: out.legacy, import: out.normalized });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
