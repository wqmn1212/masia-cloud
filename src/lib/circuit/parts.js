// 회로 시뮬레이터 부품 정의와 모양(단자 위치)
// 모든 부품은 격자 위의 두 점 p1(x1,y1)·p2(x2,y2)로 놓인다. 3단자 부품은 두 점에서 나머지 단자를 계산한다.

export const LED_COLORS = {
  red: { label: '빨강', vf: 1.9, rgb: [255, 60, 50] },
  yellow: { label: '노랑', vf: 2.0, rgb: [255, 200, 40] },
  green: { label: '초록', vf: 2.1, rgb: [60, 220, 90] },
  blue: { label: '파랑', vf: 3.0, rgb: [70, 130, 255] },
  white: { label: '흰색', vf: 3.0, rgb: [250, 226, 120] }, // 흰 화면에서도 보이게 옅은 노랑으로 표시
  warm: { label: '전구색', vf: 2.9, rgb: [255, 170, 70] },
};

// field: [키, 이름, 단위, 종류('num'|'select'|'bool'), 선택지]
export const PARTS = {
  wire: { label: '전선', group: '기본', terminals: 2, fields: [] },
  ground: { label: '접지', group: '기본', terminals: 1, fields: [] },
  resistor: { label: '저항', group: '수동 부품', terminals: 2, prefix: 'R', defaults: { r: 1000 }, fields: [['r', '저항', 'Ω']] },
  capacitor: { label: '콘덴서', group: '수동 부품', terminals: 2, prefix: 'C', defaults: { c: 1e-6 }, fields: [['c', '용량', 'F']] },
  inductor: { label: '코일', group: '수동 부품', terminals: 2, prefix: 'L', defaults: { l: 1e-3 }, fields: [['l', '인덕턴스', 'H']] },
  pot: { label: '가변저항', group: '수동 부품', terminals: 3, prefix: 'P', defaults: { r: 10000, pos: 0.5 }, fields: [['r', '전체 저항', 'Ω'], ['pos', '와이퍼 위치', '0~1']] },
  switch: { label: '스위치', group: '수동 부품', terminals: 2, prefix: 'S', defaults: { closed: false }, fields: [['closed', '닫힘', '', 'bool']] },
  dcv: { label: '직류 전원', group: '전원', terminals: 2, prefix: 'V', defaults: { v: 5 }, fields: [['v', '전압', 'V']] },
  acv: { label: '교류 전원', group: '전원', terminals: 2, prefix: 'V', defaults: { amp: 5, freq: 60, offset: 0, phase: 0 }, fields: [['amp', '진폭', 'V'], ['freq', '주파수', 'Hz'], ['offset', '직류 성분', 'V'], ['phase', '위상', '°']] },
  pulse: { label: '펄스(PWM) 전원', group: '전원', terminals: 2, prefix: 'V', defaults: { high: 5, low: 0, freq: 1000, duty: 0.5 }, fields: [['high', '높은 전압', 'V'], ['low', '낮은 전압', 'V'], ['freq', '주파수', 'Hz'], ['duty', '듀티비', '0~1']] },
  dci: { label: '전류원', group: '전원', terminals: 2, prefix: 'I', defaults: { i: 0.01 }, fields: [['i', '전류', 'A']] },
  diode: { label: '다이오드', group: '반도체', terminals: 2, prefix: 'D', defaults: { is: 1e-14, n: 1, rs: 0 }, fields: [['is', '포화 전류', 'A'], ['n', '이상 계수', ''], ['rs', '직렬 저항', 'Ω']] },
  zener: { label: '제너 다이오드', group: '반도체', terminals: 2, prefix: 'D', defaults: { is: 1e-14, n: 1, vz: 5.1, rs: 0 }, fields: [['vz', '제너 전압', 'V'], ['rs', '직렬 저항', 'Ω']] },
  led: { label: 'LED', group: '반도체', terminals: 2, prefix: 'D', defaults: { color: 'red', imax: 0.02, rs: 0 }, fields: [['color', '색', '', 'select', LED_COLORS], ['imax', '정격 전류', 'A'], ['rs', '직렬 저항', 'Ω']] },
  npn: { label: 'NPN 트랜지스터', group: '반도체', terminals: 3, prefix: 'Q', defaults: { beta: 100, is: 1e-14, flip: false }, fields: [['beta', '전류 증폭률(β)', ''], ['flip', '좌우 뒤집기', '', 'bool']] },
  pnp: { label: 'PNP 트랜지스터', group: '반도체', terminals: 3, prefix: 'Q', defaults: { beta: 100, is: 1e-14, flip: false }, fields: [['beta', '전류 증폭률(β)', ''], ['flip', '좌우 뒤집기', '', 'bool']] },
  nmos: { label: 'N채널 MOSFET', group: '반도체', terminals: 3, prefix: 'M', defaults: { vth: 1.5, kp: 0.2, lambda: 0.01, body: true, flip: false }, fields: [['vth', '문턱 전압', 'V'], ['kp', '전달 계수', 'A/V²'], ['body', '바디 다이오드', '', 'bool'], ['flip', '좌우 뒤집기', '', 'bool']] },
  pmos: { label: 'P채널 MOSFET', group: '반도체', terminals: 3, prefix: 'M', defaults: { vth: 1.5, kp: 0.2, lambda: 0.01, body: true, flip: false }, fields: [['vth', '문턱 전압(크기)', 'V'], ['kp', '전달 계수', 'A/V²'], ['body', '바디 다이오드', '', 'bool'], ['flip', '좌우 뒤집기', '', 'bool']] },
  opamp: { label: 'OP 앰프', group: '반도체', terminals: 3, prefix: 'U', defaults: { gain: 100000, vmax: 15, vmin: -15, flip: false }, fields: [['gain', '이득', ''], ['vmax', '출력 최대', 'V'], ['vmin', '출력 최소', 'V'], ['flip', '입력 위아래 뒤집기', '', 'bool']] },
  voltmeter: { label: '전압계', group: '측정', terminals: 2, prefix: 'VM', fields: [] },
  ammeter: { label: '전류계', group: '측정', terminals: 2, prefix: 'AM', fields: [] },
  probe: { label: '전압 표시', group: '측정', terminals: 1, fields: [] },
};

export const PART_GROUPS = ['기본', '전원', '수동 부품', '반도체', '측정'];

const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

/** p1→p2 방향(축 방향 단위)과 그 수직 방향 */
export function axes(p) {
  const dx = p.x2 - p.x1, dy = p.y2 - p.y1;
  const len = Math.hypot(dx, dy) || 1;
  const d = Math.abs(dx) >= Math.abs(dy) ? { x: sign(dx) || 1, y: 0 } : { x: 0, y: sign(dy) };
  return { d, n: { x: -d.y, y: d.x }, len, ux: dx / len, uy: dy / len };
}

/** 부품의 단자 좌표(격자). 순서는 계산 엔진의 단자 순서와 같다 */
export function terminals(p) {
  const a = { x: p.x1, y: p.y1 }, b = { x: p.x2, y: p.y2 };
  const t = p.type;
  if (t === 'ground' || t === 'probe') return [a];
  if (t === 'npn' || t === 'pnp' || t === 'nmos' || t === 'pmos') {
    const { n } = axes(p);
    const s = p.props?.flip ? -1 : 1;
    // [베이스(게이트), 컬렉터(드레인), 이미터(소스)]
    // 왼쪽→오른쪽으로 놓으면 컬렉터(드레인)가 위, 이미터(소스)가 아래
    return [a, { x: b.x - n.x * 2 * s, y: b.y - n.y * 2 * s }, { x: b.x + n.x * 2 * s, y: b.y + n.y * 2 * s }];
  }
  if (t === 'pot') {
    const { n } = axes(p);
    const mx = Math.round((a.x + b.x) / 2), my = Math.round((a.y + b.y) / 2);
    return [a, b, { x: mx + n.x * 2, y: my + n.y * 2 }];
  }
  if (t === 'opamp') {
    const { n } = axes(p);
    const s = p.props?.flip ? -1 : 1;
    // [+입력, −입력, 출력]
    return [{ x: a.x + n.x * s, y: a.y + n.y * s }, { x: a.x - n.x * s, y: a.y - n.y * s }, b];
  }
  return [a, b];
}

export const TERMINAL_NAMES = {
  npn: ['B', 'C', 'E'], pnp: ['B', 'C', 'E'], nmos: ['G', 'D', 'S'], pmos: ['G', 'D', 'S'],
  pot: ['1', '2', 'W'], opamp: ['+', '−', 'OUT'],
};

let seq = 0;
export const newId = () => `e${Date.now().toString(36)}${(seq++).toString(36)}`;

export function makePart(type, x1, y1, x2, y2, props) {
  const def = PARTS[type];
  return { id: newId(), type, x1, y1, x2, y2, props: { ...(def?.defaults || {}), ...(props || {}) } };
}

// ── 단위 접두어 ──
const PREFIX = { p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, 'μ': 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9 };

/** "4.7k", "10u", "2.2M", "1e-3" 같은 입력을 숫자로. 못 읽으면 NaN */
export function parseSI(text) {
  const s = String(text ?? '').trim().replace(/[ΩΩVAFHz°s]+$/u, '').replace(/,/g, '');
  if (!s) return NaN;
  const m = s.match(/^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*([pnuµμmkKMG])?$/i);
  if (!m) return NaN;
  const base = Number(m[1]);
  const p = m[2];
  if (!p) return base;
  // m(밀리)와 M(메가)은 대소문자를 구분한다
  return Number((base * (PREFIX[p] ?? PREFIX[p.toLowerCase()] ?? 1)).toPrecision(12));
}

/** 숫자를 "4.7 k" 처럼 읽기 쉬운 문자열로 */
export function formatSI(v, unit = '', digits = 3) {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return `0 ${unit}`.trim();
  const steps = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
  const a = Math.abs(v);
  if (a < 1e-12 * 0.9995) return `0 ${unit}`.trim(); // 피코 아래는 0 으로 본다
  const [f, p] = steps.find(([k]) => a >= k * 0.9995) || steps[steps.length - 1];
  const n = v / f;
  const str = Number(n.toPrecision(digits)).toString();
  return `${str} ${p}${unit}`.trim();
}

/** 부품 한 줄 설명 (화면 라벨) */
export function valueLabel(p) {
  const q = p.props || {};
  if (q.model) return String(q.model);
  switch (p.type) {
    case 'resistor': return formatSI(q.r, 'Ω');
    case 'capacitor': return formatSI(q.c, 'F');
    case 'inductor': return formatSI(q.l, 'H');
    case 'pot': return `${formatSI(q.r, 'Ω')} · ${Math.round((q.pos ?? 0.5) * 100)}%`;
    case 'dcv': return formatSI(q.v, 'V');
    case 'acv': return `${formatSI(q.amp, 'V')} ${formatSI(q.freq, 'Hz')}`;
    case 'pulse': return `${formatSI(q.freq, 'Hz')} ${Math.round((q.duty ?? 0.5) * 100)}%`;
    case 'dci': return formatSI(q.i, 'A');
    case 'zener': return `${formatSI(q.vz, 'V')}`;
    default: return '';
  }
}

/** 부품 참조 이름 (R1, C1, Q1 …): 회로 안 순서대로 */
export function refNames(parts) {
  const count = {}, out = new Map();
  (parts || []).forEach((p) => {
    const pre = PARTS[p.type]?.prefix;
    if (!pre) return;
    count[pre] = (count[pre] || 0) + 1;
    out.set(p.id, `${pre}${count[pre]}`);
  });
  return out;
}
