// 압축하지 않는(STORE) ZIP 만들기. 새 패키지 없이 서류함에서 여러 파일을 한 번에 내려받는다 (PDF·이미지는 이미 압축돼 있어 크기 차이가 작다).
// 파일 이름은 UTF-8 로 적는다 (한글 이름이 깨지지 않게 플래그 0x0800). 4GB·65,535개를 넘는 ZIP64 는 지원하지 않는다.
// 검산: npm run check:zip-store
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// DOS 날짜·시각 (ZIP 은 2초 단위)
const dosTime = (d) => ((d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2)) & 0xffff;
const dosDate = (d) => (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;

// 폴더·파일 이름에 쓸 수 없는 글자를 바꾸고, 같은 이름은 ' (2)'를 붙여 겹치지 않게 한다
export const safeName = (s) => String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || '이름 없음';
export function uniquePaths(paths) {
  const seen = new Map();
  return paths.map((p) => {
    const key = p.toLowerCase();
    const n = (seen.get(key) || 0) + 1;
    seen.set(key, n);
    if (n === 1) return p;
    const dot = p.lastIndexOf('.');
    const slash = p.lastIndexOf('/');
    return dot > slash + 1 ? `${p.slice(0, dot)} (${n})${p.slice(dot)}` : `${p} (${n})`;
  });
}

/**
 * @param files  [{ name: '폴더/파일.pdf', data: Uint8Array, date?: Date }]
 * @returns Uint8Array (ZIP 파일 내용)
 */
export function makeZip(files) {
  const enc = new TextEncoder();
  const entries = files.map((f) => {
    const name = enc.encode(f.name);
    const d = f.date instanceof Date && !Number.isNaN(f.date.getTime()) && f.date.getFullYear() >= 1980 ? f.date : new Date();
    return { name, data: f.data, crc: crc32(f.data), time: dosTime(d), date: dosDate(d) };
  });
  const localSize = entries.reduce((n, e) => n + 30 + e.name.length + e.data.length, 0);
  const centralSize = entries.reduce((n, e) => n + 46 + e.name.length, 0);
  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);
  let p = 0;
  const u16 = (v) => { view.setUint16(p, v, true); p += 2; };
  const u32 = (v) => { view.setUint32(p, v >>> 0, true); p += 4; };
  const bytes = (b) => { out.set(b, p); p += b.length; };
  const offsets = [];
  for (const e of entries) {
    offsets.push(p);
    u32(0x04034b50); u16(20); u16(0x0800); u16(0); u16(e.time); u16(e.date);
    u32(e.crc); u32(e.data.length); u32(e.data.length); u16(e.name.length); u16(0);
    bytes(e.name); bytes(e.data);
  }
  const centralStart = p;
  entries.forEach((e, i) => {
    u32(0x02014b50); u16(20); u16(20); u16(0x0800); u16(0); u16(e.time); u16(e.date);
    u32(e.crc); u32(e.data.length); u32(e.data.length); u16(e.name.length); u16(0); u16(0); u16(0); u16(0); u32(0); u32(offsets[i]);
    bytes(e.name);
  });
  const centralLength = p - centralStart;
  u32(0x06054b50); u16(0); u16(0); u16(entries.length); u16(entries.length); u32(centralLength); u32(centralStart); u16(0);
  return out;
}
