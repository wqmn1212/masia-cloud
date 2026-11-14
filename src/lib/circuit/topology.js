// 회로 연결 계산: 격자 점을 전기적으로 같은 노드끼리 묶고, 전선 전류를 구할 그래프를 만든다
import { terminals } from './parts.js';

const key = (x, y) => `${x},${y}`;

class DSU {
  constructor() { this.p = new Map(); }
  find(a) {
    if (!this.p.has(a)) this.p.set(a, a);
    let r = a;
    while (this.p.get(r) !== r) r = this.p.get(r);
    let c = a;
    while (this.p.get(c) !== r) { const n = this.p.get(c); this.p.set(c, r); c = n; }
    return r;
  }
  union(a, b) { const ra = this.find(a), rb = this.find(b); if (ra !== rb) this.p.set(ra, rb); }
}

/** (px,py)가 축 방향 선분 내부(끝점 제외)에 있는가 */
function onSegmentInterior(px, py, w) {
  if (w.x1 === w.x2) {
    if (px !== w.x1) return false;
    const lo = Math.min(w.y1, w.y2), hi = Math.max(w.y1, w.y2);
    return py > lo && py < hi;
  }
  if (w.y1 === w.y2) {
    if (py !== w.y1) return false;
    const lo = Math.min(w.x1, w.x2), hi = Math.max(w.x1, w.x2);
    return px > lo && px < hi;
  }
  return false;
}

/**
 * 회로를 노드로 정리한다.
 * 반환: { elements: [{part, nodes:[노드번호...]}], nodeCount(접지 0 제외 개수+1), pointNode: Map(점→노드),
 *        segments: 전선 조각 [{wireId, a, b, node}], warnings }
 */
export function buildTopology(circuit) {
  const parts = (circuit.parts || []).filter((p) => p.type !== 'wire');
  const wires = (circuit.parts || []).filter((p) => p.type === 'wire' && (p.x1 !== p.x2 || p.y1 !== p.y2));
  const dsu = new DSU();
  const warnings = [];

  // 모든 단자·전선 끝점
  const points = new Set();
  const partTerms = parts.map((p) => terminals(p).map((t) => key(t.x, t.y)));
  partTerms.forEach((ts) => ts.forEach((k) => { points.add(k); dsu.find(k); }));
  wires.forEach((w) => { points.add(key(w.x1, w.y1)); points.add(key(w.x2, w.y2)); });

  // 전선 조각: 다른 점이 전선 가운데에 걸치면 그 점에서 나눈다 (T자 연결)
  const segments = [];
  const allPts = [...points].map((k) => k.split(',').map(Number));
  wires.forEach((w) => {
    const cuts = allPts.filter(([x, y]) => onSegmentInterior(x, y, w));
    const horiz = w.y1 === w.y2 && w.x1 !== w.x2;
    const vert = w.x1 === w.x2;
    const along = (pt) => (horiz ? (pt[0] - w.x1) / (w.x2 - w.x1) : vert ? (pt[1] - w.y1) / (w.y2 - w.y1) : 0);
    const seq = [[w.x1, w.y1], ...cuts.sort((a, b) => along(a) - along(b)), [w.x2, w.y2]];
    for (let i = 0; i < seq.length - 1; i++) {
      const a = key(...seq[i]), b = key(...seq[i + 1]);
      dsu.union(a, b);
      segments.push({ wireId: w.id, ax: seq[i][0], ay: seq[i][1], bx: seq[i + 1][0], by: seq[i + 1][1], a, b });
    }
  });

  // 접지 노드 정하기
  const grounds = parts.filter((p) => p.type === 'ground').map((p) => dsu.find(key(p.x1, p.y1)));
  let groundRoot = grounds[0];
  grounds.slice(1).forEach((g) => dsu.union(g, groundRoot));
  if (groundRoot) groundRoot = dsu.find(groundRoot);
  if (!groundRoot) {
    const src = parts.find((p) => ['dcv', 'acv', 'pulse'].includes(p.type));
    const first = src ? partTerms[parts.indexOf(src)][0] : partTerms.find((t) => t.length)?.[0];
    if (first) {
      groundRoot = dsu.find(first);
      if (parts.some((p) => p.type !== 'probe')) warnings.push('접지가 없어 전원의 − 단자를 0 V 기준으로 잡았습니다.');
    }
  }

  // 노드 번호: 접지 0, 나머지 1부터
  const nodeOf = new Map();
  let next = 1;
  const rootNum = (root) => {
    if (root === groundRoot) return 0;
    if (!nodeOf.has(root)) nodeOf.set(root, next++);
    return nodeOf.get(root);
  };
  const pointNode = new Map();
  [...points].forEach((k) => pointNode.set(k, rootNum(dsu.find(k))));

  const elements = parts
    .map((p, i) => ({ part: p, nodes: partTerms[i].map((k) => pointNode.get(k)) }))
    .filter((e) => e.part.type !== 'ground');

  segments.forEach((s) => { s.node = pointNode.get(s.a); });

  // 연결되지 않은 단자(아무것과도 이어지지 않은 점) 경고
  const touch = new Map();
  // 전압 표시·접지가 붙은 단자도 연결된 것으로 본다
  partTerms.forEach((ts) => ts.forEach((k) => touch.set(dsu.find(k), (touch.get(dsu.find(k)) || 0) + 1)));
  const wireRoots = new Set(segments.map((s) => dsu.find(s.a)));
  let open = 0;
  partTerms.forEach((ts, i) => {
    if (['probe', 'ground', 'voltmeter'].includes(parts[i].type)) return;
    ts.forEach((k) => { const r = dsu.find(k); if (r !== groundRoot && touch.get(r) === 1 && !wireRoots.has(r)) open++; });
  });
  if (open) warnings.push(`연결되지 않은 단자가 ${open}개 있습니다.`);

  return { elements, nodeCount: next, pointNode, segments, warnings, key };
}

/**
 * 전선 조각의 전류를 구한다. 각 점에 부품이 넣고 빼는 전류(injection)를 주고,
 * 노드마다 전선 그래프의 신장 트리에서 잎부터 흐름을 모은다. 전선으로만 된 고리는 한 변을 0으로 둔다.
 * injection: Map(점 → 그 점에서 전선망으로 들어가는 전류)
 * 반환: Map(segment index → a→b 방향 전류)
 */
export function wireCurrents(segments, injection) {
  const out = new Map();
  const adj = new Map();
  segments.forEach((s, i) => {
    if (!adj.has(s.a)) adj.set(s.a, []);
    if (!adj.has(s.b)) adj.set(s.b, []);
    adj.get(s.a).push([i, s.b, 1]);
    adj.get(s.b).push([i, s.a, -1]);
  });
  const seen = new Set();
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    // BFS 신장 트리
    const order = [start];
    const parentEdge = new Map([[start, null]]);
    seen.add(start);
    for (let h = 0; h < order.length; h++) {
      const u = order[h];
      for (const [i, v, dir] of adj.get(u)) {
        if (seen.has(v)) { if (!out.has(i)) out.set(i, 0); continue; }
        seen.add(v);
        parentEdge.set(v, [i, u, dir]);
        order.push(v);
      }
    }
    // 잎부터 거슬러 올라가며 흐름 합산: 점 v 아래쪽 부분트리로 들어온 전류를 부모 쪽으로 보낸다
    const acc = new Map(order.map((k) => [k, injection.get(k) || 0]));
    for (let h = order.length - 1; h > 0; h--) {
      const v = order[h];
      const [i, u, dir] = parentEdge.get(v);
      const f = acc.get(v); // v 에서 u 로 흐르는 전류
      // 변 i 는 (u→v 가 dir=1 이면 a=u,b=v). v→u 흐름은 b→a 이므로 a→b 기준 −f
      out.set(i, dir === 1 ? -f : f);
      acc.set(u, acc.get(u) + f);
    }
  }
  return out;
}
