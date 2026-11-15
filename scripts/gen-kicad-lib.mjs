// KiCad 7 기본 라이브러리에서 회로도 내보내기에 쓰는 기호·실장 모양만 뽑아 src/lib/hw/kicadLib.data.js 로 쓴다.
// 실행: node scripts/gen-kicad-lib.mjs  (KiCad 라이브러리가 /usr/share/kicad 에 있어야 한다: apt install kicad-symbols kicad-footprints)
// 앱은 이 파일만 쓰므로 브라우저에 KiCad 가 없어도 된다. 라이브러리 라이선스: CC-BY-SA 4.0 + 설계 예외 (내보낸 설계에는 제약 없음).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, print, kids, kid, str, q } from '../src/lib/hw/sexpr.js';
import { allLibIds } from '../src/lib/hw/parts.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KI = process.env.KICAD_LIB || '/usr/share/kicad';
const out = path.join(root, 'src/lib/hw/kicadLib.data.js');
const { syms, fps } = allLibIds();

const libCache = new Map();
const lib = (name) => {
  if (!libCache.has(name)) libCache.set(name, parse(fs.readFileSync(path.join(KI, 'symbols', `${name}.kicad_sym`), 'utf8'))[0]);
  return libCache.get(name);
};
const findSym = (L, name) => kids(L, 'symbol').find((s) => str(s[1]) === name);

// 기호 하나를 회로도에 넣을 모양으로: 상속(extends)을 풀고 이름을 'Lib:Name' 으로 바꾼다
function flatten(libName, name) {
  const L = lib(libName);
  const node = findSym(L, name);
  if (!node) throw new Error(`기호 없음 ${libName}:${name}`);
  const ext = kid(node, 'extends');
  let base = node;
  if (ext) {
    const parent = flatten(libName, str(ext[1]));
    const props = new Map(kids(node, 'property').map((p) => [str(p[1]), p]));
    base = parent.node.map((c, i) => {
      if (i === 1) return q(name);
      if (Array.isArray(c) && c[0] === 'property' && props.has(str(c[1]))) return props.get(str(c[1]));
      if (Array.isArray(c) && c[0] === 'symbol') return ['symbol', q(str(c[1]).replace(parent.short, name)), ...c.slice(2)];
      return c;
    });
    return { node: base, short: name };
  }
  return { node: [...node.slice(0, 1), q(name), ...node.slice(2)], short: name };
}

function symbolEntry(id) {
  const [libName, name] = id.split(':');
  const { node } = flatten(libName, name);
  const full = node.map((c, i) => (i === 1 ? q(id) : c));
  const pins = [];
  let units = 1;
  for (const sub of kids(full, 'symbol')) {
    const m = str(sub[1]).match(/_(\d+)_(\d+)$/);
    const unit = m ? Number(m[1]) : 0;
    const style = m ? Number(m[2]) : 1;
    if (style > 1) continue;
    units = Math.max(units, unit);
    for (const p of kids(sub, 'pin')) {
      const at = kid(p, 'at');
      pins.push({ num: str(kid(p, 'number')[1]), name: str(kid(p, 'name')[1]), type: p[1], x: Number(at[1]), y: Number(at[2]), a: Number(at[3] || 0), unit, hidden: p.includes('hide') });
    }
  }
  // 전원 핀만 따로 둔 단위(예: LM393 의 3번 단위)는 회로도에 함께 놓는다
  return { text: print(full, 2), pins, units };
}

function footprintEntry(id) {
  const [libName, name] = id.split(':');
  const text = fs.readFileSync(path.join(KI, 'footprints', `${libName}.pretty`, `${name}.kicad_mod`), 'utf8');
  const node = parse(text)[0];
  const pads = kids(node, 'pad').map((p) => { const at = kid(p, 'at'); return { num: str(p[1]), x: Number(at[1]), y: Number(at[2]) }; });
  // 부품 자리(F.CrtYd) 범위
  // RF 모듈은 안테나 금지 구역까지 넣은 부품 자리(court) 와 모듈 몸체(F.Fab, bbox)를 따로 둔다 (안테나 쪽은 기판 밖으로 나가도 된다)
  const boxOn = (layerName) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (const g of node.filter((c) => Array.isArray(c) && /^fp_(line|rect|circle|arc|poly)$/.test(c[0]))) {
    const layer = kid(g, 'layer');
    if (!layer || str(layer[1]) !== layerName) continue;
    if (g[0] === 'fp_circle') { const c = kid(g, 'center'), e = kid(g, 'end'); const r = Math.hypot(e[1] - c[1], e[2] - c[2]); grow(Number(c[1]) - r, Number(c[2]) - r); grow(Number(c[1]) + r, Number(c[2]) + r); continue; }
    if (g[0] === 'fp_poly') { kids(kid(g, 'pts'), 'xy').forEach((xy) => grow(Number(xy[1]), Number(xy[2]))); continue; }
    ['start', 'end', 'mid'].forEach((k) => { const v = kid(g, k); if (v) grow(Number(v[1]), Number(v[2])); });
  }
  if (!Number.isFinite(x0)) pads.forEach((p) => { grow(p.x - 1, p.y - 1); grow(p.x + 1, p.y + 1); });
  return [x0, y0, x1, y1].map((v) => Math.round(v * 100) / 100);
  };
  const smd = !/\(pad "[^"]*" (np_)?thru_hole/.test(text); // 스루홀 패드가 하나라도 있으면 뒷면도 막는다
  const court = boxOn('F.CrtYd');
  // RF 모듈 몸체: F.Fab 과 패드(+0.25 mm) 를 합친 범위 (가장자리 패드가 몸체 밖으로 조금 나온다)
  let body = court;
  if (libName === 'RF_Module') {
    body = boxOn('F.Fab');
    for (const p of kids(node, 'pad')) {
      const at = kid(p, 'at'), sz = kid(p, 'size');
      if (!sz) continue;
      const hw = Number(sz[1]) / 2 + 0.25, hh = Number(sz[2]) / 2 + 0.25;
      const rot = Number(at[3] || 0) % 180 ? [hh, hw] : [hw, hh];
      body = [Math.min(body[0], Number(at[1]) - rot[0]), Math.min(body[1], Number(at[2]) - rot[1]), Math.max(body[2], Number(at[1]) + rot[0]), Math.max(body[3], Number(at[2]) + rot[1])].map((v) => Math.round(v * 100) / 100);
    }
  }
  return { text: print(node, 1), pads, bbox: body, court, smd };
}

const SYMBOLS = Object.fromEntries(syms.map((id) => [id, symbolEntry(id)]));
const FOOTPRINTS = Object.fromEntries(fps.map((id) => [id, footprintEntry(id)]));
const body = `// 자동 생성 파일 — 고치지 마세요. node scripts/gen-kicad-lib.mjs 로 다시 만듭니다.
// KiCad 7 기본 라이브러리(kicad-symbols · kicad-footprints, CC-BY-SA 4.0 + 설계 예외)에서 뽑은 기호·실장 모양.
export const SYMBOLS = ${JSON.stringify(SYMBOLS)};
export const FOOTPRINTS = ${JSON.stringify(FOOTPRINTS)};
`;
fs.writeFileSync(out, body);
console.log(`기호 ${syms.length}개, 실장 모양 ${fps.length}개 → ${path.relative(root, out)} (${(body.length / 1024).toFixed(0)} KB)`);
