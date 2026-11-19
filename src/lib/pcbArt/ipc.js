// PCB 전기 설계 기준식 (IPC-2221B). 검사·시뮬레이션·화면이 같이 쓴다. 단위: mm, A, °C, V
// 근사식이며 실제 온도 상승은 주변 동박·공기 흐름·기판 두께에 따라 달라진다 (IPC-2152 가 더 정밀).

export const RHO_CU = 1.72e-8; // 구리 비저항 Ω·m (20 °C)
export const ALPHA_CU = 0.00393; // 구리 저항 온도 계수 /°C
export const MIL = 0.0254; // mm
export const OZ_MM = 0.035; // 1 oz 동박 두께

const K_EXT = 0.048, K_INT = 0.024; // 외층·내층 상수

/** 전류 I 를 온도 상승 dT 이하로 흘리는 데 필요한 트랙 폭 (mm) */
export function widthForCurrent(I, { dT = 10, cu = OZ_MM, internal = false } = {}) {
  if (!(I > 0)) return 0;
  const k = internal ? K_INT : K_EXT;
  const areaMil2 = (I / (k * dT ** 0.44)) ** (1 / 0.725);
  return (areaMil2 / (cu / MIL)) * MIL;
}

/** 폭 w 트랙에 전류 I 가 흐를 때 온도 상승 (°C) */
export function tempRise(I, w, { cu = OZ_MM, internal = false } = {}) {
  if (!(I > 0) || !(w > 0)) return 0;
  const k = internal ? K_INT : K_EXT;
  const areaMil2 = (w / MIL) * (cu / MIL);
  return (I / (k * areaMil2 ** 0.725)) ** (1 / 0.44);
}

/** 트랙 저항 (Ω): 길이·폭 mm, 온도 °C */
export const trackR = (lenMm, wMm, { cu = OZ_MM, tempC = 25 } = {}) => (RHO_CU * (1 + ALPHA_CU * (tempC - 20)) * (lenMm / 1000)) / ((wMm / 1000) * (cu / 1000));
/** 동박 면저항 (Ω/□) */
export const sheetR = (cu = OZ_MM) => RHO_CU / (cu / 1000);
/** 비아 저항 (Ω): 도금 두께 plating mm (기본 0.02) */
export const viaR = (drillMm, boardMm = 1.6, plating = 0.02) => (RHO_CU * (boardMm / 1000)) / (Math.PI * ((drillMm + plating) / 1000) * (plating / 1000));
/** 동박면 위 두 접점 사이 퍼짐 저항 (Ω) — 무한 판 근사: Rs/π · ln(d/r) */
export const spreadR = (d, r, cu = OZ_MM) => (sheetR(cu) / Math.PI) * Math.log(Math.max(d, 2 * r) / Math.max(r, 0.05));

// 도체 사이 최소 간격 (IPC-2221B 표 6-1, B2: 외층·코팅 없음, 해발 3050 m 이하). [전압 상한 V, 간격 mm]
const B2 = [[15, 0.1], [30, 0.1], [50, 0.6], [100, 0.6], [150, 0.6], [170, 1.25], [250, 1.25], [300, 1.25], [500, 2.5]];
/** 전압 차 v 에 필요한 간격 (mm) */
export function clearanceForVoltage(v) {
  const a = Math.abs(Number(v) || 0);
  const row = B2.find(([lim]) => a <= lim);
  return row ? row[1] : Math.round(a * 0.005 * 1000) / 1000; // 500 V 초과: 1 V 당 0.005 mm
}

/** 마이크로스트립 임피던스 (Ω) — IPC-2141 근사, w·h·t mm, er 유전율 (FR-4 ≈ 4.4) */
export function microstripZ0({ w, h, t = OZ_MM, er = 4.4 }) {
  if (!(w > 0) || !(h > 0)) return null;
  const x = (5.98 * h) / (0.8 * w + t);
  if (x <= 0) return null;
  return (87 / Math.sqrt(er + 1.41)) * Math.log(x);
}
/** 원하는 임피던스에 맞는 폭 (mm) — 이분 탐색 */
export function widthForZ0(z0, { h, t = OZ_MM, er = 4.4 }) {
  let lo = 0.02, hi = 10;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; const z = microstripZ0({ w: m, h, t, er }); if (z == null || z < z0) hi = m; else lo = m; }
  return Math.round(((lo + hi) / 2) * 1000) / 1000;
}

/** 넷 이름으로 종류·전압 짐작: { kind: 'gnd'|'power'|'hv'|'signal', v } */
export function guessNet(name) {
  const n = String(name || '').toUpperCase().replace(/^\//, '');
  if (/^(A|P|D|S)?GND|^VSS|^0V$|GROUND|EARTH/.test(n)) return { kind: 'gnd', v: 0 };
  if (/(^|[^A-Z])(HV|EP|ELECTRODE|HIGH_?V|RF_?OUT|PROBE)/.test(n)) return { kind: 'hv', v: 0 };
  if (/VBUS|USB_?5V/.test(n)) return { kind: 'power', v: 5 };
  if (/VBAT|BAT\+|BATT/.test(n)) return { kind: 'power', v: 4.2 };
  const m = n.match(/(?:^|[^A-Z0-9])\+?(\d+)V(\d+)?(?![A-Z])/) || n.match(/^\+?(\d+(?:\.\d+)?)V/);
  if (m) return { kind: 'power', v: Number(m[2] ? `${m[1]}.${m[2]}` : m[1]) };
  if (/^(VCC|VDD|VIN|VSYS|VLED|PWR|V\+|VCOIN|\+VCOIN)/.test(n) || /^\+V/.test(n)) return { kind: 'power', v: 0 };
  return { kind: 'signal', v: 0 };
}
