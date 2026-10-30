// 워드(.docx) 견적서에서 글과 표를 꺼내고, 올라온 견적서 파일 종류를 가린다. 외부 패키지 없이 ZIP 중앙 목록을 읽고 deflate 를 풀어 word/document.xml 만 본다.
// 표는 줄마다 칸을 ' | ' 로, 문단은 줄바꿈으로 이어 AI 가 견적표로 읽기 쉽게 만든다. 검산: npm run check:quote-import
const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

async function inflateRaw(data: Uint8Array) {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// ZIP 안의 파일 하나 (중앙 디렉터리 기준). 없으면 null
export async function zipEntry(zip: Uint8Array, name: string) {
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--) if (u32(zip, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('ZIP 파일이 아닙니다');
  const count = u16(zip, eocd + 10);
  let p = u32(zip, eocd + 16);
  for (let n = 0; n < count; n++) {
    if (u32(zip, p) !== 0x02014b50) break;
    const method = u16(zip, p + 10);
    const size = u32(zip, p + 20);
    const nameLen = u16(zip, p + 28), extraLen = u16(zip, p + 30), commentLen = u16(zip, p + 32);
    const local = u32(zip, p + 42);
    const entryName = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + nameLen));
    if (entryName === name) {
      const start = local + 30 + u16(zip, local + 26) + u16(zip, local + 28);
      const raw = zip.subarray(start, start + size);
      if (method === 0) return raw;
      if (method === 8) return inflateRaw(raw);
      throw new Error('지원하지 않는 압축 방식입니다');
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

const decodeXml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d))).replace(/&amp;/g, '&');

// 문단 하나의 글자 (줄바꿈·탭 포함). <w:t/> 처럼 빈 태그는 건너뛴다
function paraText(xml: string) {
  let s = '';
  const re = /<w:t(?:\s[^>]*[^/])?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:(?:br|cr)\b[^>]*\/>/g;
  let m;
  while ((m = re.exec(xml))) s += m[1] !== undefined ? m[1] : m[0].startsWith('<w:tab') ? '\t' : '\n';
  return decodeXml(s);
}

export function docxXmlToText(xml: string) {
  const body = (xml.match(/<w:body\b[^>]*>([\s\S]*)<\/w:body>/) || [, xml])[1];
  const out: string[] = [];
  // 표와 문단을 나온 순서대로
  const re = /<w:tbl\b[\s\S]*?<\/w:tbl>|<w:p\b[\s\S]*?<\/w:p>/g;
  let m;
  while ((m = re.exec(body))) {
    const block = m[0];
    if (block.startsWith('<w:tbl')) {
      for (const row of block.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || []) {
        const cells = (row.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || []).map((c) => (c.match(/<w:p\b[\s\S]*?<\/w:p>/g) || []).map(paraText).filter((t) => t.trim()).join(' / ').trim());
        if (cells.some(Boolean)) out.push(cells.join(' | '));
      }
      out.push('');
    } else {
      const t = paraText(block).trim();
      if (t) out.push(t);
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export async function docxToText(bytes: Uint8Array) {
  const xml = await zipEntry(bytes, 'word/document.xml');
  if (!xml) throw new Error('워드 문서 본문(word/document.xml)을 찾을 수 없습니다');
  return docxXmlToText(new TextDecoder().decode(xml));
}

// 올라온 견적서 파일 종류: 내용 첫 바이트를 먼저 보고, 모르면 확장자
export async function fileKind(bytes: Uint8Array, name: string) {
  const ext = (String(name || '').split('?')[0].split('.').pop() || '').toLowerCase();
  const head = String.fromCharCode(...bytes.subarray(0, 4));
  if (head === '%PDF') return 'pdf';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image';
  if (head === '\x89PNG') return 'image';
  if (head.startsWith('PK')) {
    if (await zipEntry(bytes, 'word/document.xml').catch(() => null)) return 'docx';
    return 'xlsx';
  }
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf) return ext === 'doc' ? 'doc' : 'xlsx'; // 옛 xls(OLE)
  if (['csv', 'txt'].includes(ext)) return 'csv';
  if (['webp', 'gif', 'heic'].includes(ext)) return 'image';
  return ext || 'unknown';
}
