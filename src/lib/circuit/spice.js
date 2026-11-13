// 회로를 SPICE 넷리스트로 내보낸다. LTspice·ngspice 에서 같은 회로를 정밀 해석할 때 쓴다.
import { buildTopology } from './topology.js';
import { LED_COLORS } from './parts.js';

const VT = 0.025852;
const SUFFIX = [[1e12, 'T'], [1e9, 'G'], [1e6, 'Meg'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'u'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f']];

/** 4700 → 4.7k, 1e-5 → 10u (SPICE 단위 접미사) */
export function spiceNum(v) {
  const x = Number(v);
  if (!Number.isFinite(x)) return '0';
  if (x === 0) return '0';
  const a = Math.abs(x);
  const [f, s] = SUFFIX.find(([k]) => a >= k * 0.9995) || SUFFIX[SUFFIX.length - 1];
  return `${Number((x / f).toPrecision(6))}${s}`;
}

/**
 * analysis 를 주면 그 해석 문장(.tran/.ac/.dc/.op, .temp, .step)을 쓴다. 없으면 dt·stop 으로 .tran
 */
export function toSpice(circuit, { title = 'AEGIS circuit', dt = 1e-5, stop = 1e-2, analysis = null } = {}) {
  const topo = buildTopology(circuit);
  const nn = (n) => (n === 0 ? '0' : `N${n}`);
  const count = {};
  const ref = (prefix) => { count[prefix] = (count[prefix] || 0) + 1; return `${prefix}${count[prefix]}`; };
  const lines = [`* ${title}`, '* AEGIS 회로 시뮬레이터에서 내보냄'];
  const models = new Map();
  const model = (name, text) => { if (!models.has(name)) models.set(name, `.model ${name} ${text}`); return name; };

  const nameOf = new Map(); // 부품 id → 넷리스트 이름 (해석 문장에서 쓴다)
  const acId = analysis?.type === 'ac' ? analysis.sourceId : null;
  for (const { part: p, nodes: [a, b, c] } of topo.elements) {
    const q = p.props || {};
    const before = lines.length;
    switch (p.type) {
      case 'resistor': lines.push(`${ref('R')} ${nn(a)} ${nn(b)} ${spiceNum(q.r)}`); break;
      case 'capacitor': lines.push(`${ref('C')} ${nn(a)} ${nn(b)} ${spiceNum(q.c)}`); break;
      case 'inductor': lines.push(`${ref('L')} ${nn(a)} ${nn(b)} ${spiceNum(q.l)}`); break;
      case 'switch': lines.push(`${ref('R')} ${nn(a)} ${nn(b)} ${q.closed ? '1m' : '1G'} ; 스위치 ${q.closed ? '닫힘' : '열림'}`); break;
      case 'pot': {
        const r = Number(q.r) || 0, pos = Math.max(0, Math.min(1, Number(q.pos ?? 0.5)));
        lines.push(`${ref('R')} ${nn(a)} ${nn(c)} ${spiceNum(Math.max(r * pos, 1e-3))} ; 가변저항 위쪽`);
        lines.push(`${ref('R')} ${nn(c)} ${nn(b)} ${spiceNum(Math.max(r * (1 - pos), 1e-3))} ; 가변저항 아래쪽`);
        break;
      }
      case 'dcv': lines.push(`${ref('V')} ${nn(b)} ${nn(a)} DC ${spiceNum(q.v)}`); break;
      case 'acv': lines.push(`${ref('V')} ${nn(b)} ${nn(a)} SIN(${spiceNum(q.offset || 0)} ${spiceNum(q.amp)} ${spiceNum(q.freq)} 0 0 ${Number(q.phase) || 0})`); break;
      case 'pulse': {
        const period = 1 / (Number(q.freq) || 1), duty = Math.max(0, Math.min(1, Number(q.duty ?? 0.5)));
        lines.push(`${ref('V')} ${nn(b)} ${nn(a)} PULSE(${spiceNum(q.low)} ${spiceNum(q.high)} 0 1n 1n ${spiceNum(period * duty)} ${spiceNum(period)})`);
        break;
      }
      case 'dci': lines.push(`${ref('I')} ${nn(a)} ${nn(b)} DC ${spiceNum(q.i)}`); break;
      case 'ammeter': lines.push(`${ref('VAM')} ${nn(a)} ${nn(b)} DC 0 ; 전류계`); break;
      case 'diode': {
        const rs = Number(q.rs) > 0 ? ` RS=${spiceNum(q.rs)}` : '';
        const name = q.model ? `D${q.model}` : rs ? `DGEN_${lines.length}` : 'DGEN';
        lines.push(`${ref('D')} ${nn(a)} ${nn(b)} ${model(name, `D(IS=${spiceNum(q.is || 1e-14)} N=${Number(q.n) || 1}${rs})`)}`);
        break;
      }
      case 'zener': {
        const vz = Number(q.vz) || 5.1;
        const rs = Number(q.rs) > 0 ? ` RS=${spiceNum(q.rs)}` : '';
        lines.push(`${ref('D')} ${nn(a)} ${nn(b)} ${model(q.model ? `D${q.model}` : `DZ${String(vz).replace('.', 'V')}${rs ? `_${lines.length}` : ''}`, `D(IS=1e-14 N=1 BV=${vz} IBV=1m${rs})`)}`);
        break;
      }
      case 'led': {
        const col = LED_COLORS[q.color] ? q.color : 'red';
        const vf = LED_COLORS[col].vf;
        const is = 0.02 / (Math.exp(vf / (2 * VT)) - 1);
        const rs = Number(q.rs) > 0 ? ` RS=${spiceNum(q.rs)}` : '';
        lines.push(`${ref('D')} ${nn(a)} ${nn(b)} ${model(q.model ? `D${q.model}` : `DLED_${col.toUpperCase()}${rs ? `_${lines.length}` : ''}`, `D(IS=${is.toExponential(3)} N=2${rs})`)}`);
        break;
      }
      case 'npn': case 'pnp': {
        const beta = Number(q.beta) || 100;
        const kind = p.type.toUpperCase();
        const name = q.model ? `Q${q.model}` : beta === 100 ? `Q${kind}` : `Q${kind}_B${beta}`;
        lines.push(`${ref('Q')} ${nn(b)} ${nn(a)} ${nn(c)} ${model(name, `${kind}(IS=${spiceNum(q.is || 1e-14)} BF=${beta} BR=1)`)}`);
        break;
      }
      case 'nmos': case 'pmos': {
        const vth = Math.abs(Number(q.vth) || 1.5), kp = Number(q.kp) || 0.2, lambda = Number(q.lambda) || 0;
        const n = p.type === 'nmos';
        const name = q.model ? `M${q.model}` : `M${n ? 'N' : 'P'}_${String(vth).replace('.', 'V')}_${String(kp).replace('.', 'P')}`;
        lines.push(`${ref('M')} ${nn(b)} ${nn(a)} ${nn(c)} ${nn(c)} ${model(name, `${n ? 'NMOS' : 'PMOS'}(LEVEL=1 VTO=${n ? vth : -vth} KP=${kp} LAMBDA=${lambda})`)}`);
        break;
      }
      case 'opamp': {
        const vmax = Number(q.vmax ?? 15), vmin = Number(q.vmin ?? -15), gain = Number(q.gain) || 1e5;
        const half = (vmax - vmin) / 2, mid = (vmax + vmin) / 2;
        lines.push(`${ref('B')} ${nn(c)} 0 V=${mid}+${half}*tanh(${gain}*(V(${nn(a)})-V(${nn(b)}))/${half}) ; OP 앰프(이상적, 출력 ${vmin}~${vmax} V)`);
        break;
      }
      case 'voltmeter': lines.push(`* 전압계: V(${nn(a)}) - V(${nn(b)})`); break;
      case 'probe': lines.push(`* 전압 표시: V(${nn(a)})`); break;
      default: break;
    }
    if (lines.length > before) {
      const first = lines[before];
      nameOf.set(p.id, first.split(' ')[0]);
      // 교류 해석에 쓸 전원에는 AC 1 을 붙인다
      if (p.id === acId && /^[VI]/.test(first)) lines[before] = first.replace(/^(\S+ \S+ \S+ )/, '$1') + ' AC 1';
    }
  }
  const tail = [];
  if (!analysis) tail.push(`.tran ${spiceNum(dt)} ${spiceNum(stop)}`);
  else {
    const A = analysis;
    if (A.type === 'op') tail.push('.op');
    if (A.type === 'tran') tail.push(`.tran 0 ${spiceNum(A.stop)} 0 ${spiceNum(A.maxStep > 0 ? A.maxStep : A.stop / 2000)}${A.fromZero ? ' uic' : ''}`);
    if (A.type === 'ac') tail.push(`.ac dec ${Math.round(A.perDecade || 20)} ${spiceNum(A.fStart)} ${spiceNum(A.fStop)}`);
    if (A.type === 'dc' && nameOf.get(A.sourceId)) tail.push(`.dc ${nameOf.get(A.sourceId)} ${spiceNum(A.from)} ${spiceNum(A.to)} ${spiceNum((A.to - A.from) / Math.max(1, (A.points || 101) - 1))}`);
    const sw = A.sweep || {};
    if (sw.kind === 'temp' && sw.values?.length) tail.push(`.step temp list ${sw.values.join(' ')}`);
    else if (Number.isFinite(Number(A.temp)) && Number(A.temp) !== 27) tail.push(`.temp ${Number(A.temp)}`);
    if (sw.kind === 'param' && sw.values?.length && nameOf.get(sw.partId)) tail.push(`* 값 바꾸기: ${nameOf.get(sw.partId)} 의 ${sw.key} = ${sw.values.join(', ')} (LTspice 에서는 값을 {X} 로 바꾸고 .step param X list … 로 돌리세요)`);
    if (sw.kind === 'mc') tail.push(`* 몬테카를로: 저항·콘덴서·코일 ±${sw.tol}% ${sw.runs}회 (LTspice 에서는 값에 mc(값, ${(Number(sw.tol) || 5) / 100}) 를 쓰세요)`);
  }
  return [...lines, ...models.values(), ...tail, '.end', ''].join('\n');
}
