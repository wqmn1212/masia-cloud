import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url is required' }, { status: 400 });

    // 엑셀 파일 다운로드 후 시트 내용을 CSV 텍스트로 변환
    const fileRes = await fetch(file_url);
    if (!fileRes.ok) return Response.json({ error: '파일을 가져올 수 없습니다' }, { status: 502 });
    const buf = new Uint8Array(await fileRes.arrayBuffer());
    const wb = XLSX.read(buf, { type: 'array' });

    let text = '';
    for (const sheetName of wb.SheetNames) {
      text += `--- Sheet: ${sheetName} ---\n`;
      text += XLSX.utils.sheet_to_csv(wb.Sheets[sheetName], { blankrows: false });
      text += '\n';
    }
    text = text.slice(0, 50000);

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `아래는 엑셀 견적서(중국어/영어/한국어 혼용 가능)를 CSV 텍스트로 변환한 내용입니다.
이 견적서에서 다음을 정확히 추출하세요:
1. factory_name: 공장/발행처 회사명
2. product_name, model_name: 제품명과 모델명 (있는 경우)
3. incoterms: 인코텀즈 (EXW, FOB, CIF 등, 있는 경우)
4. logistics_cost: 물류비/운송비 (별도 항목으로 있는 경우, 숫자만)
5. items: 모든 개별 견적 항목(라인아이템). 각 항목마다:
   - option_name: 품목명/항목명 (원문 그대로)
   - specification: 사양/규격/재질/설명
   - quantity: 수량 (숫자)
   - unit_price: 단가 (숫자만)
   - currency: 통화 — ¥/元/RMB/人民币는 CNY, $/USD는 USD, ₩/원은 KRW. 표기가 없으면 중국 견적서는 CNY로 판단
합계/총계 행은 items에 포함하지 마세요. 실제 파일에 있는 내용만 추출하고 절대 지어내지 마세요.

--- 견적서 내용 ---
${text}`,
      response_json_schema: {
        type: 'object',
        properties: {
          factory_name: { type: 'string' },
          product_name: { type: 'string' },
          model_name: { type: 'string' },
          incoterms: { type: 'string' },
          logistics_cost: { type: 'number' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                option_name: { type: 'string' },
                specification: { type: 'string' },
                quantity: { type: 'number' },
                unit_price: { type: 'number' },
                currency: { type: 'string', enum: ['USD', 'CNY', 'KRW'] },
              },
            },
          },
        },
      },
    });

    return Response.json({ success: true, data: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});