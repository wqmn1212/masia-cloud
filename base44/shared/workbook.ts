import { assertPublicHttpUrl } from './safeUrl.ts';

// 엑셀(.xlsx·.xls) 파일을 시트별 2차원 배열로 읽는다. 검산에서는 globalThis.__readWorkbook 으로 바꿔 끼운다.
const MAX_BYTES = 15 * 1024 * 1024;
export async function readWorkbook(fileUrl: string): Promise<{ name: string; rows: unknown[][] }[]> {
  const seam = (globalThis as any).__readWorkbook;
  if (seam) return seam(fileUrl);
  await assertPublicHttpUrl(fileUrl);
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error('파일을 내려받지 못했습니다');
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) throw new Error('파일이 너무 큽니다 (15MB 이하)');
  const XLSX: any = await import('npm:xlsx@0.18.5');
  const wb = XLSX.read(bytes, { type: 'array' });
  return wb.SheetNames.map((name: string) => ({ name, rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, blankrows: false, defval: '' }) }));
}
