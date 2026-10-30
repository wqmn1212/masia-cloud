// 견적서 파일 → 글 → AI 추출 → 우리 양식 정리 (parseQuotationFile·parseQuotationExcel 공용).
//  엑셀·CSV: 시트를 줄 단위 표로 · 워드: 본문 글과 표 · PDF·이미지: AI 가 파일을 직접 본다
import { assertPublicHttpUrl } from './safeUrl.ts';
import { docxToText, fileKind } from './docxText.ts';
import { EXTRACT_PROMPT, EXTRACT_SCHEMA, normalizeImport, legacyShape } from './quoteImport.ts';

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_TEXT = 60000;

// 시트마다 "칸 | 칸 | 칸" 줄로. 칸 안 줄바꿈은 ' / ' 로 (한국어 / 중국어가 같은 칸에 있는 견적서가 많다)
export async function workbookText(bytes: Uint8Array) {
  // 엑셀 라이브러리는 엑셀 파일일 때만 불러온다
  const XLSX: any = await import('npm:xlsx@0.18.5');
  const wb = XLSX.read(bytes, { type: 'array' });
  let text = '';
  for (const name of wb.SheetNames) {
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, blankrows: false, defval: '' });
    text += `--- 시트: ${name} ---\n`;
    for (const row of rows) {
      const cells = row.map((c) => String(c ?? '').replace(/\s*\r?\n\s*/g, ' / ').trim());
      while (cells.length && !cells[cells.length - 1]) cells.pop();
      if (cells.some(Boolean)) text += cells.join(' | ') + '\n';
    }
  }
  return text;
}

export async function extractQuotation(svc: any, { file_url, file_name }: { file_url: string; file_name?: string }) {
  await assertPublicHttpUrl(file_url);
  const res = await fetch(file_url);
  if (!res.ok) throw new Error('파일을 가져올 수 없습니다');
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > MAX_BYTES) throw new Error('파일은 20MB 이하여야 합니다');
  const kind = await fileKind(bytes, file_name || file_url);
  let raw;
  if (kind === 'pdf' || kind === 'image') {
    raw = await svc.integrations.Core.InvokeLLM({ prompt: EXTRACT_PROMPT, file_urls: [file_url], response_json_schema: EXTRACT_SCHEMA });
  } else {
    let text = '';
    if (kind === 'docx') text = await docxToText(bytes);
    else if (kind === 'xlsx') text = await workbookText(bytes);
    else if (kind === 'csv') text = new TextDecoder().decode(bytes);
    else throw new Error(kind === 'doc' ? '옛 워드(.doc)는 읽을 수 없습니다. .docx 나 PDF 로 저장해 올려 주세요' : '엑셀·워드(.docx)·PDF·이미지 견적서만 읽을 수 있습니다');
    if (!text.trim()) throw new Error('파일에서 글자를 찾지 못했습니다. 스캔본이면 PDF·이미지로 올려 주세요');
    raw = await svc.integrations.Core.InvokeLLM({ prompt: `${EXTRACT_PROMPT}\n\n--- 견적서 내용 (${kind}) ---\n${text.slice(0, MAX_TEXT)}`, response_json_schema: EXTRACT_SCHEMA });
  }
  const normalized = normalizeImport(raw);
  return { kind, raw, normalized, legacy: legacyShape(raw, normalized) };
}
