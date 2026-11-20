// PCB 연결성: 패드·트랙·비아·동박면이 실제로 닿아 이어진 덩어리(섬)를 찾고,
// 같은 넷인데 떨어진 섬 사이를 이을 선(미연결, ratsnest)과 다른 넷끼리 닿은 곳(합선)을 낸다.
import { gap, bbox, boxesNear, inPoly, pointSeg, dist } from './geom.js';
import { allPads, padShape, trackShape, viaShape } from './board.js';

/** 동박 항목 목록: { key, kind, net, layers, shape, ref } */
export function copperItems(b) {
  const items = [];
  for (const p of allPads(b)) if (p.layers.length && p.type !== 'np_thru_hole') items.push({ key: `p:${p.ref}:${p.num}:${p.at.join(',')}`, kind: 'pad', net: p.net, layers: p.layers, shape: padShape(p), pad: p });
  for (const t of b.tracks) items.push({ key: t.id, kind: 'track', net: t.net, layers: [t.layer], shape: trackShape(t), track: t });
  for (const v of b.vias) items.push({ key: v.id, kind: 'via', net: v.net, layers: b.copper.filter((c, i, all) => i >= all.indexOf(v.layers[0]) && i <= all.indexOf(v.layers[v.layers.length - 1])), shape: viaShape(v), via: v });
  items.forEach((it) => { it.box = bbox(it.shape); });
  return items;
}

/** 동박면: 채움이 있고 최신이면 채움 다각형, 아니면 외곽(근사) */
export function zoneAreas(b) {
  const out = [];
  b.zones.forEach((z, zi) => {
    if (z.keepout || !z.net) return;
    const fresh = !b.fillsStale && z.fills.length;
    if (fresh) z.fills.forEach((f, fi) => out.push({ key: `z${zi}:${fi}`, zone: z, net: z.net, layer: f.layer, pts: f.pts, approx: false }));
    else z.layers.filter((l) => b.copper.includes(l)).forEach((l) => out.push({ key: `z${zi}:${l}`, zone: z, net: z.net, layer: l, pts: z.outline, approx: true }));
  });
  out.forEach((a) => { a.box = bbox({ kind: 'poly', pts: a.pts }); });
  return out;
}

const shareLayer = (a, b) => a.some((l) => b.includes(l));

/** 동박면에 닿는지: 채움 안에 중심이 있거나 가장자리에 걸침 */
function touchesArea(it, area) {
  if (!it.layers.includes(area.layer) || !boxesNear(it.box, area.box)) return false;
  const s = it.shape;
  const c = s.kind === 'cap' ? s.a : s.pts[0];
  if (inPoly(c, area.pts)) return true;
  if (area.approx) return false; // 외곽 근사는 안쪽에 있는 것만 (KiCad 가 채우며 이을 것)
  for (let i = 0, j = area.pts.length - 1; i < area.pts.length; j = i++) {
    if (s.kind === 'cap' && Math.min(pointSeg(area.pts[i], s.a, s.b), pointSeg(area.pts[j], s.a, s.b)) <= s.r) return true;
  }
  return false;
}

class DSU {
  constructor(n) { this.p = Array.from({ length: n }, (_, i) => i); }
  find(i) { while (this.p[i] !== i) { this.p[i] = this.p[this.p[i]]; i = this.p[i]; } return i; }
  union(a, b) { const x = this.find(a), y = this.find(b); if (x !== y) this.p[x] = y; }
}

/**
 * 연결성 분석. 돌려줌:
 *  islands: 같은 덩어리 번호(항목별), unrouted: [{net, a, b}] 이어야 할 곳, shorts: [{a, b, nets, at}] 다른 넷이 닿은 곳,
 *  netIslands: 넷별 섬 개수, items, areas
 */
export function analyzeConnectivity(b) {
  const items = copperItems(b);
  const areas = zoneAreas(b);
  const all = [...items, ...areas.map((a) => ({ key: a.key, kind: 'zone', net: a.net, layers: [a.layer], area: a, box: a.box }))];
  const dsu = new DSU(all.length);
  const shorts = [];
  for (let i = 0; i < items.length; i++) {
    const A = items[i];
    for (let j = i + 1; j < items.length; j++) {
      const B = items[j];
      if (!shareLayer(A.layers, B.layers) || !boxesNear(A.box, B.box, 0.001)) continue;
      if (gap(A.shape, B.shape) > 1e-6) continue;
      if (A.net && B.net && A.net !== B.net) {
        // 같은 부품 안의 패드끼리 붙은 것(예: 접지 패드 여러 개)은 부품 설계이므로 합선으로 보지 않는다
        if (!(A.kind === 'pad' && B.kind === 'pad' && A.pad.ref === B.pad.ref)) shorts.push({ a: A.key, b: B.key, nets: [A.net, B.net], at: A.shape.kind === 'cap' ? A.shape.a : A.shape.pts[0] });
        continue;
      }
      dsu.union(i, j);
    }
    for (let k = 0; k < areas.length; k++) {
      const z = areas[k];
      if (A.net === z.net && touchesArea(A, z)) dsu.union(i, items.length + k);
    }
  }
  // 넷별 섬
  const byNet = new Map();
  items.forEach((it, i) => {
    if (!it.net) return;
    const root = dsu.find(i);
    if (!byNet.has(it.net)) byNet.set(it.net, new Map());
    const m = byNet.get(it.net);
    if (!m.has(root)) m.set(root, []);
    m.get(root).push(it);
  });
  // 섬 사이 가장 가까운 패드끼리 최소 신장 트리로 잇는다 (KiCad 의 ratsnest 와 같은 생각)
  const unrouted = [];
  const netIslands = {};
  for (const [net, m] of byNet) {
    const isl = [...m.values()].map((list) => list.filter((it) => it.kind === 'pad' || it.kind === 'via' || it.kind === 'track'));
    const withPads = isl.filter((l) => l.some((it) => it.kind === 'pad'));
    netIslands[net] = withPads.length;
    if (withPads.length < 2) continue;
    const pts = withPads.map((l) => l.map((it) => (it.shape.kind === 'cap' ? it.shape.a : centroid(it.shape.pts))));
    const inTree = [0];
    const rest = new Set(withPads.map((_, i) => i).slice(1));
    while (rest.size) {
      let best = null;
      for (const i of inTree) for (const j of rest) {
        for (const p of pts[i]) for (const q of pts[j]) { const d = dist(p, q); if (!best || d < best.d) best = { i, j, d, a: p, b: q }; }
      }
      inTree.push(best.j); rest.delete(best.j);
      unrouted.push({ net, a: best.a, b: best.b, len: Math.round(best.d * 100) / 100 });
    }
  }
  return { items, areas, islands: items.map((_, i) => dsu.find(i)), unrouted, shorts, netIslands };
}

const centroid = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

/** 한 점에 닿는 항목 (화면에서 배선을 시작·끝낼 때) */
export function itemsAt(items, p, layer, tol = 0.05) {
  const probe = { kind: 'cap', a: p, b: p, r: tol };
  return items.filter((it) => (!layer || it.layers.includes(layer)) && gap(it.shape, probe) <= 0);
}
