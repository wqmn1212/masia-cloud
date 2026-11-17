// 금형용 설계 템플릿 치수 → 제어 기판 외곽·구멍·부품 자리 (2D, CAD 좌표: X 오른쪽, Y 뒤(앞 = −Y), 단위 mm).
// CAD 엔진 없이 계산하므로 화면·KiCad 내보내기·DXF 에서 바로 쓴다. builders.js 의 기판 솔리드도 이 값을 따른다.
import { cleanParams, handheldAsBox } from './catalog.js';

const DEG = Math.PI / 180;
const tanD = (d) => Math.tan(d * DEG);
const r2 = (v) => Math.round(v * 100) / 100;

export function ellipsePts(cx, cy, a, b, n = 72) {
  return Array.from({ length: n }, (_, i) => { const t = (2 * Math.PI * i) / n; return [r2(cx + a * Math.cos(t)), r2(cy + b * Math.sin(t))]; });
}
export function rrectPts(w, h, r, n = 8) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  const pts = [];
  const corner = (cx, cy, a0) => { for (let i = 0; i <= n; i++) { const t = (a0 + (90 * i) / n) * DEG; pts.push([r2(cx + rr * Math.cos(t)), r2(cy + rr * Math.sin(t))]); } };
  corner(w / 2 - rr, h / 2 - rr, 0); corner(-w / 2 + rr, h / 2 - rr, 90); corner(-w / 2 + rr, -h / 2 + rr, 180); corner(w / 2 - rr, -h / 2 + rr, 270);
  return rr > 0 ? pts : [[w / 2, h / 2], [-w / 2, h / 2], [-w / 2, -h / 2], [w / 2, -h / 2]];
}
export const polyArea = (pts) => Math.abs(pts.reduce((s, [x, y], i) => { const [x2, y2] = pts[(i + 1) % pts.length]; return s + x * y2 - x2 * y; }, 0)) / 2;
export function inPoly(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function roundLamp(p) {
  const a = p.draft, w = p.wall;
  const rx = p.base_w / 2, ry = p.base_d / 2, Hb = p.base_h;
  const dw = w / Math.cos(a * DEG);
  const rxi = rx - dw, ryi = ry - dw;
  const shrink = (z) => (z + 1) * tanD(a);
  const wallY = (x, z) => { const ax = rxi - shrink(z), ay = ryi - shrink(z); return ay * Math.sqrt(Math.max(0, 1 - (x / ax) ** 2)); };
  const wallX = (y, z) => { const ax = rxi - shrink(z), ay = ryi - shrink(z); return ax * Math.sqrt(Math.max(0, 1 - (y / ay) ** 2)); };
  const sideX = wallX(4, Hb) - 3 - 1.2;
  const rearX = 0.4 * rxi, rearY = wallY(rearX + 3, Hb) - 3 - 1.2;
  const bosses = [[-sideX, -4], [sideX, -4], [rearX, rearY]];
  const plateT = p.plate_t;
  const pcbZ = plateT + 2.4, pcbTop = pcbZ + 1.6; // 기판 아래 2.4 mm: 뒷면에 높이 2 mm 이하 부품(인덕터·SOIC)을 둘 자리
  const swZ = pcbTop + 3, jackZ = pcbTop + 4.5;
  const dialZ = Math.max(p.dial_z, pcbTop + 7);
  // 기판: 받침대 안쪽 타원(기판 윗면 높이)에서 0.8 mm 띄움, 바닥판 고정 보스 자리는 구멍으로 피한다
  const ex = rxi - shrink(pcbTop) - 0.8, ey = ryi - shrink(pcbTop) - 0.8;
  const bossR = (z) => 3 - (Hb - w + 0.3 - z) * tanD(Math.max(1.5, a)); // 보스 반지름 (높이 z)
  const holes = bosses.map(([x, y]) => ({ x: r2(x), y: r2(y), d: r2(2 * (bossR(pcbTop) + 0.6)), kind: 'boss', keep: r2(bossR(pcbTop + 12) + 0.8), label: '바닥판 고정 보스 자리 (기판이 끼워져 자리를 잡는다)' }));
  const encFront = -wallY(6.2, dialZ + 6.2) + 0.3;
  const yT = wallY(-12, swZ + 3) - 0.3, yB = wallY(-20, swZ + 3) - 0.3, xJ = -wallX(18.5, jackZ + 4.5) + 0.3;
  return {
    kind: 'ellipse', outline: ellipsePts(0, 0, ex, ey), size: [r2(2 * ex), r2(2 * ey)], z: r2(pcbZ), backClear: r2(pcbZ - plateT), holes,
    anchors: [
      { id: 'dial', kind: 'encoder', x: 0, y: r2(encFront + 3.5), dir: -90, label: '다이얼 (앞 벽, 축이 앞으로)', sideways: true },
      { id: 'toggle', kind: 'switch', x: -6, y: r2(yT - 3), dir: 90, label: '수면 모드 토글 (뒤 벽)', sideways: true },
      { id: 'bt', kind: 'button', x: -17, y: r2(yB - 2.5), dir: 90, label: '블루투스 버튼 (뒤 벽)', sideways: true },
      { id: 'jack', kind: 'jack', x: r2(xJ + 6), y: 14, dir: 180, label: 'DC 잭 (왼쪽 벽)' },
    ],
    // 기판 위 높이 제한 구역 (외장 안쪽 구조물·부품 몸체 아래): 이 안에는 maxH 보다 높은 부품을 두지 않는다
    zones: [
      { rect: [-14.5, -6.5, 14.5, 6.5], maxH: r2(Math.max(0, p.pivot_h - 6 - pcbTop - 0.5)), label: '힌지 연결부·브래킷 아래' },
      { rect: [-6.9, r2(encFront - 0.6), 6.9, r2(encFront + 7.6)], maxH: 0, label: '로터리 엔코더 몸체' },
      { rect: [-12.6, r2(yT - 6.6), 0.6, r2(yT + 0.6)], maxH: 0, label: '토글 스위치 몸체' },
      { rect: [-20.6, r2(yB - 5.6), -13.4, r2(yB + 0.6)], maxH: 0, label: '블루투스 버튼 몸체' },
      { rect: [r2(xJ - 0.6), 8.9, r2(xJ + 12.6), 19.1], maxH: 0, label: 'DC 잭 몸체' },
    ],
    notes: ['블루투스 안테나가 금속 힌지·바닥 무게판 가까이 있습니다. 실물 시제품에서 블루투스 거리(목표 5 m 이상)를 꼭 재세요. 모자라면 모듈을 힌지에서 먼 쪽으로 옮기거나 안테나 외장형(-1U) 모듈을 씁니다.', '벽 밖으로 나가는 다이얼·토글·버튼은 옆으로 눕힌(직각) 부품을 쓰세요. 실장 모양은 세로형 기본값이라 바꿔야 합니다.', '바닥판 보스 3개가 기판 구멍에 끼워져 자리를 잡습니다. 기판 고정은 바닥판 쪽 받침(스페이서) 또는 양면 테이프로 합니다.'],
  };
}

function boxCase(p) {
  const a = p.draft, w = p.wall, D = p.depth, H = p.height;
  const Hl = Math.round(H * p.split) / 100;
  const dw = w / Math.cos(a * DEG);
  const pcbTop = p.usb === 'parting' ? Hl - 1.65 : Math.max(w + (p.battery ? p.battery + 1.5 : 3) + 1.6, Hl - 3);
  const n = p.buttons, pitch = p.button_d + 8;
  const alongY = p.button_axis === 'y';
  const anchors = Array.from({ length: n }, (_, i) => { const t = r2((i - (n - 1) / 2) * pitch); return { id: `button_${i + 1}`, kind: 'button', x: alongY ? 0 : t, y: alongY ? -t : 0, dir: 0, label: `버튼 ${i + 1} (윗면)` }; });
  if (p.usb !== 'none') anchors.push({ id: 'usb', kind: 'usb', x: 0, y: r2(Math.min(p.pcb_d / 2 - 3.7, D / 2 - dw - 3.7)), dir: 90, label: 'USB-C (뒤 벽)' });
  const hx = p.pcb_w / 2 - 3.5, hy = p.pcb_d / 2 - 3.5;
  return {
    kind: 'rect', outline: rrectPts(p.pcb_w, p.pcb_d, 1), size: [p.pcb_w, p.pcb_d], z: r2(pcbTop - 1.6), backClear: r2(Math.max(0, pcbTop - 1.6 - w - (p.battery ? p.battery + 1 : 0))),
    holes: [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([sx, sy]) => ({ x: r2(sx * hx), y: r2(sy * hy), d: 2.7, kind: 'mount', keep: 3, label: 'M2.5 고정 구멍 (아래 케이스 받침)' })),
    anchors, notes: ['기판 고정 구멍 4개에 맞는 받침(보스)을 아래 케이스 바닥에 추가하세요 (금형 설계에는 아직 없음).'],
  };
}

function cylinderCase(p) {
  const a = p.draft, w = p.wall, r = p.dia / 2, H = p.height;
  const Hc = Math.min(p.cap_h, H - 20), Hm = H - Hc;
  const dw = w / Math.cos(a * DEG);
  const pcbTop = Hm - 4;
  const ringR = ((p.outlet_d > 0 ? p.outlet_d / 2 + 3 : 0) + (r - dw - 4)) / 2;
  const n = p.buttons;
  const anchors = Array.from({ length: n }, (_, i) => { const g = (-90 + (i - (n - 1) / 2) * 32) * DEG; return { id: `button_${i + 1}`, kind: 'button', x: r2(ringR * Math.cos(g)), y: r2(ringR * Math.sin(g)), dir: 0, label: `버튼 ${i + 1} (윗면)` }; });
  const rh = p.pcb_d / 2 - 4;
  const holes = [90, 210, 330].map((g) => ({ x: r2(rh * Math.cos(g * DEG)), y: r2(rh * Math.sin(g * DEG)), d: 2.7, kind: 'mount', keep: 3, label: 'M2.5 고정 구멍' }));
  if (p.outlet_d > 0) holes.push({ x: 0, y: 0, d: r2(p.outlet_d + 4), kind: 'cutout', keep: 1, label: '배출구 통로' });
  return { kind: 'circle', outline: ellipsePts(0, 0, p.pcb_d / 2, p.pcb_d / 2), size: [p.pcb_d, p.pcb_d], z: r2(pcbTop - 1.6), backClear: r2(Math.max(0, pcbTop - 1.6 - w)), holes, anchors, notes: ['기판 고정 구멍 3개에 맞는 받침을 몸통 안쪽에 추가하세요 (금형 설계에는 아직 없음).'] };
}

const LAYOUTS = { round_lamp: roundLamp, box: boxCase, cylinder: cylinderCase, handheld: (p) => boxCase(handheldAsBox(p)) };

/** 금형용 설계(dev.mold_design)의 기판. 템플릿이 없으면 null */
export function pcbLayout(template, rawParams) {
  if (!LAYOUTS[template]) return null;
  const p = cleanParams(template, rawParams || {});
  const L = LAYOUTS[template](p);
  return { template, ...L, area: r2(polyArea(L.outline) - L.holes.reduce((s, h) => s + (Math.PI * h.d * h.d) / 4, 0)), source: '금형용 설계' };
}

/** 금형 설계가 없을 때: 부품 면적에 맞춘 사각 기판 */
export function defaultLayout(partArea) {
  const need = Math.max(900, partArea * 2.2);
  const wv = Math.ceil(Math.sqrt(need * 4 / 3) / 5) * 5, hv = Math.ceil(need / wv / 5) * 5;
  const hx = wv / 2 - 3.5, hy = hv / 2 - 3.5;
  const outline = rrectPts(wv, hv, 1);
  return {
    template: null, kind: 'rect', outline, size: [wv, hv], z: 0, source: '기본 (금형용 설계 없음)',
    holes: [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([sx, sy]) => ({ x: sx * hx, y: sy * hy, d: 3.2, kind: 'mount', keep: 3.5, label: 'M3 고정 구멍' })),
    anchors: [], notes: ['금형용 설계가 없어 부품 면적에 맞춘 사각 기판으로 잡았습니다. 3D 도면 단계에서 외장을 정하면 외곽이 맞춰집니다.'],
    area: polyArea(outline) - 4 * Math.PI * 1.6 * 1.6,
  };
}
