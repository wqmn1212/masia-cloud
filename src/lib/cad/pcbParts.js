// 기판에 실장된 부품을 높이 있는 상자로 만들어 외장 조립에 넣는다 (간섭 검사·3D 표시용).
// 자리는 회로 단계의 자동 배치(placeParts) 결과, 높이는 실장 모양 이름으로 어림한다 (데이터시트 최대 높이에 가깝게).
const RULES = [
  [/RF_Module:ESP32/, 3.3], [/USB_C_Receptacle/, 3.4], [/BarrelJack/, 11], [/JST_SH_SM/, 3.0], [/JST_PH_S|JST_XH_S/, 6], [/JST_PH/, 6.2], [/JST_XH/, 7.2],
  [/CP_Elec_[\d.]+x([\d.]+)/, (m) => Number(m[1]) + 0.3], [/CP_Radial_D[\d.]+mm_P[\d.]+mm/, 12], [/SRU(\d\d)(\d\d)/, (m) => Number(m[2]) / 10 + 0.2], [/L_.*?(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)/, (m) => Number(m[3])], [/Inductor_SMD:L_/, 4.5],
  [/_0402_/, 0.6], [/_0603_/, 0.9], [/_0805_/, 1.3], [/_1206_/, 1.7], [/_1210_/, 2.6],
  [/SOT-23|SOT-89|SOT-223/, 1.3], [/SOIC|SOP-|TSSOP|MSOP/, 1.8], [/QFN|DFN/, 1.0], [/D_SMA|D_SMB|D_SMC/, 2.5], [/D_SOD/, 1.3],
  [/Crystal/, 1.2], [/Buzzer/, 9.5], [/BatteryHolder/, 5.5], [/RotaryEncoder/, 20], [/SW_SPDT|SW_Slide/, 5], [/SW_/, 4.3], [/LED_/, 1.0], [/MountingHole/, 0],
];

/** 실장 모양 이름 → 기판 면에서의 높이 (mm) */
export function partHeight(fp) {
  for (const [re, h] of RULES) { const m = re.exec(fp || ''); if (m) return typeof h === 'function' ? h(m) : h; }
  return 2;
}

/** 축에 나란한 상자 메시 (면마다 정점을 따로 둬 법선이 평평하다) */
export function boxMesh([x0, y0, x1, y1], z0, z1) {
  const c = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const faces = [[0, 3, 2, 1, [0, 0, -1]], [4, 5, 6, 7, [0, 0, 1]], [0, 1, 5, 4, [0, -1, 0]], [1, 2, 6, 5, [1, 0, 0]], [2, 3, 7, 6, [0, 1, 0]], [3, 0, 4, 7, [-1, 0, 0]]];
  const V = [], N = [], F = [];
  faces.forEach(([a, b, d, e, n], i) => { for (const k of [a, b, d, e]) { V.push(...c[k]); N.push(...n); } F.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3); });
  return { V: Float32Array.from(V), F: Uint32Array.from(F), N: Float32Array.from(N) };
}

/**
 * 제어 기판의 부품 상자 목록.
 * @param board buildHwPackage(...).boards 의 한 장 (layout.z 가 있어야 한다: 외장 템플릿에서 온 기판)
 * @returns [{ id, ref, name, side, rect, h, z0, z1, mesh }] — 외장에 따로 그려진 부품(버튼·다이얼·잭·USB 등 앵커 부품)과 높이 0.8 mm 이하 부품은 뺀다
 */
export function pcbPartBoxes(board, { minH = 0.8, t = 1.6 } = {}) {
  const z = board?.layout?.z;
  if (!Number.isFinite(z)) return [];
  const out = [];
  for (const o of board.pcb.place.list) {
    if (o.outside || o.anchor) continue;
    const h = partHeight(o.c.part.fp);
    if (h <= minH) continue;
    const z0 = o.side === 'B' ? z - h : z + t, z1 = o.side === 'B' ? z : z + t + h;
    out.push({ id: `pcbc_${o.c.ref}`, ref: o.c.ref, name: `${o.c.ref} ${o.c.value || o.c.part.name || ''} (기판 부품, 높이 ${h} mm)`.replace(/\s+/g, ' '), side: o.side, rect: o.rect, h, z0, z1, mesh: boxMesh(o.rect, z0, z1) });
  }
  return out;
}

/** 간섭 검사에서 건너뛸 쌍: 기판 부품끼리, 기판 부품과 기판 */
export const skipPcbPair = (a, b) => (a.startsWith('pcbc_') && (b.startsWith('pcbc_') || b === 'pcb')) || (b.startsWith('pcbc_') && a === 'pcb');
