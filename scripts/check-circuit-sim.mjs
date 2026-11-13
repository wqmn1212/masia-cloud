// 회로 시뮬레이터 계산 엔진 검산: 이론값(분압·RC·RL·LED·트랜지스터·OP 앰프·교류 필터)과 대조
// 실행: npm run check:circuit-sim
import assert from 'node:assert/strict';
import { Simulator } from '../src/lib/circuit/solver.js';
import { makePart, parseSI, formatSI, terminals } from '../src/lib/circuit/parts.js';
import { toSpice } from '../src/lib/circuit/spice.js';
import { EXAMPLES, exampleCircuit } from '../src/lib/circuit/examples.js';
import { operatingPoint, transient, acAnalysis, dcSweep, runAnalysis, measureWave, measureBode } from '../src/lib/circuit/analysis.js';
import { PART_MODELS } from '../src/lib/circuit/library.js';

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('✓', name); };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} (기대 ${b} ± ${tol})`);
const P = (type, x1, y1, x2, y2, props) => makePart(type, x1, y1, x2, y2, props);
const W = (x1, y1, x2, y2) => P('wire', x1, y1, x2, y2);

// 왼쪽 세로 전원(아래 −, 위 +), 위쪽 레일 y=0, 아래쪽 접지 레일 y=8
function loop(source, ...rest) {
  return { parts: [source, P('ground', 0, 8, 0, 9), W(0, 0, 8, 0), W(0, 8, 8, 8), ...rest] };
}
const V = (v) => P('dcv', 0, 8, 0, 0, { v });

ok('단위 읽기·쓰기', () => {
  assert.equal(parseSI('4.7k'), 4700);
  assert.equal(parseSI('10u'), 1e-5);
  assert.equal(parseSI('10µF'), 1e-5);
  assert.equal(parseSI('2.2M'), 2.2e6);
  assert.equal(parseSI('1m'), 1e-3);
  assert.equal(parseSI('60Hz'), 60);
  assert.ok(Number.isNaN(parseSI('abc')));
  assert.equal(formatSI(4700, 'Ω'), '4.7 kΩ');
  assert.equal(formatSI(0.0142, 'A'), '14.2 mA');
});

ok('분압: 10 V, 1 kΩ + 1 kΩ → 5 V, 5 mA (전선 전류 포함)', () => {
  const c = loop(V(10), P('resistor', 8, 0, 8, 4, { r: 1000 }), P('resistor', 8, 4, 8, 8, { r: 1000 }));
  const s = new Simulator(c, { dt: 1e-5 });
  s.step();
  near(s.voltageAt(8, 4), 5, 1e-6, '가운데 전압');
  near(s.info(c.parts[4].id).current, 0.005, 1e-8, '저항 전류');
  // 위쪽 전선: 전원 + 에서 저항으로 5 mA
  const top = s.topo.segments.findIndex((g) => g.ay === 0 && g.by === 0);
  near(Math.abs(s.wireI.get(top)), 0.005, 1e-8, '전선 전류');
  near(s.info(c.parts[0].id).power, -0.05, 1e-6, '전원이 내는 전력(−)');
});

ok('T자 연결: 전선 가운데에 놓인 단자도 이어진다', () => {
  const c = { parts: [V(10), P('ground', 0, 8, 0, 9), W(0, 0, 8, 0), W(0, 8, 8, 8), P('resistor', 4, 0, 4, 8, { r: 1000 })] };
  const s = new Simulator(c);
  s.step();
  near(s.info(c.parts[4].id).current, 0.01, 1e-8, 'T자 저항 전류');
});

for (const method of ['trap', 'be']) {
  ok(`RC 충전 (${method}): 5 V, 1 kΩ, 1 µF, 1 ms 뒤 = 5(1−e⁻¹)`, () => {
    const c = loop(V(5), P('resistor', 8, 0, 8, 4, { r: 1000 }), P('capacitor', 8, 4, 8, 8, { c: 1e-6 }));
    const s = new Simulator(c, { dt: 1e-6, method });
    s.run(1000);
    near(s.t, 1e-3, 1e-12, '시간');
    near(s.voltageAt(8, 4), 5 * (1 - Math.exp(-1)), 0.005, '콘덴서 전압');
  });
}

ok('RL: 5 V, 100 Ω, 10 mH, τ 뒤 전류 = 50 mA(1−e⁻¹)', () => {
  const c = loop(V(5), P('resistor', 8, 0, 8, 4, { r: 100 }), P('inductor', 8, 4, 8, 8, { l: 0.01 }));
  const s = new Simulator(c, { dt: 1e-6 });
  s.run(100);
  near(s.info(c.parts[5].id).current, 0.05 * (1 - Math.exp(-1)), 0.0003, '코일 전류');
});

ok('LC 진동: 1 µF 를 5 V 로 충전 뒤 1 mH 로 방전, 주기 2π√LC, 진폭 유지(사다리꼴)', () => {
  // 스위치 대신 펄스 전원 없이: 직류 5 V + 저항으로 충전한 뒤 회로를 바꿔 방전
  const cap = P('capacitor', 8, 0, 8, 8, { c: 1e-6 });
  const charge = { parts: [V(5), P('ground', 0, 8, 0, 9), W(0, 0, 8, 0), W(0, 8, 8, 8), cap] };
  const s = new Simulator(charge, { dt: 1e-6 });
  s.run(5);
  const vc = s.els.find((e) => e.id === cap.id).st.v;
  near(vc, 5, 1e-3, '충전');
  const ind = P('inductor', 16, 0, 16, 8, { l: 1e-3 });
  const lc = { parts: [cap, P('ground', 8, 8, 8, 9), W(8, 0, 16, 0), W(8, 8, 16, 8), ind] };
  const s2 = new Simulator(lc, { dt: 1e-7 });
  s2.els.find((e) => e.id === cap.id).st.v = 5;
  const T = 2 * Math.PI * Math.sqrt(1e-3 * 1e-6);
  const steps = Math.round(T / 1e-7);
  let peak = 0;
  for (let i = 0; i < steps * 3; i++) { s2.step(); if (i > steps * 2) peak = Math.max(peak, s2.voltageAt(8, 0)); }
  near(peak, 5, 0.05, '세 주기 뒤 진폭');
});

ok('LED: 5 V, 220 Ω, 빨강 → 약 14 mA, 순방향 약 1.9 V', () => {
  const c = loop(V(5), P('resistor', 8, 0, 8, 4, { r: 220 }), P('led', 8, 4, 8, 8, { color: 'red' }));
  const s = new Simulator(c);
  s.step();
  const led = s.info(c.parts[5].id);
  near(led.current, 0.0142, 0.0008, 'LED 전류');
  near(led.voltage, 1.88, 0.05, 'LED 전압');
  assert.ok(led.brightness > 0.6 && led.brightness < 0.8, `밝기 ${led.brightness}`);
});

ok('다이오드: 1 mA 근처 순방향 0.6~0.7 V, 역방향은 거의 0', () => {
  const c = loop(V(5), P('resistor', 8, 0, 8, 4, { r: 4300 }), P('diode', 8, 4, 8, 8));
  const s = new Simulator(c);
  s.step();
  const d = s.info(c.parts[5].id);
  assert.ok(d.voltage > 0.6 && d.voltage < 0.7, `Vd ${d.voltage}`);
  const r = loop(V(5), P('resistor', 8, 0, 8, 4, { r: 4300 }), P('diode', 8, 8, 8, 4));
  const s2 = new Simulator(r);
  s2.step();
  assert.ok(Math.abs(s2.info(r.parts[5].id).current) < 1e-9);
});

ok('제너: 12 V, 1 kΩ, 5.1 V 제너 → 약 5.1 V', () => {
  const c = loop(V(12), P('resistor', 8, 0, 8, 4, { r: 1000 }), P('zener', 8, 8, 8, 4, { vz: 5.1 }));
  const s = new Simulator(c);
  s.step();
  near(s.voltageAt(8, 4), 5.1, 0.25, '제너 전압');
});

ok('가변저항: 10 V, 와이퍼 25 % → 7.5 V (위 단자 기준 25 % 지점)', () => {
  const c = loop(V(10), P('pot', 8, 0, 8, 8, { r: 10000, pos: 0.25 }));
  const s = new Simulator(c);
  s.step();
  const w = terminals(c.parts[4])[2];
  near(s.voltageAt(w.x, w.y), 7.5, 1e-4, '와이퍼 전압');
});

ok('스위치: 열림 0 A, 닫힘 10 mA', () => {
  const sw = P('switch', 8, 0, 8, 4, { closed: false });
  const c = loop(V(10), sw, P('resistor', 8, 4, 8, 8, { r: 1000 }));
  const s = new Simulator(c);
  s.step();
  assert.ok(Math.abs(s.info(sw.id).current) < 1e-9);
  sw.props.closed = true; s.touch(); s.step();
  near(s.info(sw.id).current, 0.01, 1e-5, '닫힘 전류');
});

ok('NPN 스위치: 베이스 10 kΩ 로 켜면 포화(Vce < 0.2 V), 끄면 5 V', () => {
  // 컬렉터 저항 (8,0)-(8,4), 트랜지스터 베이스 (4,6) 몸체 (8,6) → C (8,4), E (8,8). 베이스 전원은 접지 레일 (2,8)에서
  const make = (vb) => ({ parts: [
    V(5), P('ground', 0, 8, 0, 9), W(0, 0, 8, 0), W(0, 8, 12, 8),
    P('resistor', 8, 0, 8, 4, { r: 1000 }), P('npn', 4, 6, 8, 6, { beta: 100 }),
    P('dcv', 2, 8, 2, 4, { v: vb }), P('resistor', 2, 4, 4, 4, { r: 10000 }), W(4, 4, 4, 6),
  ] });
  const on = make(5);
  const s = new Simulator(on);
  s.run(3);
  const q = s.info(on.parts[5].id);
  const vce = q.volts[1] - q.volts[2];
  assert.ok(vce < 0.2 && vce > 0, `Vce ${vce}`);
  assert.equal(q.region, '포화');
  const off = make(0);
  const s2 = new Simulator(off);
  s2.run(3);
  const q2 = s2.info(off.parts[5].id);
  near(q2.volts[1] - q2.volts[2], 5, 0.01, '꺼짐 Vce');
  assert.equal(q2.region, '차단');
});

ok('NPN 증폭: 베이스 20 µA, β 100 → 컬렉터 약 2 mA', () => {
  const c = { parts: [
    V(10), P('ground', 0, 8, 0, 9), W(0, 0, 8, 0), W(0, 8, 8, 8),
    P('resistor', 8, 0, 8, 4, { r: 1000 }), P('npn', 4, 6, 8, 6, { beta: 100 }),
    P('dci', 4, 2, 4, 6, { i: 20e-6 }), W(4, 2, 4, 0),
  ] };
  const s = new Simulator(c);
  s.run(3);
  near(s.info(c.parts[5].id).ti[1], 0.002, 0.00005, '컬렉터 전류');
});

ok('N채널 MOSFET 로우사이드: 게이트 5 V → 켜짐, 0 V → 꺼짐', () => {
  const make = (vg) => ({ parts: [
    V(12), P('ground', 0, 8, 0, 9), W(0, 0, 8, 0), W(0, 8, 12, 8),
    P('resistor', 8, 0, 8, 4, { r: 100 }), P('nmos', 4, 6, 8, 6, {}),
    P('dcv', 2, 8, 2, 6, { v: vg }), W(2, 6, 4, 6),
  ] });
  const c = make(5);
  const s = new Simulator(c); s.run(3);
  const m = s.info(c.parts[5].id);
  assert.ok(m.volts[1] < 0.5, `Vds ${m.volts[1]}`);
  near(m.ti[1], 0.12, 0.003, '드레인 전류');
  const c2 = make(0);
  const s2 = new Simulator(c2); s2.run(3);
  near(s2.info(c2.parts[5].id).volts[1], 12, 0.01, '꺼짐 드레인 전압');
});

ok('PNP·P채널 하이사이드 스위치가 켜진다', () => {
  for (const type of ['pnp', 'pmos']) {
    // 에미터/소스를 위 레일(5 V)에: 몸체 (8,2), 베이스 (4,2) → C/D (8,4), E/S (8,0) 이 되도록 뒤집기
    const c = { parts: [
      V(5), P('ground', 0, 8, 0, 9), W(0, 0, 8, 0), W(0, 8, 8, 8),
      P(type, 4, 2, 8, 2, { flip: true }), P('resistor', 8, 4, 8, 8, { r: 1000 }),
      P('resistor', 4, 2, 4, 8, { r: type === 'pnp' ? 10000 : 1000 }),
    ] };
    const t = terminals(c.parts[4]);
    assert.deepEqual([t[1].y, t[2].y], [4, 0]);
    const s = new Simulator(c); s.run(3);
    assert.ok(s.voltageAt(8, 4) > 4.5, `${type} 출력 ${s.voltageAt(8, 4)}`);
  }
});

ok('OP 앰프 비반전 증폭: 1 V 입력, 1 kΩ/1 kΩ → 2 V', () => {
  // +입력 (4,1) 출력 (8,2): opamp p1 (4,2) p2 (8,2), 뒤집기 없음 → n=(0,1): + (4,3), − (4,1)
  const op = P('opamp', 4, 2, 8, 2, {});
  const [plus, minus, out] = terminals(op);
  const c = { parts: [
    P('ground', 0, 8, 0, 9), P('dcv', 0, 8, 0, plus.y, { v: 1 }), W(0, plus.y, plus.x, plus.y), op,
    P('resistor', out.x, out.y, out.x, -2, { r: 1000 }), W(out.x, -2, minus.x, -2), W(minus.x, -2, minus.x, minus.y),
    P('resistor', minus.x, -2, -2, -2, { r: 1000 }), W(-2, -2, -2, 8), W(-2, 8, 0, 8),
  ] };
  const s = new Simulator(c);
  s.run(5);
  near(s.voltageAt(out.x, out.y), 2, 0.001, '출력');
});

ok('교류 RC 저역 통과: 차단 주파수에서 진폭 0.707', () => {
  const R = 1000, C = 1 / (2 * Math.PI * 1000 * R);
  const c = loop(P('acv', 0, 8, 0, 0, { amp: 1, freq: 1000 }), P('resistor', 8, 0, 8, 4, { r: R }), P('capacitor', 8, 4, 8, 8, { c: C }));
  const s = new Simulator(c, { dt: 1e-6 });
  let peak = 0;
  for (let i = 0; i < 8000; i++) { s.step(); if (i > 6000) peak = Math.max(peak, s.voltageAt(8, 4)); }
  near(peak, Math.SQRT1_2, 0.01, '출력 진폭');
});

ok('PWM 50 %: LED 평균 전류가 연속 켜짐의 절반', () => {
  const c = loop(P('pulse', 0, 8, 0, 0, { high: 5, low: 0, freq: 1000, duty: 0.5 }), P('resistor', 8, 0, 8, 4, { r: 220 }), P('led', 8, 4, 8, 8, { color: 'red' }));
  const s = new Simulator(c, { dt: 1e-6 });
  let sum = 0;
  for (let i = 0; i < 4000; i++) { s.step(); sum += s.info(c.parts[5].id).current; }
  near(sum / 4000, 0.0142 / 2, 0.0006, '평균 전류');
});

ok('풀 수 없는 회로(서로 다른 전압원 병렬)는 오류를 낸다', () => {
  const c = loop(V(5), P('dcv', 8, 8, 8, 0, { v: 3 }));
  const s = new Simulator(c);
  assert.equal(s.step(), false);
  assert.match(s.error, /풀 수 없습니다/);
});

ok('접지가 없으면 전원 − 단자를 기준으로 잡고 알려 준다', () => {
  const c = { parts: [V(10), W(0, 0, 8, 0), W(0, 8, 8, 8), P('resistor', 8, 0, 8, 8, { r: 1000 })] };
  const s = new Simulator(c);
  s.step();
  near(s.voltageAt(8, 0), 10, 1e-6, '위 레일');
  assert.ok(s.warnings.some((w) => w.includes('접지')));
});

ok('연결 안 된 단자를 알려 준다', () => {
  const c = loop(V(5), P('resistor', 8, 0, 8, 4, { r: 1000 }));
  const s = new Simulator(c);
  assert.ok(s.warnings.some((w) => w.includes('연결되지 않은')));
});

ok('SPICE 넷리스트 내보내기', () => {
  const c = loop(V(10), P('resistor', 8, 0, 8, 4, { r: 4700 }), P('led', 8, 4, 8, 8, { color: 'red' }), P('npn', 4, 6, 8, 6, {}));
  const text = toSpice(c, { title: '시험', dt: 1e-5, stop: 1e-2 });
  assert.match(text, /^\* 시험/);
  assert.match(text, /^R1 \S+ \S+ 4\.7k$/m);
  assert.match(text, /^V1 \S+ 0 DC 10$/m);
  assert.match(text, /^D1 \S+ 0 DLED_RED$/m);
  assert.match(text, /^Q1 \S+ \S+ \S+ QNPN$/m);
  assert.match(text, /^\.model DLED_RED D\(/m);
  assert.match(text, /^\.tran 10u 10m$/m);
  assert.match(text, /^\.end$/m);
});

ok('예제 회로가 모두 오류·경고 없이 돈다', () => {
  for (const ex of EXAMPLES) {
    const c = exampleCircuit(ex.key);
    const s = new Simulator(c, { dt: c.dt });
    assert.ok(s.run(3000), `${ex.title}: ${s.error}`);
    assert.equal(s.slow, 0, `${ex.title} 수렴 지연`);
    assert.deepEqual(s.warnings, [], `${ex.title} 경고`);
  }
  // PWM 예제: 듀티 30 % → LED 평균 전류는 연속 켜짐(약 20 mA)의 약 30 %
  const c = exampleCircuit('pwm');
  const s = new Simulator(c, { dt: c.dt });
  s.run(20000);
  const led = s.els.find((e) => e.type === 'led');
  const avg = led.out.avgCurrent;
  assert.ok(avg > 0.004 && avg < 0.009, `PWM 평균 전류 ${avg}`);
  // 트랜지스터 예제: 스위치가 열려 있으면 LED 꺼짐
  const n2 = exampleCircuit('npn');
  const s2 = new Simulator(n2); s2.run(50);
  assert.ok(Math.abs(s2.els.find((e) => e.type === 'led').out.current) < 1e-6);
});

// ── 정밀 해석 ──
const nodeV = (_, c, x, y) => new Simulator(c).nodeAt(x, y);

ok('동작점: 분압 5 V, 콘덴서는 개방·코일은 단락', () => {
  const c = loop(V(10), P('resistor', 8, 0, 8, 4, { r: 1000 }), P('resistor', 8, 4, 8, 8, { r: 1000 }), P('capacitor', 8, 4, 12, 4, { c: 1e-6 }), W(12, 4, 12, 8));
  const r = operatingPoint(c);
  assert.ok(!r.error, r.error);
  near(r.nodes[nodeV(null, c, 8, 4) - 1], 5, 1e-6, '가운데');
  const rl = loop(V(5), P('resistor', 8, 0, 8, 4, { r: 100 }), P('inductor', 8, 4, 8, 8, { l: 1e-3 }));
  const r2 = operatingPoint(rl);
  near(r2.elems.find((e) => e.type === 'inductor').current, 0.05, 1e-5, '코일 단락 전류');
});

ok('과도: 동작점에서 시작하면 정상 상태, 0 에서 시작하면 충전 곡선', () => {
  const c = loop(V(5), P('resistor', 8, 0, 8, 4, { r: 1000 }), P('capacitor', 8, 4, 8, 8, { c: 1e-6 }));
  const n = nodeV(null, c, 8, 4) - 1;
  const a = transient(c, { stop: 1e-3, maxStep: 1e-6 });
  near(a.nodes[n][0], 5, 1e-6, '동작점 시작'); near(a.nodes[n].at(-1), 5, 1e-6, '끝');
  const b = transient(c, { stop: 1e-3, maxStep: 1e-6, fromZero: true });
  near(b.nodes[n].at(-1), 5 * (1 - Math.exp(-1)), 0.005, '0 에서 1 ms');
  near(b.x.at(-1), 1e-3, 1e-12, '끝 시간');
  assert.ok(b.x.length <= 4001);
});

ok('교류: RC 저역 통과 −3 dB = 1 kHz, 위상 −45°, 10 배 위에서 −20 dB', () => {
  const R = 1000, C = 1 / (2 * Math.PI * 1000 * R);
  const src = P('acv', 0, 8, 0, 0, { amp: 1, freq: 1000 });
  const c = loop(src, P('resistor', 8, 0, 8, 4, { r: R }), P('capacitor', 8, 4, 8, 8, { c: C }));
  const r = acAnalysis(c, { sourceId: src.id, fStart: 10, fStop: 1e6, perDecade: 50 });
  assert.ok(!r.error, r.error);
  const n = nodeV(null, c, 8, 4) - 1;
  const m = measureBode(r.x, r.nodesRe[n], r.nodesIm[n]);
  near(m.f3db, 1000, 15, '−3 dB 주파수');
  near(m.lowGain, 0, 0.01, '저주파 이득');
  const i10k = r.x.findIndex((f) => f >= 9999);
  near(m.db[i10k], -20.04, 0.1, '10 kHz 이득');
  const i1k = r.x.findIndex((f) => f >= 999);
  near(m.ph[i1k], -45, 0.5, '1 kHz 위상');
});

ok('교류: RLC 대역 통과 공진 = 1/(2π√LC)', () => {
  const L = 1e-3, C = 1e-6, f0 = 1 / (2 * Math.PI * Math.sqrt(L * C));
  const src = P('acv', 0, 8, 0, 0, { amp: 1 });
  const c = { parts: [src, P('ground', 0, 8, 0, 9), W(0, 0, 4, 0), P('inductor', 4, 0, 8, 0, { l: L }), P('capacitor', 8, 0, 12, 0, { c: C }), P('resistor', 12, 0, 12, 8, { r: 10 }), W(12, 8, 0, 8)] };
  const r = acAnalysis(c, { sourceId: src.id, fStart: 100, fStop: 100e3, perDecade: 400 });
  const n = nodeV(null, c, 12, 0) - 1;
  const m = measureBode(r.x, r.nodesRe[n], r.nodesIm[n]);
  near(m.peakFreq, f0, f0 * 0.01, '공진 주파수');
  near(m.peakGain, 0, 0.05, '공진 이득');
});

ok('교류: OP 앰프 3배 증폭 = 9.54 dB, 전류원 입력도 된다', () => {
  const ex = exampleCircuit('opamp');
  const src = ex.parts.find((p) => p.type === 'acv');
  const r = acAnalysis(ex, { sourceId: src.id, fStart: 10, fStop: 1e4 });
  const out = ex.parts.find((p) => p.type === 'opamp');
  const n = nodeV(null, ex, out.x2, out.y2) - 1;
  near(measureBode(r.x, r.nodesRe[n], r.nodesIm[n]).lowGain, 20 * Math.log10(3), 0.01, '이득');
  // 전류원에 1 A 교류 → 1 kΩ 양단 1000 V (60 dB)
  const isrc = P('dci', 8, 8, 8, 0, { i: 0 });
  const c2 = { parts: [P('ground', 0, 8, 0, 9), W(0, 8, 8, 8), W(0, 0, 8, 0), P('resistor', 0, 0, 0, 8, { r: 1000 }), isrc] };
  const r2 = acAnalysis(c2, { sourceId: isrc.id, fStart: 10, fStop: 100 });
  assert.ok(!r2.error, r2.error);
  const n2 = nodeV(null, c2, 0, 0) - 1;
  near(measureBode(r2.x, r2.nodesRe[n2], r2.nodesIm[n2]).lowGain, 60, 0.01, '전류원 입력');
});

ok('직류 스윕: LED I-V (5 V 에서 14 mA), 다이오드 1 mA 순방향', () => {
  const src = V(0);
  const c = loop(src, P('resistor', 8, 0, 8, 4, { r: 220 }), P('led', 8, 4, 8, 8, { color: 'red' }));
  const r = dcSweep(c, { sourceId: src.id, from: 0, to: 5, points: 51 });
  assert.ok(!r.error, r.error);
  const led = c.parts[5].id;
  near(r.elems[led].at(-1), 0.0142, 0.0008, '5 V 전류');
  for (let i = 1; i < r.x.length; i++) assert.ok(r.elems[led][i] >= r.elems[led][i - 1] - 1e-12, '단조 증가');
  assert.ok(Math.abs(r.elems[led][10]) < 1e-6, '1 V 에서는 거의 0');
});

ok('부품 모델: 1N4007 1 A 순방향 0.85~1.15 V, AO3400 4.5 V 구동 1 A 에서 약 27 mV', () => {
  const m = PART_MODELS.diode.find((x) => x.key === '1N4007');
  const src = P('dci', 8, 8, 8, 0, { i: 1 });
  const d = P('diode', 0, 0, 0, 8, { ...m.props, model: m.key });
  const c = { parts: [P('ground', 0, 8, 0, 9), W(0, 0, 8, 0), W(0, 8, 8, 8), d, src] };
  const r = operatingPoint(c);
  const vf = r.elems.find((e) => e.id === d.id).volts;
  const v = vf[0] - vf[1];
  assert.ok(v > 0.85 && v < 1.15, `1N4007 Vf ${v}`);
  const ao = PART_MODELS.nmos.find((x) => x.key === 'AO3400');
  const mos = P('nmos', 4, 6, 8, 6, { ...ao.props });
  const c2 = { parts: [P('dci', 12, 0, 8, 0, { i: 1 }), W(12, 0, 12, 8), P('ground', 8, 8, 8, 9), W(8, 8, 12, 8), W(8, 0, 8, 4), mos, P('dcv', 2, 8, 2, 6, { v: 4.5 }), W(2, 6, 4, 6), W(2, 8, 8, 8)] };
  const r2 = operatingPoint(c2);
  assert.ok(!r2.error, r2.error);
  const vds = r2.elems.find((e) => e.id === mos.id).volts[1];
  near(vds, 0.027, 0.004, 'AO3400 Vds');
});

ok('온도: 다이오드 순방향 전압이 약 −2 mV/°C 로 줄어든다', () => {
  const src = P('dci', 8, 8, 8, 0, { i: 1e-3 });
  const d = P('diode', 0, 0, 0, 8, {});
  const c = { parts: [P('ground', 0, 8, 0, 9), W(0, 0, 8, 0), W(0, 8, 8, 8), d, src] };
  const v = (t) => { const r = operatingPoint(c, { temp: t }); const e = r.elems.find((x) => x.id === d.id); return e.volts[0] - e.volts[1]; };
  const slope = (v(77) - v(27)) / 50;
  assert.ok(slope < -0.0015 && slope > -0.0025, `기울기 ${slope}`);
});

ok('반복: 저항 값 바꾸기·몬테카를로(재현 가능)·온도', () => {
  const src = P('acv', 0, 8, 0, 0, { amp: 1 });
  const R = P('resistor', 8, 0, 8, 4, { r: 1000 });
  const C = 1 / (2 * Math.PI * 1000 * 1000);
  const c = loop(src, R, P('capacitor', 8, 4, 8, 8, { c: C }));
  const n = nodeV(null, c, 8, 4) - 1;
  const base = { type: 'ac', sourceId: src.id, fStart: 10, fStop: 1e5, perDecade: 50 };
  const f3 = (run) => measureBode(run.result.x, run.result.nodesRe[n], run.result.nodesIm[n]).f3db;
  const p = runAnalysis(c, { ...base, sweep: { kind: 'param', partId: R.id, key: 'r', values: [1000, 2000] } });
  assert.equal(p.runs.length, 2);
  near(f3(p.runs[1]) / f3(p.runs[0]), 0.5, 0.01, '저항 두 배 → 차단 주파수 절반');
  const mc = runAnalysis(c, { ...base, sweep: { kind: 'mc', runs: 30, tol: 5, seed: 7 } });
  const mc2 = runAnalysis(c, { ...base, sweep: { kind: 'mc', runs: 30, tol: 5, seed: 7 } });
  const fs = mc.runs.map(f3);
  assert.deepEqual(fs, mc2.runs.map(f3), '같은 씨앗이면 같은 결과');
  assert.ok(Math.min(...fs) > 900 && Math.max(...fs) < 1110 && Math.max(...fs) - Math.min(...fs) > 20, `범위 ${Math.min(...fs)}~${Math.max(...fs)}`);
  const t = runAnalysis(c, { type: 'op', sweep: { kind: 'temp', values: [-20, 27, 85] } });
  assert.deepEqual(t.runs.map((r) => r.temp), [-20, 27, 85]);
});

ok('SPICE 로 해석 설정 내보내기 (.ac·.dc·.op·온도)', () => {
  const src = P('acv', 0, 8, 0, 0, { amp: 1, freq: 1000 });
  const c = loop(src, P('resistor', 8, 0, 8, 4, { r: 1000 }), P('capacitor', 8, 4, 8, 8, { c: 1e-6 }));
  const ac = toSpice(c, { analysis: { type: 'ac', sourceId: src.id, fStart: 10, fStop: 1e5, perDecade: 20, temp: 85, sweep: { kind: 'none' } } });
  assert.match(ac, /^V1 N\d+ 0 SIN\(.*\) AC 1$/m);
  assert.match(ac, /^\.ac dec 20 10 100k$/m);
  assert.match(ac, /^\.temp 85$/m);
  assert.doesNotMatch(ac, /^\.tran/m);
  const dc = toSpice(c, { analysis: { type: 'dc', sourceId: src.id, from: 0, to: 5, points: 51, sweep: { kind: 'temp', values: [-20, 27, 85] } } });
  assert.match(dc, /^\.dc V1 0 5 100m$/m);
  assert.match(dc, /^\.step temp list -20 27 85$/m);
  assert.match(toSpice(c, { analysis: { type: 'op', sweep: { kind: 'none' } } }), /^\.op$/m);
  assert.match(toSpice(c, { analysis: { type: 'tran', stop: 0.01, maxStep: 1e-5, fromZero: true, sweep: { kind: 'none' } } }), /^\.tran 0 10m 0 10u uic$/m);
});

ok('측정: 사인파 실효값 0.707, 주파수, 평균 0', () => {
  const x = Array.from({ length: 2001 }, (_, i) => i * 1e-5), y = x.map((t) => Math.sin(2 * Math.PI * 1000 * t));
  const m = measureWave(x, y);
  near(m.rms, Math.SQRT1_2, 0.002, '실효값'); near(m.freq, 1000, 1, '주파수'); near(m.avg, 0, 0.002, '평균'); near(m.pp, 2, 1e-3, '피크 간');
});

console.log(`\n${n}개 검산 통과`);
