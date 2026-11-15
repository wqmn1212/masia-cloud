// buildHardware 결과 → KiCad 7 프로젝트 (.kicad_sch 회로도 · .kicad_pcb 기판 · .kicad_pro) 와 DXF 외곽.
// 회로도는 부품마다 핀 끝에 넷 이름표를 단다 (선 없이 이름표로 연결 → KiCad 넷리스트가 그대로 나온다).
// 기판은 외곽(Edge.Cuts)·고정 구멍·모든 실장 모양을 외곽 안에 늘어놓고 패드마다 넷을 넣는다 → KiCad 에서 배선만 하면 된다.
import { q, print, parse, kids, kid, str } from './sexpr.js';
import { CUSTOM } from './customSymbols.js';
import { inPoly, polyArea } from '../cad/pcbLayout.js';

// ───────────────────────── 공통
function rng(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function uuidGen(seed) {
  const r = rng(seed);
  return () => {
    const hex = Array.from({ length: 32 }, () => Math.floor(r() * 16).toString(16));
    hex[12] = '4'; hex[16] = '89ab'[Math.floor(r() * 4)];
    const s = hex.join('');
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
  };
}
const font = (size = 1.27, ...more) => ['effects', ['font', ['size', size, size]], ...more];
const snap = (v, g = 2.54) => Math.round(v / g) * g;
const ascii = (t) => /^[\x20-\x7e]*$/.test(String(t || ''));
/** KiCad 에 쓰는 값: 한글이 들어 있으면 부품 검색 이름(영문)으로 (한글은 Note 속성에 남긴다) */
export const kicadValue = (c) => (ascii(c.value) ? c.value : ascii(c.part.search) && c.part.search ? c.part.search : String(c.value).replace(/[^\x20-\x7e]/g, '').trim() || c.part.cat);

// ───────────────────────── 기호 (기본 라이브러리 + 사각 기호)
function customSymbol(id) {
  const def = CUSTOM[id];
  const short = id.split(':')[1];
  const n = Math.max(def.left.length, def.right.length);
  const longest = Math.max(...[...def.left, ...def.right].map((p) => p[1].length));
  const w = snap(Math.max(7.62, longest * 1.27 + 2.54)), h = snap((n + 1) * 2.54 / 2 + 1.27, 2.54);
  const pins = [];
  const pinNodes = [];
  const side = (list, x, a) => list.forEach(([num, name, type], i) => {
    const y = h - 2.54 * (i + 1);
    pins.push({ num, name, type, x, y, a, unit: 1, hidden: false });
    pinNodes.push(['pin', type, 'line', ['at', x, y, a], ['length', 2.54], ['name', q(name), font()], ['number', q(num), font()]]);
  });
  side(def.left, -w - 2.54, 0);
  side(def.right, w + 2.54, 180);
  const node = ['symbol', q(id), ['in_bom', 'yes'], ['on_board', 'yes'],
    ['property', q('Reference'), q(def.ref), ['at', 0, h + 1.27, 0], font()],
    ['property', q('Value'), q(short), ['at', 0, -h - 1.27, 0], font()],
    ['property', q('Footprint'), q(''), ['at', 0, 0, 0], font(1.27, 'hide')],
    ['property', q('Datasheet'), q(''), ['at', 0, 0, 0], font(1.27, 'hide')],
    ['symbol', q(`${short}_0_1`), ['rectangle', ['start', -w, h], ['end', w, -h], ['stroke', ['width', 0.254], ['type', 'default']], ['fill', ['type', 'background']]]],
    ['symbol', q(`${short}_1_1`), ...pinNodes]];
  return { text: print(node, 2), pins, units: 1 };
}
const symOf = (lib, id) => (id.startsWith('custom:') ? customSymbol(id) : lib.SYMBOLS[id]);

function symBox(sym, unit) {
  const ps = sym.pins.filter((p) => !unit || p.unit === unit || p.unit === 0);
  let x0 = -2.54, x1 = 2.54, y0 = -2.54, y1 = 2.54;
  ps.forEach((p) => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
  return { x0, x1, y0, y1 };
}

// ───────────────────────── 회로도
export function toKicadSch(hw, lib, { title = 'AEGIS prototype', project = 'aegis', date = '', seed = 'x' } = {}) {
  const uuid = uuidGen(`sch|${seed}`);
  const rootUuid = uuid();
  const libIds = new Set(['power:PWR_FLAG']);
  hw.comps.forEach((c) => c.part.sym && libIds.add(c.part.sym));
  const syms = Object.fromEntries([...libIds].map((id) => [id, symOf(lib, id)]));
  const items = [];
  const placed = []; // { ref, uuid, unit, x, y }
  const labelLen = (s) => s.length * 1.05 + 2.5;

  // 블록마다 카드 하나: 부품을 가로로 늘어놓는다
  const cards = hw.blocks.map((b) => {
    const cells = [];
    b.refs.forEach((c) => {
      if (!c.part.sym) return;
      const sym = syms[c.part.sym];
      const units = sym.units > 1 ? Array.from({ length: sym.units }, (_, i) => i + 1) : [1];
      units.forEach((unit) => {
        const bx = symBox(sym, sym.units > 1 ? unit : 0);
        const nets = sym.pins.filter((p) => (sym.units <= 1 || p.unit === unit || p.unit === 0)).map((p) => c.conns[p.num] || '');
        const lab = Math.max(4, ...nets.map(labelLen));
        cells.push({ c, unit, bx, w: snap(bx.x1 - bx.x0 + 2 * lab + 5.08), h: snap(bx.y1 - bx.y0 + 10.16) });
      });
    });
    const maxW = 160;
    let x = 0, y = 0, rowH = 0, W = 0;
    cells.forEach((cell) => {
      if (x > 0 && x + cell.w > maxW) { x = 0; y += rowH; rowH = 0; }
      cell.ox = x; cell.oy = y;
      x += cell.w; rowH = Math.max(rowH, cell.h); W = Math.max(W, x);
    });
    return { b, cells, w: Math.max(W, 60), h: y + rowH + 7.62 };
  });
  // 카드를 도면에 쌓는다 (용지 크기는 들어가는 것으로)
  const papers = [['A3', 420, 297], ['A2', 594, 420], ['A1', 841, 594], ['A0', 1189, 841]];
  let paper, layout;
  for (const [name, PW, PH] of papers) {
    let x = 12.7, y = 25.4, colW = 0;
    const pos = [];
    for (const card of cards) {
      if (y + card.h > PH - 40 && y > 25.4) { x += colW + 10.16; y = 25.4; colW = 0; }
      pos.push({ x: snap(x), y: snap(y) });
      y += card.h + 5.08; colW = Math.max(colW, card.w);
    }
    if (x + colW < PW - 12.7 || name === 'A0') { paper = name; layout = pos; break; }
  }
  cards.forEach((card, i) => {
    const { x: cx, y: cy } = layout[i];
    items.push(['text', q(card.b.en || card.b.name), ['at', cx, cy, 0], font(2, ['justify', 'left', 'bottom']), ['uuid', q(uuid())]]);
    card.cells.forEach((cell) => {
      const { c, unit, bx } = cell;
      const sym = syms[c.part.sym];
      // 기호 원점: 칸 안에서 왼쪽 이름표 자리를 뺀 곳
      const lab = (cell.w - (bx.x1 - bx.x0)) / 2;
      const sx = snap(cx + cell.ox + lab - bx.x0), sy = snap(cy + 5.08 + cell.oy + bx.y1 + 2.54);
      const u = uuid();
      placed.push({ ref: c.ref, uuid: u, unit });
      const multi = sym.units > 1;
      const pins = sym.pins.filter((p) => !multi || p.unit === unit || p.unit === 0);
      const props = [
        ['property', q('Reference'), q(c.ref), ['at', sx + bx.x1 + 1.27, sy - bx.y1, 0], font(1.27, ['justify', 'left'])],
        ['property', q('Value'), q(kicadValue(c)), ['at', sx + bx.x1 + 1.27, sy - bx.y1 + 2.54, 0], font(1.27, ['justify', 'left'])],
        ['property', q('Footprint'), q(c.part.fp || ''), ['at', sx, sy, 0], font(1.27, 'hide')],
        ['property', q('Datasheet'), q('~'), ['at', sx, sy, 0], font(1.27, 'hide')],
        ['property', q('LCSC'), q(c.part.lcsc || ''), ['at', sx, sy, 0], font(1.27, 'hide')],
      ];
      const note = [ascii(c.value) ? '' : c.value, c.note].filter(Boolean).join(' · ');
      if (note) props.push(['property', q('Note'), q(note), ['at', sx, sy, 0], font(1.27, 'hide')]);
      items.push(['symbol', ['lib_id', q(c.part.sym)], ['at', sx, sy, 0], ['unit', unit], ['in_bom', 'yes'], ['on_board', 'yes'], ['dnp', 'no'], ['uuid', q(u)],
        ...props, ...pins.map((p) => ['pin', q(p.num), ['uuid', q(uuid())]]),
        ['instances', ['project', q(project), ['path', q(`/${rootUuid}`), ['reference', q(c.ref)], ['unit', unit]]]]]);
      // 핀 끝 이름표 (같은 자리에 겹친 숨은 핀은 한 번만)
      const done = new Set();
      for (const p of pins) {
        const px = Math.round((sx + p.x) * 100) / 100, py = Math.round((sy - p.y) * 100) / 100;
        const key = `${px},${py}`;
        const net = c.conns[p.num];
        if (done.has(key)) continue;
        const stackedNet = net || pins.filter((o) => o !== p && Math.abs(o.x - p.x) < 1e-6 && Math.abs(o.y - p.y) < 1e-6).map((o) => c.conns[o.num]).find(Boolean);
        if (stackedNet) {
          done.add(key);
          const ang = (p.a + 180) % 360;
          items.push(['label', q(stackedNet), ['at', px, py, ang], ['fields_autoplaced'], font(1.27, ['justify', ang === 180 || ang === 270 ? 'right' : 'left', 'bottom']), ['uuid', q(uuid())]]);
        } else if (!p.hidden && p.type !== 'no_connect') {
          done.add(key);
          items.push(['no_connect', ['at', px, py], ['uuid', q(uuid())]]);
        }
      }
    });
  });
  // 전원 플래그: 전원 입력 핀만 있는 넷이 "구동원 없음"으로 잡히지 않게
  const fx = 12.7;
  let fy = snap(({ A3: 297, A2: 420, A1: 594, A0: 841 })[paper] - 30);
  items.push(['text', q('PWR_FLAG'), ['at', fx, fy - 5.08, 0], font(1.27, ['justify', 'left', 'bottom']), ['uuid', q(uuid())]]);
  hw.powerFlags.forEach((net, i) => {
    const x = snap(fx + i * 20.32);
    items.push(['symbol', ['lib_id', q('power:PWR_FLAG')], ['at', x, fy, 0], ['unit', 1], ['in_bom', 'yes'], ['on_board', 'yes'], ['dnp', 'no'], ['uuid', q(uuid())],
      ['property', q('Reference'), q(`#FLG0${i + 1}`), ['at', x, fy - 1.905, 0], font(1.27, 'hide')],
      ['property', q('Value'), q('PWR_FLAG'), ['at', x, fy - 3.81, 0], font()],
      ['property', q('Footprint'), q(''), ['at', x, fy, 0], font(1.27, 'hide')],
      ['property', q('Datasheet'), q('~'), ['at', x, fy, 0], font(1.27, 'hide')],
      ['pin', q('1'), ['uuid', q(uuid())]],
      ['instances', ['project', q(project), ['path', q(`/${rootUuid}`), ['reference', q(`#FLG0${i + 1}`)], ['unit', 1]]]]]);
    items.push(['label', q(net), ['at', x, fy, 270], ['fields_autoplaced'], font(1.27, ['justify', 'right', 'bottom']), ['uuid', q(uuid())]]);
  });

  const libNodes = [...libIds].map((id) => parse(syms[id].text)[0]);
  const doc = ['kicad_sch', ['version', 20230121], ['generator', 'eeschema'], ['uuid', q(rootUuid)], ['paper', q(paper)],
    ['title_block', ['title', q(title)], ['date', q(date)], ['rev', q('0.1')], ['company', q('AEGIS prototype workbench')], ['comment', 1, q('Auto-generated draft - review before PCB release')]],
    ['lib_symbols', ...libNodes], ...items,
    ['sheet_instances', ['path', q('/'), ['page', q('1')]]]];
  return { text: `${print(doc)}\n`, placed, rootUuid, paper };
}

// ───────────────────────── 기판
const LAYERS = [[0, 'F.Cu', 'signal'], [31, 'B.Cu', 'signal'], [32, 'B.Adhes', 'user', 'B.Adhesive'], [33, 'F.Adhes', 'user', 'F.Adhesive'], [34, 'B.Paste', 'user'], [35, 'F.Paste', 'user'], [36, 'B.SilkS', 'user', 'B.Silkscreen'], [37, 'F.SilkS', 'user', 'F.Silkscreen'], [38, 'B.Mask', 'user'], [39, 'F.Mask', 'user'], [40, 'Dwgs.User', 'user', 'User.Drawings'], [41, 'Cmts.User', 'user', 'User.Comments'], [42, 'Eco1.User', 'user', 'User.Eco1'], [43, 'Eco2.User', 'user', 'User.Eco2'], [44, 'Edge.Cuts', 'user'], [45, 'Margin', 'user'], [46, 'B.CrtYd', 'user', 'B.Courtyard'], [47, 'F.CrtYd', 'user', 'F.Courtyard'], [48, 'B.Fab', 'user'], [49, 'F.Fab', 'user']];
const HOLE_FP = (d) => (d <= 2.3 ? 'MountingHole:MountingHole_2.2mm_M2' : d <= 2.9 ? 'MountingHole:MountingHole_2.7mm_M2.5' : 'MountingHole:MountingHole_3.2mm_M3');

/** 부품 자리 정하기: 고정 자리(앵커) 먼저, 나머지는 외곽 안에 위에서부터 채운다 (0.5 mm 격자, 앞면 → 작은 SMD 는 뒷면) */
export function placeParts(hw, lib, layout) {
  const out = [];
  const pts = layout.outline;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const bb = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const EDGE = 0.7; // 구리 ~ 기판 가장자리 0.5 mm + 여유
  const GAP = 0.3; // 부품 사이
  const G = 0.5;
  const NX = Math.ceil((bb[2] - bb[0]) / G), NY = Math.ceil((bb[3] - bb[1]) / G);
  const holes = layout.holes.map((h) => ({ x: h.x, y: h.y, r: h.d / 2 + (h.keep || 1) }));
  const segDist = (px, py) => {
    let d = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
      const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / L));
      d = Math.min(d, Math.hypot(px - x1 - t * dx, py - y1 - t * dy));
    }
    return d;
  };
  // 기본 막힘: 외곽 밖·가장자리 여유·구멍
  const base = new Uint8Array(NX * NY);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const x = bb[0] + (i + 0.5) * G, y = bb[1] + (j + 0.5) * G;
    const ok = inPoly(pts, x, y) && segDist(x, y) >= EDGE + G / 2 && !holes.some((h) => Math.hypot(x - h.x, y - h.y) < h.r + G / 2);
    base[j * NX + i] = ok ? 0 : 1;
  }
  const grids = { F: base.slice(), B: base.slice() };
  const sums = {};
  const rebuild = (side) => {
    const g = grids[side], S = new Int32Array((NX + 1) * (NY + 1));
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) S[(j + 1) * (NX + 1) + i + 1] = g[j * NX + i] + S[j * (NX + 1) + i + 1] + S[(j + 1) * (NX + 1) + i] - S[j * (NX + 1) + i];
    sums[side] = S;
  };
  rebuild('F'); rebuild('B');
  const cellRange = (r, m) => [Math.floor((r[0] - m - bb[0]) / G), Math.floor((r[1] - m - bb[1]) / G), Math.ceil((r[2] + m - bb[0]) / G), Math.ceil((r[3] + m - bb[1]) / G)];
  const freeRect = (r, side) => {
    const [i0, j0, i1, j1] = cellRange(r, GAP);
    if (i0 < 0 || j0 < 0 || i1 > NX || j1 > NY) return false;
    const S = sums[side], W = NX + 1;
    return S[j1 * W + i1] - S[j0 * W + i1] - S[j1 * W + i0] + S[j0 * W + i0] === 0;
  };
  const mark = (r, sides) => {
    const [i0, j0, i1, j1] = cellRange(r, 0);
    for (const side of sides) {
      const g = grids[side];
      for (let j = Math.max(0, j0); j < Math.min(NY, j1); j++) for (let i = Math.max(0, i0); i < Math.min(NX, i1); i++) g[j * NX + i] = 1;
      rebuild(side);
    }
  };
  const rects = []; // 놓은 부품 자리 (앞면)
  const rectOf = (fp, x, y, rot, which = 'bbox') => {
    const [a, b, c, d] = lib.FOOTPRINTS[fp][which] || lib.FOOTPRINTS[fp].bbox; // KiCad 좌표 (y 아래)
    const t = (rot * Math.PI) / 180;
    const corners = [[a, b], [c, b], [c, d], [a, d]].map(([px, py]) => [px * Math.cos(t) + py * Math.sin(t), -px * Math.sin(t) + py * Math.cos(t)]);
    const X = corners.map((p) => p[0]), Y = corners.map((p) => -p[1]); // CAD 좌표 (y 위)
    return [x + Math.min(...X), y + Math.min(...Y), x + Math.max(...X), y + Math.max(...Y)];
  };
  const insideOutline = (r) => {
    const [x0, y0, x1, y1] = [r[0] - EDGE, r[1] - EDGE, r[2] + EDGE, r[3] + EDGE];
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [(x0 + x1) / 2, y0], [(x0 + x1) / 2, y1], [x0, (y0 + y1) / 2], [x1, (y0 + y1) / 2]].every(([x, y]) => inPoly(pts, x, y));
  };
  const sidesOf = (c, side) => (side === 'F' && !lib.FOOTPRINTS[c.part.fp].smd ? ['F', 'B'] : [side]); // 스루홀은 뒷면도 막는다
  const anchors = [...(layout.anchors || [])];
  const takeAnchor = (kind) => { const i = anchors.findIndex((x) => x.kind === kind); return i >= 0 ? anchors.splice(i, 1)[0] : null; };
  const comps = hw.comps.filter((c) => c.part.fp);
  const area = (c) => { const [a, b, x, y] = lib.FOOTPRINTS[c.part.fp].bbox; return (x - a) * (y - b); };
  // 1. 앵커 부품 (버튼·다이얼·잭·USB 등 외장 구멍에 맞춘 자리): 몸체 가운데를 앵커에 두고, 외곽 밖으로 나가면 가운데 쪽으로 민다
  const cx0 = (bb[0] + bb[2]) / 2, cy0 = (bb[1] + bb[3]) / 2;
  const pending = [];
  const clash = [];
  for (const c of comps) {
    const an = c.anchor ? takeAnchor(c.anchor) : null;
    if (!an) { pending.push(c); continue; }
    const rot = (((an.dir - (lib.FOOTPRINTS[c.part.fp].face ?? an.dir)) % 360) + 360) % 360; // 부품이 바라보는 쪽을 벽 쪽으로
    const r0 = rectOf(c.part.fp, 0, 0, rot);
    let x = an.x - (r0[0] + r0[2]) / 2, y = an.y - (r0[1] + r0[3]) / 2;
    const d = Math.hypot(cx0 - an.x, cy0 - an.y) || 1;
    let moved = 0;
    while (!insideOutline(rectOf(c.part.fp, x, y, rot)) && moved < 30) { x += ((cx0 - an.x) / d) * 0.25; y += ((cy0 - an.y) / d) * 0.25; moved += 0.25; }
    const r = rectOf(c.part.fp, x, y, rot);
    if (rects.some((o) => !(r[2] <= o[0] || r[0] >= o[2] || r[3] <= o[1] || r[1] >= o[3]))) clash.push(c.ref);
    mark(r, sidesOf(c, 'F')); rects.push(r);
    out.push({ c, x, y, rot, anchor: an, moved: Math.round(moved * 10) / 10, side: 'F', rect: r });
  }
  // 2. 나머지: MCU 먼저(맨 위 가장자리 → 안테나가 바깥쪽), 그다음 큰 것부터
  pending.sort((a, b) => (/RF_Module/.test(b.part.fp) - /RF_Module/.test(a.part.fp)) || area(b) - area(a));
  const scan = (c, side) => {
    for (const rot of [0, 90]) {
      const r0 = rectOf(c.part.fp, 0, 0, rot);
      for (let y = bb[3]; y - (r0[3] - r0[1]) >= bb[1]; y -= G) {
        for (let x = bb[0]; x + (r0[2] - r0[0]) <= bb[2]; x += G) {
          const px = x - r0[0], py = y - r0[3];
          const rr = [r0[0] + px, r0[1] + py, r0[2] + px, r0[3] + py];
          if (!freeRect(rr, side)) continue;
          // RF 모듈: 안테나 금지 구역(court)에는 다른 부품이 없어야 한다 (기판 밖은 괜찮다)
          const court = lib.FOOTPRINTS[c.part.fp].court;
          const isRf = /^RF_Module:/.test(c.part.fp) && court;
          if (isRf && rot !== 0) continue;
          // 안테나 띠: 모듈 위쪽 8 mm 와 그 양옆 (KiCad 부품 자리 폭까지), 위로는 기판 밖까지
          const rc = isRf ? rectOf(c.part.fp, px, py, rot, 'court') : null;
          // (KiCad 부품 자리는 Espressif 권장 금지 구역 전체라 작은 기판에는 안 들어간다 → 모듈 폭 + 양옆 3 mm, 위로 5 mm 로 줄여 잡고 메모로 알린다)
          const band = rc ? [rr[0] - 3, rr[3] - 8, rr[2] + 3, Math.min(rc[3], rr[3] + 5)] : null;
          if (band && rects.some((o) => !(band[2] < o[0] || band[0] > o[2] || band[3] < o[1] || band[1] > o[3]))) continue;
          mark(rr, sidesOf(c, side)); rects.push(rr);
          if (band) { mark(band, ['F', 'B']); rects.push(band); }
          out.push({ c, x: px, y: py, rot, side, rect: rr }); return true;
        }
      }
    }
    return false;
  };
  const smallSmd = (c) => lib.FOOTPRINTS[c.part.fp].smd && area(c) <= 40 && !/RF_Module|Connector/.test(c.part.fp);
  const outside = [];
  const later = [];
  for (const c of pending) if (!scan(c, 'F')) later.push(c);
  // 앞면에 못 넣은 작은 표면 실장 부품은 뒷면에 (JLCPCB 양면 조립)
  for (const c of later) if (!(smallSmd(c) && scan(c, 'B'))) outside.push(c);
  // 3. 못 넣은 부품은 기판 오른쪽 밖에 줄 세운다
  let ox = bb[2] + 10, oy = bb[3], colW = 0;
  for (const c of outside) {
    const r = rectOf(c.part.fp, 0, 0, 0);
    const w = r[2] - r[0], h = r[3] - r[1];
    if (oy - h < bb[1] - 40) { ox += colW + 2; oy = bb[3]; colW = 0; }
    out.push({ c, x: ox - r[0], y: oy - r[3], rot: 0, outside: true, side: 'F', rect: [ox, oy - h, ox + w, oy] });
    oy -= h + 1; colW = Math.max(colW, w);
  }
  const used = comps.reduce((s, c) => s + area(c), 0);
  return { list: out, outside: outside.map((c) => c.ref), bottom: out.filter((o) => o.side === 'B').map((o) => o.c.ref), clash, density: used / Math.max(1, layout.area), usedArea: used, leftAnchors: anchors };
}

// 뒷면: KiCad 의 위·아래 뒤집기와 같게 (로컬 y → −y, F.* ↔ B.* 층, 글자는 180° + 거울)
const swapLayer = (name) => name.replace(/^F\./, '@').replace(/^B\./, 'F.').replace(/^@/, 'B.').replace(/^\*\.Cu$/, '*.Cu');
function flipNode(n) {
  if (!Array.isArray(n)) return n;
  const head = n[0];
  if (['at', 'start', 'end', 'center', 'mid', 'xy'].includes(head)) {
    const r = [head, n[1], -Number(n[2])];
    if (head === 'at' && n.length > 3) r.push(n[3]);
    return r;
  }
  if (head === 'layer' || head === 'layers') return [head, ...n.slice(1).map((v) => (v && typeof v === 'object' && 's' in v ? q(swapLayer(v.s)) : typeof v === 'string' ? swapLayer(v) : v))];
  if (head === 'model') return n;
  return n.map((v, i) => (i === 0 ? v : flipNode(v)));
}

function footprintNode(lib, fpId, { ref, value, x, y, rot, side = 'F', padNets, netIndex, pathUuid, tstamp, project }) {
  const src = parse(lib.FOOTPRINTS[fpId].text)[0];
  let keep = src.slice(2).filter((c) => !(Array.isArray(c) && ['version', 'generator', 'layer'].includes(c[0])));
  if (side === 'B') {
    keep = keep.map((c) => {
      if (!Array.isArray(c)) return c;
      let f = flipNode(c);
      if (c[0] === 'fp_text') {
        f = f.map((v) => (Array.isArray(v) && v[0] === 'at' ? ['at', v[1], v[2], (180 - Number(v[3] || 0) + 360) % 360] : v));
        f = f.map((v) => (Array.isArray(v) && v[0] === 'effects' && !v.some((e) => Array.isArray(e) && e[0] === 'justify') ? [...v, ['justify', 'mirror']] : v));
      }
      if (c[0] === 'pad') f = f.map((v) => (Array.isArray(v) && v[0] === 'at' ? ['at', v[1], v[2], (360 - Number(v[3] || 0)) % 360] : v));
      return f;
    });
  }
  const body = keep.map((c) => {
    if (!Array.isArray(c)) return c;
    if (c[0] === 'fp_text') {
      const t = c.map((v, i) => (i === 2 && c[1] === 'reference' ? q(ref) : i === 2 && c[1] === 'value' ? q(value) : v));
      return t.map((v) => (Array.isArray(v) && v[0] === 'at' ? ['at', v[1], v[2], (Number(v[3] || 0) + rot) % 360] : v));
    }
    if (c[0] === 'pad') {
      const num = str(c[1]);
      const p = c.map((v) => (Array.isArray(v) && v[0] === 'at' ? ['at', v[1], v[2], (Number(v[3] || 0) + rot) % 360] : v));
      const net = padNets[num];
      if (net) p.push(['net', netIndex.get(net), q(net)]);
      return p;
    }
    return c;
  });
  return ['footprint', q(fpId), ['layer', q(side === 'B' ? 'B.Cu' : 'F.Cu')], ['tstamp', q(tstamp)], ['at', x, y, rot],
    ['property', q('Sheetfile'), q(`${project}.kicad_sch`)], ['property', q('Sheetname'), q('')], ...(pathUuid ? [['path', q(`/${pathUuid}`)]] : []), ...body];
}

export function toKicadPcb(hw, lib, layout, { schPlaced = [], project = 'aegis', seed = 'x', title = '' } = {}) {
  const uuid = uuidGen(`pcb|${seed}`);
  const place = placeParts(hw, lib, layout);
  const netNames = [...hw.nets.keys()].sort((a, b) => (a === 'GND' ? -1 : b === 'GND' ? 1 : a.localeCompare(b)));
  const netIndex = new Map(netNames.map((n, i) => [n, i + 1]));
  const X = (x) => Math.round((100 + x) * 1000) / 1000, Y = (y) => Math.round((100 - y) * 1000) / 1000;
  const symUuid = new Map();
  schPlaced.forEach((p) => { if (!symUuid.has(p.ref)) symUuid.set(p.ref, p.uuid); });
  const nodes = [];
  for (const p of place.list) {
    const { c } = p;
    nodes.push(footprintNode(lib, c.part.fp, { ref: c.ref, value: kicadValue(c), x: X(p.x), y: Y(p.y), rot: p.rot, side: p.side, padNets: c.conns, netIndex, pathUuid: symUuid.get(c.ref), tstamp: uuid(), project }));
  }
  // 고정 구멍 · 보스 자리 · 외곽
  let h = 0;
  for (const ho of layout.holes) {
    if (ho.kind === 'mount') { h++; nodes.push(footprintNode(lib, HOLE_FP(ho.d), { ref: `H${h}`, value: HOLE_FP(ho.d).split('_').slice(1).join(' '), x: X(ho.x), y: Y(ho.y), rot: 0, padNets: {}, netIndex, tstamp: uuid(), project })); }
    else nodes.push(['gr_circle', ['center', X(ho.x), Y(ho.y)], ['end', X(ho.x + ho.d / 2), Y(ho.y)], ['stroke', ['width', 0.1], ['type', 'default']], ['fill', 'none'], ['layer', q('Edge.Cuts')], ['tstamp', q(uuid())]]);
  }
  const pts = layout.outline;
  pts.forEach((pt, i) => {
    const nx = pts[(i + 1) % pts.length];
    nodes.push(['gr_line', ['start', X(pt[0]), Y(pt[1])], ['end', X(nx[0]), Y(nx[1])], ['stroke', ['width', 0.1], ['type', 'default']], ['layer', q('Edge.Cuts')], ['tstamp', q(uuid())]]);
  });
  // 앵커 자리 설명 (User.Comments)
  for (const a of layout.anchors || []) nodes.push(['gr_text', q(`${a.id.toUpperCase()} (${a.kind}, housing opening)`), ['at', X(a.x), Y(a.y) + 4, 0], ['layer', q('Cmts.User')], ['tstamp', q(uuid())], font(0.8)]);
  const doc = ['kicad_pcb', ['version', 20221018], ['generator', 'pcbnew'], ['general', ['thickness', 1.6]], ['paper', q('A3')],
    ['title_block', ['title', q(title)], ['rev', q('0.1')], ['company', q('AEGIS prototype workbench')]],
    ['layers', ...LAYERS.map(([n, name, type, user]) => (user ? [n, q(name), type, q(user)] : [n, q(name), type]))],
    ['setup', ['pad_to_mask_clearance', 0]],
    ['net', 0, q('')], ...netNames.map((n) => ['net', netIndex.get(n), q(n)]),
    ...nodes];
  return { text: `${print(doc)}\n`, place };
}

export function toKicadPro(project) {
  return `${JSON.stringify({ board: { design_settings: { defaults: { board_outline_line_width: 0.1 }, rules: { min_clearance: 0.15, min_track_width: 0.15, min_through_hole_diameter: 0.2, min_via_diameter: 0.45, min_hole_to_hole: 0.25, min_copper_edge_clearance: 0.5 } } }, meta: { filename: `${project}.kicad_pro`, version: 1 }, net_settings: { classes: [{ name: 'Default', clearance: 0.2, track_width: 0.25, via_diameter: 0.6, via_drill: 0.3 }, { name: 'Power', clearance: 0.2, track_width: 0.8, via_diameter: 0.8, via_drill: 0.4 }], netclass_patterns: [{ netclass: 'Power', pattern: '+*' }, { netclass: 'Power', pattern: 'GND' }, { netclass: 'Power', pattern: 'VBUS' }, { netclass: 'Power', pattern: '*_SW' }, { netclass: 'Power', pattern: '*_SET' }, { netclass: 'Power', pattern: '*_LEDK' }], meta: { version: 3 } }, schematic: { legacy_lib_dir: '', legacy_lib_list: [] }, sheets: [], text_variables: {} }, null, 2)}\n`;
}

// ───────────────────────── DXF (기판 외곽 · 구멍 · 부품 자리) R12 ASCII, mm
export function toDxf(layout) {
  const L = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '70', '3'];
  [['OUTLINE', 7], ['HOLES', 1], ['PARTS', 3]].forEach(([n, color]) => L.push('0', 'LAYER', '2', n, '70', '0', '62', String(color), '6', 'CONTINUOUS'));
  L.push('0', 'ENDTAB', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES');
  const f = (v) => (Math.round(v * 1000) / 1000).toString();
  const pts = layout.outline;
  pts.forEach((p, i) => { const n = pts[(i + 1) % pts.length]; L.push('0', 'LINE', '8', 'OUTLINE', '10', f(p[0]), '20', f(p[1]), '30', '0', '11', f(n[0]), '21', f(n[1]), '31', '0'); });
  layout.holes.forEach((h) => L.push('0', 'CIRCLE', '8', 'HOLES', '10', f(h.x), '20', f(h.y), '30', '0', '40', f(h.d / 2)));
  (layout.anchors || []).forEach((a) => {
    L.push('0', 'CIRCLE', '8', 'PARTS', '10', f(a.x), '20', f(a.y), '30', '0', '40', '1');
    L.push('0', 'TEXT', '8', 'PARTS', '10', f(a.x + 1.5), '20', f(a.y + 1.5), '30', '0', '40', '1.5', '1', a.id.toUpperCase());
  });
  L.push('0', 'ENDSEC', '0', 'EOF');
  return `${L.join('\n')}\n`;
}

/** 기판 면적·밀도 요약 */
export function pcbStats(layout, place) {
  return { area: Math.round(layout.area), outline: Math.round(polyArea(layout.outline)), used: Math.round(place.usedArea), density: place.density, outside: place.outside };
}
export { kids, kid };
