// 정밀 해석 (LTspice·Micro-Cap 식): 동작점·과도·교류(보드 선도)·직류 스윕과 반복(값 바꾸기·몬테카를로·온도)
// 실시간 화면과 같은 부품 모델을 쓰고, 결과는 모든 노드 전압과 부품 전류를 기록해 둔다(해석 뒤에 무엇이든 그래프로 볼 수 있게).
import { Simulator } from './solver.js';
import { traceValue } from './scope.js';
import { PARTS } from './parts.js';

const MAX_POINTS = 4000;

/** 기록용: 노드 전압(화면 노드만)과 부품 대표 전류 */
function snapshot(sim) {
  const nodes = new Float64Array(sim.nTopo);
  for (let i = 0; i < sim.nTopo; i++) nodes[i] = sim.x[i] || 0;
  const elems = {};
  for (const el of sim.els) elems[el.id] = traceValue(el.part, el.out, 'i');
  return { nodes, elems };
}

function collector(sim) {
  const x = [], nodes = Array.from({ length: sim.nTopo }, () => []), elems = Object.fromEntries(sim.els.map((e) => [e.id, []]));
  return {
    push(xv) {
      const s = snapshot(sim);
      x.push(xv);
      s.nodes.forEach((v, i) => nodes[i].push(v));
      Object.entries(s.elems).forEach(([id, v]) => elems[id].push(v));
    },
    done(extra) {
      return {
        x: Float64Array.from(x),
        nodes: nodes.map((a) => Float64Array.from(a)),
        elems: Object.fromEntries(Object.entries(elems).map(([k, a]) => [k, Float64Array.from(a)])),
        ...extra,
      };
    },
  };
}

/** 직류 동작점 */
export function operatingPoint(circuit, { temp = 27 } = {}) {
  const sim = new Simulator(circuit, { temp, mode: 'dc' });
  if (sim.error) return { kind: 'op', error: sim.error };
  if (!sim.solveDC()) return { kind: 'op', error: sim.error };
  const nodes = Array.from({ length: sim.nTopo }, (_, i) => sim.x[i]);
  const elems = sim.els.map((el) => ({ id: el.id, type: el.type, volts: el.out.volts, ti: el.out.ti, power: el.out.power, region: el.out.region, current: traceValue(el.part, el.out, 'i') }));
  return { kind: 'op', nodes, elems, warnings: sim.warnings };
}

/**
 * 과도 해석. stop: 끝 시간(s), maxStep: 최대 시간 간격(s, 없으면 stop/2000), fromZero: 0 에서 시작(전원 켜기)
 * onProgress(0~1)
 */
export function transient(circuit, { stop = 0.01, maxStep = 0, fromZero = false, temp = 27, onProgress } = {}) {
  const dt = Math.min(maxStep > 0 ? maxStep : stop / 2000, stop / 50);
  const steps = Math.ceil(stop / dt - 1e-9);
  const every = Math.max(1, Math.ceil(steps / MAX_POINTS));
  const sim = new Simulator(circuit, { dt, temp });
  if (sim.error) return { kind: 'tran', error: sim.error };
  if (!fromZero && !sim.solveDC()) return { kind: 'tran', error: sim.error };
  sim.compute();
  const rec = collector(sim);
  rec.push(0);
  for (let k = 1; k <= steps; k++) {
    if (!sim.step()) return { kind: 'tran', error: sim.error };
    if (k % every === 0 || k === steps) rec.push(sim.t);
    if (onProgress && k % 500 === 0) onProgress(k / steps);
  }
  return rec.done({ kind: 'tran', dt, slow: sim.slow });
}

// ── 복소수 LU ──
function luFactorC(re, im, n) {
  const piv = new Int32Array(n);
  for (let k = 0; k < n; k++) {
    let p = k, best = Math.hypot(re[k * n + k], im[k * n + k]);
    for (let i = k + 1; i < n; i++) { const v = Math.hypot(re[i * n + k], im[i * n + k]); if (v > best) { best = v; p = i; } }
    if (best < 1e-30) return null;
    piv[k] = p;
    if (p !== k) for (let j = 0; j < n; j++) {
      let t = re[k * n + j]; re[k * n + j] = re[p * n + j]; re[p * n + j] = t;
      t = im[k * n + j]; im[k * n + j] = im[p * n + j]; im[p * n + j] = t;
    }
    const dr = re[k * n + k], di = im[k * n + k], dd = dr * dr + di * di;
    for (let i = k + 1; i < n; i++) {
      const ar = re[i * n + k], ai = im[i * n + k];
      const fr = (ar * dr + ai * di) / dd, fi = (ai * dr - ar * di) / dd;
      re[i * n + k] = fr; im[i * n + k] = fi;
      if (fr === 0 && fi === 0) continue;
      for (let j = k + 1; j < n; j++) {
        const br = re[k * n + j], bi = im[k * n + j];
        re[i * n + j] -= fr * br - fi * bi;
        im[i * n + j] -= fr * bi + fi * br;
      }
    }
  }
  return piv;
}
function luSolveC(re, im, piv, bre, bim, n) {
  const xr = Float64Array.from(bre), xi = Float64Array.from(bim);
  for (let k = 0; k < n; k++) { const p = piv[k]; if (p !== k) { let t = xr[k]; xr[k] = xr[p]; xr[p] = t; t = xi[k]; xi[k] = xi[p]; xi[p] = t; } }
  for (let i = 0; i < n; i++) {
    let sr = xr[i], si = xi[i];
    for (let j = 0; j < i; j++) { const ar = re[i * n + j], ai = im[i * n + j]; sr -= ar * xr[j] - ai * xi[j]; si -= ar * xi[j] + ai * xr[j]; }
    xr[i] = sr; xi[i] = si;
  }
  for (let i = n - 1; i >= 0; i--) {
    let sr = xr[i], si = xi[i];
    for (let j = i + 1; j < n; j++) { const ar = re[i * n + j], ai = im[i * n + j]; sr -= ar * xr[j] - ai * xi[j]; si -= ar * xi[j] + ai * xr[j]; }
    const dr = re[i * n + i], di = im[i * n + i], dd = dr * dr + di * di;
    xr[i] = (sr * dr + si * di) / dd; xi[i] = (si * dr - sr * di) / dd;
  }
  return [xr, xi];
}

export const AC_SOURCES = new Set(['dcv', 'acv', 'pulse', 'dci']);

/** 교류 소신호 해석: 동작점에서 선형화한 뒤 sourceId 전원에 1 V(전류원이면 1 A) 교류를 넣고 주파수를 훑는다 */
export function acAnalysis(circuit, { sourceId, fStart = 10, fStop = 1e6, perDecade = 20, temp = 27 } = {}) {
  const sim = new Simulator(circuit, { temp, mode: 'dc' });
  if (sim.error) return { kind: 'ac', error: sim.error };
  const src = sim.els.find((e) => e.id === sourceId && AC_SOURCES.has(e.type));
  if (!src) return { kind: 'ac', error: '교류 신호를 넣을 전원을 고르세요.' };
  if (!sim.solveDC()) return { kind: 'ac', error: sim.error };
  sim.mode = 'acbase';
  const S = sim.size;
  const A0 = new Float64Array(S * S), b0 = new Float64Array(S);
  sim.stamp(A0, b0, sim.x, 0);
  const idx = (n) => n - 1;
  const fA = Math.max(fStart, 1e-3), fB = Math.max(fStop, fA * 1.0001);
  const decades = Math.log10(fB / fA);
  const N = Math.max(2, Math.round(decades * perDecade) + 1);
  const freqs = new Float64Array(N);
  const nodesRe = Array.from({ length: sim.nTopo }, () => new Float64Array(N));
  const nodesIm = Array.from({ length: sim.nTopo }, () => new Float64Array(N));
  const elemRe = {}, elemIm = {};
  const passive = sim.els.filter((e) => ['resistor', 'capacitor', 'inductor', 'dcv', 'acv', 'pulse', 'ammeter', 'switch'].includes(e.type));
  passive.forEach((e) => { elemRe[e.id] = new Float64Array(N); elemIm[e.id] = new Float64Array(N); });

  for (let k = 0; k < N; k++) {
    const f = fA * Math.pow(10, (decades * k) / (N - 1));
    const w = 2 * Math.PI * f;
    freqs[k] = f;
    const re = Float64Array.from(A0), im = new Float64Array(S * S);
    const addY = (n1, n2, g) => {
      if (n1) im[idx(n1) * S + idx(n1)] += g;
      if (n2) im[idx(n2) * S + idx(n2)] += g;
      if (n1 && n2) { im[idx(n1) * S + idx(n2)] -= g; im[idx(n2) * S + idx(n1)] -= g; }
    };
    for (const el of sim.els) {
      const q = el.part.props || {};
      const [a, c] = el.n;
      if (el.type === 'capacitor') addY(a, c, w * Math.max(Number(q.c) || 0, 1e-18));
      if (el.type === 'inductor') addY(a, c, -1 / (w * Math.max(Number(q.l) || 0, 1e-12)));
    }
    const bre = new Float64Array(S), bim = new Float64Array(S);
    if (src.type === 'dci') { const [a, c] = src.n; if (a) bre[idx(a)] -= 1; if (c) bre[idx(c)] += 1; }
    else bre[src.br] = 1;
    const piv = luFactorC(re, im, S);
    if (!piv) return { kind: 'ac', error: '교류 해석 행렬을 풀 수 없습니다. 회로 연결을 확인하세요.' };
    const [xr, xi] = luSolveC(re, im, piv, bre, bim, S);
    for (let i = 0; i < sim.nTopo; i++) { nodesRe[i][k] = xr[i]; nodesIm[i][k] = xi[i]; }
    const V = (n) => (n ? [xr[idx(n)], xi[idx(n)]] : [0, 0]);
    for (const el of passive) {
      const q = el.part.props || {};
      const [va, vc] = [V(el.n[0]), V(el.n[1])];
      const dr = va[0] - vc[0], di = va[1] - vc[1];
      let ir = 0, ii = 0;
      if (el.type === 'resistor') { const g = 1 / Math.max(Number(q.r) || 0, 1e-6); ir = dr * g; ii = di * g; }
      else if (el.type === 'switch') { const g = q.closed ? 1e3 : 1e-12; ir = dr * g; ii = di * g; }
      else if (el.type === 'capacitor') { const b = w * (Number(q.c) || 0); ir = -di * b; ii = dr * b; }
      else if (el.type === 'inductor') { const b = -1 / (w * Math.max(Number(q.l) || 0, 1e-12)); ir = -di * b; ii = dr * b; }
      else { ir = xr[el.br]; ii = xi[el.br]; }
      elemRe[el.id][k] = ir; elemIm[el.id][k] = ii;
    }
  }
  return { kind: 'ac', x: freqs, nodesRe, nodesIm, elemRe, elemIm };
}

/** 직류 스윕: sourceId 전원의 값을 from→to 로 바꿔 가며 동작점을 푼다 */
export function dcSweep(circuit, { sourceId, from = 0, to = 5, points = 101, temp = 27 } = {}) {
  const sim = new Simulator(circuit, { temp, mode: 'dc' });
  if (sim.error) return { kind: 'dc', error: sim.error };
  const src = sim.els.find((e) => e.id === sourceId && ['dcv', 'dci', 'acv', 'pulse'].includes(e.type));
  if (!src) return { kind: 'dc', error: '값을 바꿔 갈 전원을 고르세요.' };
  const n = Math.max(2, Math.min(2000, Math.round(points)));
  const rec = collector(sim);
  for (let k = 0; k < n; k++) {
    const v = from + ((to - from) * k) / (n - 1);
    sim.override = { id: sourceId, value: v };
    sim.error = '';
    if (!sim.solveDC()) return { kind: 'dc', error: `${v} 에서 ${sim.error}` };
    sim.compute();
    rec.push(v);
  }
  return rec.done({ kind: 'dc', unit: src.type === 'dci' ? 'A' : 'V' });
}

// ── 반복 해석 ──
/** 재현 가능한 난수 (mulberry32) */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TOL_KEYS = { resistor: 'r', capacitor: 'c', inductor: 'l', pot: 'r' };

/** 몬테카를로: 저항·콘덴서·코일 값을 ±tol % 안에서 고르게 흔든 회로 */
export function jitterCircuit(circuit, tol, random) {
  return {
    ...circuit,
    parts: circuit.parts.map((p) => {
      const k = TOL_KEYS[p.type];
      if (!k) return p;
      const v = Number(p.props?.[k]) || 0;
      return { ...p, props: { ...p.props, [k]: v * (1 + (tol / 100) * (2 * random() - 1)) } };
    }),
  };
}

export function withProp(circuit, partId, key, value) {
  return { ...circuit, parts: circuit.parts.map((p) => (p.id === partId ? { ...p, props: { ...p.props, [key]: value } } : p)) };
}

function runOne(circuit, s, temp, onProgress) {
  if (s.type === 'op') return operatingPoint(circuit, { temp });
  if (s.type === 'tran') return transient(circuit, { stop: s.stop, maxStep: s.maxStep, fromZero: s.fromZero, temp, onProgress });
  if (s.type === 'ac') return acAnalysis(circuit, { sourceId: s.sourceId, fStart: s.fStart, fStop: s.fStop, perDecade: s.perDecade, temp });
  if (s.type === 'dc') return dcSweep(circuit, { sourceId: s.sourceId, from: s.from, to: s.to, points: s.points, temp });
  return { error: '알 수 없는 해석입니다.' };
}

/**
 * 해석 실행. settings: { type, ...해석 값, temp, sweep: { kind: 'none'|'param'|'mc'|'temp', ... } }
 * 반환: { type, runs: [{ label, result }], error }
 */
export function runAnalysis(circuit, settings, onProgress) {
  const temp = Number.isFinite(Number(settings.temp)) ? Number(settings.temp) : 27;
  const sw = settings.sweep || { kind: 'none' };
  const jobs = [];
  if (sw.kind === 'param' && sw.partId && sw.key && sw.values?.length) {
    const part = circuit.parts.find((p) => p.id === sw.partId);
    const fld = PARTS[part?.type]?.fields?.find((f) => f[0] === sw.key);
    sw.values.forEach((v) => jobs.push({ label: `${fld?.[1] || sw.key} = ${v}`, circuit: withProp(circuit, sw.partId, sw.key, v), temp }));
  } else if (sw.kind === 'mc') {
    const random = rng(Number(sw.seed) || 1);
    const n = Math.max(1, Math.min(200, Math.round(Number(sw.runs) || 20)));
    jobs.push({ label: '기준값', circuit, temp });
    for (let i = 1; i < n; i++) jobs.push({ label: `${i + 1}회`, circuit: jitterCircuit(circuit, Number(sw.tol) || 5, random), temp });
  } else if (sw.kind === 'temp' && sw.values?.length) {
    sw.values.forEach((t) => jobs.push({ label: `${t} °C`, circuit, temp: Number(t) }));
  } else jobs.push({ label: '', circuit, temp });

  const runs = [];
  for (let i = 0; i < jobs.length; i++) {
    const j = jobs[i];
    const result = runOne(j.circuit, settings, j.temp, (p) => onProgress?.((i + p) / jobs.length));
    if (result.error) return { type: settings.type, runs, error: jobs.length > 1 ? `${j.label}: ${result.error}` : result.error };
    runs.push({ label: j.label, temp: j.temp, result });
    onProgress?.((i + 1) / jobs.length);
  }
  return { type: settings.type, sweepKind: sw.kind, runs };
}

// ── 측정 (LTspice .meas 처럼) ──
/** 시간 파형: 최소·최대·평균·실효값·피크 간·마지막 값·주파수 */
export function measureWave(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 2) return null;
  let mn = Infinity, mx = -Infinity, area = 0, sq = 0;
  for (let i = 0; i < n; i++) { mn = Math.min(mn, y[i]); mx = Math.max(mx, y[i]); }
  for (let i = 1; i < n; i++) {
    const h = x[i] - x[i - 1];
    area += ((y[i] + y[i - 1]) / 2) * h;
    sq += ((y[i] * y[i] + y[i - 1] * y[i - 1]) / 2) * h;
  }
  const T = x[n - 1] - x[0] || 1;
  const avg = area / T;
  // 주파수: 가운데 값을 위로 지나는 시점 사이 간격 평균
  const mid = (mn + mx) / 2, hyst = (mx - mn) * 0.05;
  const ups = [];
  let below = y[0] < mid - hyst;
  for (let i = 1; i < n; i++) {
    if (below && y[i] >= mid) {
      const f = (mid - y[i - 1]) / ((y[i] - y[i - 1]) || 1);
      ups.push(x[i - 1] + f * (x[i] - x[i - 1]));
      below = false;
    } else if (y[i] < mid - hyst) below = true;
  }
  const freq = mx - mn > 1e-12 && ups.length >= 2 ? (ups.length - 1) / (ups[ups.length - 1] - ups[0]) : NaN;
  return { min: mn, max: mx, avg, rms: Math.sqrt(sq / T), pp: mx - mn, final: y[n - 1], freq };
}

/** 교류: 크기(dB)·위상과 저주파 이득, 최대 이득, −3 dB 주파수 */
export function measureBode(f, re, im) {
  const n = f.length;
  const db = new Float64Array(n), ph = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    db[i] = 20 * Math.log10(Math.hypot(re[i], im[i]) || 1e-30);
    ph[i] = (Math.atan2(im[i], re[i]) * 180) / Math.PI;
  }
  // 위상을 이어지게 펼친다
  for (let i = 1; i < n; i++) { while (ph[i] - ph[i - 1] > 180) ph[i] -= 360; while (ph[i] - ph[i - 1] < -180) ph[i] += 360; }
  let peak = 0;
  for (let i = 1; i < n; i++) if (db[i] > db[peak]) peak = i;
  const ref = db[0];
  let f3 = NaN;
  for (let i = 1; i < n; i++) {
    if (db[i - 1] >= ref - 3 && db[i] < ref - 3) {
      const t = (ref - 3 - db[i - 1]) / (db[i] - db[i - 1]);
      f3 = Math.pow(10, Math.log10(f[i - 1]) + t * (Math.log10(f[i]) - Math.log10(f[i - 1])));
      break;
    }
  }
  return { db, ph, lowGain: ref, peakGain: db[peak], peakFreq: f[peak], f3db: f3 };
}
