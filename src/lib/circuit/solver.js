// 회로 시뮬레이터 계산 엔진: 수정 절점 해석(MNA) + 뉴턴 반복 + 사다리꼴 적분
// 브라우저에서 바로 돌고, 같은 코드를 검산 스크립트(node)에서도 쓴다.
import { buildTopology, wireCurrents } from './topology.js';
import { LED_COLORS, terminals } from './parts.js';

const VT = 0.025852; // 27 °C 열전압
const GMIN = 1e-10;
const R_ON = 1e-3; // 닫힌 스위치·전류계 대신 쓰는 아주 작은 저항
const NONLINEAR = new Set(['diode', 'zener', 'led', 'npn', 'pnp', 'nmos', 'pmos', 'opamp']);
const BRANCH = new Set(['dcv', 'acv', 'pulse', 'ammeter', 'opamp']);

const safeExp = (x) => Math.exp(Math.min(x, 80));

/** SPICE 의 접합 전압 제한: 뉴턴 반복이 지수 함수에서 튀지 않게 한다 */
function pnjlim(vnew, vold, vt, vcrit) {
  if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
    if (vold > 0) {
      const arg = 1 + (vnew - vold) / vt;
      return arg > 0 ? vold + vt * Math.log(arg) : vcrit;
    }
    return vt * Math.log(vnew / vt);
  }
  return vnew;
}
const vcritOf = (is, nvt) => nvt * Math.log(nvt / (Math.SQRT2 * is));
const clampStep = (vnew, vold, max) => vold + Math.max(-max, Math.min(max, vnew - vold));

/** LU 분해(부분 피벗). 특이 행렬이면 null */
function luFactor(a, n) {
  const piv = new Int32Array(n);
  for (let k = 0; k < n; k++) {
    let p = k, best = Math.abs(a[k * n + k]);
    for (let i = k + 1; i < n; i++) { const v = Math.abs(a[i * n + k]); if (v > best) { best = v; p = i; } }
    if (best < 1e-18) return null;
    piv[k] = p;
    if (p !== k) for (let j = 0; j < n; j++) { const t = a[k * n + j]; a[k * n + j] = a[p * n + j]; a[p * n + j] = t; }
    const d = a[k * n + k];
    for (let i = k + 1; i < n; i++) {
      const f = (a[i * n + k] /= d);
      if (f !== 0) for (let j = k + 1; j < n; j++) a[i * n + j] -= f * a[k * n + j];
    }
  }
  return piv;
}
function luSolve(a, piv, b, n) {
  const x = Float64Array.from(b);
  for (let k = 0; k < n; k++) { const p = piv[k]; if (p !== k) { const t = x[k]; x[k] = x[p]; x[p] = t; } }
  for (let i = 0; i < n; i++) { let s = x[i]; for (let j = 0; j < i; j++) s -= a[i * n + j] * x[j]; x[i] = s; }
  for (let i = n - 1; i >= 0; i--) { let s = x[i]; for (let j = i + 1; j < n; j++) s -= a[i * n + j] * x[j]; x[i] = s / a[i * n + i]; }
  return x;
}

// ── 소자 모델 ──
function diodeModel(vd, is, nvt) {
  const e = safeExp(vd / nvt);
  return { i: is * (e - 1), g: (is * e) / nvt };
}
/** 제너: 순방향은 일반 다이오드, 역방향은 제너 전압에서 1 mA 가 흐르도록(SPICE 의 BV·IBV) */
const IBV = 1e-3;
function zenerModel(vd, is, nvt, vz) {
  const f = diodeModel(vd, is, nvt);
  const e = safeExp((-vd - vz) / nvt);
  return { i: f.i - IBV * e, g: f.g + (IBV * e) / nvt };
}
/** NPN 에버스-몰(전달형). vbe, vbc → 컬렉터·베이스로 들어가는 전류와 미분 */
function bjtModel(vbe, vbc, is, bf, br) {
  const ef = safeExp(vbe / VT), er = safeExp(vbc / VT);
  const iF = is * (ef - 1), iR = is * (er - 1);
  const gf = (is * ef) / VT, gr = (is * er) / VT;
  return {
    ic: iF - iR * (1 + 1 / br), ib: iF / bf + iR / br,
    dic_be: gf, dic_bc: -gr * (1 + 1 / br), dib_be: gf / bf, dib_bc: gr / br,
  };
}
/** MOSFET 1단계(제곱 법칙). vds ≥ 0 기준 */
function mosCore(vgs, vds, vth, kp, lambda) {
  const vov = vgs - vth;
  if (vov <= 0) return { id: 0, gm: 0, gds: 0, region: '차단' };
  const cl = 1 + lambda * vds;
  if (vds < vov) {
    const base = vov * vds - (vds * vds) / 2;
    return { id: kp * base * cl, gm: kp * vds * cl, gds: kp * (vov - vds) * cl + kp * base * lambda, region: '선형' };
  }
  return { id: (kp / 2) * vov * vov * cl, gm: kp * vov * cl, gds: (kp / 2) * vov * vov * lambda, region: '포화' };
}
function mosModel(vgs, vds, vth, kp, lambda) {
  if (vds >= 0) return mosCore(vgs, vds, vth, kp, lambda);
  // 드레인·소스가 뒤바뀐 경우
  const r = mosCore(vgs - vds, -vds, vth, kp, lambda);
  return { id: -r.id, gm: -r.gm, gds: r.gm + r.gds, region: r.region };
}
const ledIs = (vf) => 0.02 / (Math.exp(vf / (2 * VT)) - 1);

export class Simulator {
  constructor(circuit, { dt = 1e-5, method = 'trap' } = {}) {
    this.dt = dt;
    this.method = method;
    this.t = 0;
    this.error = '';
    this.slow = 0; // 수렴하지 못한 단계 수
    this.load(circuit);
  }

  load(circuit) {
    this.circuit = circuit;
    const topo = buildTopology(circuit);
    this.topo = topo;
    this.warnings = topo.warnings;
    this.nNodes = topo.nodeCount - 1;
    let br = this.nNodes;
    this.els = topo.elements.map((e) => {
      const el = { id: e.part.id, type: e.part.type, part: e.part, n: e.nodes, st: {} };
      if (BRANCH.has(el.type)) el.br = br++;
      return el;
    });
    this.size = br;
    this.x = new Float64Array(this.size);
    this.nonlinear = this.els.some((e) => NONLINEAR.has(e.type));
    this.reset();
  }

  reset() {
    this.t = 0;
    this.error = '';
    this.slow = 0;
    this.x.fill(0);
    this.els.forEach((e) => { e.st = { v: 0, i: 0, vd: 0, vbe: 0, vbc: 0, vgs: 0, vds: 0, vdb: 0, avgI: undefined }; e.out = null; });
    this.cache = null;
    this.compute();
  }

  /** 부품 값이 바뀌었을 때 (행렬 캐시 무효화) */
  touch() { this.cache = null; }

  /**
   * 배치(부품 종류·위치)가 같고 값만 바뀌었으면 콘덴서 전압 같은 상태를 유지한 채 바꾸고 true.
   * 배치가 바뀌었으면 false (새로 만들어야 함)
   */
  updateParts(circuit) {
    const a = this.circuit.parts || [], b = circuit.parts || [];
    if (a.length !== b.length) return false;
    const same = (p, q) => p.id === q.id && p.type === q.type && p.x1 === q.x1 && p.y1 === q.y1 && p.x2 === q.x2 && p.y2 === q.y2 && !!p.props?.flip === !!q.props?.flip;
    for (let i = 0; i < a.length; i++) if (!same(a[i], b[i])) return false;
    const byId = new Map(b.map((p) => [p.id, p]));
    this.els.forEach((e) => { e.part = byId.get(e.id) || e.part; });
    this.circuit = circuit;
    this.touch();
    this.compute();
    return true;
  }

  V(node) { return node === 0 ? 0 : this.x[node - 1]; }
  sourceValue(el, t) {
    const q = el.part.props || {};
    if (el.type === 'dcv') return Number(q.v) || 0;
    if (el.type === 'ammeter') return 0;
    if (el.type === 'acv') return (Number(q.offset) || 0) + (Number(q.amp) || 0) * Math.sin(2 * Math.PI * (Number(q.freq) || 0) * t + ((Number(q.phase) || 0) * Math.PI) / 180);
    if (el.type === 'pulse') {
      const f = Number(q.freq) || 1, duty = Math.max(0, Math.min(1, Number(q.duty ?? 0.5)));
      const frac = (t * f) % 1;
      return frac < duty ? Number(q.high) || 0 : Number(q.low) || 0;
    }
    return 0;
  }

  // ── 행렬 조립 ──
  stamp(A, b, x, t) {
    const S = this.size, dt = this.dt, trap = this.method === 'trap';
    const idx = (node) => node - 1;
    const addG = (n1, n2, g) => {
      if (n1) A[idx(n1) * S + idx(n1)] += g;
      if (n2) A[idx(n2) * S + idx(n2)] += g;
      if (n1 && n2) { A[idx(n1) * S + idx(n2)] -= g; A[idx(n2) * S + idx(n1)] -= g; }
    };
    // n1 에서 소자로 들어가 n2 로 나오는 일정 전류 i0
    const addI = (n1, n2, i0) => { if (n1) b[idx(n1)] -= i0; if (n2) b[idx(n2)] += i0; };
    // node 행에: (소자로 들어가는 전류) = Σ g·V + c
    const addRow = (node, terms, c) => {
      if (!node) return;
      const r = idx(node) * S;
      terms.forEach(([m, g]) => { if (m) A[r + idx(m)] += g; });
      b[idx(node)] -= c;
    };
    const Vx = (node) => (node === 0 ? 0 : x[node - 1]);

    for (let i = 0; i < this.nNodes; i++) A[i * S + i] += GMIN;

    for (const el of this.els) {
      const q = el.part.props || {};
      const [a, c, d] = el.n;
      switch (el.type) {
        case 'resistor': addG(a, c, 1 / Math.max(Number(q.r) || 0, 1e-6)); break;
        case 'switch': addG(a, c, q.closed ? 1 / R_ON : 1e-12); break;
        case 'pot': {
          const r = Math.max(Number(q.r) || 0, 1e-3), pos = Math.max(0, Math.min(1, Number(q.pos ?? 0.5)));
          addG(a, d, 1 / Math.max(r * pos, R_ON));
          addG(d, c, 1 / Math.max(r * (1 - pos), R_ON));
          break;
        }
        case 'capacitor': {
          const C = Math.max(Number(q.c) || 0, 1e-18);
          const g = (trap ? 2 : 1) * C / dt;
          addG(a, c, g);
          addI(a, c, trap ? -(g * el.st.v + el.st.i) : -g * el.st.v);
          break;
        }
        case 'inductor': {
          const L = Math.max(Number(q.l) || 0, 1e-12);
          const g = dt / ((trap ? 2 : 1) * L);
          addG(a, c, g);
          addI(a, c, trap ? el.st.i + g * el.st.v : el.st.i);
          break;
        }
        case 'dci': addI(a, c, Number(q.i) || 0); break;
        case 'dcv': case 'acv': case 'pulse': case 'ammeter': {
          const j = el.br;
          if (a) { A[idx(a) * S + j] += 1; A[j * S + idx(a)] -= 1; }
          if (c) { A[idx(c) * S + j] -= 1; A[j * S + idx(c)] += 1; }
          b[j] = this.sourceValue(el, t);
          break;
        }
        case 'diode': case 'led': case 'zener': {
          const vdRaw = Vx(a) - Vx(c);
          const nvt = (el.type === 'led' ? 2 : Number(q.n) || 1) * VT;
          const is = el.type === 'led' ? ledIs(LED_COLORS[q.color]?.vf ?? 2) : Number(q.is) || 1e-14;
          let vd = pnjlim(vdRaw, el.st.vdLin ?? el.st.vd, nvt, vcritOf(is, nvt));
          if (el.type === 'zener' && vd < 0) {
            const vz = Number(q.vz) || 5.1;
            vd = -vz - pnjlim(-vdRaw - vz, -(el.st.vdLin ?? el.st.vd) - vz, nvt, vcritOf(IBV, nvt));
          }
          el.st.vdLin = vd;
          if (Math.abs(vd - vdRaw) > 1e-9) this.limited = true;
          const m = el.type === 'zener' ? zenerModel(vd, is, nvt, Number(q.vz) || 5.1) : diodeModel(vd, is, nvt);
          const g = m.g + 1e-12;
          addG(a, c, g);
          addI(a, c, m.i - g * vd);
          break;
        }
        case 'npn': case 'pnp': {
          const s = el.type === 'npn' ? 1 : -1;
          const is = Number(q.is) || 1e-14, bf = Math.max(Number(q.beta) || 100, 1), br = 1;
          const vcrit = vcritOf(is, VT);
          const B = a, C = c, E = d;
          const rbe = s * (Vx(B) - Vx(E)), rbc = s * (Vx(B) - Vx(C));
          const vbe = pnjlim(rbe, el.st.vbeLin ?? el.st.vbe, VT, vcrit);
          const vbc = pnjlim(rbc, el.st.vbcLin ?? el.st.vbc, VT, vcrit);
          if (Math.abs(vbe - rbe) > 1e-9 || Math.abs(vbc - rbc) > 1e-9) this.limited = true;
          el.st.vbeLin = vbe; el.st.vbcLin = vbc;
          const m = bjtModel(vbe, vbc, is, bf, br);
          // 노드 전압에 대한 선형화: I = s·f0 + f_be(VB−VE) + f_bc(VB−VC) − s(f_be·vbe0 + f_bc·vbc0)
          const lin = (f0, fbe, fbc) => ({ terms: [[B, fbe + fbc], [E, -fbe], [C, -fbc]], c: s * (f0 - fbe * vbe - fbc * vbc) });
          const ic = lin(m.ic, m.dic_be, m.dic_bc);
          const ib = lin(m.ib, m.dib_be, m.dib_bc);
          addRow(C, ic.terms, ic.c);
          addRow(B, ib.terms, ib.c);
          addRow(E, ic.terms.map(([n, g], k) => [n, -g - ib.terms[k][1]]), -ic.c - ib.c);
          addG(B, E, 1e-12); addG(B, C, 1e-12);
          break;
        }
        case 'nmos': case 'pmos': {
          const s = el.type === 'nmos' ? 1 : -1;
          const G = a, D = c, Sn = d;
          const vth = Math.abs(Number(q.vth) || 1.5), kp = Math.max(Number(q.kp) || 0.2, 1e-9), lambda = Math.max(Number(q.lambda) || 0, 0);
          const rgs = s * (Vx(G) - Vx(Sn)), rds = s * (Vx(D) - Vx(Sn));
          const vgs = clampStep(rgs, el.st.vgsLin ?? el.st.vgs, 1);
          const vds = clampStep(rds, el.st.vdsLin ?? el.st.vds, 2);
          if (Math.abs(vgs - rgs) > 1e-9 || Math.abs(vds - rds) > 1e-9) this.limited = true;
          el.st.vgsLin = vgs; el.st.vdsLin = vds;
          const m = mosModel(vgs, vds, vth, kp, lambda);
          const terms = [[G, m.gm], [D, m.gds], [Sn, -m.gm - m.gds]];
          const c0 = s * (m.id - m.gm * vgs - m.gds * vds);
          addRow(D, terms, c0);
          addRow(Sn, terms.map(([n, g]) => [n, -g]), -c0);
          addG(D, Sn, 1e-9);
          if (q.body !== false) {
            // 바디 다이오드: N채널은 소스→드레인, P채널은 드레인→소스
            const an = s > 0 ? Sn : D, ca = s > 0 ? D : Sn;
            const nvt = VT, isb = 1e-12;
            const raw = Vx(an) - Vx(ca);
            const vd = pnjlim(raw, el.st.vdbLin ?? el.st.vdb, nvt, vcritOf(isb, nvt));
            if (Math.abs(vd - raw) > 1e-9) this.limited = true;
            el.st.vdbLin = vd;
            const dm = diodeModel(vd, isb, nvt);
            addG(an, ca, dm.g);
            addI(an, ca, dm.i - dm.g * vd);
          }
          break;
        }
        case 'opamp': {
          const P = a, N = c, O = d, j = el.br;
          const vmax = Number(q.vmax ?? 15), vmin = Number(q.vmin ?? -15), gain = Math.max(Number(q.gain) || 1e5, 1);
          const half = Math.max((vmax - vmin) / 2, 1e-3), mid = (vmax + vmin) / 2;
          const vdiff = Vx(P) - Vx(N);
          const th = Math.tanh((gain * vdiff) / half);
          const gOut = mid + half * th, gd = gain * (1 - th * th);
          // 출력은 접지 기준 전압원: V(O) − g'(V+ − V−) = g − g'·vd
          if (O) { A[idx(O) * S + j] -= 1; A[j * S + idx(O)] += 1; }
          if (P) A[j * S + idx(P)] -= gd;
          if (N) A[j * S + idx(N)] += gd;
          b[j] = gOut - gd * vdiff;
          break;
        }
        default: break; // 전압계·전압 표시는 연결만
      }
    }
  }

  /** 한 시간 단계 진행. 실패하면 false */
  step() {
    if (this.error) return false;
    const S = this.size;
    if (!S) { this.t += this.dt; return true; }
    const t = this.t + this.dt;
    let x = this.x;

    if (!this.nonlinear) {
      // 선형 회로는 행렬이 시간에 따라 바뀌지 않으므로 한 번 분해해 재사용한다
      if (!this.cache) {
        const A = new Float64Array(S * S), b = new Float64Array(S);
        this.stamp(A, b, x, t);
        const piv = luFactor(A, S);
        if (!piv) return this.fail();
        this.cache = { A, piv };
      }
      const A2 = new Float64Array(S * S), b = new Float64Array(S);
      this.stamp(A2, b, x, t);
      x = luSolve(this.cache.A, this.cache.piv, b, S);
    } else {
      let ok = false;
      for (let it = 0; it < 120; it++) {
        const A = new Float64Array(S * S), b = new Float64Array(S);
        this.limited = false;
        this.stamp(A, b, x, t);
        const piv = luFactor(A, S);
        if (!piv) return this.fail();
        const xn = luSolve(A, piv, b, S);
        let conv = !this.limited;
        for (let i = 0; i < S; i++) {
          if (!Number.isFinite(xn[i])) return this.fail('계산 값이 발산했습니다. 부품 값이나 연결을 확인하세요.');
          if (Math.abs(xn[i] - x[i]) > 1e-6 + 1e-5 * Math.abs(xn[i])) conv = false;
        }
        x = xn;
        if (conv && it > 0) { ok = true; break; }
      }
      if (!ok) this.slow++;
    }
    this.x = x;
    this.t = t;
    this.commit();
    return true;
  }

  fail(msg) {
    this.error = msg || '회로를 풀 수 없습니다. 전압원끼리 바로 이어진 곳, 전압원과 병렬인 전선, 코일·전류원만으로 된 고리가 있는지 확인하세요.';
    return false;
  }

  /** 수렴한 해로 소자 상태(콘덴서 전압·코일 전류·접합 전압)를 갱신 */
  commit() {
    const trap = this.method === 'trap', dt = this.dt;
    for (const el of this.els) {
      const q = el.part.props || {};
      const [a, c, d] = el.n;
      const v = this.V(a) - this.V(c);
      if (el.type === 'capacitor') {
        const C = Math.max(Number(q.c) || 0, 1e-18);
        const g = (trap ? 2 : 1) * C / dt;
        el.st.i = trap ? g * (v - el.st.v) - el.st.i : g * (v - el.st.v);
        el.st.v = v;
      } else if (el.type === 'inductor') {
        const L = Math.max(Number(q.l) || 0, 1e-12);
        el.st.i = trap ? el.st.i + (dt / (2 * L)) * (v + el.st.v) : el.st.i + (dt / L) * v;
        el.st.v = v;
      } else if (el.type === 'diode' || el.type === 'led' || el.type === 'zener') {
        el.st.vd = v; el.st.vdLin = v;
        if (el.type === 'led') {
          // 눈에 보이는 밝기: 약 10 ms 평균 (PWM 감광이 깜빡이지 않고 평균 밝기로 보이도록)
          const is = ledIs(LED_COLORS[q.color]?.vf ?? 2);
          const i = diodeModel(v, is, 2 * VT).i;
          const k = Math.min(1, dt / 0.01);
          el.st.avgI = (el.st.avgI ?? i) + (i - (el.st.avgI ?? i)) * k;
        }
      } else if (el.type === 'npn' || el.type === 'pnp') {
        const s = el.type === 'npn' ? 1 : -1;
        el.st.vbe = s * (this.V(a) - this.V(d)); el.st.vbc = s * (this.V(a) - this.V(c));
        el.st.vbeLin = el.st.vbe; el.st.vbcLin = el.st.vbc;
      } else if (el.type === 'nmos' || el.type === 'pmos') {
        const s = el.type === 'nmos' ? 1 : -1;
        el.st.vgs = s * (this.V(a) - this.V(d)); el.st.vds = s * (this.V(c) - this.V(d));
        el.st.vgsLin = el.st.vgs; el.st.vdsLin = el.st.vds;
        const an = s > 0 ? d : c, ca = s > 0 ? c : d;
        el.st.vdb = this.V(an) - this.V(ca); el.st.vdbLin = el.st.vdb;
      }
    }
    this.compute();
  }

  /** 화면에 쓸 소자별 전압·전류와 전선 전류를 계산 */
  compute() {
    const injection = new Map();
    const key = this.topo.key;
    for (const el of this.els) {
      const q = el.part.props || {};
      const [a, c, d] = el.n;
      const Va = this.V(a), Vc = this.V(c), Vd = d != null ? this.V(d) : 0;
      let ti = []; // 단자로 들어가는 전류
      let extra = {};
      switch (el.type) {
        case 'resistor': { const i = (Va - Vc) / Math.max(Number(q.r) || 0, 1e-6); ti = [i, -i]; break; }
        case 'switch': { const i = (Va - Vc) * (q.closed ? 1 / R_ON : 1e-12); ti = [i, -i]; break; }
        case 'pot': {
          const r = Math.max(Number(q.r) || 0, 1e-3), pos = Math.max(0, Math.min(1, Number(q.pos ?? 0.5)));
          const i1 = (Va - Vd) / Math.max(r * pos, R_ON), i2 = (Vd - Vc) / Math.max(r * (1 - pos), R_ON);
          ti = [i1, -i2, i2 - i1];
          break;
        }
        case 'capacitor': case 'inductor': ti = [el.st.i, -el.st.i]; break;
        case 'dci': { const i = Number(q.i) || 0; ti = [i, -i]; break; }
        case 'dcv': case 'acv': case 'pulse': case 'ammeter': { const j = this.size ? this.x[el.br] : 0; ti = [j, -j]; break; }
        case 'diode': case 'led': case 'zener': {
          const nvt = (el.type === 'led' ? 2 : Number(q.n) || 1) * VT;
          const is = el.type === 'led' ? ledIs(LED_COLORS[q.color]?.vf ?? 2) : Number(q.is) || 1e-14;
          const m = el.type === 'zener' ? zenerModel(Va - Vc, is, nvt, Number(q.vz) || 5.1) : diodeModel(Va - Vc, is, nvt);
          ti = [m.i, -m.i];
          if (el.type === 'led') {
            const imax = Math.max(Number(q.imax) || 0.02, 1e-6), avg = el.st.avgI ?? m.i;
            extra = { brightness: Math.max(0, Math.min(1.2, avg / imax)), avgCurrent: avg, over: m.i > imax * 1.5 };
          }
          break;
        }
        case 'npn': case 'pnp': {
          const s = el.type === 'npn' ? 1 : -1;
          const vbe = s * (Va - Vd), vbc = s * (Va - Vc);
          const m = bjtModel(vbe, vbc, Number(q.is) || 1e-14, Math.max(Number(q.beta) || 100, 1), 1);
          const ib = s * m.ib, ic = s * m.ic;
          ti = [ib, ic, -ib - ic];
          extra = { region: vbe < 0.5 ? '차단' : vbc > 0.4 ? '포화' : '증폭' };
          break;
        }
        case 'nmos': case 'pmos': {
          const s = el.type === 'nmos' ? 1 : -1;
          const m = mosModel(s * (Va - Vd), s * (Vc - Vd), Math.abs(Number(q.vth) || 1.5), Math.max(Number(q.kp) || 0.2, 1e-9), Math.max(Number(q.lambda) || 0, 0));
          let id = s * m.id + (Vc - Vd) * 1e-9;
          if (q.body !== false) {
            const an = s > 0 ? Vd : Vc, ca = s > 0 ? Vc : Vd;
            const ib = diodeModel(an - ca, 1e-12, VT).i;
            id += s > 0 ? -ib : ib;
          }
          ti = [0, id, -id];
          extra = { region: m.region };
          break;
        }
        case 'opamp': { const j = this.size ? this.x[el.br] : 0; ti = [0, 0, -j]; break; }
        default: ti = el.n.map(() => 0);
      }
      const volts = el.n.map((n) => this.V(n));
      const power = ti.reduce((s, i, k) => s + i * volts[k], 0);
      el.out = { ti, volts, current: ti[0] ?? 0, voltage: (volts[0] ?? 0) - (volts[1] ?? 0), power, ...extra };
      // 전선망으로 들어가는 전류 = 소자 단자로 들어가는 전류의 반대
      terminals(el.part).forEach((p, k) => {
        const kk = key(p.x, p.y);
        injection.set(kk, (injection.get(kk) || 0) - (ti[k] || 0));
      });
    }
    this.wireI = wireCurrents(this.topo.segments, injection);
  }

  /** 여러 단계를 한 번에 (화면 한 프레임) */
  run(steps) {
    for (let i = 0; i < steps; i++) if (!this.step()) return false;
    return true;
  }

  info(id) { return this.els.find((e) => e.id === id)?.out || null; }
  nodeAt(x, y) { return this.topo.pointNode.get(`${x},${y}`); }
  voltageAt(x, y) { const n = this.nodeAt(x, y); return n == null ? null : this.V(n); }
}
