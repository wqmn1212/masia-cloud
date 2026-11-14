// 스코프: 선택한 부품의 전압·전류를 시간에 따라 기록한다
import { terminals } from './parts.js';

export const TRACE_COLORS = ['#2563eb', '#16a34a', '#d97706', '#db2777'];
export const SCOPE_POINTS = 1000;

/** 부품 종류에 맞는 대표 전압·전류 */
export function traceValue(part, info, kind) {
  if (!info) return NaN;
  const n = terminals(part).length;
  if (kind === 'v') {
    if (n === 1) return info.volts[0];
    if (part.type === 'opamp') return info.volts[2];
    if (n === 3 && part.type !== 'pot') return info.volts[1] - info.volts[2]; // Vce·Vds
    if (part.type === 'pot') return info.volts[2];
    return info.volts[0] - info.volts[1];
  }
  if (part.type === 'opamp') return -info.ti[2];
  if (n === 3 && part.type !== 'pot') return info.ti[1]; // 컬렉터·드레인 전류
  return info.ti[0];
}

export function traceLabel(part, kind, name) {
  const n = terminals(part).length;
  const k = kind === 'v'
    ? (n === 1 ? '전압' : part.type === 'opamp' ? '출력 전압' : ['npn', 'pnp'].includes(part.type) ? 'Vce' : ['nmos', 'pmos'].includes(part.type) ? 'Vds' : part.type === 'pot' ? '와이퍼 전압' : '전압')
    : (['npn', 'pnp'].includes(part.type) ? 'Ic' : ['nmos', 'pmos'].includes(part.type) ? 'Id' : part.type === 'opamp' ? '출력 전류' : '전류');
  return `${name} ${k}`;
}

export class ScopeRecorder {
  constructor() { this.traces = []; this.span = 0.02; this.dt = 1e-5; this.stride = 1; this.count = 0; }

  configure(span, dt) {
    this.span = span; this.dt = dt;
    this.stride = Math.max(1, Math.round(span / dt / SCOPE_POINTS));
    this.clear();
  }

  clear() { this.count = 0; this.traces.forEach((t) => { t.buf.fill(NaN); t.head = 0; t.len = 0; }); }

  add(partId, kind, label) {
    if (this.traces.some((t) => t.partId === partId && t.kind === kind)) return false;
    if (this.traces.length >= TRACE_COLORS.length) this.traces.shift();
    const used = new Set(this.traces.map((t) => t.color));
    const color = TRACE_COLORS.find((c) => !used.has(c)) || TRACE_COLORS[0];
    this.traces.push({ partId, kind, label, color, buf: new Float64Array(SCOPE_POINTS).fill(NaN), head: 0, len: 0, last: NaN });
    return true;
  }

  remove(i) { this.traces.splice(i, 1); }

  /** 매 단계 호출. stride 마다 한 점 기록 */
  sample(sim) {
    if (!this.traces.length) return;
    if (this.count++ % this.stride) return;
    for (const t of this.traces) {
      const el = sim.els.find((e) => e.id === t.partId);
      const v = el ? traceValue(el.part, el.out, t.kind) : NaN;
      t.buf[t.head] = v;
      t.head = (t.head + 1) % SCOPE_POINTS;
      t.len = Math.min(SCOPE_POINTS, t.len + 1);
      t.last = v;
    }
  }

  /** 오래된 것부터 순서대로 */
  series(t) {
    const out = new Array(t.len);
    const start = (t.head - t.len + SCOPE_POINTS) % SCOPE_POINTS;
    for (let i = 0; i < t.len; i++) out[i] = t.buf[(start + i) % SCOPE_POINTS];
    return out;
  }
}
