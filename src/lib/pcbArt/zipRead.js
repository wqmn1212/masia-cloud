// zip 읽기 (브라우저·node 공용): 저장(무압축)과 deflate 항목. 제조 묶음 zip 이나 KiCad 프로젝트 zip 에서 .kicad_pcb 를 꺼낼 때 쓴다.
const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

async function inflateRaw(data) {
  if (typeof DecompressionStream === 'undefined') throw new Error('이 브라우저는 압축된 zip 을 풀 수 없습니다');
  const s = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

/** zip 의 파일 목록 [{ name, read(): Promise<Uint8Array> }] — 중앙 디렉터리로 읽는다 */
export function listZip(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('zip 파일이 아닙니다');
  const count = u16(b, eocd + 10);
  let p = u32(b, eocd + 16);
  const out = [];
  const dec = new TextDecoder();
  for (let k = 0; k < count && u32(b, p) === 0x02014b50; k++) {
    const method = u16(b, p + 10), csize = u32(b, p + 20), nlen = u16(b, p + 28), xlen = u16(b, p + 30), clen = u16(b, p + 32), local = u32(b, p + 42);
    const name = dec.decode(b.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    if (name.endsWith('/')) continue;
    const start = local + 30 + u16(b, local + 26) + u16(b, local + 28);
    const data = b.subarray(start, start + csize);
    out.push({ name, read: async () => (method === 0 ? data : method === 8 ? inflateRaw(data) : Promise.reject(new Error(`${name}: 지원하지 않는 압축 방식`))) });
  }
  return out;
}

/** zip 안의 기판 파일들 (안쪽 zip 한 겹까지) → [{ name, text }] */
export async function boardsFromZip(bytes, depth = 0) {
  if (depth > 1) return [];
  if (bytes.byteLength > 40 * 1024 * 1024) throw new Error('40MB 이하 압축 자료만 열 수 있습니다.');
  const found = [];
  for (const e of listZip(bytes)) {
    if (/\.(kicad_pcb|pcb|asc|opj)$/i.test(e.name)) {
      const data = await e.read();
      if (data.byteLength > 40 * 1024 * 1024) throw new Error(`${e.name}: 40MB 이하 파일만 열 수 있습니다.`);
      found.push({ name: e.name, bytes: data });
    } else if (/\.zip$/i.test(e.name) && !/gerber/i.test(e.name)) {
      for (const x of await boardsFromZip(await e.read(), depth + 1)) found.push({ ...x, name: `${e.name}/${x.name}` });
    }
  }
  return found;
}