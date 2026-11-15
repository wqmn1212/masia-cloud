// 조립 간섭 검사 (단위 mm). 부품 메시끼리 파고드는 곳과, 움직이는 묶음(본체 기울기 등)이 돌면서 좁아지는 틈을 찾는다.
// DOM·three.js·CAD 엔진을 쓰지 않으므로 워커와 Node 검산에서 같이 돈다.
import { weldVertices, refineLongEdges, buildBvh, countHits, nearestPoint } from '../moldReview/geometry.js';

const RAYS = [[0.3713, 0.5571, 0.7428], [-0.6017, 0.4799, -0.6384]];
const DEG = Math.PI / 180;

function prep(part, maxEdge) {
  const w = weldVertices(part.V, part.F);
  const { V, F } = refineLongEdges(w.V, w.F, maxEdge, 120000);
  const Vf = Float64Array.from(V);
  const Fu = Uint32Array.from(F);
  const bvh = buildBvh(Vf, Fu);
  // 표본점: 정점 + 삼각형 중심 (넓은 면이 다른 부품 속으로 들어간 경우도 잡는다)
  const nv = Vf.length / 3, nt = Fu.length / 3;
  const S = new Float64Array((nv + nt) * 3);
  S.set(Vf);
  for (let t = 0; t < nt; t++) {
    const a = Fu[t * 3] * 3, b = Fu[t * 3 + 1] * 3, c = Fu[t * 3 + 2] * 3, o = (nv + t) * 3;
    S[o] = (Vf[a] + Vf[b] + Vf[c]) / 3; S[o + 1] = (Vf[a + 1] + Vf[b + 1] + Vf[c + 1]) / 3; S[o + 2] = (Vf[a + 2] + Vf[b + 2] + Vf[c + 2]) / 3;
  }
  return { id: part.id, name: part.name, group: part.group || 'fixed', bvh, S, bbox: w.bbox };
}

const inBox = (b, x, y, z, m) => x >= b[0] - m && x <= b[3] + m && y >= b[1] - m && y <= b[4] + m && z >= b[2] - m && z <= b[5] + m;
const boxesTouch = (a, b, m) => a[0] - m <= b[3] && b[0] - m <= a[3] && a[1] - m <= b[4] && b[1] - m <= a[4] && a[2] - m <= b[5] && b[2] - m <= a[5];

function inside(bvh, x, y, z) {
  let odd = 0;
  for (const d of RAYS) if (countHits(bvh, x, y, z, d[0], d[1], d[2]) % 2 === 1) odd++;
  return odd === RAYS.length;
}

/** 축 둘레 회전 행렬 (로드리게스) */
function rotation(axis, deg) {
  const [ux, uy, uz] = axis; const n = Math.hypot(ux, uy, uz) || 1;
  const x = ux / n, y = uy / n, z = uz / n, c = Math.cos(deg * DEG), s = Math.sin(deg * DEG), t = 1 - c;
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c];
}
const apply = (M, o, x, y, z, out) => {
  const px = x - o[0], py = y - o[1], pz = z - o[2];
  out[0] = o[0] + M[0] * px + M[1] * py + M[2] * pz;
  out[1] = o[1] + M[3] * px + M[4] * py + M[5] * pz;
  out[2] = o[2] + M[6] * px + M[7] * py + M[8] * pz;
};
function movedBox(b, M, o) {
  const out = [0, 0, 0]; const r = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const x of [b[0], b[3]]) for (const y of [b[1], b[4]]) for (const z of [b[2], b[5]]) {
    apply(M, o, x, y, z, out);
    for (let k = 0; k < 3; k++) { r[k] = Math.min(r[k], out[k]); r[k + 3] = Math.max(r[k + 3], out[k]); }
  }
  return r;
}

/**
 * A 의 표본점을 (M, o 로 옮긴 뒤) B 에 넣어 본다.
 * 반환: { depth, at } 가장 깊이 파고든 점, { gap, at } 가장 가까운 점 (gapLimit 안에서만)
 */
function probe(A, B, M, o, tol, gapLimit) {
  const p = [0, 0, 0], q = [0, 0, 0];
  let depth = 0, dAt = null, gap = Infinity, gAt = null;
  const S = A.S, m = Math.max(tol, gapLimit);
  for (let i = 0; i < S.length; i += 3) {
    if (M) apply(M, o, S[i], S[i + 1], S[i + 2], p); else { p[0] = S[i]; p[1] = S[i + 1]; p[2] = S[i + 2]; }
    if (!inBox(B.bbox, p[0], p[1], p[2], m)) continue;
    // 먼저 안·밖을 본다 (광선 2개). 안이면 표면까지 거리 = 파고든 깊이, 밖이면 gapLimit 안에서만 틈을 잰다
    if (inBox(B.bbox, p[0], p[1], p[2], 0) && inside(B.bvh, p[0], p[1], p[2])) {
      const d = nearestPoint(B.bvh, p[0], p[1], p[2], 60, q);
      if (d > tol) { if (d > depth) { depth = d; dAt = [p[0], p[1], p[2]]; } continue; }
      if (gapLimit > 0 && d < gap) { gap = d; gAt = [p[0], p[1], p[2]]; }
      continue;
    }
    if (gapLimit > 0) {
      const d = nearestPoint(B.bvh, p[0], p[1], p[2], gapLimit, q);
      if (d < gap) { gap = d; gAt = [p[0], p[1], p[2]]; }
    }
  }
  return { depth, dAt, gap, gAt };
}

/**
 * @param {Array<{id,name,group,V,F}>} parts 부품 메시 (V: 정점, F: 삼각형)
 * @param {{ skip?: (aId, bId) => boolean, motion?: {group, origin, axis, min, max, clearance}, tol?: number, maxEdge?: number, step?: number }} opts
 */
export function checkInterference(parts, opts = {}) {
  const t0 = Date.now();
  const tol = opts.tol ?? 0.05;
  const P = parts.filter((p) => p.V?.length && p.F?.length).map((p) => prep(p, opts.maxEdge ?? 3));
  const overlaps = [];
  let pairs = 0;
  // 1) 조립 상태: 파고든 곳
  for (let i = 0; i < P.length; i++) {
    for (let j = i + 1; j < P.length; j++) {
      const A = P[i], B = P[j];
      if (opts.skip?.(A.id, B.id) || !boxesTouch(A.bbox, B.bbox, tol)) continue;
      pairs++;
      const ab = probe(A, B, null, null, tol, 0), ba = probe(B, A, null, null, tol, 0);
      const best = ab.depth >= ba.depth ? ab : ba;
      if (best.depth > tol) overlaps.push({ a: A.id, b: B.id, aName: A.name, bName: B.name, kind: 'overlap', depth: best.depth, at: best.dAt, angle: 0 });
    }
  }
  // 2) 움직임: 돌리는 묶음 vs 나머지
  const mo = opts.motion;
  const sweep = [];
  const tight = [];
  if (mo && mo.max > mo.min) {
    const moving = P.filter((p) => p.group === mo.group), fixed = P.filter((p) => p.group !== mo.group);
    const step = opts.step ?? 2.5;
    const angles = [];
    for (let g = mo.min; g <= mo.max + 1e-9; g += step) angles.push(Math.round(g * 100) / 100);
    if (!angles.includes(mo.max)) angles.push(mo.max);
    const clearance = mo.clearance ?? 0.5;
    const restGap = new Map();
    const key = (a, b) => `${a}|${b}`;
    const measure = (deg) => {
      const M = rotation(mo.axis, deg), Mi = rotation(mo.axis, -deg);
      let worst = Infinity, worstPair = null;
      const found = [];
      for (const A of moving) {
        const box = movedBox(A.bbox, M, mo.origin);
        for (const B of fixed) {
          if (opts.skip?.(A.id, B.id) || !boxesTouch(box, B.bbox, clearance + 0.5)) continue;
          const ab = probe(A, B, M, mo.origin, tol, clearance + 0.5);
          const ba = probe(B, A, Mi, mo.origin, tol, clearance + 0.5);
          const depth = Math.max(ab.depth, ba.depth);
          const gap = Math.min(ab.gap, ba.gap);
          const at = ab.depth >= ba.depth ? ab.dAt : ba.dAt;
          const gAt = ab.gap <= ba.gap ? ab.gAt : (ba.gAt && (() => { const o = [0, 0, 0]; apply(M, mo.origin, ba.gAt[0], ba.gAt[1], ba.gAt[2], o); return o; })());
          found.push({ A, B, depth, gap, at: depth > tol ? (ab.depth >= ba.depth ? at : (() => { const o = [0, 0, 0]; apply(M, mo.origin, at[0], at[1], at[2], o); return o; })()) : gAt });
          const v = depth > tol ? -depth : gap;
          if (v < worst) { worst = v; worstPair = [A.name, B.name]; }
        }
      }
      return { found, worst, worstPair };
    };
    const rest = measure(0);
    for (const f of rest.found) restGap.set(key(f.A.id, f.B.id), f.depth > tol ? -f.depth : f.gap);
    for (const deg of angles) {
      if (deg === 0) { sweep.push({ angle: 0, gap: Infinity, pair: null }); continue; }
      const r = measure(deg);
      let worst = Infinity, wp = null;
      for (const f of r.found) {
        const before = restGap.get(key(f.A.id, f.B.id)) ?? Infinity;
        const v = f.depth > tol ? -f.depth : f.gap;
        // 쉬고 있을 때보다 좁아진 쌍만 본다 (축과 축 구멍처럼 원래 붙어 있는 쌍은 빼고)
        if (!(v < before - 0.05)) continue;
        if (v < worst) { worst = v; wp = [f.A.name, f.B.name]; }
        if (f.depth > tol || f.gap < clearance) {
          const prev = tight.find((x) => x.a === f.A.id && x.b === f.B.id);
          const item = { a: f.A.id, b: f.B.id, aName: f.A.name, bName: f.B.name, kind: f.depth > tol ? 'overlap' : 'tight', depth: f.depth > tol ? f.depth : 0, gap: f.depth > tol ? 0 : f.gap, at: f.at, angle: deg };
          if (!prev) tight.push(item);
          else if ((item.kind === 'overlap' && (prev.kind !== 'overlap' || item.depth > prev.depth)) || (prev.kind === 'tight' && item.kind === 'tight' && item.gap < prev.gap)) Object.assign(prev, item);
        }
      }
      sweep.push({ angle: deg, gap: worst, pair: wp });
    }
  }
  return {
    overlaps: overlaps.sort((x, y) => y.depth - x.depth),
    motion: mo ? { label: mo.label, min: mo.min, max: mo.max, clearance: mo.clearance ?? 0.5, issues: tight, sweep } : null,
    pairs,
    ms: Date.now() - t0,
  };
}
