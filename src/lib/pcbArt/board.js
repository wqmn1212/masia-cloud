// PCB 아트웍 모델: KiCad 7 .kicad_pcb 읽기 → 화면·검사·시뮬레이션용 모델, 편집(이동·회전·뒤집기·배선·비아) → 다시 .kicad_pcb
// 부품 안쪽(패드·실크)은 원래 파일 노드를 그대로 두고 위치·방향만 바꾼다 (정보를 잃지 않게).
// 트랙·비아는 모델이 기준이고 내보낼 때 새로 쓴다. 동박면(zone)은 편집하면 채움이 낡아 내보낼 때 채움을 지운다(KiCad 에서 B 로 다시 채움).
import { parse, print, q, kids, kid, str } from '../hw/sexpr.js';
import { rot, arcPoints, chainLoops, circlePoly } from './geom.js';

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const r4 = (v) => Math.round(v * 10000) / 10000;
const xy = (n) => (n ? [num(n[1]), num(n[2])] : [0, 0]);
const layerList = (n) => (n ? n.slice(1).map(str) : []);

/** 패드가 걸치는 구리층 (*.Cu 는 모든 구리층) */
export function padCopper(layers, copper) {
  const out = new Set();
  for (const l of layers) {
    if (l === '*.Cu') copper.forEach((c) => out.add(c));
    else if (l === 'F&B.Cu') { out.add('F.Cu'); out.add('B.Cu'); }
    else if (copper.includes(l)) out.add(l);
  }
  return [...out];
}

function readPad(n, fp, copper) {
  const at = kid(n, 'at') || ['at', 0, 0, 0];
  const size = kid(n, 'size') || ['size', 0, 0];
  const drill = kid(n, 'drill');
  const netN = kid(n, 'net');
  const layers = padCopper(layerList(kid(n, 'layers')), copper);
  const local = [num(at[1]), num(at[2])];
  // 파일의 패드 각도는 부품 각도가 더해진 절대 각도다
  const angle = num(at[3]);
  let d = null;
  if (drill) {
    const isOval = str(drill[1]) === 'oval';
    const vals = drill.slice(isOval ? 2 : 1).filter((v) => !Array.isArray(v) && Number.isFinite(Number(str(v)))).map((v) => Number(str(v)));
    d = isOval ? { oval: true, w: vals[0] || 0, h: vals[1] || vals[0] || 0 } : { w: vals[0] || 0, h: vals[0] || 0 };
  }
  const c = rot(local, fp.rot);
  return {
    num: str(n[1]), type: str(n[2]), shape: str(n[3]), local, angle, at: [r4(fp.x + c[0]), r4(fp.y + c[1])],
    size: { w: num(size[1]), h: num(size[2], num(size[1])) }, drill: d, layers,
    net: netN ? num(netN[1]) : 0, netName: netN ? str(netN[2]) : '', rratio: num(kid(n, 'roundrect_rratio')?.[1], 0),
    zoneConnect: kid(n, 'zone_connect') ? num(kid(n, 'zone_connect')[1]) : null, // 0 없음, 1 서멀, 2 꽉
    ref: fp.ref, fpIndex: fp.index,
  };
}

function readGraphic(n, layerFilter) {
  const layer = str(kid(n, 'layer')?.[1]);
  if (layerFilter && !layerFilter(layer)) return null;
  const width = num(kid(kid(n, 'stroke'), 'width')?.[1], num(kid(n, 'width')?.[1], 0.1));
  const h = n[0].replace(/^(gr|fp)_/, '');
  if (h === 'line') return { kind: 'line', layer, width, pts: [xy(kid(n, 'start')), xy(kid(n, 'end'))] };
  if (h === 'rect') { const [a, b] = [xy(kid(n, 'start')), xy(kid(n, 'end'))]; return { kind: 'poly', layer, width, closed: true, pts: [a, [b[0], a[1]], b, [a[0], b[1]]] }; }
  if (h === 'circle') { const c = xy(kid(n, 'center')), e = xy(kid(n, 'end')); return { kind: 'circle', layer, width, c, r: Math.hypot(e[0] - c[0], e[1] - c[1]) }; }
  if (h === 'arc') return { kind: 'line', layer, width, pts: arcPoints(xy(kid(n, 'start')), xy(kid(n, 'mid')), xy(kid(n, 'end'))) };
  if (h === 'poly') return { kind: 'poly', layer, width, closed: true, pts: kids(kid(n, 'pts'), 'xy').map(xy) };
  return null;
}

/** 부품 하나 (원래 노드에서 다시 읽는다) */
function readFootprint(node, index, copper) {
  const at = kid(node, 'at') || ['at', 0, 0, 0];
  const props = Object.fromEntries(kids(node, 'property').map((p) => [str(p[1]), str(p[2])]));
  const texts = Object.fromEntries(kids(node, 'fp_text').map((t) => [str(t[1]), str(t[2])]));
  const fp = { index, node, lib: str(node[1]), side: str(kid(node, 'layer')?.[1]) === 'B.Cu' ? 'B' : 'F', x: num(at[1]), y: num(at[2]), rot: num(at[3]), ref: props.Reference || texts.reference || '', value: props.Value || texts.value || '' };
  fp.pads = kids(node, 'pad').map((p) => readPad(p, fp, copper));
  // 부품 그림(실크·외형·코트야드): 부품 좌표 → 절대 좌표
  const toAbs = (p) => { const c = rot(p, fp.rot); return [fp.x + c[0], fp.y + c[1]]; };
  fp.graphics = node.filter((c) => Array.isArray(c) && /^fp_(line|rect|circle|arc|poly)$/.test(c[0])).map((c) => readGraphic(c)).filter(Boolean)
    .map((g) => (g.kind === 'circle' ? { ...g, c: toAbs(g.c) } : { ...g, pts: g.pts.map(toAbs) }));
  // 부품 안의 금지 구역(안테나 아래 등): 라이브러리에서 그대로 온 것은 부품 좌표, KiCad 가 저장한 것은 기판 좌표다 — 원점에 더 가까운 쪽으로 판단
  fp.zones = kids(node, 'zone').map(readZone).map((z) => {
    const c = z.outline.length ? z.outline.reduce((a, p) => [a[0] + p[0] / z.outline.length, a[1] + p[1] / z.outline.length], [0, 0]) : [0, 0];
    const local = Math.hypot(c[0], c[1]) < Math.hypot(c[0] - fp.x, c[1] - fp.y);
    return local ? { ...z, outline: z.outline.map(toAbs), fills: [] } : z;
  });
  return fp;
}

function readZone(n) {
  const netN = kid(n, 'net');
  const layers = kid(n, 'layers') ? layerList(kid(n, 'layers')) : [str(kid(n, 'layer')?.[1])];
  const cp = kid(n, 'connect_pads');
  const mode = cp && typeof cp[1] === 'string' ? cp[1] : (cp && cp[1] && !Array.isArray(cp[1]) ? str(cp[1]) : 'thermal');
  const fill = kid(n, 'fill');
  const keep = kid(n, 'keepout');
  return {
    net: netN ? num(netN[1]) : 0, netName: str(kid(n, 'net_name')?.[1] || ''), layers,
    connect: mode === 'yes' ? 'solid' : mode === 'no' ? 'none' : mode === 'thru_hole_only' ? 'thru_hole_only' : 'thermal',
    clearance: num(kid(cp, 'clearance')?.[1], 0.5), minThickness: num(kid(n, 'min_thickness')?.[1], 0.25),
    thermalGap: num(kid(fill, 'thermal_gap')?.[1], 0.5), thermalBridge: num(kid(fill, 'thermal_bridge_width')?.[1], 0.5),
    keepout: keep ? Object.fromEntries(keep.slice(1).filter(Array.isArray).map((k) => [k[0], str(k[1])])) : null,
    outline: kids(kid(n, 'polygon'), 'pts').flatMap((p) => kids(p, 'xy').map(xy)),
    fills: kids(n, 'filled_polygon').map((f) => ({ layer: str(kid(f, 'layer')?.[1]), pts: kids(kid(f, 'pts'), 'xy').map(xy) })),
  };
}

let seq = 0;
const nid = (p) => `${p}${(seq += 1).toString(36)}`;

/** .kicad_pcb 글 → 모델 */
export function parseBoard(text) {
  const doc = parse(text)[0];
  if (!Array.isArray(doc) || doc[0] !== 'kicad_pcb') throw new Error('KiCad 기판 파일(.kicad_pcb)이 아닙니다');
  const copper = [];
  for (const l of (kid(doc, 'layers') || []).slice(1)) if (Array.isArray(l) && ['signal', 'power', 'mixed', 'jumper'].includes(str(l[2]))) copper.push(str(l[1]));
  if (!copper.length) copper.push('F.Cu', 'B.Cu');
  const nets = new Map(kids(doc, 'net').map((n) => [num(n[1]), str(n[2])]));
  const footprints = kids(doc, 'footprint').map((n, i) => readFootprint(n, i, copper));
  // 외곽: 기판 그림 + 부품 안의 Edge.Cuts
  const isEdge = (l) => l === 'Edge.Cuts';
  const edgeG = [...doc.filter((c) => Array.isArray(c) && /^gr_(line|rect|circle|arc|poly)$/.test(c[0])).map((c) => readGraphic(c, isEdge)).filter(Boolean),
    ...footprints.flatMap((f) => f.graphics.filter((g) => isEdge(g.layer)))];
  const open = edgeG.filter((g) => g.kind === 'line').map((g) => g.pts);
  const closed = edgeG.filter((g) => g.kind === 'poly').map((g) => g.pts);
  const loops = [...chainLoops(open), ...closed, ...edgeG.filter((g) => g.kind === 'circle').map((g) => circlePoly(g.c, g.r, 32))];
  const tracks = [];
  for (const s of kids(doc, 'segment')) tracks.push({ id: nid('t'), a: xy(kid(s, 'start')), b: xy(kid(s, 'end')), w: num(kid(s, 'width')?.[1], 0.25), layer: str(kid(s, 'layer')?.[1]), net: num(kid(s, 'net')?.[1]) });
  // 원호 트랙은 짧은 선분으로 나눈다 (내보낼 때 선분으로 쓴다)
  for (const s of kids(doc, 'arc')) {
    const pts = arcPoints(xy(kid(s, 'start')), xy(kid(s, 'mid')), xy(kid(s, 'end')), 8);
    for (let i = 1; i < pts.length; i++) tracks.push({ id: nid('t'), a: pts[i - 1], b: pts[i], w: num(kid(s, 'width')?.[1], 0.25), layer: str(kid(s, 'layer')?.[1]), net: num(kid(s, 'net')?.[1]) });
  }
  const vias = kids(doc, 'via').map((v) => ({ id: nid('v'), at: xy(kid(v, 'at')), size: num(kid(v, 'size')?.[1], 0.6), drill: num(kid(v, 'drill')?.[1], 0.3), layers: layerList(kid(v, 'layers')).length ? layerList(kid(v, 'layers')) : ['F.Cu', 'B.Cu'], net: num(kid(v, 'net')?.[1]) }));
  // 기판 두께·동박 두께 (stackup 이 있으면)
  const stack = kid(kid(doc, 'setup'), 'stackup');
  const cuT = stack ? kids(stack, 'layer').filter((l) => str(l[1]).endsWith('.Cu')).map((l) => num(kid(l, 'thickness')?.[1], 0.035)) : [];
  return {
    doc, copper, nets, footprints, tracks, vias,
    zones: kids(doc, 'zone').map(readZone),
    outline: loops.sort((a, b) => b.length - a.length),
    graphics: doc.filter((c) => Array.isArray(c) && /^gr_(line|rect|circle|arc|poly)$/.test(c[0])).map((c) => readGraphic(c, (l) => !isEdge(l))).filter(Boolean),
    thickness: num(kid(kid(doc, 'general'), 'thickness')?.[1], 1.6),
    copperMm: cuT[0] || 0.035,
    fillsStale: false,
  };
}

export const allPads = (b) => b.footprints.flatMap((f) => f.pads);
/** 금지 구역 (기판 + 부품 안): { outline, layers, keepout:{tracks, vias, copperpour, pads}, ref } */
export const keepouts = (b) => [...b.zones.filter((z) => z.keepout), ...b.footprints.flatMap((f) => f.zones.filter((z) => z.keepout).map((z) => ({ ...z, ref: f.ref })))];
export const netName = (b, id) => b.nets.get(id) || (id ? `넷 ${id}` : '(없음)');
export const netId = (b, name) => [...b.nets.entries()].find(([, n]) => n === name)?.[0] ?? 0;

/** 패드 동박 모양 (절대 좌표) */
export function padShape(p) {
  const { w, h } = p.size;
  if (p.shape === 'circle') return { kind: 'cap', a: p.at, b: p.at, r: w / 2 };
  if (p.shape === 'oval') {
    const long = Math.max(w, h), short = Math.min(w, h), half = (long - short) / 2;
    const dir = w >= h ? [half, 0] : [0, half];
    const d = rot(dir, p.angle);
    return { kind: 'cap', a: [p.at[0] - d[0], p.at[1] - d[1]], b: [p.at[0] + d[0], p.at[1] + d[1]], r: short / 2 };
  }
  const pts = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map((c) => { const r = rot(c, p.angle); return [p.at[0] + r[0], p.at[1] + r[1]]; });
  return { kind: 'poly', pts };
}
export const trackShape = (t) => ({ kind: 'cap', a: t.a, b: t.b, r: t.w / 2 });
export const viaShape = (v) => ({ kind: 'cap', a: v.at, b: v.at, r: v.size / 2 });

// ───────────── 편집 (모델을 새로 만들어 돌려준다 — 되돌리기를 쉽게)
const clone = (b) => ({ ...b, footprints: [...b.footprints], tracks: [...b.tracks], vias: [...b.vias] });
const setAt = (node, x, y, r) => node.map((c) => (Array.isArray(c) && c[0] === 'at' ? ['at', r4(x), r4(y), ((r % 360) + 360) % 360] : c));

/** 부품 이동·회전 (rot 은 절대 각도). 패드 각도도 같이 돈다 */
export function placeFootprint(b, index, { x, y, rot: r }) {
  const fp = b.footprints[index];
  const nr = r ?? fp.rot, dr = nr - fp.rot;
  let node = setAt(fp.node, x ?? fp.x, y ?? fp.y, nr);
  if (dr) node = node.map((c) => (Array.isArray(c) && (c[0] === 'pad' || c[0] === 'fp_text') ? c.map((v) => (Array.isArray(v) && v[0] === 'at' ? ['at', v[1], v[2], (((num(v[3]) + dr) % 360) + 360) % 360] : v)) : c));
  const out = clone(b);
  out.footprints[index] = readFootprint(node, index, b.copper);
  out.fillsStale = true;
  return out;
}

const swapLayer = (l) => (l.startsWith('F.') ? `B.${l.slice(2)}` : l.startsWith('B.') ? `F.${l.slice(2)}` : l);
function flipNodeY(n) {
  if (!Array.isArray(n)) return n;
  const h = n[0];
  if (['at', 'start', 'end', 'center', 'mid', 'xy'].includes(h)) { const r = [h, n[1], -num(n[2])]; if (h === 'at' && n.length > 3) r.push(n[3]); return r; }
  if (h === 'layer' || h === 'layers') return [h, ...n.slice(1).map((v) => (v && typeof v === 'object' && 's' in v ? q(swapLayer(v.s)) : v))];
  if (h === 'model') return n;
  return n.map((v, i) => (i === 0 ? v : flipNodeY(v)));
}
/** 앞면 ↔ 뒷면 (KiCad 와 같이 부품 좌표의 y 를 뒤집고 층을 바꾼다) */
export function flipFootprint(b, index) {
  const fp = b.footprints[index];
  const node = fp.node.map((c, i) => {
    if (i < 2 || !Array.isArray(c)) return c;
    if (c[0] === 'at') return c;
    if (c[0] === 'layer') return ['layer', q(fp.side === 'F' ? 'B.Cu' : 'F.Cu')];
    if (c[0] === 'pad') {
      // 패드 각도: 부품 각도를 뺀 자기 각도를 뒤집고 다시 더한다
      const f = flipNodeY(c);
      return f.map((v) => (Array.isArray(v) && v[0] === 'at' ? ['at', v[1], v[2], (((2 * fp.rot - num(v[3])) % 360) + 360) % 360] : v));
    }
    if (/^fp_|^property$|^zone$/.test(c[0])) return flipNodeY(c);
    return c;
  });
  const out = clone(b);
  out.footprints[index] = readFootprint(node, index, b.copper);
  out.fillsStale = true;
  return out;
}

export function addTrack(b, t) { const out = clone(b); out.tracks.push({ id: nid('t'), ...t }); out.fillsStale = true; return out; }
export function addVia(b, v) { const out = clone(b); out.vias.push({ id: nid('v'), size: 0.6, drill: 0.3, layers: ['F.Cu', 'B.Cu'], ...v }); out.fillsStale = true; return out; }
export function removeItems(b, ids) { const s = new Set(ids); const out = clone(b); out.tracks = b.tracks.filter((t) => !s.has(t.id)); out.vias = b.vias.filter((v) => !s.has(v.id)); out.fillsStale = true; return out; }
export function updateTrack(b, id, patch) { const out = clone(b); out.tracks = b.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)); out.fillsStale = true; return out; }

/** 모델 → .kicad_pcb 글. 부품 노드는 바뀐 것으로, 트랙·비아는 새로, 낡은 동박 채움은 지운다 */
export function toKicadText(b) {
  const fpQueue = [...b.footprints];
  const body = [];
  for (const c of b.doc) {
    if (!Array.isArray(c)) { body.push(c); continue; }
    if (c[0] === 'footprint') { body.push(fpQueue.shift().node); continue; }
    if (c[0] === 'segment' || c[0] === 'arc' || c[0] === 'via') continue;
    if (c[0] === 'zone' && b.fillsStale) { body.push(c.filter((z) => !(Array.isArray(z) && z[0] === 'filled_polygon'))); continue; }
    body.push(c);
  }
  for (const t of b.tracks) body.push(['segment', ['start', r4(t.a[0]), r4(t.a[1])], ['end', r4(t.b[0]), r4(t.b[1])], ['width', r4(t.w)], ['layer', q(t.layer)], ['net', t.net]]);
  for (const v of b.vias) body.push(['via', ['at', r4(v.at[0]), r4(v.at[1])], ['size', r4(v.size)], ['drill', r4(v.drill)], ['layers', ...v.layers.map(q)], ['net', v.net]]);
  return `${print(body)}\n`;
}

/** 요약 (화면 머리) */
export function boardStats(b) {
  const xs = b.outline[0] || [];
  const w = xs.length ? Math.max(...xs.map((p) => p[0])) - Math.min(...xs.map((p) => p[0])) : 0;
  const h = xs.length ? Math.max(...xs.map((p) => p[1])) - Math.min(...xs.map((p) => p[1])) : 0;
  return { w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10, layers: b.copper.length, parts: b.footprints.length, nets: [...b.nets.keys()].filter((k) => k > 0).length, tracks: b.tracks.length, vias: b.vias.length, zones: b.zones.length };
}
