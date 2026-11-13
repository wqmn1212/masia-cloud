// 회로 시뮬레이터 예제 회로 (격자 좌표)
import { makePart as P } from './parts.js';

const W = (x1, y1, x2, y2) => P('wire', x1, y1, x2, y2);

export const EXAMPLES = [
  {
    key: 'led',
    title: 'LED와 저항',
    note: '스위치를 눌러 켜고 끕니다. 저항 값을 바꾸면 LED 전류와 밝기가 바뀝니다.',
    dt: 1e-5,
    parts: () => [
      P('dcv', 0, 8, 0, 0, { v: 5 }), P('ground', 0, 8, 0, 9),
      W(0, 0, 4, 0), P('switch', 4, 0, 8, 0, { closed: true }), W(8, 0, 12, 0),
      P('resistor', 12, 0, 12, 4, { r: 220 }), P('led', 12, 4, 12, 8, { color: 'red' }),
      W(12, 8, 0, 8),
      W(12, 4, 16, 4), P('voltmeter', 16, 4, 16, 8), W(12, 8, 16, 8),
    ],
  },
  {
    key: 'rc',
    title: 'RC 충전·방전',
    note: '100 Hz 펄스로 1 kΩ·1 µF 콘덴서를 충전·방전합니다. 콘덴서를 골라 스코프에 전압을 추가해 보세요.',
    dt: 1e-5,
    parts: () => [
      P('pulse', 0, 8, 0, 0, { high: 5, low: 0, freq: 100, duty: 0.5 }), P('ground', 0, 8, 0, 9),
      W(0, 0, 4, 0), P('resistor', 4, 0, 8, 0, { r: 1000 }), W(8, 0, 12, 0),
      P('capacitor', 12, 0, 12, 8, { c: 1e-6 }), W(12, 8, 0, 8),
      P('probe', 12, 0, 14, -2),
    ],
  },
  {
    key: 'pot',
    title: '분압과 가변저항',
    note: '가변저항의 와이퍼 위치를 바꾸면 가운데 전압이 바뀝니다.',
    dt: 1e-5,
    parts: () => [
      P('dcv', 0, 8, 0, 0, { v: 12 }), P('ground', 0, 8, 0, 9),
      W(0, 0, 8, 0), P('pot', 8, 0, 8, 8, { r: 10000, pos: 0.5 }), W(8, 8, 0, 8),
      P('probe', 6, 4, 3, 4),
    ],
  },
  {
    key: 'npn',
    title: '트랜지스터로 LED 켜기',
    note: '베이스 쪽 스위치를 닫으면 NPN 트랜지스터가 포화되어 LED가 켜집니다.',
    dt: 1e-5,
    parts: () => [
      P('dcv', 0, 12, 0, 0, { v: 9 }), P('ground', 0, 12, 0, 13),
      W(0, 0, 12, 0), P('resistor', 12, 0, 12, 4, { r: 470 }), P('led', 12, 4, 12, 8, { color: 'green' }),
      P('npn', 8, 10, 12, 10, { beta: 100 }), W(12, 12, 0, 12),
      P('switch', 4, 0, 4, 4, { closed: false }), P('resistor', 4, 4, 4, 8, { r: 10000 }), W(4, 8, 4, 10), W(4, 10, 8, 10),
    ],
  },
  {
    key: 'pwm',
    title: 'MOSFET PWM 감광 (LED 3개 직렬)',
    note: '1 kHz 펄스의 듀티비로 LED 평균 밝기를 조절합니다. 펄스 전원의 듀티비를 바꿔 보세요.',
    dt: 2e-6,
    parts: () => [
      P('dcv', 0, 17, 0, 0, { v: 12 }), P('ground', 0, 17, 0, 18),
      W(0, 0, 12, 0), P('resistor', 12, 0, 12, 4, { r: 150 }),
      P('led', 12, 4, 12, 7, { color: 'white' }), P('led', 12, 7, 12, 10, { color: 'white' }), P('led', 12, 10, 12, 13, { color: 'white' }),
      P('nmos', 8, 15, 12, 15, {}), W(12, 17, 0, 17),
      P('pulse', 4, 17, 4, 13, { high: 5, low: 0, freq: 1000, duty: 0.3 }), P('resistor', 4, 13, 8, 13, { r: 100 }), W(8, 13, 8, 15),
      P('resistor', 8, 15, 8, 17, { r: 10000 }),
    ],
  },
  {
    key: 'opamp',
    title: 'OP 앰프 비반전 증폭 (3배)',
    note: '0.5 V 사인파를 1 + 2 kΩ/1 kΩ = 3배로 키웁니다.',
    dt: 1e-5,
    parts: () => [
      P('acv', 0, 10, 0, 5, { amp: 0.5, freq: 100 }), P('ground', 0, 10, 0, 11), W(0, 10, 4, 10),
      W(0, 5, 6, 5), P('opamp', 6, 4, 12, 4, {}),
      W(12, 4, 12, 0), P('resistor', 12, 0, 6, 0, { r: 2000 }), W(6, 0, 6, 3),
      P('resistor', 6, 0, 2, 0, { r: 1000 }), W(2, 0, 2, 10),
      P('probe', 12, 4, 14, 6),
    ],
  },
  {
    key: 'rectifier',
    title: '반파 정류와 평활',
    note: '60 Hz 교류를 다이오드로 정류하고 100 µF 콘덴서로 평활합니다. 부하 저항을 줄이면 리플이 커집니다.',
    dt: 2e-5,
    parts: () => [
      P('acv', 0, 8, 0, 0, { amp: 10, freq: 60 }), P('ground', 0, 8, 0, 9),
      W(0, 0, 2, 0), P('diode', 2, 0, 6, 0), W(6, 0, 14, 0),
      P('capacitor', 10, 0, 10, 8, { c: 100e-6 }), P('resistor', 14, 0, 14, 8, { r: 1000 }),
      W(14, 8, 0, 8), P('probe', 10, 0, 12, -2),
    ],
  },
];

export const emptyCircuit = () => ({ version: 1, parts: [] });
export const exampleCircuit = (key) => {
  const ex = EXAMPLES.find((e) => e.key === key) || EXAMPLES[0];
  return { version: 1, parts: ex.parts(), dt: ex.dt };
};
