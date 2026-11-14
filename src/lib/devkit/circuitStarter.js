// 기능 목록 → 회로 시뮬레이터 시작 회로. 기능마다 MCU 핀을 전원(3.3 V 논리·PWM 펄스)으로 바꿔 놓은 작은 회로 블록을 격자에 나란히 둔다.
// 그대로 돌려 보며 저항·소자 값을 고르는 출발점이고, 실제 회로도(MCU·전원부 포함)는 아니다.
import { makePart } from '../circuit/parts.js';
import { FEATURE_KINDS, heaterWatts } from './features.js';

const PITCH_X = 26, PITCH_Y = 24, COLS = 3;

// 블록: (ox, oy) 를 원점으로 하는 부품 목록. 좌표는 회로 시뮬레이터 예제 회로와 같은 배치를 따른다
const BLOCKS = {
  button: (P, W) => [
    P('dcv', 0, 8, 0, 0, { v: 3.3 }), P('ground', 0, 8, 0, 9), W(0, 0, 8, 0),
    P('resistor', 8, 0, 8, 4, { r: 10000 }), P('switch', 8, 4, 8, 8, { closed: false }), W(8, 8, 0, 8),
    P('probe', 8, 4, 11, 4),
  ],
  tilt: (P, W) => BLOCKS.button(P, W),
  lid: (P, W) => BLOCKS.button(P, W),
  water: (P, W) => BLOCKS.button(P, W),
  led: (P, W, f) => [
    P('pulse', 0, 8, 0, 0, { high: 3.3, low: 0, freq: f.freq, duty: 0.5 }), P('ground', 0, 8, 0, 9), W(0, 0, 8, 0),
    P('resistor', 8, 0, 8, 4, { r: 330 }), P('led', 8, 4, 8, 8, { color: 'green' }), W(8, 8, 0, 8),
  ],
  motor: (P, W, f, s) => [
    P('dcv', 0, 17, 0, 0, { v: s.supply_v }), P('ground', 0, 17, 0, 18), W(0, 0, 12, 0), W(12, 0, 16, 0),
    P('resistor', 12, 0, 12, 6, { r: 10 }), P('inductor', 12, 6, 12, 13, { l: 1e-3 }),
    W(12, 13, 16, 13), P('diode', 16, 13, 16, 0, {}),
    P('nmos', 8, 15, 12, 15, {}), W(12, 17, 0, 17),
    P('pulse', 4, 17, 4, 13, { high: 3.3, low: 0, freq: f.freq, duty: 0.5 }), P('resistor', 4, 13, 8, 13, { r: 100 }), W(8, 13, 8, 15),
    P('resistor', 8, 15, 8, 17, { r: 100000 }),
  ],
  heater: (P, W, f, s) => [
    P('dcv', 0, 17, 0, 0, { v: s.supply_v }), P('ground', 0, 17, 0, 18), W(0, 0, 12, 0),
    P('resistor', 12, 0, 12, 13, { r: Math.max(0.5, Number(((s.supply_v ** 2) / heaterWatts(f)).toFixed(2))) }),
    P('nmos', 8, 15, 12, 15, {}), W(12, 17, 0, 17),
    P('pulse', 4, 17, 4, 13, { high: 3.3, low: 0, freq: f.freq, duty: 0.5 }), P('resistor', 4, 13, 8, 13, { r: 100 }), W(8, 13, 8, 15),
    P('resistor', 8, 15, 8, 17, { r: 100000 }),
  ],
  buzzer: (P, W, f) => [
    P('dcv', 0, 12, 0, 0, { v: 5 }), P('ground', 0, 12, 0, 13), W(0, 0, 12, 0),
    P('resistor', 12, 0, 12, 8, { r: 100 }), P('npn', 8, 10, 12, 10, { beta: 200 }), W(12, 12, 0, 12),
    P('pulse', 4, 12, 4, 8, { high: 3.3, low: 0, freq: f.freq, duty: 0.5 }), P('resistor', 4, 8, 8, 8, { r: 1000 }), W(8, 8, 8, 10),
  ],
  servo: (P, W, f) => [
    P('pulse', 0, 8, 0, 0, { high: 3.3, low: 0, freq: f.freq, duty: 0.075 }), P('ground', 0, 8, 0, 9), W(0, 0, 8, 0),
    P('resistor', 8, 0, 8, 8, { r: 10000 }), W(8, 8, 0, 8), P('probe', 8, 0, 11, -2),
  ],
  relay: (P, W) => [
    P('dcv', 0, 12, 0, 0, { v: 5 }), P('ground', 0, 12, 0, 13), W(0, 0, 12, 0), W(12, 0, 16, 0),
    P('resistor', 12, 0, 12, 4, { r: 70 }), P('inductor', 12, 4, 12, 8, { l: 0.01 }),
    W(12, 8, 16, 8), P('diode', 16, 8, 16, 0, {}),
    P('npn', 8, 10, 12, 10, { beta: 200 }), W(12, 12, 0, 12),
    P('dcv', 4, 12, 4, 6, { v: 3.3 }), P('switch', 4, 6, 8, 6, { closed: false }), P('resistor', 8, 6, 8, 10, { r: 1000 }),
  ],
  temp: (P, W) => [
    P('dcv', 0, 8, 0, 0, { v: 3.3 }), P('ground', 0, 8, 0, 9), W(0, 0, 8, 0),
    P('resistor', 8, 0, 8, 4, { r: 10000 }), P('resistor', 8, 4, 8, 8, { r: 10000 }), W(8, 8, 0, 8),
    P('probe', 8, 4, 11, 4),
  ],
  analog: (P, W) => [
    P('dcv', 0, 8, 0, 0, { v: 3.3 }), P('ground', 0, 8, 0, 9), W(0, 0, 8, 0),
    P('pot', 8, 0, 8, 8, { r: 10000, pos: 0.5 }), W(8, 8, 0, 8), P('probe', 6, 4, 3, 4),
  ],
  battery: (P, W) => [
    P('dcv', 0, 8, 0, 0, { v: 4.2 }), P('ground', 0, 8, 0, 9), W(0, 0, 8, 0),
    P('resistor', 8, 0, 8, 4, { r: 100000 }), P('resistor', 8, 4, 8, 8, { r: 100000 }), W(8, 8, 0, 8),
    P('capacitor', 12, 4, 12, 8, { c: 1e-7 }), W(8, 4, 12, 4), W(8, 8, 12, 8),
    P('probe', 12, 4, 14, 2),
  ],
};

export const hasBlock = (kind) => !!BLOCKS[kind];

/** 기능 하나의 블록. 측정점(probe)·주요 소자를 돌려준다 */
export function featureBlock(feature, settings = {}, ox = 0, oy = 0) {
  const kind = FEATURE_KINDS[feature.kind];
  const make = BLOCKS[feature.kind];
  if (!kind || !make) return [];
  const s = { supply_v: Number(settings.supply_v) || 5 };
  const P = (type, x1, y1, x2, y2, props) => makePart(type, x1 + ox, y1 + oy, x2 + ox, y2 + oy, props);
  const W = (x1, y1, x2, y2) => P('wire', x1, y1, x2, y2);
  return make(P, W, { freq: kind.freq || 1000, power_w: feature.power_w }, s).map((p) => ({ ...p, feature_id: feature.id }));
}

/** 기능 전체 → 회로 시뮬레이터 회로 { version, parts, dt, blocks:[{feature_id, name, x, y}] } */
export function starterCircuit(features, settings = {}) {
  const parts = [];
  const blocks = [];
  let i = 0;
  let fastest = 1000;
  features.forEach((f) => {
    if (!hasBlock(f.kind)) return;
    const ox = (i % COLS) * PITCH_X, oy = Math.floor(i / COLS) * PITCH_Y;
    parts.push(...featureBlock(f, settings, ox, oy));
    blocks.push({ feature_id: f.id, name: f.name, kind: f.kind, x: ox, y: oy });
    fastest = Math.max(fastest, FEATURE_KINDS[f.kind].freq || 0);
    i += 1;
  });
  // 가장 빠른 PWM 한 주기에 25칸 이상
  const dt = Math.min(1e-5, Number((1 / fastest / 25).toPrecision(1)));
  return { version: 1, parts, dt, blocks };
}
