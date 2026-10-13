// 금형 사전 검토 엔진 (단위 mm)
// 부품 메시 하나로 빼기 방향 · 언더컷 · 구배 · 살 두께 · 파팅라인 · 게이트 후보 · 웰드라인 · 에어트랩을 계산한다.
// 재질에 따라 달라지는 판정(최소 두께, 유동 길이비 한계, 게이트 치수 등)은 report.js 에서 한다.
// 형상만 보는 추정이므로 최종 판단은 금형 설계자와 모류분석으로 확정한다.

import {
  weldVertices, refineLongEdges, computeFaceData, signedVolume, buildTopology, unifyWinding, flipTriangle,
  buildBvh, raycast, countHits, nearestPoint, buildGraph, shortestPaths, weightedMedian, symmetricEigen3,
} from './geometry.js';
import { DEFAULT_ANALYSIS_OPTIONS } from './options.js';

export const ENGINE_VERSION = '2.0.0';

export { DEFAULT_ANALYSIS_OPTIONS };

const DEG = Math.PI / 180;
const SIN_BAND = Math.sin(3 * DEG); // 빼기 방향과 거의 수직인 면은 위아래를 모두 본다
const SIN_LEAN = Math.sin(1 * DEG); // 이보다 기운 양쪽 자유 면은 기운 쪽으로 보낸다
const FLAT_GATE_COS = 0.97; // 핀 게이트 후보 면: 빼기 방향과 14° 이내
const SHARP_COS = Math.cos(40 * DEG); // 날카로운 모서리 (웰드라인 판정에서 제외할 띠)
const LIFTER_MAX_DEPTH = 8; // 리프터로 풀 수 있는 언더컷 깊이 상한 (mm)

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * @param {Float32Array|number[]} positions 정점 좌표 (mm)
 * @param {Uint32Array|number[]} indices 삼각형 인덱스 (비어 있으면 positions 를 3개씩 삼각형으로 본다)
 * @param {object} [options] DEFAULT_ANALYSIS_OPTIONS 참고
 * @param {(label: string, percent: number) => void} [onProgress]
 */
export function analyzeMold(positions, indices, options = {}, onProgress = () => {}) {
  const opt = { ...DEFAULT_ANALYSIS_OPTIONS, ...options };
  const t0 = now();
  const timing = {};
  let lastLabel = null, lastAt = t0;
  const progress = (label, percent) => {
    if (label !== lastLabel) {
      const at = now();
      if (lastLabel) timing[lastLabel] = Math.round((timing[lastLabel] || 0) + at - lastAt);
      lastLabel = label;
      lastAt = at;
    }
    onProgress(label, Math.round(percent));
  };

  progress('형상 정리 중', 2);
  const mesh = prepareMesh(positions, indices, opt);
  const { V, F, N, A, C, nv, nt, bbox } = mesh;
  if (nt < 4) throw new Error('검토할 수 있는 삼각형이 없습니다');

  const totalA = sum(A);
  const center = areaCentroid(C, A, nt);
  const blocked = makeBlockedTest(mesh);

  progress('빼기 방향 찾는 중', 8);
  const pull = choosePullDirection(mesh, blocked, center, opt);
  const [dx, dy, dz] = pull.dir;

  progress('언더컷 · 구배 계산 중', 22);
  const S = new Float64Array(nt);
  const side = new Int8Array(nt); // +1 고정측(캐비티), -1 가동측(코어), 0 언더컷, 2 양쪽 자유(임시)
  for (let t = 0; t < nt; t++) {
    const s = N[t * 3] * dx + N[t * 3 + 1] * dy + N[t * 3 + 2] * dz;
    S[t] = s;
    if (s > SIN_BAND) side[t] = blocked(t, dx, dy, dz) ? 0 : 1;
    else if (s < -SIN_BAND) side[t] = blocked(t, -dx, -dy, -dz) ? 0 : -1;
    else {
      const up = blocked(t, dx, dy, dz), dn = blocked(t, -dx, -dy, -dz);
      side[t] = up && dn ? 0 : up ? -1 : dn ? 1 : 2;
    }
  }
  const edgeCos = dihedralCos(mesh.edges, N);
  const flexible = resolveFreeFaces(mesh, side, S, edgeCos, opt);
  const draft = new Float32Array(nt);
  for (let t = 0; t < nt; t++) {
    const a = Math.asin(Math.min(1, Math.abs(S[t]))) / DEG;
    draft[t] = side[t] !== 0 && S[t] * side[t] < 0 ? -a : a;
  }

  progress('살 두께 계산 중', 32);
  const { thick, thru } = measureThickness(mesh, (p) => progress('살 두께 계산 중', 32 + p * 30));
  const nominal = weightedMedian(thick, A) || 1;
  const thickLimit = nominal * opt.sinkRatio;
  // 내접구는 모서리 바로 옆에서 작게 잡힌다 → 얇음 판정·표시는 주변 두 고리의 최댓값(wall)으로 보정
  const wall = dilateMax(F, nv, thick, 2);
  const shown = new Float32Array(nt);
  for (let t = 0; t < nt; t++) shown[t] = Math.max(thick[t], Math.min(wall[t], nominal));
  const vThick = vertexAverage(F, nv, shown, A);

  progress('파팅라인 찾는 중', 63);
  const parting = extractPartingLines(mesh, side, edgeCos, pull.dir, opt, nominal);

  progress('언더컷 묶는 중', 69);
  const { list: undercuts, faceSets: undercutFaces } = groupUndercuts(mesh, side, pull.dir, center, nominal, blocked);
  const obstacles = findObstacles(mesh, S, undercuts, undercutFaces, pull.dir, nominal);

  progress('게이트 후보 계산 중', 73);
  const cosmeticSide = opt.cosmetic === 'core' ? -1 : 1;
  const flow = buildFlowGraph(mesh, vThick, thru, nominal);
  const plGrid = partingGrid(parting.segments);
  const gateStudy = findGates(mesh, flow, side, S, vThick, nominal, thickLimit, parting, plGrid, opt,
    (p) => progress('게이트 후보 계산 중', 73 + p * 17));

  progress('웰드라인 · 에어트랩 계산 중', 91);
  const plans = gateStudy.plans.map((plan) => ({
    ...plan,
    ...meldAndAir(mesh, flow, plan, obstacles, edgeCos, vThick, nominal, side, opt, plGrid),
  }));

  // 합계 (재질과 무관한 것만. 구배·얇음 기준은 report.js 에서 사용자 설정으로 계산)
  let underA = 0, thickA = 0, thickCosmeticA = 0, proj = 0;
  for (let t = 0; t < nt; t++) {
    if (side[t] === 0) underA += A[t];
    if (thick[t] > thickLimit) {
      thickA += A[t];
      if (opt.cosmetic === 'both' || side[t] === cosmeticSide) thickCosmeticA += A[t];
    }
    if (S[t] > 0) proj += A[t] * S[t];
  }

  progress('완료', 100);
  return {
    version: ENGINE_VERSION,
    options: opt,
    mesh: { V: new Float32Array(V), F },
    face: { side, draft, thick, wall, S: new Float32Array(S), area: new Float32Array(A), flexible },
    vertex: { thick: vThick },
    pull: {
      dir: pull.dir, label: pull.label, auto: pull.auto, tilted: pull.tilted, candidates: pull.candidates,
      height: pull.height,
    },
    parting: {
      segments: parting.segments,
      kinds: parting.kinds,
      length: parting.mainLength,
      smoothLength: parting.smoothLength,
      shutoffs: parting.shutoffs,
      step: parting.step,
      stepLimit: Math.max(1, pull.height * 0.04),
    },
    undercuts,
    gates: gateStudy.gates,
    plans,
    summary: {
      nt, nv, bbox,
      size: [bbox[3] - bbox[0], bbox[4] - bbox[1], bbox[5] - bbox[2]],
      volume: Math.abs(signedVolume(V, F)),
      totalA,
      projectedA: proj,
      nominal, thickLimit, underA, thickA, thickCosmeticA,
      flippedWinding: mesh.flippedWinding,
      ms: Math.round(now() - t0),
      timing,
    },
  };
}

// ---------- 1. 메시 준비 ----------

function prepareMesh(positions, indices, opt) {
  const welded = weldVertices(positions, indices);
  // 큰 부품은 4mm, 작은 부품은 1mm 보다 긴 간선을 나눈다
  const maxEdge = Math.min(4, Math.max(1, welded.diag / 60));
  const { V, F } = refineLongEdges(welded.V, welded.F, maxEdge, opt.maxTris);
  const nv = V.length / 3, nt = F.length / 3;
  const { triNb, slotEdge, edges } = buildTopology(F, nv);
  const winding = unifyWinding(F, triNb, slotEdge);
  const { N, A, C } = computeFaceData(V, F);
  const bvh = buildBvh(V, F);
  // 성분마다 법선이 재료 바깥을 향하는지 광선 교차 홀짝으로 확인한다 (속 빈 공간의 면은 그대로 둔다)
  let flipped = winding.flippedAny;
  const e = Math.max(1e-4, welded.diag * 1e-6);
  for (const list of winding.components) {
    const samples = list.length <= 9 ? list : list.slice().sort((a, b) => A[b] - A[a]).slice(0, 9);
    let inward = 0, outward = 0;
    for (const t of samples) {
      const r = normalize([N[t * 3] + 0.0123, N[t * 3 + 1] + 0.0071, N[t * 3 + 2] + 0.0047]);
      const hits = countHits(bvh, C[t * 3] + N[t * 3] * e, C[t * 3 + 1] + N[t * 3 + 1] * e, C[t * 3 + 2] + N[t * 3 + 2] * e, r[0], r[1], r[2]);
      if (hits % 2) inward++;
      else outward++;
    }
    if (inward <= outward) continue;
    flipped = true;
    for (const t of list) {
      flipTriangle(F, triNb, slotEdge, t);
      N[t * 3] *= -1;
      N[t * 3 + 1] *= -1;
      N[t * 3 + 2] *= -1;
    }
  }
  return {
    V, F, N, A, C, nv, nt, diag: welded.diag, bbox: welded.bbox, triNb, slotEdge, edges, bvh, maxEdge,
    flippedWinding: flipped,
  };
}

/** 면 앞쪽에서 dir 방향으로 쏜 광선이 부품에 막히는지. 메시 오차로 옆 면에 스치는 것을 막으려고 조금 띄운다 */
function makeBlockedTest(mesh) {
  const { N, C, diag, bvh } = mesh;
  const off = Math.max(diag * 1e-5 + 1e-4, 0.04);
  const minHit = 0.12;
  return (t, dx, dy, dz, maxDist = Infinity) => {
    const ox = C[t * 3] + N[t * 3] * off + dx * minHit;
    const oy = C[t * 3 + 1] + N[t * 3 + 1] * off + dy * minHit;
    const oz = C[t * 3 + 2] + N[t * 3 + 2] * off + dz * minHit;
    return raycast(bvh, ox, oy, oz, dx, dy, dz, t, true) < maxDist;
  };
}

function sum(arr) {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s;
}

function areaCentroid(C, A, nt) {
  let x = 0, y = 0, z = 0, a = 0;
  for (let t = 0; t < nt; t++) {
    x += C[t * 3] * A[t];
    y += C[t * 3 + 1] * A[t];
    z += C[t * 3 + 2] * A[t];
    a += A[t];
  }
  return [x / a, y / a, z / a];
}

function dihedralCos(edges, N) {
  const out = new Float32Array(edges.length / 4).fill(1);
  for (let i = 0, e = 0; i < edges.length; i += 4, e++) {
    const t1 = edges[i + 2], t2 = edges[i + 3];
    if (t2 < 0) continue;
    out[e] = N[t1 * 3] * N[t2 * 3] + N[t1 * 3 + 1] * N[t2 * 3 + 1] + N[t1 * 3 + 2] * N[t2 * 3 + 2];
  }
  return out;
}

function vertexAverage(F, nv, values, A) {
  const acc = new Float64Array(nv), w = new Float64Array(nv);
  for (let t = 0; t < F.length / 3; t++) {
    for (let k = 0; k < 3; k++) {
      const v = F[t * 3 + k];
      acc[v] += values[t] * A[t];
      w[v] += A[t];
    }
  }
  const out = new Float32Array(nv);
  for (let v = 0; v < nv; v++) out[v] = w[v] > 0 ? acc[v] / w[v] : 0;
  return out;
}

/** 면 값을 정점 고리 단위로 최댓값 확장 (rings 번) */
function dilateMax(F, nv, values, rings) {
  const nt = F.length / 3;
  let cur = Float32Array.from(values);
  for (let r = 0; r < rings; r++) {
    const vmax = new Float32Array(nv);
    for (let t = 0; t < nt; t++) {
      for (let k = 0; k < 3; k++) {
        const v = F[t * 3 + k];
        if (cur[t] > vmax[v]) vmax[v] = cur[t];
      }
    }
    const next = new Float32Array(nt);
    for (let t = 0; t < nt; t++) next[t] = Math.max(vmax[F[t * 3]], vmax[F[t * 3 + 1]], vmax[F[t * 3 + 2]]);
    cur = next;
  }
  return cur;
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function normalize(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function planeBasis(d) {
  const ref = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  let e1 = [ref[1] * d[2] - ref[2] * d[1], ref[2] * d[0] - ref[0] * d[2], ref[0] * d[1] - ref[1] * d[0]];
  e1 = normalize(e1);
  const e2 = normalize([d[1] * e1[2] - d[2] * e1[1], d[2] * e1[0] - d[0] * e1[2], d[0] * e1[1] - d[1] * e1[0]]);
  return [e1, e2];
}

// ---------- 2. 빼기 방향 ----------

const AXES = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

function axisLabel(d) {
  const ax = Math.abs(d[0]), ay = Math.abs(d[1]), az = Math.abs(d[2]);
  const m = Math.max(ax, ay, az);
  if (m > 0.9995) {
    const k = ax === m ? 0 : ay === m ? 1 : 2;
    return 'XYZ'[k] + (d[k] > 0 ? '+' : '−');
  }
  return `(${d.map((v) => v.toFixed(2)).join(', ')})`;
}

/**
 * 후보 방향마다 언더컷 면적(표본)과 투영 면적을 재서 고른다.
 * 후보: 좌표축 3개 + 면 법선 분포의 주축 3개 + 넓은 평면 묶음의 법선 3개 (3° 안쪽 중복 제거)
 */
function choosePullDirection(mesh, blocked, center, opt) {
  const { N, A, C, nt, V, nv } = mesh;
  const manual = String(opt.pull || 'auto').toLowerCase();
  let dir = null;
  let fixedSign = false;
  let candidates = [];
  let tilted = false;
  if (manual !== 'auto' && AXES[manual[0]]) {
    dir = AXES[manual[0]].slice();
    if (manual[1] === '-' || manual[1] === '−') {
      dir = dir.map((v) => -v);
      fixedSign = true;
    } else if (manual[1] === '+') fixedSign = true;
  } else {
    const lines = [AXES.z, AXES.y, AXES.x].map((v) => ({ dir: v.slice(), axis: true }));
    const m = [0, 0, 0, 0, 0, 0];
    for (let t = 0; t < nt; t++) {
      const x = N[t * 3], y = N[t * 3 + 1], z = N[t * 3 + 2], a = A[t];
      m[0] += a * x * x; m[1] += a * x * y; m[2] += a * x * z;
      m[3] += a * y * y; m[4] += a * y * z; m[5] += a * z * z;
    }
    for (const e of symmetricEigen3(m)) lines.push({ dir: normalize(e.vector), axis: false });
    for (const n of dominantNormals(N, A, nt, 3)) lines.push({ dir: n, axis: false });
    const unique = [];
    for (const c of lines) {
      if (unique.some((u) => Math.abs(dot(u.dir, c.dir)) > Math.cos(3 * DEG))) continue;
      unique.push(c);
    }
    const stride = Math.max(1, Math.floor(nt / 24000));
    for (const c of unique) {
      const [ax, ay, az] = c.dir;
      let under = 0, proj = 0;
      for (let t = 0; t < nt; t += stride) {
        const s = N[t * 3] * ax + N[t * 3 + 1] * ay + N[t * 3 + 2] * az;
        if (s > 0) proj += A[t] * s;
        let u;
        if (s > SIN_BAND) u = blocked(t, ax, ay, az);
        else if (s < -SIN_BAND) u = blocked(t, -ax, -ay, -az);
        else u = blocked(t, ax, ay, az) && blocked(t, -ax, -ay, -az);
        if (u) under += A[t];
      }
      c.under = under * stride;
      c.proj = proj * stride;
    }
    // 언더컷이 가장 작은 것. 차이가 작으면 투영 면적이 큰 것(얇은 방향으로 열림)
    const pickBest = (list) => {
      const best = list.reduce((a, b) => (b.under < a.under ? b : a));
      return list.filter((c) => c.under <= best.under * 1.15 + 1).sort((a, b) => b.proj - a.proj)[0];
    };
    let chosen = pickBest(unique.filter((c) => c.axis));
    // 기운 방향은 언더컷이 30% 이상, 5mm² 이상 줄 때만 쓴다 (금형은 보통 좌표축 기준으로 만든다)
    const others = unique.filter((c) => !c.axis);
    if (others.length) {
      const alt = pickBest(others);
      if (alt.under < chosen.under * 0.7 - 5) {
        chosen = alt;
        tilted = true;
      }
    }
    dir = chosen.dir.slice();
    candidates = unique
      .map((c) => ({ dir: c.dir, label: axisLabel(c.dir).replace(/[+−]$/, ''), under: c.under, proj: c.proj, axis: c.axis }))
      .sort((a, b) => a.under - b.under || b.proj - a.proj);
  }
  if (!fixedSign) {
    // 빼기 방향을 바라보는 면들이 부품 중심에서 바깥을 향하는 쪽을 고정측(캐비티)으로 둔다
    let outP = 0, outN = 0;
    for (let t = 0; t < nt; t++) {
      const s = N[t * 3] * dir[0] + N[t * 3 + 1] * dir[1] + N[t * 3 + 2] * dir[2];
      if (Math.abs(s) < 0.3) continue;
      const rx = C[t * 3] - center[0], ry = C[t * 3 + 1] - center[1], rz = C[t * 3 + 2] - center[2];
      const rl = Math.hypot(rx, ry, rz) || 1;
      const o = ((N[t * 3] * rx + N[t * 3 + 1] * ry + N[t * 3 + 2] * rz) / rl) * A[t] * Math.abs(s);
      if (s > 0) outP += o;
      else outN += o;
    }
    if (outN > outP) dir = dir.map((v) => -v);
  }
  let hMin = Infinity, hMax = -Infinity;
  for (let v = 0; v < nv; v++) {
    const h = V[v * 3] * dir[0] + V[v * 3 + 1] * dir[1] + V[v * 3 + 2] * dir[2];
    if (h < hMin) hMin = h;
    if (h > hMax) hMax = h;
  }
  return { dir, label: axisLabel(dir), auto: manual === 'auto', candidates, tilted, height: hMax - hMin };
}

function dominantNormals(N, A, nt, k) {
  // 법선을 직선(±같음)으로 보고 약 5° 격자에 모은 뒤 면적이 큰 묶음의 평균 법선
  const bins = new Map();
  const q = 12;
  for (let t = 0; t < nt; t++) {
    let x = N[t * 3], y = N[t * 3 + 1], z = N[t * 3 + 2];
    const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
    if ((ax >= ay && ax >= az ? x : ay >= az ? y : z) < 0) {
      x = -x; y = -y; z = -z;
    }
    const key = `${Math.round(x * q)},${Math.round(y * q)},${Math.round(z * q)}`;
    const b = bins.get(key) || { a: 0, x: 0, y: 0, z: 0 };
    b.a += A[t]; b.x += x * A[t]; b.y += y * A[t]; b.z += z * A[t];
    bins.set(key, b);
  }
  return [...bins.values()].sort((a, b) => b.a - a.a).slice(0, k).map((b) => normalize([b.x, b.y, b.z]));
}

// ---------- 3. 양쪽 자유 면 정리 ----------

/**
 * 빼기 방향과 거의 수직이고 위아래 어느 쪽으로도 빠지는 면을 고정측/가동측에 나눈다.
 *  1) 1° 이상 기운 면은 기운 쪽으로 (그쪽에서 양의 구배가 된다)
 *  2) 남은 수직 면은 이어진 덩어리마다, 파팅라인이 날카로운 모서리를 지나는 쪽으로
 *  3) 경계의 들쭉날쭉함은 다수결로 정리
 *  4) 반대쪽에 완전히 둘러싸인 섬은 금형으로 만들 수 없으므로 둘러싼 쪽으로
 * 반환: 양쪽 자유였던 면 표시 (Uint8Array)
 */
function resolveFreeFaces(mesh, side, S, edgeCos, opt) {
  const { F, V, nt, triNb, slotEdge } = mesh;
  const flexible = new Uint8Array(nt);
  for (let t = 0; t < nt; t++) {
    if (side[t] !== 2) continue;
    flexible[t] = 1;
    if (S[t] > SIN_LEAN) side[t] = 1;
    else if (S[t] < -SIN_LEAN) side[t] = -1;
  }
  const smoothCos = Math.cos(opt.plSmoothDeg * DEG);
  const edgeLen = (t, k) => {
    const a = F[t * 3 + k] * 3, b = F[t * 3 + ((k + 1) % 3)] * 3;
    return Math.hypot(V[a] - V[b], V[a + 1] - V[b + 1], V[a + 2] - V[b + 2]);
  };
  const plCost = (t, k) => edgeLen(t, k) * (edgeCos[slotEdge[t * 3 + k]] > smoothCos ? 3 : 1);

  // 2) 수직 덩어리
  const mark = new Uint8Array(nt);
  for (let s = 0; s < nt; s++) {
    if (side[s] !== 2 || mark[s]) continue;
    const list = [s];
    mark[s] = 1;
    let costIfCavity = 0, costIfCore = 0, touchCav = false, touchCore = false;
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      for (let k = 0; k < 3; k++) {
        const u = triNb[t * 3 + k];
        if (u < 0) continue;
        if (side[u] === 2) {
          if (!mark[u]) {
            mark[u] = 1;
            list.push(u);
          }
        } else if (side[u] === -1) {
          costIfCavity += plCost(t, k);
          touchCore = true;
        } else if (side[u] === 1) {
          costIfCore += plCost(t, k);
          touchCav = true;
        }
      }
    }
    let target = 1;
    if (touchCav && touchCore) target = costIfCavity <= costIfCore ? 1 : -1;
    else if (touchCore) target = -1;
    for (const t of list) side[t] = target;
  }

  // 3) 다수결 (거의 수직인 면만)
  for (let pass = 0; pass < 2; pass++) {
    for (let t = 0; t < nt; t++) {
      if (!flexible[t] || Math.abs(S[t]) > SIN_LEAN) continue;
      let vote = 0, total = 0;
      for (let k = 0; k < 3; k++) {
        const u = triNb[t * 3 + k];
        if (u < 0 || side[u] === 0) continue;
        const l = edgeLen(t, k);
        vote += side[u] * l;
        total += l;
      }
      if (total > 0 && Math.sign(vote) === -side[t] && Math.abs(vote) > total * 0.34) side[t] = -side[t];
    }
  }

  // 4) 섬 정리
  const seen = new Uint8Array(nt);
  for (let s = 0; s < nt; s++) {
    if (seen[s] || side[s] === 0) continue;
    const sd = side[s];
    const list = [s];
    seen[s] = 1;
    let allFlexible = true, touchOther = false;
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      if (!flexible[t]) allFlexible = false;
      for (let k = 0; k < 3; k++) {
        const u = triNb[t * 3 + k];
        if (u < 0 || side[u] === 0) continue;
        if (side[u] === sd) {
          if (!seen[u]) {
            seen[u] = 1;
            list.push(u);
          }
        } else touchOther = true;
      }
    }
    if (allFlexible && touchOther) for (const t of list) side[t] = -sd;
  }
  return flexible;
}

// ---------- 4. 살 두께 ----------

/**
 * 면마다 안쪽으로 내접구를 키웠다 줄이며(shrinking ball) 그 지름을 살 두께로 본다.
 * 리브 뿌리 반대쪽처럼 살이 몰린 곳은 지름이 커진다.
 * 두께를 가로지르는 짧은 연결(thru: [정점, 건너편 정점, 가중치, 유동 길이])은 유동 그래프에 쓴다.
 */
function measureThickness(mesh, report) {
  const { V, F, N, A, C, nt, diag, bvh } = mesh;
  const thick = new Float32Array(nt);
  const thru = [];
  const out = [0, 0, 0];
  const eps = diag * 1e-5 + 1e-4;
  // 안쪽으로 쏜 광선이 반대편 면에 닿는 거리 (없으면 Infinity). 맞은 삼각형은 bvh.lastHit
  const inwardRay = (t) => raycast(bvh, C[t * 3] - N[t * 3] * eps, C[t * 3 + 1] - N[t * 3 + 1] * eps, C[t * 3 + 2] - N[t * 3 + 2] * eps,
    -N[t * 3], -N[t * 3 + 1], -N[t * 3 + 2], t, false);
  // 한 면의 내접구 반지름 (shrinking ball). 시작 반지름을 cap 으로 묶으면 그 이상 두꺼운 곳은 cap 으로 잘린다.
  // guess: 바로 앞 면의 결과로 짐작한 시작 반지름. 그 공이 비어 있으면 답이 더 크다는 뜻이므로 상한에서 다시 시작한다
  //        (같은 점에 접하는 공은 반지름 순으로 포개지므로 결과는 짐작 없이 계산한 것과 같다)
  const shrink = (px, py, pz, mx, my, mz, r) => {
    for (let it = 0; it < 12; it++) {
      const cx = px + mx * r, cy = py + my * r, cz = pz + mz * r;
      const dc = nearestPoint(bvh, cx, cy, cz, r, out);
      if (!(dc < r - 1e-3)) return { r, empty: it === 0 };
      const qx = out[0] - px, qy = out[1] - py, qz = out[2] - pz;
      const den = 2 * (qx * mx + qy * my + qz * mz);
      if (den <= 1e-9) return { r, empty: false };
      const rn = (qx * qx + qy * qy + qz * qz) / den;
      if (!(rn < r) || rn <= 1e-4) return { r, empty: false };
      r = rn;
    }
    return { r, empty: false };
  };
  const ball = (t, rayLen, cap, guess = Infinity) => {
    const px = C[t * 3], py = C[t * 3 + 1], pz = C[t * 3 + 2];
    const mx = -N[t * 3], my = -N[t * 3 + 1], mz = -N[t * 3 + 2];
    const upper = Math.min((Number.isFinite(rayLen) ? rayLen : diag * 0.1) / 2, cap);
    if (guess < upper) {
      const first = shrink(px, py, pz, mx, my, mz, guess);
      if (!first.empty) return first.r;
    }
    return shrink(px, py, pz, mx, my, mz, upper).r;
  };
  // 두께를 곧장 가로지르는 연결 (얇은 판 안을 길게 지나가는 광선은 흐름을 왜곡하므로 뺀다)
  const addThru = (t, rayLen, hit, r) => {
    if (!Number.isFinite(rayLen) || hit < 0 || rayLen > Math.max(3 * r, 2 * r + 0.3)) return;
    const mx = -N[t * 3], my = -N[t * 3 + 1], mz = -N[t * 3 + 2];
    const hx = C[t * 3] + mx * rayLen, hy = C[t * 3 + 1] + my * rayLen, hz = C[t * 3 + 2] + mz * rayLen;
    let bv = F[hit * 3], bd = Infinity;
    for (let k = 0; k < 3; k++) {
      const v = F[hit * 3 + k];
      const dd = (V[v * 3] - hx) ** 2 + (V[v * 3 + 1] - hy) ** 2 + (V[v * 3 + 2] - hz) ** 2;
      if (dd < bd) {
        bd = dd;
        bv = v;
      }
    }
    // 두께 방향 성분은 거의 비용 없이, 옆으로 비껴가는 성분은 그대로 친다 (앞뒤를 오가며 미끄러지는 지름길 방지)
    const a = F[t * 3];
    const ex = V[bv * 3] - V[a * 3], ey = V[bv * 3 + 1] - V[a * 3 + 1], ez = V[bv * 3 + 2] - V[a * 3 + 2];
    const along = ex * mx + ey * my + ez * mz;
    const lateral = Math.sqrt(Math.max(0, ex * ex + ey * ey + ez * ez - along * along));
    thru.push(a, bv, lateral + rayLen * 0.2, lateral);
  };
  // 1) 표본(약 6천 면)으로 기본 두께를 먼저 잡는다
  const stride = Math.max(1, Math.floor(nt / 6000));
  const sampleT = [], sampleA = [];
  for (let t = 0; t < nt; t += stride) {
    sampleT.push(2 * ball(t, inwardRay(t), Infinity));
    sampleA.push(A[t]);
  }
  const nominal0 = weightedMedian(sampleT, sampleA) || 1;
  // 2) 전체. 기본 두께의 4배를 넘는 덩어리는 4배로 본다 (판정에는 1.6배까지만 쓴다)
  const cap = nominal0 * 2;
  let prev = cap;
  for (let t = 0; t < nt; t++) {
    const rayLen = inwardRay(t);
    const hit = bvh.lastHit;
    const r = ball(t, rayLen, cap, prev * 1.3 + 0.05);
    prev = r;
    thick[t] = 2 * r;
    addThru(t, rayLen, hit, r);
    if ((t & 8191) === 0) report(t / nt);
  }
  return { thick, thru };
}

// ---------- 5. 파팅라인 ----------

/** 간선 (a,b) 중점에서 r 안의 면들 중 기준 법선과 40° 넘게 다른 면이 있는지 */
function turnsNearby(mesh, t1, t2, a, b, r) {
  const { V, F, N, C, triNb } = mesh;
  const mx = (V[a * 3] + V[b * 3]) / 2, my = (V[a * 3 + 1] + V[b * 3 + 1]) / 2, mz = (V[a * 3 + 2] + V[b * 3 + 2]) / 2;
  const ref = normalize([N[t1 * 3] + N[t2 * 3], N[t1 * 3 + 1] + N[t2 * 3 + 1], N[t1 * 3 + 2] + N[t2 * 3 + 2]]);
  const seen = new Set([t1, t2]);
  const queue = [t1, t2];
  const r2 = r * r;
  // 큰 삼각형도 놓치지 않도록 무게중심이 아니라 가장 가까운 꼭짓점 거리로 범위를 본다
  const near2 = (u) => {
    let best = (C[u * 3] - mx) ** 2 + (C[u * 3 + 1] - my) ** 2 + (C[u * 3 + 2] - mz) ** 2;
    for (let k = 0; k < 3; k++) {
      const v = F[u * 3 + k];
      const d2 = (V[v * 3] - mx) ** 2 + (V[v * 3 + 1] - my) ** 2 + (V[v * 3 + 2] - mz) ** 2;
      if (d2 < best) best = d2;
    }
    return best;
  };
  for (let i = 0; i < queue.length && i < 4000; i++) {
    const t = queue[i];
    if (N[t * 3] * ref[0] + N[t * 3 + 1] * ref[1] + N[t * 3 + 2] * ref[2] < SHARP_COS) return true;
    for (let k = 0; k < 3; k++) {
      const u = triNb[t * 3 + k];
      if (u < 0 || seen.has(u) || near2(u) > r2) continue;
      seen.add(u);
      queue.push(u);
    }
  }
  return false;
}

/**
 * 고정측 면과 가동측 면이 맞닿는 간선을 이어 선으로 만든다.
 * 가장 긴 덩어리가 주 파팅라인, 나머지는 관통부 막음면(shut-off).
 * 곡면을 지나는 구간은 메시 계단이 보이지 않도록 다듬고 표면에 다시 붙인다.
 */
function extractPartingLines(mesh, side, edgeCos, dir, opt, nominal) {
  const { V, N, C, edges, nv, bvh, maxEdge, triNb } = mesh;
  const smoothCos = Math.cos(opt.plSmoothDeg * DEG);
  const ea = [], eb = [], es = [];
  const nearR = Math.max(1, nominal * 0.75);
  for (let i = 0, e = 0; i < edges.length; i += 4, e++) {
    const t1 = edges[i + 2], t2 = edges[i + 3];
    if (t2 < 0 || side[t1] * side[t2] !== -1) continue;
    ea.push(edges[i]);
    eb.push(edges[i + 1]);
    let smooth = edgeCos[e] > smoothCos;
    // 곡면 위라도 바로 옆(기본 두께 정도 안)에서 면이 40° 넘게 꺾이면 모서리 R 위의 파팅 → 자국이 모서리에 묻힌다
    if (smooth) smooth = !turnsNearby(mesh, t1, t2, edges[i], edges[i + 1], nearR);
    es.push(smooth ? 1 : 0);
  }
  const m = ea.length;
  const empty = {
    segments: new Float32Array(0), kinds: new Uint8Array(0), mainLength: 0, smoothLength: 0, shutoffs: 0, step: 0,
    mainVerts: [], allVerts: [],
  };
  if (!m) return empty;

  // 덩어리 (union-find)
  const parent = new Int32Array(nv).fill(-1);
  const find = (x) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  for (let i = 0; i < m; i++) {
    if (parent[ea[i]] < 0) parent[ea[i]] = ea[i];
    if (parent[eb[i]] < 0) parent[eb[i]] = eb[i];
    const ra = find(ea[i]), rb = find(eb[i]);
    if (ra !== rb) parent[ra] = rb;
  }
  const P = (v) => [V[v * 3], V[v * 3 + 1], V[v * 3 + 2]];
  const elen = (i) => Math.hypot(V[ea[i] * 3] - V[eb[i] * 3], V[ea[i] * 3 + 1] - V[eb[i] * 3 + 1], V[ea[i] * 3 + 2] - V[eb[i] * 3 + 2]);
  const compLen = new Map();
  for (let i = 0; i < m; i++) {
    const r = find(ea[i]);
    compLen.set(r, (compLen.get(r) || 0) + elen(i));
  }
  let mainRoot = -1, best = -1;
  for (const [r, l] of compLen) {
    if (l > best) {
      best = l;
      mainRoot = r;
    }
  }
  let shutoffs = 0;
  for (const [r, l] of compLen) if (r !== mainRoot && l > 3) shutoffs++;

  // 정점별 파팅 간선 목록
  const deg = new Map();
  const addInc = (v, i) => {
    const list = deg.get(v);
    if (list) list.push(i);
    else deg.set(v, [i]);
  };
  for (let i = 0; i < m; i++) {
    addInc(ea[i], i);
    addInc(eb[i], i);
  }
  const used = new Uint8Array(m);
  const chains = [];
  const walk = (startV, startE) => {
    const verts = [startV], ids = [];
    let cur = startV, e = startE;
    for (;;) {
      used[e] = 1;
      ids.push(e);
      const next = ea[e] === cur ? eb[e] : ea[e];
      verts.push(next);
      const inc = deg.get(next);
      if (next === startV || inc.length !== 2) break;
      const ne = inc[0] === e ? inc[1] : inc[0];
      if (used[ne]) break;
      cur = next;
      e = ne;
    }
    chains.push({ verts, ids, closed: verts[0] === verts[verts.length - 1] });
  };
  for (const [v, inc] of deg) {
    if (inc.length === 2) continue;
    for (const e of inc) if (!used[e]) walk(v, e);
  }
  for (let i = 0; i < m; i++) if (!used[i]) walk(ea[i], i);

  // 다듬기
  const segs = [], kinds = [];
  let mainLength = 0, smoothLength = 0, hMin = Infinity, hMax = -Infinity;
  const mainVerts = [], allVerts = [];
  const out = [0, 0, 0];
  for (const ch of chains) {
    const isMain = find(ch.verts[0]) === mainRoot;
    const n = ch.verts.length;
    const pts = ch.verts.map(P);
    const movable = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const before = i > 0 ? ch.ids[i - 1] : ch.closed ? ch.ids[ch.ids.length - 1] : -1;
      const after = i < ch.ids.length ? ch.ids[i] : ch.closed ? ch.ids[0] : -1;
      movable[i] = before >= 0 && after >= 0 && es[before] && es[after] ? 1 : 0;
    }
    if (ch.closed) movable[n - 1] = 0; // 닫힌 고리의 마지막 점은 첫 점과 같다
    for (let it = 0; it < 6; it++) {
      const next = pts.map((p) => p.slice());
      for (let i = 0; i < n; i++) {
        if (!movable[i]) continue;
        const a = i > 0 ? pts[i - 1] : pts[n - 2];
        const b = i < n - 1 ? pts[i + 1] : pts[1];
        const q = [0, 1, 2].map((k) => pts[i][k] + 0.5 * ((a[k] + b[k]) / 2 - pts[i][k]));
        if (nearestPoint(bvh, q[0], q[1], q[2], maxEdge * 3, out) < Infinity) next[i] = [out[0], out[1], out[2]];
        else next[i] = q;
      }
      if (ch.closed) next[n - 1] = next[0];
      for (let i = 0; i < n; i++) pts[i] = next[i];
    }
    for (let i = 0; i < n - 1; i++) {
      const e = ch.ids[i];
      const kind = isMain ? (es[e] ? 1 : 0) : 2;
      segs.push(pts[i][0], pts[i][1], pts[i][2], pts[i + 1][0], pts[i + 1][1], pts[i + 1][2]);
      kinds.push(kind);
      const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1], pts[i + 1][2] - pts[i][2]);
      if (isMain) {
        mainLength += l;
        if (kind === 1) smoothLength += l;
      }
    }
    for (const v of ch.verts) {
      allVerts.push(v);
      if (!isMain) continue;
      mainVerts.push(v);
      const h = V[v * 3] * dir[0] + V[v * 3 + 1] * dir[1] + V[v * 3 + 2] * dir[2];
      if (h < hMin) hMin = h;
      if (h > hMax) hMax = h;
    }
  }
  return {
    segments: new Float32Array(segs),
    kinds: new Uint8Array(kinds),
    mainLength,
    smoothLength,
    shutoffs,
    step: Number.isFinite(hMax) ? hMax - hMin : 0,
    mainVerts: [...new Set(mainVerts)],
    allVerts: [...new Set(allVerts)],
  };
}

// ---------- 6. 언더컷 ----------

/**
 * 언더컷 면을 덩어리로 묶고, 가까운 덩어리(같은 창·구멍)는 합친다.
 * 덩어리마다 빼기 방향과 수직인 여러 방향으로 풀어 보고 슬라이드(바깥으로)·리프터(안쪽으로)를 정한다.
 * 깊이 = 푸는 방향으로 잰 언더컷 폭, 이동 거리(stroke) = 깊이 + 2mm
 */
function groupUndercuts(mesh, side, dir, center, nominal, blocked) {
  const { V, F, N, A, C, nt, triNb } = mesh;
  const raw = [];
  const seen = new Uint8Array(nt);
  for (let s = 0; s < nt; s++) {
    if (side[s] !== 0 || seen[s]) continue;
    const tris = [s];
    seen[s] = 1;
    const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    let area = 0;
    for (let i = 0; i < tris.length; i++) {
      const t = tris[i];
      area += A[t];
      for (let k = 0; k < 3; k++) {
        const v = F[t * 3 + k];
        for (let j = 0; j < 3; j++) {
          box[j] = Math.min(box[j], V[v * 3 + j]);
          box[j + 3] = Math.max(box[j + 3], V[v * 3 + j]);
        }
        const u = triNb[t * 3 + k];
        if (u >= 0 && side[u] === 0 && !seen[u]) {
          seen[u] = 1;
          tris.push(u);
        }
      }
    }
    if (area >= 0.3) raw.push({ tris, area, box });
  }
  // 가까운 덩어리 합치기 (상자를 넓혀 겹치면 같은 언더컷)
  const pad = Math.max(1.5, nominal);
  const root = raw.map((_, i) => i);
  const find = (x) => {
    while (root[x] !== x) x = root[x] = root[root[x]];
    return x;
  };
  for (let i = 0; i < raw.length; i++) {
    for (let j = i + 1; j < raw.length; j++) {
      const a = raw[i].box, b = raw[j].box;
      let overlap = true;
      for (let k = 0; k < 3; k++) if (a[k] - pad > b[k + 3] || b[k] - pad > a[k + 3]) overlap = false;
      if (overlap) root[find(i)] = find(j);
    }
  }
  const groups = new Map();
  raw.forEach((r, i) => {
    const g = find(i);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(r);
  });

  const [e1, e2] = planeBasis(dir);
  const result = [];
  for (const parts of groups.values()) {
    const tris = parts.flatMap((p) => p.tris);
    let area = 0, cx = 0, cy = 0, cz = 0, nx = 0, ny = 0, nz = 0;
    for (const t of tris) {
      area += A[t];
      cx += C[t * 3] * A[t]; cy += C[t * 3 + 1] * A[t]; cz += C[t * 3 + 2] * A[t];
      nx += N[t * 3] * A[t]; ny += N[t * 3 + 1] * A[t]; nz += N[t * 3 + 2] * A[t];
    }
    // 흩어진 작은 조각만 모인 묶음은 곡면 메시 잡음이다 (실제 언더컷은 이어진 면이 있다)
    if (area < 2 || (Math.max(...parts.map((p) => p.area)) < 1.5 && area < 10)) continue;
    const c = [cx / area, cy / area, cz / area];
    const proj = (v) => {
      const k = dot(v, dir);
      return [v[0] - k * dir[0], v[1] - k * dir[1], v[2] - k * dir[2]];
    };
    let outward = proj([c[0] - center[0], c[1] - center[1], c[2] - center[2]]);
    const hasOutward = Math.hypot(...outward) > 1e-6;
    outward = hasOutward ? normalize(outward) : e1;
    const dirs = [];
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      dirs.push(normalize([0, 1, 2].map((j) => e1[j] * Math.cos(a) + e2[j] * Math.sin(a))));
    }
    if (hasOutward) dirs.push(outward, outward.map((v) => -v));
    const meanN = proj([nx, ny, nz]);
    if (Math.hypot(...meanN) > area * 0.2) {
      const mn = normalize(meanN);
      dirs.push(mn, mn.map((v) => -v));
    }
    const sample = tris.length > 240 ? tris.slice().sort((a, b) => A[b] - A[a]).slice(0, 240) : tris;
    let sampleA = 0;
    for (const t of sample) sampleA += A[t];
    const freeRatio = (r, maxDist) => {
      let free = 0;
      for (const t of sample) {
        if (N[t * 3] * r[0] + N[t * 3 + 1] * r[1] + N[t * 3 + 2] * r[2] < -SIN_BAND) continue;
        if (!blocked(t, r[0], r[1], r[2], maxDist)) free += A[t];
      }
      return free / (sampleA || 1);
    };
    // 방향마다 언더컷 깊이(그 방향으로 잰 폭)
    const extent = (r) => {
      let lo = Infinity, hi = -Infinity;
      for (const t of tris) {
        for (let k = 0; k < 3; k++) {
          const v = F[t * 3 + k];
          const p = V[v * 3] * r[0] + V[v * 3 + 1] * r[1] + V[v * 3 + 2] * r[2];
          if (p < lo) lo = p;
          if (p > hi) hi = p;
        }
      }
      return Math.max(0, hi - lo);
    };
    // 슬라이드: 바깥쪽으로 끝까지 빠져야 한다 / 리프터: 안쪽으로 짧게(깊이 8mm 이하) 움직이면 된다
    let slide = { r: null, free: -1 }, lifter = { r: null, free: -1 };
    for (const r of dirs) {
      const o = dot(r, outward);
      if (o >= -0.2) {
        const f = freeRatio(r, Infinity) + o * 0.01;
        if (f > slide.free) slide = { r, free: f };
      }
      const depthR = extent(r);
      if (o <= 0.2 && depthR <= LIFTER_MAX_DEPTH) {
        const f = freeRatio(r, depthR + 2) - o * 0.01;
        if (f > lifter.free) lifter = { r, free: f };
      }
    }
    // 슬라이드로 60% 이상 풀리면 슬라이드, 아니면 리프터, 둘 다 모자라면 더 많이 풀리는 쪽 (복합 언더컷)
    const useLifter = slide.free < 0.6 && lifter.free >= 0 && (lifter.free >= 0.6 || lifter.free > slide.free);
    const chosen = useLifter ? lifter : slide;
    const type = useLifter ? 'lifter' : 'slide';
    const release = chosen.r, free = chosen.free;
    const depth = extent(release);
    result.push({
      tris,
      area,
      center: c,
      normal: normalize([nx, ny, nz]),
      release,
      type,
      freeRatio: Math.max(0, Math.min(1, free)),
      complex: free < 0.6,
      depth,
      stroke: Math.ceil((depth + 2) * 2) / 2,
    });
  }
  result.sort((a, b) => b.area - a.area);
  const faceSets = result.map((u) => u.tris);
  for (const u of result) delete u.tris;
  return { list: result, faceSets };
}

// ---------- 7. 유동 그래프 · 게이트 ----------

/**
 * 표면 간선 + 두께를 가로지르는 연결로 수지 흐름을 근사한다.
 * 가중치 = 길이 × (기본 두께 / 그 자리 두께)² → 얇은 곳은 늦게, 두꺼운 곳은 빨리 찬다(0.25~4배로 제한).
 * 맞붙은 삼각형의 반대 꼭짓점도 펼친 길이로 이어 메시 간선만 따라갈 때 생기는 방향 왜곡을 줄인다.
 */
function buildFlowGraph(mesh, vThick, thru, nominal) {
  const { V, F, edges, nv } = mesh;
  const ne = edges.length / 4;
  const factor = (a, b) => {
    const t = (vThick[a] + vThick[b]) / 2 || nominal;
    return Math.min(4, Math.max(0.25, (nominal / t) ** 2));
  };
  const flowList = [];
  const surfList = new Float64Array(ne * 4);
  const third = (t, a, b) => {
    for (let k = 0; k < 3; k++) {
      const v = F[t * 3 + k];
      if (v !== a && v !== b) return v;
    }
    return -1;
  };
  for (let i = 0, e = 0; e < ne; i += 4, e++) {
    const a = edges[i], b = edges[i + 1];
    const ax = V[a * 3], ay = V[a * 3 + 1], az = V[a * 3 + 2];
    const ux = V[b * 3] - ax, uy = V[b * 3 + 1] - ay, uz = V[b * 3 + 2] - az;
    const len = Math.hypot(ux, uy, uz);
    flowList.push(a, b, len * factor(a, b), len);
    surfList[i] = a; surfList[i + 1] = b; surfList[i + 2] = len; surfList[i + 3] = len;
    // 맞붙은 두 삼각형의 반대쪽 꼭짓점을 펼친 직선으로 잇는다 → 메시 간선만 따라갈 때의 지그재그 오차를 줄인다
    const t2 = edges[i + 3];
    if (t2 < 0 || len < 1e-9) continue;
    const c = third(edges[i + 2], a, b), d = third(t2, a, b);
    if (c < 0 || d < 0) continue;
    const proj = (v) => {
      const px = V[v * 3] - ax, py = V[v * 3 + 1] - ay, pz = V[v * 3 + 2] - az;
      const s = (px * ux + py * uy + pz * uz) / len;
      const h = Math.sqrt(Math.max(0, px * px + py * py + pz * pz - s * s));
      return [s, h];
    };
    const [sc, hc] = proj(c), [sd, hd] = proj(d);
    if (hc + hd < 1e-9) continue;
    const cross = sc + ((sd - sc) * hc) / (hc + hd);
    if (cross <= 0 || cross >= len) continue; // 펼친 사각형이 오목하면 꼭짓점을 지나는 길이 더 짧다
    const dl = Math.hypot(sc - sd, hc + hd);
    flowList.push(c, d, dl * factor(c, d), dl);
  }
  // 두께 건너기: 벽 앞뒤 표면은 같은 흐름 앞쪽이 지나가므로 두께 방향은 거의 비용 없이 잇는다.
  // 두께를 그대로 치면 모서리마다 광선 길이 차이로 앞뒤 채움 시간이 어긋나 가짜 웰드라인이 생긴다.
  for (let j = 0; j < thru.length; j += 4) flowList.push(thru[j], thru[j + 1], thru[j + 2], thru[j + 3]);
  return { graph: buildGraph(nv, flowList), surface: buildGraph(nv, surfList) };
}

/** 정점 a-b 간선 위에 step 간격으로 점을 찍어 out(xyz 나열)에 넣는다 (양 끝 포함) */
function samplePoints(V, a, b, step, out) {
  const ax = V[a * 3], ay = V[a * 3 + 1], az = V[a * 3 + 2];
  const dx = V[b * 3] - ax, dy = V[b * 3 + 1] - ay, dz = V[b * 3 + 2] - az;
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy, dz) / step));
  for (let i = 0; i <= n; i++) out.push(ax + (dx * i) / n, ay + (dy * i) / n, az + (dz * i) / n);
}

/** 점 묶음의 최근접 거리 질의용 격자 */
function makePointGrid(points, cell) {
  const map = new Map();
  const key = (i, j, k) => (i * 73856093) ^ (j * 19349663) ^ (k * 83492791);
  for (let p = 0; p < points.length; p += 3) {
    const kk = key(Math.floor(points[p] / cell), Math.floor(points[p + 1] / cell), Math.floor(points[p + 2] / cell));
    const list = map.get(kk);
    if (list) list.push(p);
    else map.set(kk, [p]);
  }
  return {
    /** maxR 안의 가장 가까운 점까지 거리 (없으면 Infinity) */
    nearest(x, y, z, maxR) {
      const r = Math.ceil(maxR / cell);
      const ci = Math.floor(x / cell), cj = Math.floor(y / cell), ck = Math.floor(z / cell);
      let best = maxR * maxR, found = false;
      for (let i = ci - r; i <= ci + r; i++) {
        for (let j = cj - r; j <= cj + r; j++) {
          for (let k = ck - r; k <= ck + r; k++) {
            const list = map.get(key(i, j, k));
            if (!list) continue;
            for (const p of list) {
              const d2 = (points[p] - x) ** 2 + (points[p + 1] - y) ** 2 + (points[p + 2] - z) ** 2;
              if (d2 <= best) {
                best = d2;
                found = true;
              }
            }
          }
        }
      }
      return found ? Math.sqrt(best) : Infinity;
    },
  };
}

/** 파팅라인 선분을 0.5mm 간격 점으로 바꿔 격자에 담는다 */
function partingGrid(segments) {
  const pts = [];
  for (let i = 0; i < segments.length; i += 6) {
    const dx = segments[i + 3] - segments[i], dy = segments[i + 4] - segments[i + 1], dz = segments[i + 5] - segments[i + 2];
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dy, dz) / 0.5));
    for (let k = 0; k <= n; k++) pts.push(segments[i] + (dx * k) / n, segments[i + 1] + (dy * k) / n, segments[i + 2] + (dz * k) / n);
  }
  return makePointGrid(pts, 2);
}

function farthestPointSample(V, list, k) {
  if (!list.length) return [];
  const picks = [];
  const dmin = new Float64Array(list.length).fill(Infinity);
  let cur = list[Math.floor(list.length / 2)];
  for (let it = 0; it < Math.min(k, list.length); it++) {
    picks.push(cur);
    let far = -1, fd = -1;
    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      const d = Math.hypot(V[v * 3] - V[cur * 3], V[v * 3 + 1] - V[cur * 3 + 1], V[v * 3 + 2] - V[cur * 3 + 2]);
      if (d < dmin[i]) dmin[i] = d;
      if (dmin[i] > fd) {
        fd = dmin[i];
        far = list[i];
      }
    }
    if (fd <= 0) break;
    cur = far;
  }
  return picks;
}

/**
 * 게이트 후보
 *  핀 포인트(3단) / 서브마린(2단): 외관 반대쪽의 넓고 평평한 면, 가장자리에서 충분히 떨어진 곳 (리브 끝·테두리 제외)
 *  사이드(에지): 주 파팅라인 위
 * 후보마다 흐름 거리를 계산해 가장 늦게 차는 곳이 빨리 차는 순으로 고른다.
 * 1점으로 길면 2점 게이트 조합도 만든다 (어느 쪽을 쓸지는 재질 한계로 report.js 가 정한다).
 */
function findGates(mesh, flow, side, S, vThick, nominal, thickLimit, parting, plGrid, opt, report) {
  const { V, F, nv, nt, diag, edges } = mesh;
  const cands = [];
  if (opt.cosmetic !== 'both') {
    const gateSide = opt.cosmetic === 'core' ? 1 : -1;
    const inRegion = new Uint8Array(nt);
    const inc = new Uint16Array(nv), incR = new Uint16Array(nv);
    for (let t = 0; t < nt; t++) {
      inRegion[t] = side[t] === gateSide && S[t] * gateSide >= FLAT_GATE_COS ? 1 : 0;
      for (let k = 0; k < 3; k++) {
        const v = F[t * 3 + k];
        inc[v]++;
        if (inRegion[t]) incR[v]++;
      }
    }
    // 평평한 영역의 가장자리 (간선을 0.5mm 간격 점으로) → 가장자리에서 충분히 먼 곳만 (리브 끝·테두리 단 제외)
    const borderPts = [];
    for (let i = 0; i < edges.length; i += 4) {
      const t1 = edges[i + 2], t2 = edges[i + 3];
      if (t2 >= 0 && inRegion[t1] === inRegion[t2]) continue;
      if (t2 < 0 && !inRegion[t1]) continue;
      samplePoints(V, edges[i], edges[i + 1], 0.5, borderPts);
    }
    const borderGrid = makePointGrid(borderPts, 2);
    // 파팅면 가까이(맞붙는 면·테두리 단)는 핀 게이트 자리로 쓰지 않는다
    const plGap = Math.max(1.5, nominal * 2);
    const collect = (rMin, tLo, tHi) => {
      const list = [];
      for (let v = 0; v < nv; v++) {
        if (!incR[v] || incR[v] < inc[v]) continue;
        if (vThick[v] < tLo || vThick[v] > tHi) continue;
        const x = V[v * 3], y = V[v * 3 + 1], z = V[v * 3 + 2];
        if (borderGrid.nearest(x, y, z, rMin) < rMin) continue;
        if (plGrid.nearest(x, y, z, plGap) < plGap) continue;
        list.push(v);
      }
      return list;
    };
    let list = collect(Math.max(1.5, nominal * 0.75), nominal * 0.85, thickLimit);
    if (!list.length) list = collect(Math.max(0.8, nominal * 0.5), nominal * 0.7, thickLimit * 1.1);
    for (const v of farthestPointSample(V, list, 12)) cands.push({ v, kind: 'pin' });
  }
  // 사이드 게이트: 주 파팅라인 위, 살 두께가 기본 두께에 가까운 곳 (얇은 테두리로 들어가면 흐름이 막힌다)
  const edgeSpots = parting.mainVerts.filter((v) => vThick[v] >= nominal * 0.8 && vThick[v] <= thickLimit);
  for (const v of farthestPointSample(V, edgeSpots.length ? edgeSpots : parting.mainVerts, 6)) cands.push({ v, kind: 'edge' });
  if (!cands.length) return { gates: [], plans: [] };

  const evaluated = [];
  cands.forEach((c, i) => {
    const { dist, geo } = shortestPaths(flow.graph, [c.v], { withGeo: true });
    let maxTime = 0, maxFlow = 0;
    for (let v = 0; v < nv; v++) {
      if (dist[v] !== Infinity && dist[v] > maxTime) maxTime = dist[v];
      if (geo[v] !== Infinity && geo[v] > maxFlow) maxFlow = geo[v];
    }
    evaluated.push({ ...c, maxTime, maxFlow, dist, geo });
    report((i + 1) / cands.length);
  });
  evaluated.sort((a, b) => a.maxTime - b.maxTime);

  const pos = (v) => [V[v * 3], V[v * 3 + 1], V[v * 3 + 2]];
  const gap = (a, b) => Math.hypot(V[a * 3] - V[b * 3], V[a * 3 + 1] - V[b * 3 + 1], V[a * 3 + 2] - V[b * 3 + 2]);
  const toGate = (e) => ({
    vertex: e.v,
    position: pos(e.v),
    kind: e.kind,
    maxFlow: e.maxFlow,
    lt: e.maxFlow / nominal,
    localThickness: vThick[e.v] || nominal,
  });
  // 1~3순위: 서로 떨어진 위치, 가능하면 두 종류가 다 보이게
  const spacing = Math.max(8, diag * 0.1);
  const chosen = [];
  for (const e of evaluated) {
    if (chosen.length >= 3) break;
    if (chosen.some((c) => gap(c.v, e.v) < spacing)) continue;
    chosen.push(e);
  }
  if (chosen.length === 3 && chosen.every((c) => c.kind === chosen[0].kind)) {
    const other = evaluated.find((e) => e.kind !== chosen[0].kind && !chosen.some((c) => gap(c.v, e.v) < spacing));
    if (other) chosen[2] = other;
  }
  const gates = chosen.map(toGate);

  const single = evaluated[0];
  const plans = [{
    id: 'single',
    gates: [toGate(single)],
    maxFlow: single.maxFlow,
    lt: single.maxFlow / nominal,
    maxTime: single.maxTime,
    fill: Float32Array.from(single.dist, (d) => (d === Infinity ? -1 : d)),
  }];
  // 2점 게이트: 상위 후보 조합 중 가장 늦게 차는 곳이 가장 빨리 차는 쌍
  const top = evaluated.slice(0, 8);
  let bestPair = null;
  for (let i = 0; i < top.length; i++) {
    for (let j = i + 1; j < top.length; j++) {
      if (gap(top[i].v, top[j].v) < Math.max(10, diag * 0.15)) continue;
      const a = top[i].dist, b = top[j].dist;
      let worst = 0;
      for (let v = 0; v < nv; v++) {
        const d = a[v] < b[v] ? a[v] : b[v];
        if (d !== Infinity && d > worst) worst = d;
      }
      if (!bestPair || worst < bestPair.worst) bestPair = { i, j, worst };
    }
  }
  if (bestPair && bestPair.worst < single.maxTime * 0.85) {
    const ga = top[bestPair.i], gb = top[bestPair.j];
    const fill = new Float32Array(nv);
    let maxFlow = 0;
    for (let v = 0; v < nv; v++) {
      const useA = ga.dist[v] <= gb.dist[v];
      const d = useA ? ga.dist[v] : gb.dist[v];
      fill[v] = d === Infinity ? -1 : d;
      const g = useA ? ga.geo[v] : gb.geo[v];
      if (g !== Infinity && g > maxFlow) maxFlow = g;
    }
    plans.push({
      id: 'double',
      gates: [toGate(ga), toGate(gb)],
      maxFlow,
      lt: maxFlow / nominal,
      maxTime: bestPair.worst,
      fill,
    });
  }
  return { gates, plans };
}

// ---------- 8. 웰드라인 · 에어트랩 ----------

/**
 * 흐름이 돌아 나가야 하는 장애물 (구멍 뒤에 웰드라인이 생긴다)
 *  - 빼기 방향을 축으로 하는 구멍(관통 구멍·코어 핀): 가파른 면이 축을 둘러싸고 안쪽을 본다
 *  - 측면 창·구멍: 슬라이드 언더컷 (축 = 슬라이드 방향)
 */
function findObstacles(mesh, S, undercuts, undercutFaces, dir, nominal) {
  const { V, nv, nt, triNb } = mesh;
  // 부품 자체를 둘러싼 안쪽 벽(상자 내부 등)은 장애물이 아니다 → 축에 수직인 부품 폭의 1/4 이하인 구멍만
  const [e1, e2] = planeBasis(dir);
  let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
  for (let v = 0; v < nv; v += 7) {
    const p = [V[v * 3], V[v * 3 + 1], V[v * 3 + 2]];
    const a = dot(p, e1), b = dot(p, e2);
    if (a < a0) a0 = a;
    if (a > a1) a1 = a;
    if (b < b0) b0 = b;
    if (b > b1) b1 = b;
  }
  const maxHole = 0.25 * Math.min(a1 - a0, b1 - b0);
  const out = [];
  const seen = new Uint8Array(nt);
  const steep = (t) => Math.abs(S[t]) < 0.35;
  for (let s = 0; s < nt; s++) {
    if (seen[s] || !steep(s)) continue;
    const faces = [s];
    seen[s] = 1;
    for (let i = 0; i < faces.length; i++) {
      const t = faces[i];
      for (let k = 0; k < 3; k++) {
        const u = triNb[t * 3 + k];
        if (u >= 0 && !seen[u] && steep(u)) {
          seen[u] = 1;
          faces.push(u);
        }
      }
    }
    if (faces.length < 6 || faces.length > nt * 0.3) continue;
    const ob = tubeAround(mesh, faces, dir);
    if (!ob || ob.radius < 0.5) continue;
    // 큰 통은 뚫린 구멍(링의 안쪽 등)일 때만 장애물. 막힌 통(상자 안쪽)은 흐름이 위에서 한꺼번에 들어온다
    if (ob.radius <= maxHole || throughAxis(mesh, ob.center, dir)) out.push(ob);
  }
  // 측면 창은 이미 국소 형상(언더컷)이므로 크기 제한 없이 닫힌 통이면 장애물
  undercuts.forEach((u, i) => {
    if (u.type !== 'slide' || u.depth > nominal * 3 + 1) return;
    const ob = tubeAround(mesh, undercutFaces[i], u.release);
    if (ob && ob.radius >= 0.5) out.push(ob);
  });
  return out.sort((a, b) => b.radius - a.radius).slice(0, 16);
}

/** 통 중심에서 축 양방향으로 쏜 광선이 모두 부품에 닿지 않으면 뚫린 구멍 */
function throughAxis(mesh, c, axis) {
  const { bvh } = mesh;
  return raycast(bvh, c[0], c[1], c[2], axis[0], axis[1], axis[2], -1, true) === Infinity
    && raycast(bvh, c[0], c[1], c[2], -axis[0], -axis[1], -axis[2], -1, true) === Infinity;
}

/** 면 묶음이 axis 둘레를 감싸며 안쪽을 보는 통(구멍 벽)이면 정점과 반지름을 돌려준다 */
function tubeAround(mesh, faces, axis) {
  const { F, N, A, C } = mesh;
  let area = 0, cx = 0, cy = 0, cz = 0;
  for (const t of faces) {
    area += A[t];
    cx += C[t * 3] * A[t];
    cy += C[t * 3 + 1] * A[t];
    cz += C[t * 3 + 2] * A[t];
  }
  if (area <= 0) return null;
  const c = [cx / area, cy / area, cz / area];
  const [e1, e2] = planeBasis(axis);
  const angles = [];
  let inward = 0, rad = 0;
  for (const t of faces) {
    const q = [C[t * 3] - c[0], C[t * 3 + 1] - c[1], C[t * 3 + 2] - c[2]];
    const kq = dot(q, axis);
    const qp = [q[0] - kq * axis[0], q[1] - kq * axis[1], q[2] - kq * axis[2]];
    const rho = Math.hypot(...qp);
    const n = [N[t * 3], N[t * 3 + 1], N[t * 3 + 2]];
    const kn = dot(n, axis);
    const np = [n[0] - kn * axis[0], n[1] - kn * axis[1], n[2] - kn * axis[2]];
    const nl = Math.hypot(...np);
    if (rho < 1e-9 || nl < 0.3) continue;
    inward += A[t] * (-dot(np, qp) / (rho * nl));
    rad += A[t] * rho;
    angles.push(Math.atan2(dot(np, e2), dot(np, e1)));
  }
  if (angles.length < 4 || inward < area * 0.6) return null;
  // 법선 방향이 축 둘레를 빈틈 120° 이하로 감싸야 닫힌 구멍 (네모 구멍은 90° 간격)
  angles.sort((x, y) => x - y);
  let gap = angles[0] + 2 * Math.PI - angles[angles.length - 1];
  for (let i = 1; i < angles.length; i++) gap = Math.max(gap, angles[i] - angles[i - 1]);
  if (gap > (2 * Math.PI) / 3 + 1e-6) return null;
  const verts = new Set();
  for (const t of faces) for (let k = 0; k < 3; k++) verts.add(F[t * 3 + k]);
  return { verts: Int32Array.from(verts), axis, center: c, radius: rad / area };
}

/**
 * 장애물 뒤 웰드라인: 각 정점에 흐름이 장애물의 어느 쪽(왼쪽/오른쪽)을 돌아왔는지 꼬리표를 붙이고,
 * 꼬리표가 바뀌는 경계를 삼각형 안에서 이어 선으로 만든다. 장애물 크기의 6배(최소 기본 두께 4배)까지만 본다.
 */
function wakeSegments(mesh, flow, tree, obstacles, nominal, side, cosmeticSide, opt, out) {
  const { V, F, nv, nt, slotEdge } = mesh;
  const { start: ss, to: st } = flow.surface;
  const { dist: T, parent, order } = tree;
  const label = new Int8Array(nv);
  const fixed = new Uint8Array(nv);
  for (const ob of obstacles) {
    let lead = -1, trail = -1;
    for (const v of ob.verts) {
      if (T[v] === Infinity) continue;
      if (lead < 0 || T[v] < T[lead]) lead = v;
      if (trail < 0 || T[v] > T[trail]) trail = v;
    }
    if (lead < 0 || trail === lead) continue;
    const ax = ob.axis;
    // 축 둘레로 도는 성분만 본다 (축을 따라 흐르는 구멍이면 왼쪽·오른쪽이 없다)
    const fd = [V[trail * 3] - V[lead * 3], V[trail * 3 + 1] - V[lead * 3 + 1], V[trail * 3 + 2] - V[lead * 3 + 2]];
    const ka = dot(fd, ax);
    const lateral = [fd[0] - ka * ax[0], fd[1] - ka * ax[1], fd[2] - ka * ax[2]];
    if (Math.hypot(...lateral) < ob.radius * 0.5) continue;
    const sideDir = normalize([
      ax[1] * lateral[2] - ax[2] * lateral[1],
      ax[2] * lateral[0] - ax[0] * lateral[2],
      ax[0] * lateral[1] - ax[1] * lateral[0],
    ]);
    label.fill(0);
    fixed.fill(0);
    for (const v of ob.verts) {
      const sd = (V[v * 3] - V[lead * 3]) * sideDir[0] + (V[v * 3 + 1] - V[lead * 3 + 1]) * sideDir[1] + (V[v * 3 + 2] - V[lead * 3 + 2]) * sideDir[2];
      label[v] = sd >= 0 ? 1 : 2;
      fixed[v] = 1;
    }
    for (let i = 0; i < order.length; i++) {
      const v = order[i];
      if (label[v] === 0 && parent[v] >= 0) label[v] = label[parent[v]];
    }
    // 양쪽에서 같은 시각에 닿는 경계는 꼬리표가 들쭉날쭉하다 → 이웃 다수결로 두 번 다듬는다
    for (let pass = 0; pass < 2; pass++) {
      const next = Int8Array.from(label);
      for (let v = 0; v < nv; v++) {
        if (!label[v] || fixed[v]) continue;
        let c1 = 0, c2 = 0;
        for (let e = ss[v]; e < ss[v + 1]; e++) {
          if (label[st[e]] === 1) c1++;
          else if (label[st[e]] === 2) c2++;
        }
        if (label[v] === 1 && c2 > c1 + 1) next[v] = 2;
        else if (label[v] === 2 && c1 > c2 + 1) next[v] = 1;
      }
      label.set(next);
    }
    const reach = Math.max(nominal * 4, ob.radius * 6);
    const tx = V[trail * 3], ty = V[trail * 3 + 1], tz = V[trail * 3 + 2];
    const tMin = T[trail] - nominal;
    for (let t = 0; t < nt; t++) {
      const a = F[t * 3], b = F[t * 3 + 1], c = F[t * 3 + 2];
      const la = label[a], lb = label[b], lc = label[c];
      if (!la || !lb || !lc || (la === lb && lb === lc)) continue;
      if (T[a] < tMin || T[b] < tMin || T[c] < tMin) continue;
      if (Math.hypot(V[a * 3] - tx, V[a * 3 + 1] - ty, V[a * 3 + 2] - tz) > reach) continue;
      const mids = [];
      for (let k = 0; k < 3; k++) {
        const u = F[t * 3 + k], w = F[t * 3 + ((k + 1) % 3)];
        if (label[u] === label[w]) continue;
        mids.push(nv + slotEdge[t * 3 + k], (V[u * 3] + V[w * 3]) / 2, (V[u * 3 + 1] + V[w * 3 + 1]) / 2, (V[u * 3 + 2] + V[w * 3 + 2]) / 2);
      }
      if (mids.length !== 8) continue;
      out.add(mids[0], mids[4], mids[1], mids[2], mids[3], mids[5], mids[6], mids[7], true,
        opt.cosmetic === 'both' || side[t] === cosmeticSide);
    }
  }
}

/**
 * 그 밖의 웰드라인: 흐름 앞쪽(채움 시간의 기울기)이 한 간선을 사이에 두고 정면으로(90° 넘게) 마주 오는 곳.
 * 2점 게이트 사이, 부품을 돌아와 만나는 곳이 여기에 해당한다. 착시를 막으려고 다음을 뺀다.
 *  - 기울기가 흐름 저항만큼 나오지 않는 평평한 구간 (같은 시각에 차는 곳의 잡음)
 *  - 양옆 δ 거리보다 충분히 늦게 차지 않는 국소 굴곡
 *  - 테두리·리브 끝처럼 양옆이 모두 꺾인 좁은 띠 (실제로는 두께 전체가 한 번에 찬다)
 *  - 파팅라인(제품 끝 테두리) 바로 옆 (흐름이 끝나는 곳)
 */
function ridgeSegments(mesh, flow, fill, edgeCos, vThick, nominal, side, cosmeticSide, opt, plGrid, out) {
  const { V, F, N, C, nt, nv, edges, bvh } = mesh;
  const probe = [0, 0, 0];
  // 기울기용 채움 시간: 표면 이웃 평균으로 한 번 다듬어 메시 잡음으로 생긴 작은 굴곡을 줄인다
  const T = Float64Array.from(fill);
  {
    const { start: ss, to: st } = flow.surface;
    const next = new Float64Array(nv);
    for (let v = 0; v < nv; v++) {
      next[v] = T[v];
      if (T[v] < 0) continue;
      let acc = 0, n = 0;
      for (let e = ss[v]; e < ss[v + 1]; e++) {
        if (T[st[e]] >= 0) {
          acc += T[st[e]];
          n++;
        }
      }
      if (n) next[v] = 0.5 * T[v] + (0.5 * acc) / n;
    }
    T.set(next);
  }
  const G = new Float32Array(nt * 3);
  for (let t = 0; t < nt; t++) {
    const a = F[t * 3], b = F[t * 3 + 1], c = F[t * 3 + 2];
    if (T[a] < 0 || T[b] < 0 || T[c] < 0) continue;
    const e1 = [V[b * 3] - V[a * 3], V[b * 3 + 1] - V[a * 3 + 1], V[b * 3 + 2] - V[a * 3 + 2]];
    const e2 = [V[c * 3] - V[a * 3], V[c * 3 + 1] - V[a * 3 + 1], V[c * 3 + 2] - V[a * 3 + 2]];
    const d1 = T[b] - T[a], d2 = T[c] - T[a];
    const g11 = dot(e1, e1), g12 = dot(e1, e2), g22 = dot(e2, e2);
    const det = g11 * g22 - g12 * g12;
    if (det <= 1e-12) continue;
    const al = (d1 * g22 - d2 * g12) / det, be = (d2 * g11 - d1 * g12) / det;
    for (let k = 0; k < 3; k++) G[t * 3 + k] = al * e1[k] + be * e2[k];
  }
  const minT = Math.max(3, nominal * 2);
  const smoothCos = Math.cos(30 * DEG);
  const reach = Math.max(2, nominal);
  const plGap = Math.max(1.5, nominal);
  for (let i = 0; i < edges.length; i += 4) {
    const a = edges[i], b = edges[i + 1], t1 = edges[i + 2], t2 = edges[i + 3];
    if (t2 < 0 || edgeCos[i / 4] < smoothCos) continue;
    if (fill[a] < minT || fill[b] < minT) continue;
    const tLocal = Math.max((vThick[a] + vThick[b]) / 2, nominal * 0.5);
    const g1 = [G[t1 * 3], G[t1 * 3 + 1], G[t1 * 3 + 2]], g2 = [G[t2 * 3], G[t2 * 3 + 1], G[t2 * 3 + 2]];
    const m1 = Math.hypot(...g1), m2 = Math.hypot(...g2);
    const expected = Math.min(4, Math.max(0.25, (nominal / tLocal) ** 2));
    if (m1 < expected * 0.3 || m2 < expected * 0.3) continue;
    if (dot(g1, g2) / (m1 * m2) > 0) continue;
    const mx = (V[a * 3] + V[b * 3]) / 2, my = (V[a * 3 + 1] + V[b * 3 + 1]) / 2, mz = (V[a * 3 + 2] + V[b * 3 + 2]) / 2;
    const ev = normalize([V[b * 3] - V[a * 3], V[b * 3 + 1] - V[a * 3 + 1], V[b * 3 + 2] - V[a * 3 + 2]]);
    const across = (t) => {
      const u = [C[t * 3] - mx, C[t * 3 + 1] - my, C[t * 3 + 2] - mz];
      const k = dot(u, ev);
      return normalize([u[0] - k * ev[0], u[1] - k * ev[1], u[2] - k * ev[2]]);
    };
    const w1 = across(t1), w2 = across(t2);
    if (-dot(g1, w1) / m1 < 0.5 || -dot(g2, w2) / m2 < 0.5) continue;
    const tm = (fill[a] + fill[b]) / 2;
    const rise = (w) => {
      if (nearestPoint(bvh, mx + w[0] * reach, my + w[1] * reach, mz + w[2] * reach, reach, probe) === Infinity) return -Infinity;
      const h = bvh.lastHit;
      const f0 = fill[F[h * 3]], f1 = fill[F[h * 3 + 1]], f2 = fill[F[h * 3 + 2]];
      if (f0 < 0 || f1 < 0 || f2 < 0) return -Infinity;
      return tm - (f0 + f1 + f2) / 3;
    };
    const need = reach * expected * 0.4;
    if (rise(w1) < need || rise(w2) < need) continue;
    const folded = (w, t) => {
      // 띠 너비(≈두께)만큼 옆, 살 쪽으로 조금 들어간 점에서 가장 가까운 면이 크게 꺾여 있으면 그 사이에 모서리가 있다
      const r = tLocal * 1.1, dn = tLocal * 0.25;
      const qx = mx + w[0] * r - N[t * 3] * dn, qy = my + w[1] * r - N[t * 3 + 1] * dn, qz = mz + w[2] * r - N[t * 3 + 2] * dn;
      if (nearestPoint(bvh, qx, qy, qz, r * 2, probe) === Infinity) return false;
      const h = bvh.lastHit;
      return N[h * 3] * N[t * 3] + N[h * 3 + 1] * N[t * 3 + 1] + N[h * 3 + 2] * N[t * 3 + 2] < SHARP_COS;
    };
    if (folded(w1, t1) && folded(w2, t2)) continue;
    if (plGrid.nearest(mx, my, mz, plGap) < plGap) continue;
    out.add(a, b, V[a * 3], V[a * 3 + 1], V[a * 3 + 2], V[b * 3], V[b * 3 + 1], V[b * 3 + 2], false,
      opt.cosmetic === 'both' || side[t1] === cosmeticSide || side[t2] === cosmeticSide);
  }
}

function weldCollector() {
  const na = [], nb = [], pos = [], wake = [], cos = [];
  return {
    na, nb, pos, wake, cos,
    add(a, b, x1, y1, z1, x2, y2, z2, isWake, isCosmetic) {
      na.push(a);
      nb.push(b);
      pos.push(x1, y1, z1, x2, y2, z2);
      wake.push(isWake ? 1 : 0);
      cos.push(isCosmetic ? 1 : 0);
    },
  };
}

/** 선분을 이어진 선으로 묶고, 같은 벽 앞뒤에서 잡힌 선은 합친 뒤 짧은 것을 버린다 */
function groupWeldSegments(seg, nominal) {
  const parent = new Map();
  const find = (x) => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r);
    let c = x;
    while (parent.get(c) !== r) {
      const n = parent.get(c);
      parent.set(c, r);
      c = n;
    }
    return r;
  };
  const n = seg.na.length;
  for (let i = 0; i < n; i++) {
    if (!parent.has(seg.na[i])) parent.set(seg.na[i], seg.na[i]);
    if (!parent.has(seg.nb[i])) parent.set(seg.nb[i], seg.nb[i]);
    const ra = find(seg.na[i]), rb = find(seg.nb[i]);
    if (ra !== rb) parent.set(ra, rb);
  }
  const lines = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(seg.na[i]);
    let L = lines.get(r);
    if (!L) {
      L = { ids: [], length: 0, box: [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], wake: false, cos: 0, cx: 0, cy: 0, cz: 0 };
      lines.set(r, L);
    }
    const p = seg.pos;
    const l = Math.hypot(p[i * 6 + 3] - p[i * 6], p[i * 6 + 4] - p[i * 6 + 1], p[i * 6 + 5] - p[i * 6 + 2]);
    L.ids.push(i);
    L.length += l;
    L.cos += seg.cos[i] * l;
    L.cx += ((p[i * 6] + p[i * 6 + 3]) / 2) * l;
    L.cy += ((p[i * 6 + 1] + p[i * 6 + 4]) / 2) * l;
    L.cz += ((p[i * 6 + 2] + p[i * 6 + 5]) / 2) * l;
    if (seg.wake[i]) L.wake = true;
    for (let k = 0; k < 6; k++) {
      const j = k % 3;
      L.box[j] = Math.min(L.box[j], p[i * 6 + k]);
      L.box[j + 3] = Math.max(L.box[j + 3], p[i * 6 + k]);
    }
  }
  const list = [...lines.values()];
  const pad = Math.max(1, nominal * 1.2);
  const root = list.map((_, i) => i);
  const findL = (x) => {
    while (root[x] !== x) x = root[x] = root[root[x]];
    return x;
  };
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i].box, b = list[j].box;
      let overlap = true;
      for (let k = 0; k < 3; k++) if (a[k] - pad > b[k + 3] || b[k] - pad > a[k + 3]) overlap = false;
      if (overlap) root[findL(i)] = findL(j);
    }
  }
  const merged = new Map();
  list.forEach((L, i) => {
    const r = findL(i);
    if (!merged.has(r)) merged.set(r, []);
    merged.get(r).push(L);
  });
  // 장애물 뒤 선은 짧아도 남기고, 그 밖의 마주침은 기본 두께 2배(최소 4mm) 이상만 남긴다
  const minWake = Math.max(1.5, nominal), minRidge = Math.max(4, nominal * 2);
  const outSegs = [], groups = [];
  for (const members of merged.values()) {
    const longest = Math.max(...members.map((L) => L.length));
    const isWake = members.some((L) => L.wake);
    if (longest < (isWake ? minWake : minRidge)) continue;
    let total = 0, cx = 0, cy = 0, cz = 0;
    for (const L of members) {
      total += L.length;
      cx += L.cx;
      cy += L.cy;
      cz += L.cz;
      for (const i of L.ids) for (let k = 0; k < 6; k++) outSegs.push(seg.pos[i * 6 + k]);
    }
    groups.push({
      center: [cx / total, cy / total, cz / total],
      length: longest,
      // 묶음 중 한 줄이라도 대부분 외관면 위에 있으면 외관에 보이는 웰드라인
      cosmetic: members.some((L) => L.cos > L.length * 0.5),
      behindObstacle: isWake,
    });
  }
  groups.sort((a, b) => b.length - a.length);
  return { weld: new Float32Array(outSegs), weldGroups: groups };
}

/** 에어트랩: 주변보다 늦게 차는 국소 최대점 (파팅면 위면 자연 배기, 아니면 벤트 필요) */
function airTraps(mesh, flow, fill, maxT, nominal, plGrid) {
  const { V, nv, diag } = mesh;
  const { start, to } = flow.graph;
  const peaks = [];
  for (let u = 0; u < nv; u++) {
    if (fill[u] < maxT * 0.6) continue;
    let top = true;
    for (let e = start[u]; e < start[u + 1]; e++) {
      if (fill[to[e]] > fill[u]) {
        top = false;
        break;
      }
    }
    if (top) peaks.push(u);
  }
  peaks.sort((a, b) => fill[b] - fill[a]);
  const spacing = Math.max(4, diag * 0.04);
  const near = Math.max(1, nominal * 0.75);
  const air = [];
  for (const u of peaks) {
    if (air.length >= 6) break;
    const p = [V[u * 3], V[u * 3 + 1], V[u * 3 + 2]];
    if (air.some((q) => Math.hypot(q.position[0] - p[0], q.position[1] - p[1], q.position[2] - p[2]) < spacing)) continue;
    air.push({ position: p, atParting: plGrid.nearest(p[0], p[1], p[2], near) <= near, fillRatio: maxT ? fill[u] / maxT : 1 });
  }
  return air;
}

/** 게이트 배치(plan)마다 웰드라인·에어트랩 */
function meldAndAir(mesh, flow, plan, obstacles, edgeCos, vThick, nominal, side, opt, plGrid) {
  const { nv } = mesh;
  const fill = plan.fill;
  const cosmeticSide = opt.cosmetic === 'core' ? -1 : 1;
  let maxT = 0;
  for (let v = 0; v < nv; v++) if (fill[v] > maxT) maxT = fill[v];
  const tree = shortestPaths(flow.graph, plan.gates.map((g) => g.vertex), { withParent: true });
  const seg = weldCollector();
  wakeSegments(mesh, flow, tree, obstacles, nominal, side, cosmeticSide, opt, seg);
  ridgeSegments(mesh, flow, fill, edgeCos, vThick, nominal, side, cosmeticSide, opt, plGrid, seg);
  const { weld, weldGroups } = groupWeldSegments(seg, nominal);
  return { maxTime: maxT, weld, weldGroups, air: airTraps(mesh, flow, fill, maxT, nominal, plGrid) };
}
