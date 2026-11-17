// 템플릿 치수 → 부품별 솔리드 (단위 mm, Z 위, 앞 = −Y). replicad 모듈(R)을 받아서 쓴다.
// 결과: { parts: [{ id, name, role, material, color, mold, group, shape }], motion, notes }
//  - mold: 사출 부품이면 true (금형 점검 대상)
//  - group: 'body' 는 회전하는 묶음 (motion 으로 돌려 보며 간섭을 본다)
import { taper, pin, boss, rib, bar, box, notch, slotZ, screwThrough, attempt, tanD } from './geom.js';
import { cleanParams, MATERIALS, handheldAsBox } from './catalog.js';
import { pcbLayout } from './pcbLayout.js';
import { sphereGeom } from './sphereGeom.js';

const COLORS = { shell: '#E2DFD9', shell2: '#D9D6D0', pc: '#F1F1EE', fabric: '#C8C6C1', steel: '#8C8F93', zinc: '#A9ACB0', pcb: '#27684B', mcpcb: '#E6E5DB', alu: '#B7BBC0', part: '#3A3A3A', knob: '#D3CFC8' };
const matLabel = (k) => MATERIALS[k]?.label || k;

// 무거운 부품(하우징·받침대)은 관련 치수가 같으면 다시 만들지 않는다 (미팅에서 슬라이더를 움직일 때 빠르게)
const CACHE = new Map();
function memo(key, make, notes) {
  let hit = CACHE.get(key);
  if (hit) { CACHE.delete(key); CACHE.set(key, hit); } else {
    const local = [];
    hit = { shape: make(local), notes: local };
    CACHE.set(key, hit);
    if (CACHE.size > 24) {
      const [k, old] = CACHE.entries().next().value;
      CACHE.delete(k);
      try { old.shape.delete?.(); } catch { /* 이미 해제 */ }
    }
  }
  notes.push(...hit.notes);
  return hit.shape.clone();
}

// ---------------------------------------------------------------- 원형 양면 조명

function roundLamp(R, p, notes) {
  const a = p.draft, w = p.wall;
  const Rd = p.dia / 2, T = p.thick, h = T / 2;
  const Zb = p.base_h + p.gap; // 본체 아래 끝 높이
  const Zc = Zb + Rd; // 본체 중심 높이
  const parts = [];
  let last = Date.now();
  const add = (o) => { const now = Date.now(); parts.push({ group: 'fixed', mold: false, role: '', ...o, ms: now - last }); last = now; };

  // 본체 나사 보스 자리: 앞쪽 보스 Ø5.5(나사 구멍 Ø2.2), 뒤쪽 보스 Ø7(통과 구멍 Ø2.9 + 머리 자리 Ø5.4)
  const odF = 5.5, odR = 7;
  let nb = Number(p.bosses) || 0;
  const rb = Rd - w - odR / 2 - 1.2; // 바깥 벽에서 1.2 mm 띄운다 (벽에 붙이면 뿌리가 두꺼워져 외관에 수축 자국)
  const bd = Math.max(1.5, a); // 보스·구멍 구배 (점검 기준 1° 보다 여유 있게)
  const Ro = Rd - p.bezel; // 발광창 반지름 (안쪽 면 기준)
  if (nb && Ro > rb - odR / 2 - 0.5) {
    notes.push(`테두리 폭 ${p.bezel} mm 로는 본체 나사 보스(Ø${odR})가 발광창에 걸려 보스를 뺐습니다. 테두리 폭을 ${Math.ceil((p.bezel + (Ro - (rb - odR / 2 - 0.5))) * 2) / 2} mm 이상으로 하면 들어갑니다.`);
    nb = 0;
  }
  const innerR = nb ? rb - odR / 2 - 0.4 : Rd - w - 0.5; // 안쪽 판(LED·방열판)이 쓸 수 있는 반지름
  const tw = 22, tt = Math.max(6, Math.min(10, T - 2 * w - 6)); // 힌지 연결부 폭·두께
  const angles = [];
  for (let k = 0; k < nb; k++) angles.push((nb % 2 ? 90 : 90 + 180 / nb) + (k * 360) / nb);

  // 하우징 반쪽 (s = +1 앞, −1 뒤). 로컬 좌표: 원판 축 = Z, 분할면 z = 0
  const halfKey = JSON.stringify([p.dia, p.thick, p.bezel, nb, w, a, p.edge_r]);
  const half = (s) => memo(`half${s}|${halfKey}`, (notes) => {
    const zf = s * h; // 바깥 면
    let outer = taper(R, 'circle', Rd, Rd, 0, 0, zf, a);
    if (p.edge_r > 0) outer = attempt(() => outer.fillet(Math.min(p.edge_r, h - 0.5), (e) => e.inPlane('XY', zf)), outer, notes, `${s > 0 ? '앞' : '뒤'} 하우징 바깥 모서리 R`);
    const dw = w / Math.cos((a * Math.PI) / 180);
    const inner = taper(R, 'circle', Rd - dw, Rd - dw, 0, -s * 1, zf - s * w, a);
    let shell = outer.cut(inner);
    // 발광창: 바깥 면 쪽이 넓다
    const win = taper(R, 'circle', Ro + (w + 1) * tanD(a), 0, 0, zf + s * 0.5, zf - s * (w + 0.5), a);
    shell = shell.cut(win);
    // 아래쪽 힌지 연결부 자리 (분할면 쪽이 넓다)
    const nz = s * (tt / 2 + 0.8);
    const cutter = taper(R, 'rrect', tw + 1.6 + 2 * Math.abs(nz) * tanD(a), w + 4, 0.4, -s * 0.5, nz, a).translate([0, -Rd + (w + 4) / 2 - 1.5, 0]);
    shell = shell.cut(cutter);
    for (const ang of angles) {
      const x = rb * Math.cos((ang * Math.PI) / 180), y = rb * Math.sin((ang * Math.PI) / 180);
      if (s > 0) {
        shell = shell.fuse(boss(R, x, y, zf - s * (w - 0.3), s * 0.15, odF, 2.2, 99, bd));
      } else {
        // 뒤쪽: 통과 구멍 + 바깥 면 머리 자리
        const b = pin(R, x, y, zf - s * (w - 0.3), s * 0.15, odR / 2, bd);
        shell = shell.fuse(b);
        shell = shell.cut(screwThrough(R, x, y, zf, s * 0.15, w, bd));
      }
    }
    return shell;
  }, notes);
  const place = (shape) => shape.rotate(90, [0, 0, 0], [1, 0, 0]).translate([0, 0, Zc]); // 로컬 +Z → 앞(−Y)
  add({ id: 'front_housing', name: '앞 하우징', role: '앞면 발광창 테두리, 나사 보스(Ø2.2)', material: matLabel(p.material), color: COLORS.shell, mold: true, group: 'body', shape: place(half(1)) });
  add({ id: 'rear_housing', name: '뒤 하우징', role: '뒷면 발광창 테두리, 나사 통과 구멍', material: matLabel(p.material), color: COLORS.shell, mold: true, group: 'body', shape: place(half(-1)) });

  // 안쪽 부품 (로컬 좌표에서 만들고 같이 옮긴다)
  // 확산판은 발광창보다 2 mm 크게, 보스 자리는 반원 홈으로 비운다
  const rd = Math.min(Ro + 2, Rd - w - 0.4);
  const diffuser = (s) => memo(`diff${s}|${halfKey}`, () => {
    let d = taper(R, 'circle', rd, 0, 0, s * (h - w), s * (h - w - 1.5), Math.max(1.5, a));
    for (const ang of angles) d = d.cut(taper(R, 'circle', odR / 2 + 0.6, 0, 0, s * (h - w + 0.5), s * (h - w - 2), Math.max(1.5, a)).translate([rb * Math.cos((ang * Math.PI) / 180), rb * Math.sin((ang * Math.PI) / 180), 0]));
    return d;
  }, notes);
  add({ id: 'front_diffuser', name: '앞 확산판 (패브릭 뒤)', role: '4,000K 기상등 발광면', material: 'PC 확산', color: COLORS.fabric, mold: true, group: 'body', shape: place(diffuser(1)) });
  add({ id: 'rear_diffuser', name: '뒤 확산판 (유백)', role: '2,700K 수면등 발광면', material: 'PC 유백', color: COLORS.pc, mold: true, group: 'body', shape: place(diffuser(-1)) });
  const tongueTop = -Rd + w + 6; // 힌지 연결부가 본체 안으로 들어오는 끝 (로컬 y)
  const rs = Math.min(innerR - 0.5, Math.abs(tongueTop) - 1); // 힌지 연결부 끝보다 1 mm 위
  const rl = Math.min(Ro - 1, rs);
  add({ id: 'spreader', name: '가운데 방열판 (알루미늄)', material: '알루미늄 1.5T×2', color: COLORS.alu, group: 'body', shape: place(R.makeCylinder(rs, 3, [0, 0, -1.5])) });
  add({ id: 'led_front', name: '앞 LED 판 (MCPCB)', material: 'MCPCB', color: COLORS.mcpcb, group: 'body', shape: place(R.makeCylinder(rl, 1.6, [0, 0, 1.5])) });
  add({ id: 'led_rear', name: '뒤 LED 판 (MCPCB)', material: 'MCPCB', color: COLORS.mcpcb, group: 'body', shape: place(R.makeCylinder(rl, 1.6, [0, 0, -3.1])) });
  if (h - w - 1.5 - 3.4 >= 4) {
    const ct = Math.min(5, h - w - 1.5 - 3.4 - 0.3);
    add({ id: 'clock', name: '시계 모듈 (7세그먼트)', material: '모듈', color: COLORS.part, group: 'body', shape: place(box(R, [0, -0.45 * Rd, 3.4 + ct / 2], [44, 14, ct])) });
  }
  // 힌지 연결부 (본체 안 → 받침대 속 축), 축 구멍 Ø3.2
  const tz0 = p.pivot_h - 6, tz1 = Zc + tongueTop;
  if (tz1 - tz0 > 4) {
    const tongue = box(R, [0, 0, (tz0 + tz1) / 2], [tw, tt, tz1 - tz0]).cut(bar(R, 'x', [0, 0, p.pivot_h], 1.6, tw + 2));
    add({ id: 'tongue', name: '힌지 연결부', role: '본체 → 받침대 속 축', material: '아연 다이캐스트', color: COLORS.zinc, group: 'body', shape: tongue });
  }

  // ---- 받침대 (조립 좌표, 위로 빼는 컵, 아래가 열림)
  const rx = p.base_w / 2, ry = p.base_d / 2, Hb = p.base_h;
  const dw = w / Math.cos((a * Math.PI) / 180);
  const rxi = rx - dw, ryi = ry - dw;
  // 안쪽 벽 위치 (구배 포함): 높이 z 에서 x 일 때 y, y 일 때 x
  const shrink = (z) => (z + 1) * tanD(a);
  const wallY = (x, z) => { const ax = rxi - shrink(z), ay = ryi - shrink(z); return ay * Math.sqrt(Math.max(0, 1 - (x / ax) ** 2)); };
  const wallX = (y, z) => { const ax = rxi - shrink(z), ay = ryi - shrink(z); return ax * Math.sqrt(Math.max(0, 1 - (y / ay) ** 2)); };
  // 윗면 힌지 슬롯: 기울어도 연결부가 닿지 않는 길이
  const slotL = 2 * (tt / 2 + Math.max(0, Hb - p.pivot_h) * tanD(p.tilt) + 0.8);
  const slotW = tw + 1.6;
  if (slotL / 2 > ryi - 2) notes.push(`기울기 ${p.tilt}° 에 필요한 받침대 윗면 슬롯(${slotL.toFixed(1)} mm)이 받침대보다 깁니다. 회전축을 올리거나 기울기를 줄이세요.`);
  // 바닥판 고정 보스 3개 (위에서 매달려 바닥판까지)
  const plateT = p.plate_t;
  const sideX = wallX(4, Hb) - 3 - 1.2; // 벽에서 1.2 mm 띄운다
  const rearX = 0.4 * rxi, rearY = wallY(rearX + 3, Hb) - 3 - 1.2;
  const bossXY = [[-sideX, -4], [sideX, -4], [rearX, rearY]];
  // 버튼·잭 높이 (기판 위)
  const pcbZ = plateT + 2.4, pcbTop = pcbZ + 1.6; // 기판 아래 2.4 mm: 뒷면에 높이 2 mm 이하 부품(인덕터·SOIC)을 둘 자리
  const swZ = pcbTop + 3, jackZ = pcbTop + 4.5;
  const dialZ = Math.max(p.dial_z, pcbTop + 7);
  if (dialZ !== p.dial_z) notes.push(`다이얼 높이를 기판 위로 올려 ${dialZ} mm 로 잡았습니다.`);
  const notchStyle = p.hole_style === 'notch';
  const holes = [
    { id: 'dial', axis: 'y', c: [0, -ry, dialZ], d: 7.4, label: '다이얼 축 구멍' },
    { id: 'toggle', axis: 'y', c: [-6, wallY(-6, swZ) + dw, swZ], slot: [7.5, 3.8], label: '수면 모드 토글 구멍' },
    { id: 'bt', axis: 'y', c: [-17, wallY(-17, swZ) + dw, swZ], d: 6.8, label: '블루투스 버튼 구멍' },
    { id: 'jack', axis: 'x', c: [-wallX(14, jackZ) - dw, 14, jackZ], d: 8.4, label: 'DC 잭 구멍' },
  ];
  const baseKey = JSON.stringify([rx, ry, Hb, w, a, p.edge_r, slotL, slotW, bossXY, plateT, notchStyle, holes.map((x) => x.c)]);
  const base = memo(`base|${baseKey}`, (notes) => {
    let outer = taper(R, 'ellipse', rx, ry, 0, 0, Hb, a);
    if (p.edge_r > 0) outer = attempt(() => outer.fillet(Math.min(p.edge_r + 1, Hb / 3), (e) => e.inPlane('XY', Hb)), outer, notes, '받침대 윗 모서리 R');
    let b = outer.cut(taper(R, 'ellipse', rxi, ryi, 0, -1, Hb - w, a));
    b = b.cut(slotZ(R, 0, 0, slotW, Math.min(slotL, 2 * ryi - 4), Hb - w - 0.5, Hb + 0.5, a, 1));
    for (const [x, y] of bossXY) b = b.fuse(boss(R, x, y, Hb - w + 0.3, plateT, 6, 2.2, 99, Math.max(1.5, a)));
    for (const ho of holes) {
      const len = 4 * w + 8;
      if (notchStyle) {
        const width = ho.slot ? ho.slot[0] : ho.d;
        const top = ho.c[2] + (ho.slot ? ho.slot[1] : ho.d) / 2;
        const wb = width + 2 * (top + 0.5) * tanD(a);
        b = b.cut(notch(R, ho.axis, ho.c[0], ho.c[1], -0.5, top, wb, len, a));
      } else if (ho.slot) {
        b = b.cut(box(R, ho.c, [ho.slot[0], len, ho.slot[1]]));
      } else {
        b = b.cut(bar(R, ho.axis, ho.c, ho.d / 2, len));
      }
    }
    return b;
  }, notes);
  add({ id: 'base_shell', name: '받침대 하우징', role: notchStyle ? '버튼·잭 자리를 아래로 트인 홈으로 (슬라이드 없음)' : '버튼·잭 자리 벽 구멍 (슬라이드 필요)', material: matLabel(p.material), color: COLORS.shell2, mold: true, shape: base });

  // 받침대 안쪽 부품
  let plate = taper(R, 'ellipse', rxi - 0.3, ryi - 0.3, 0, 0, plateT, 0);
  for (const [x, y] of bossXY) plate = plate.cut(bar(R, 'z', [x, y, plateT / 2], 1.5, plateT + 2));
  add({ id: 'weight_plate', name: '바닥 무게판 (도장 강판)', role: '무게 중심 낮추기 + 바닥 덮개', material: '강판', color: COLORS.steel, shape: plate });
  // 기판: 안쪽 타원에서 0.8 mm 띄운 타원, 바닥판 보스 자리는 구멍 (회로 설계의 KiCad 외곽과 같은 값)
  const lay = pcbLayout('round_lamp', p);
  let pcbSolid = taper(R, 'ellipse', lay.size[0] / 2, lay.size[1] / 2, 0, pcbZ, pcbZ + 1.6, 0);
  for (const h of lay.holes) pcbSolid = pcbSolid.cut(bar(R, 'z', [h.x, h.y, pcbZ + 0.8], h.d / 2, 4));
  add({ id: 'pcb', name: '제어 기판', material: 'FR-4 1.6T', color: COLORS.pcb, shape: pcbSolid });
  // 다이얼 엔코더 + 축, 바깥 노브
  const encFront = -wallY(6.2, dialZ + 6.2) + 0.3;
  const outerFrontY = -(ry - dialZ * tanD(a)); // 바깥 앞 벽
  const shaftTip = outerFrontY - 0.6 - 5.5; // 노브 축 구멍(깊이 6) 바닥 0.5 mm 앞
  add({ id: 'encoder', name: '로터리 엔코더', material: '부품', color: COLORS.part, shape: box(R, [0, encFront + 3.5, dialZ], [12.4, 7, 12.4]).fuse(bar(R, 'y', [0, (encFront + shaftTip) / 2, dialZ], 3, encFront - shaftTip)) });
  const knobL = 8;
  let knob = taper(R, 'circle', p.dial_d / 2, 0, 0, 0, knobL, a);
  if (p.edge_r > 0) knob = attempt(() => knob.fillet(Math.min(1, p.dial_d / 6), (e) => e.inPlane('XY', knobL)), knob, notes, '다이얼 앞 모서리 R');
  knob = knob.cut(taper(R, 'circle', 3.35, 0, 0, -0.5, 6, Math.max(1.5, a)));
  // 노브는 로컬 +Z 가 앞(−Y)으로: X 축 +90° 회전 후 앞 벽에서 0.6 mm 띄운다
  add({ id: 'dial_knob', name: '다이얼 노브', role: '돌리면 밝기, 누르면 켜기·끄기', material: matLabel(p.material), color: COLORS.knob, mold: true, shape: knob.rotate(90, [0, 0, 0], [1, 0, 0]).translate([0, outerFrontY - 0.6, dialZ]) });
  // 토글·블루투스 스위치 (뒤 벽 안쪽)
  const yT = wallY(-12, swZ + 3) - 0.3;
  add({ id: 'toggle_sw', name: '수면 모드 토글 스위치', material: '부품 SS12D', color: COLORS.part, shape: box(R, [-6, yT - 3, swZ], [12, 6, 6]).fuse(box(R, [-6, yT + 1.5, swZ], [2.5, 3, 2.5])) });
  const yB = wallY(-20, swZ + 3) - 0.3;
  add({ id: 'bt_sw', name: '블루투스 버튼 (택트)', material: '부품', color: COLORS.part, shape: box(R, [-17, yB - 2.5, swZ], [6, 5, 6]).fuse(bar(R, 'y', [-17, yB + 0.8, swZ], 1.7, 2.6)) });
  const xJ = -wallX(18.5, jackZ + 4.5) + 0.3;
  add({ id: 'dc_jack', name: 'DC 잭 (12 V)', material: '부품', color: COLORS.part, shape: bar(R, 'x', [xJ + 6, 14, jackZ], 4.5, 12) });
  // 힌지 브래킷 2장 + 축
  const brZ0 = p.pivot_h - 6, brZ1 = Hb - w;
  if (brZ1 - brZ0 > 3) {
    for (const sx of [-1, 1]) {
      const br = box(R, [sx * (tw / 2 + 1.6), 0, (brZ0 + brZ1) / 2], [2, 12, brZ1 - brZ0]).cut(bar(R, 'x', [sx * (tw / 2 + 1.6), 0, p.pivot_h], 1.55, 4));
      add({ id: `bracket_${sx > 0 ? 'r' : 'l'}`, name: `힌지 브래킷 ${sx > 0 ? '오른쪽' : '왼쪽'} (마찰 힌지)`, material: '강판', color: COLORS.steel, shape: br });
    }
  } else notes.push('회전축이 받침대 윗면에 너무 가까워 힌지 브래킷을 넣지 못했습니다.');
  add({ id: 'axle', name: '회전축 핀 Ø3', material: '스테인리스', color: COLORS.steel, shape: bar(R, 'x', [0, 0, p.pivot_h], 1.5, tw + 7) });

  return {
    parts,
    motion: { group: 'body', label: `본체 기울기 ±${p.tilt}°`, origin: [0, 0, p.pivot_h], axis: [1, 0, 0], min: -p.tilt, max: p.tilt, clearance: 0.5 },
    overall: { x: Math.max(p.dia, p.base_w), y: Math.max(T, p.base_d), z: Zb + p.dia },
  };
}

// ---------------------------------------------------------------- 사각 하우징

const alongYBatt = (p) => (p.button_axis === 'y' ? [Math.min(34, p.pcb_w - 4), Math.min(50, p.pcb_d - 10), p.battery] : [Math.min(50, p.pcb_w - 10), Math.min(34, p.pcb_d - 6), p.battery]);

function boxCase(R, p, notes) {
  const a = p.draft, w = p.wall, W = p.width, D = p.depth, H = p.height, rc = p.corner;
  const Hl = Math.round(H * p.split) / 100;
  const dw = w / Math.cos((a * Math.PI) / 180);
  const parts = [];
  let last = Date.now();
  const add = (o) => { const now = Date.now(); parts.push({ group: 'fixed', mold: false, role: '', ...o, ms: now - last }); last = now; };

  // 분할선에서 가장 넓고 위·아래로 좁아진다
  let lowOuter = taper(R, 'rrect', W, D, rc, Hl, 0, a);
  if (p.edge_r > 0) lowOuter = attempt(() => lowOuter.fillet(Math.min(p.edge_r, Hl / 2), (e) => e.inPlane('XY', 0)), lowOuter, notes, '아래 케이스 모서리 R');
  const lowInner = taper(R, 'rrect', W - 2 * dw, D - 2 * dw, rc - w, Hl + 2, w, a);
  let lower = lowOuter.cut(lowInner);
  // 끼움 턱: 아래 케이스 벽 안쪽 절반이 1.5 mm 올라온다
  const lipH = 1.5;
  const lipOuter = (extra) => taper(R, 'rrect', W - dw + extra, D - dw + extra, rc - w / 2 + extra / 2, Hl - 0.5, Hl + lipH + extra / 2, a);
  lower = lower.fuse(lipOuter(0).cut(lowInner));

  let upOuter = taper(R, 'rrect', W, D, rc, Hl, H, a);
  if (p.edge_r > 0) upOuter = attempt(() => upOuter.fillet(Math.min(p.edge_r, (H - Hl) / 2), (e) => e.inPlane('XY', H)), upOuter, notes, '위 케이스 모서리 R');
  let upper = upOuter.cut(taper(R, 'rrect', W - 2 * dw, D - 2 * dw, rc - w, Hl - 1, H - w, a));

  // 모서리 나사 보스 (아래: 통과 구멍 + 머리 자리, 위: Ø2.2 나사 구멍)
  // 모서리 보스: 안쪽 벽에서 1.2 mm 띄워 세운다 (벽에 붙이면 뿌리가 두꺼워진다)
  const od = 7, gap = 1.2, bd = Math.max(1.5, a);
  const ri = rc - dw, off = ri - gap - od / 2;
  const cx = off >= 0 ? W / 2 - rc + off * Math.SQRT1_2 : W / 2 - dw - gap - od / 2 - H * tanD(a);
  const cy = off >= 0 ? D / 2 - rc + off * Math.SQRT1_2 : D / 2 - dw - gap - od / 2 - H * tanD(a);
  const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([sx, sy]) => [sx * cx, sy * cy]);
  const ribT = Math.max(0.8, w * 0.6);
  for (const [x, y] of corners) {
    upper = upper.fuse(boss(R, x, y, H - w + 0.3, Hl + 0.15, 5.5, 2.2, 99, bd));
    lower = lower.fuse(pin(R, x, y, w - 0.3, Hl - 0.15, od / 2, bd));
    lower = lower.cut(screwThrough(R, x, y, 0, Hl - 0.15, w, bd));
  }
  // 위 케이스 리브 2줄 (y = ±D/4), 버튼 자리와 겹치지 않게
  const ribH = Math.min(5, H - Hl - w - 3);
  const alongY = p.button_axis === 'y';
  if (!alongY && ribH >= 1.5 && D / 4 > p.button_d / 2 + 2) {
    for (const sy of [-1, 1]) upper = upper.fuse(rib(R, -(W / 2 - dw - 0.5), sy * D / 4, W / 2 - dw - 0.5, sy * D / 4, H - w + 0.3, H - w - ribH, ribT, 1));
  }
  // 끼움 턱 자리: 위 케이스 벽 안쪽 절반을 파낸다 (보스도 같이 다듬는다)
  upper = upper.cut(lipOuter(0.3).cut(taper(R, 'rrect', W - 2 * dw - 1.2, D - 2 * dw - 1.2, Math.max(0.5, rc - w - 0.6), Hl - 1, Hl + 3, 0)));

  // 내부: 배터리 → 기판 → 택트 스위치
  const usbMode = p.usb;
  const pcbTop = usbMode === 'parting' ? Hl - 1.65 : Math.max(w + (p.battery ? p.battery + 1.5 : 3) + 1.6, Hl - 3);
  const pcbZ = pcbTop - 1.6;
  if (p.battery > 0) {
    const bz0 = w + 0.3;
    if (bz0 + p.battery > pcbZ - 0.3) notes.push(`배터리(${p.battery} mm)가 기판 밑에 들어가지 않습니다. 아래 케이스 높이 비율을 늘리거나 배터리를 얇게 하세요.`);
    add({ id: 'battery', name: '배터리 (리튬 폴리머)', material: '부품', color: '#6E7B8B', shape: box(R, [0, 0, bz0 + p.battery / 2], alongYBatt(p)) });
  }
  add({ id: 'pcb', name: '메인 기판', material: 'FR-4 1.6T', color: COLORS.pcb, shape: box(R, [0, 0, pcbZ + 0.8], [p.pcb_w, p.pcb_d, 1.6]) });
  const n = p.buttons;
  const pitch = p.button_d + 8;
  for (let i = 0; i < n; i++) {
    const t = (i - (n - 1) / 2) * pitch;
    const x = alongY ? 0 : t, y = alongY ? -t : 0; // 손잡이형은 길이 방향(Y)으로, 첫 버튼이 USB 반대쪽 끝이 아니라 위쪽(+Y)부터
    if (Math.abs(t) + p.button_d / 2 > (alongY ? D : W) / 2 - dw - 4 - (alongY ? rc * 0.3 : 0)) { notes.push(`버튼 ${n}개가 윗면에 다 들어가지 않습니다.`); break; }
    upper = upper.cut(slotZ(R, x, y, p.button_d, p.button_d, H - w - 0.5, H + 0.5, a, p.button_d / 2 - 0.01));
    const capR = p.button_d / 2 - 0.3;
    const cap = R.makeCylinder(capR, w + 1.2, [x, y, H - w - 0.2]).fuse(R.makeCylinder(capR + 1.2, 1, [x, y, H - w - 1.05])).fuse(R.makeCylinder(2, H - w - 1.05 - (pcbTop + 5) + 0.2, [x, y, pcbTop + 5]));
    add({ id: `button_${i + 1}`, name: `버튼 ${i + 1}`, material: matLabel(p.material), color: COLORS.knob, shape: cap });
    add({ id: `tact_${i + 1}`, name: `택트 스위치 ${i + 1}`, material: '부품', color: COLORS.part, shape: box(R, [x, y, pcbTop + 2.5], [6, 6, 5]) });
  }
  // USB-C
  if (usbMode !== 'none') {
    const uz = pcbTop + 1.65;
    const yIn = D / 2 - dw - Math.abs(uz - Hl) * tanD(a);
    add({ id: 'usb', name: 'USB-C 커넥터', material: '부품', color: COLORS.steel, shape: box(R, [0, yIn - 3.7 + 0.8, uz], [8.9, 7.4, 3.2]) });
    if (usbMode === 'parting') {
      const wB = 9.6 + 2 * 1.9 * tanD(a);
      lower = lower.cut(notch(R, 'y', 0, D / 2, Hl + 0.01 + 3, Hl - 1.9, wB, 4 * w + 6, a));
      upper = upper.cut(notch(R, 'y', 0, D / 2, Hl - 0.01 - 3, Hl + 1.9, wB, 4 * w + 6, a));
      // (위 두 홈은 분할선에서 넓고 멀어질수록 좁다 → 슬라이드 없이 빠진다)
    } else {
      const cut = box(R, [0, D / 2, uz], [9.6, 4 * w + 6, 3.8]);
      if (uz < Hl) lower = lower.cut(cut); else upper = upper.cut(cut);
    }
  }
  add({ id: 'upper_case', name: '위 케이스', role: '윗면 버튼 구멍, 나사 보스(Ø2.2), 리브', material: matLabel(p.material), color: COLORS.shell, mold: true, shape: upper });
  add({ id: 'lower_case', name: '아래 케이스', role: '끼움 턱, 나사 통과 구멍', material: matLabel(p.material), color: COLORS.shell2, mold: true, shape: lower });
  parts.reverse();
  return { parts, motion: null, overall: { x: W, y: D, z: H } };
}

// ---------------------------------------------------------------- 원통형

function cylinderCase(R, p, notes) {
  const a = p.draft, w = p.wall, r = p.dia / 2, H = p.height;
  const Hc = Math.min(p.cap_h, H - 20), Hm = H - Hc; // 분할 높이
  const dw = w / Math.cos((a * Math.PI) / 180);
  const parts = [];
  let last = Date.now();
  const add = (o) => { const now = Date.now(); parts.push({ group: 'fixed', mold: false, role: '', ...o, ms: now - last }); last = now; };

  let bOuter = taper(R, 'circle', r, 0, 0, Hm, 0, a);
  if (p.edge_r > 0) bOuter = attempt(() => bOuter.fillet(Math.min(p.edge_r, 8), (e) => e.inPlane('XY', 0)), bOuter, notes, '몸통 바닥 모서리 R');
  const bInner = taper(R, 'circle', r - dw, 0, 0, Hm + 2, w, a);
  let body = bOuter.cut(bInner);
  const lipH = 2;
  const lip = (extra) => taper(R, 'circle', r - dw / 2 + extra / 2, 0, 0, Hm - 0.5, Hm + lipH + extra / 2, a);
  body = body.fuse(lip(0).cut(bInner));

  let cOuter = taper(R, 'circle', r, 0, 0, Hm, H, a);
  if (p.edge_r > 0) cOuter = attempt(() => cOuter.fillet(Math.min(p.edge_r, Hc / 2), (e) => e.inPlane('XY', H)), cOuter, notes, '윗뚜껑 모서리 R');
  let cap = cOuter.cut(taper(R, 'circle', r - dw, 0, 0, Hm - 1, H - w, a));

  // 보스 3개 (90°, 210°, 330°) 벽에 물림
  const bd = Math.max(1.5, a);
  const rbz = r - dw - 3.5 - 1.2 - Hm * tanD(a); // 벽에서 1.2 mm 띄운다
  const pts = [90, 210, 330].map((g) => [rbz * Math.cos((g * Math.PI) / 180), rbz * Math.sin((g * Math.PI) / 180)]);
  for (const [x, y] of pts) {
    body = body.fuse(pin(R, x, y, w - 0.3, Hm - 0.15, 3.5, bd));
    body = body.cut(screwThrough(R, x, y, 0, Hm - 0.15, w, bd));
    cap = cap.fuse(boss(R, x, y, H - w + 0.3, Hm + 0.15, 5.5, 2.2, 99, bd));
  }
  // 바닥 리브 4줄 (45° 방향)
  const ribL = r - dw - 4 - 4;
  for (const g of [45, 135, 225, 315]) {
    const c = Math.cos((g * Math.PI) / 180), s = Math.sin((g * Math.PI) / 180);
    body = body.fuse(rib(R, 4 * c, 4 * s, ribL * c, ribL * s, w - 0.3, w + 5, Math.max(0.8, w * 0.6), 1));
  }
  cap = cap.cut(lip(0.3).cut(taper(R, 'circle', r - dw - 0.6, 0, 0, Hm - 1, Hm + 3, 0)));

  // 윗면 배출구·버튼
  const pcbTop = Hm - 4;
  if (p.outlet_d > 0) cap = cap.cut(slotZ(R, 0, 0, p.outlet_d, p.outlet_d, H - w - 0.5, H + 0.5, a, p.outlet_d / 2 - 0.01));
  const ringR = ((p.outlet_d > 0 ? p.outlet_d / 2 + 3 : 0) + (r - dw - 4)) / 2;
  const n = p.buttons;
  for (let i = 0; i < n; i++) {
    const g = -90 + (i - (n - 1) / 2) * 32;
    const x = ringR * Math.cos((g * Math.PI) / 180), y = ringR * Math.sin((g * Math.PI) / 180);
    cap = cap.cut(slotZ(R, x, y, p.button_d, p.button_d, H - w - 0.5, H + 0.5, a, p.button_d / 2 - 0.01));
    const capR = p.button_d / 2 - 0.3;
    const stemTop = H - w - 1.05;
    add({ id: `button_${i + 1}`, name: `버튼 ${i + 1}`, material: matLabel(p.material), color: COLORS.knob, shape: R.makeCylinder(capR, w + 1.2, [x, y, H - w - 0.2]).fuse(R.makeCylinder(capR + 1.2, 1, [x, y, stemTop])).fuse(R.makeCylinder(2, stemTop - (pcbTop + 5) + 0.2, [x, y, pcbTop + 5])) });
    add({ id: `tact_${i + 1}`, name: `택트 스위치 ${i + 1}`, material: '부품', color: COLORS.part, shape: box(R, [x, y, pcbTop + 2.5], [6, 6, 5]) });
  }
  let pcb = R.makeCylinder(p.pcb_d / 2, 1.6, [0, 0, pcbTop - 1.6]);
  if (p.outlet_d > 0) pcb = pcb.cut(R.makeCylinder(p.outlet_d / 2 + 2, 4, [0, 0, pcbTop - 3]));
  if (p.pcb_d / 2 > rbz - 3.5 - 1) notes.push(`원형 기판(Ø${p.pcb_d})이 나사 보스에 닿을 수 있습니다. Ø${Math.floor(2 * (rbz - 4.5))} 이하로 하세요.`);
  add({ id: 'pcb', name: '원형 기판', material: 'FR-4 1.6T', color: COLORS.pcb, shape: pcb });
  add({ id: 'body', name: '몸통', role: '바닥 막힘, 끼움 턱, 바닥 리브, 나사 통과 구멍', material: matLabel(p.material), color: COLORS.shell2, mold: true, shape: body });
  add({ id: 'cap', name: '윗뚜껑', role: '배출구·버튼 구멍, 나사 보스(Ø2.2)', material: matLabel(p.material), color: COLORS.shell, mold: true, shape: cap });
  parts.reverse();
  return { parts, motion: null, overall: { x: p.dia, y: p.dia, z: H } };
}

// ---------------------------------------------------------------- 구형 셸 조명 (비스듬히 자른 공)

function sphereLamp(R, p, notes) {
  const g = sphereGeom(p);
  const a = p.draft, w = p.wall, bd = Math.max(1.5, a);
  const parts = [];
  let last = Date.now();
  const add = (o) => { const now = Date.now(); parts.push({ group: 'fixed', mold: false, role: '', ...o, ms: now - last }); last = now; };
  const BIG = 4 * g.R;
  // 로컬 → CAD 배치: 판(place) · 외장 테두리(placeR)
  const place = (shape) => shape.rotate(90 - g.t, [0, 0, 0], [1, 0, 0]).translate([0, 0, g.zc]);
  const placeR = (shape) => shape.rotate(90 - g.tr, [0, 0, 0], [1, 0, 0]).translate([0, 0, g.zc]);
  const disc = (r, z0, z1) => R.makeCylinder(r, Math.abs(z1 - z0), [0, 0, Math.min(z0, z1)]);
  // 사출 판: 앞(+z)이 넓고 뒤로 구배 (패브릭 프레임·확산판은 발광면 방향으로 뺀다)
  const dDisc = (r, z0, z1) => taper(R, 'circle', r, r, 0, Math.max(z0, z1), Math.min(z0, z1), a);
  const below = (y, z0, z1) => box(R, [0, y - BIG / 2, (z0 + z1) / 2], [BIG, BIG, Math.abs(z1 - z0) + 2]); // 로컬 y 아래쪽 반공간
  const above = (y, z0, z1) => box(R, [0, y + BIG / 2, (z0 + z1) / 2], [BIG, BIG, Math.abs(z1 - z0) + 2]);
  // 구배 있는 반공간: 경계면이 (y, zF) 를 지나고 앞(+z)으로 갈수록 y 가 k 만큼 움직인다 (y = y0 + k·(z − zF))
  // 남는 쪽 면이 앞(빼기 방향)을 보게: 위쪽이 남으면 k > 0, 아래쪽이 남으면 k < 0
  const half = (side, y0, zF, k) => box(R, [0, y0 + (side * BIG) / 2, zF], [BIG, BIG, BIG]).rotate((-Math.atan(k) * 180) / Math.PI, [0, y0, zF], [1, 0, 0]);
  const kD = tanD(Math.max(1, a));

  if (g.panelProud > 15) notes.push(`패브릭 판이 외장 테두리 위로 ${g.panelProud} mm 나옵니다. 판 위치(recess)를 뒤로 하거나 더 눕힘(rim_open)을 줄이세요.`);
  if (g.off > 0.05) notes.push(`자르는 면을 중심에서 ${g.off} mm 앞으로 두면 외장 안쪽에 ${(g.Ri - Math.sqrt(g.Ri ** 2 - g.off ** 2)).toFixed(2)} mm 언더컷이 생겨 코어를 그대로 뺄 수 없습니다 (0 이하 권장).`);

  // ---- 외장 (한 덩어리): 바깥 공 ∩ 바닥 위 ∩ 발광면 뒤 − 안쪽 공(바닥 두께 위)
  const shellKey = JSON.stringify([p.dia, w, p.flat_d, p.face_tilt, p.rim_open, p.recess, p.mix, p.face_off, p.edge_r, g.swZ, g.jackZ, g.dialZ, p.dial_d, g.dialAng, g.bosses.map((b) => [b.x, b.y])]);
  const shell = memo(`sphere|${shellKey}`, (notes) => {
    let outer = R.makeSphere(g.R).translate([0, 0, g.zc]);
    outer = outer.cut(box(R, [0, 0, -BIG / 2], [BIG, BIG, BIG]));
    outer = outer.cut(placeR(box(R, [0, 0, g.off + BIG / 2], [BIG, BIG, BIG])));
    let inner = R.makeSphere(g.Ri).translate([0, 0, g.zc]).cut(box(R, [0, 0, w - BIG / 2], [BIG, BIG, BIG]));
    let sh = outer.cut(inner);
    if (p.edge_r > 0) {
      const rim = new R.Plane(g.toWorldR([0, 0, g.off]), [1, 0, 0], g.nR);
      sh = attempt(() => sh.fillet(Math.min(p.edge_r, w * 0.45), (e) => e.inPlane(rim)), sh, notes, '외장 테두리 R');
    }
    // 방열판 고정 보스: 빼기 방향(테두리 로컬 z)과 평행하게 안쪽 벽에서 솟고, 끝은 방열판 뒷면 기울기로 자른다 (코어 핀 끝면 경사).
    // 벽이 비스듬해 보스 발 한쪽이 벽에서 뜨지 않도록 뿌리를 벽 속 깊이 넣고 바깥 공으로 잘라 겉에 튀어나오지 않게 한다
    const spBack = place(box(R, [0, 0, g.zSpB + BIG / 2], [BIG, BIG, BIG]));
    const ball = R.makeSphere(g.R - 0.3).translate([0, 0, g.zc]);
    for (const b of g.bosses) sh = sh.fuse(placeR(boss(R, b.x, b.y, b.zWall - 12, b.zTip + 3, 6, 2.2, 10, bd)).cut(spBack).intersect(ball));
    // 뒤쪽: DC 잭·수면 모드 토글·블루투스 버튼, 오른쪽: 다이얼 (빼기 방향과 비스듬한 구멍 → 슬라이드)
    const yJ = g.wallYAt(0, g.jackZ), yS = g.wallYAt(16, g.swZ);
    sh = sh.cut(bar(R, 'y', [0, yJ, g.jackZ], 4.3, 4 * w + 10));
    sh = sh.cut(box(R, [-16, g.wallYAt(-16, g.swZ), g.swZ], [7.5, 4 * w + 10, 3.8]));
    sh = sh.cut(bar(R, 'y', [16, yS, g.swZ], 3.4, 4 * w + 10));
    const rD = Math.sqrt(Math.max(0, g.R ** 2 - (g.dialZ - g.zc) ** 2));
    sh = sh.cut(bar(R, 'x', [rD, 0, g.dialZ], p.dial_d / 2 + 0.6, 4 * w + 10).rotate(g.dialAng, [0, 0, 0], [0, 0, 1]));
    return sh;
  }, notes);
  add({ id: 'shell', pull: g.nR, name: '외장 (공 셸)', role: '한 덩어리, 발광면 방향으로 뺀다. 뒤 잭·토글·버튼, 오른쪽 다이얼 구멍은 슬라이드', material: matLabel(p.material), color: COLORS.shell, mold: true, shape: shell });

  // ---- 발광면 쌓임 (로컬에서 만들어 함께 배치)
  const yb = g.yb, hasBand = p.clock_h > 0;
  // 패브릭: 위쪽(밝은 면)과 아래 띠(어두운 면, 시계 투과)
  let fab = disc(g.rp, g.zFabB, g.zFab);
  if (hasBand) {
    add({ id: 'fabric_main', name: '패브릭 (발광면)', role: '투광 멜란지 패브릭 0.6T, 프레임에 감아 붙인다', material: '폴리에스터 패브릭', color: COLORS.fabric, group: 'face', shape: place(fab.cut(below(yb, g.zFabB, g.zFab))) });
    add({ id: 'fabric_band', name: '패브릭 (시계 띠)', role: '어두운 패브릭, 도트 시계가 비친다', material: '폴리에스터 패브릭 (진한 색)', color: '#8E857B', group: 'face', shape: place(fab.cut(above(yb, g.zFabB, g.zFab))) });
  } else add({ id: 'fabric_main', name: '패브릭 (발광면)', material: '폴리에스터 패브릭', color: COLORS.fabric, group: 'face', shape: place(fab) });

  // 패브릭 프레임: 테두리 6 mm + 위 창 + 시계 창 + 칸막이 + LED 판까지 내려가는 기둥 3개
  const frameKey = JSON.stringify([g.rp, g.win, yb, g.zFabB, g.zFrB, g.zDifB, g.zLed, a]);
  const frame = memo(`sframe|${frameKey}`, () => {
    let f = dDisc(g.rp, g.zFrB, g.zFabB);
    // 창: 앞이 넓다 (뒤 끝 반지름 = win)
    const winCyl = taper(R, 'circle', g.win + (g.zFabB - g.zFrB + 2) * tanD(a), 0, 0, g.zFabB + 1, g.zFrB - 1, a);
    if (hasBand) {
      f = f.cut(winCyl.cut(half(-1, yb + 1, g.zFabB, -kD))); // 위 창: 칸막이 위 면이 앞을 본다
      f = f.cut(winCyl.cut(half(1, yb - 1, g.zFabB, kD))); // 시계 창: 칸막이 아래 면이 앞을 본다
      // 칸막이: 시계 띠와 위쪽 빛을 나눈다 (프레임 뒤에서 LED 판 앞 0.5 mm 까지)
      const chord = 2 * Math.sqrt(Math.max(0, g.win ** 2 - yb ** 2));
      f = f.fuse(taper(R, 'rrect', chord, 2.4, 0.3, g.zFrB + 0.3, g.zLed + 0.5, Math.max(0.5, a / 2)).translate([0, yb, 0]));
    } else f = f.cut(winCyl);
    // 걸림 3곳: 테두리 뒤에서 확산판 뒷면까지 내려오는 탭 (끝의 갈고리는 금형 상세 설계에서)
    for (const c of g.clips) {
      const tab = taper(R, 'rrect', 8, 2, 0.4, g.zFrB + 0.3, g.zDifB - 0.8, bd).rotate(c.a - 90, [0, 0, 0], [0, 0, 1]).translate([c.x, c.y, 0]);
      f = f.fuse(tab);
    }
    return f;
  }, notes);
  add({ id: 'face_frame', pull: g.n, name: '패브릭 프레임', role: '패브릭을 감아 붙이는 틀, 시계 칸막이, 확산판 가장자리 걸림 3곳', material: 'PC/ABS', color: COLORS.shell2, mold: true, group: 'face', shape: place(frame) });

  // 확산판 (시계 띠는 비운다, 기둥 자리 구멍)
  let dif = dDisc(g.win + 2, g.zDifB, g.zDif);
  if (hasBand) dif = dif.cut(half(-1, yb + 1.5, g.zDif, kD));
  // 뒤 기둥 3곳 (LED 판 앞면까지, 나사 구멍 Ø2.2)
  for (const q of g.posts) dif = dif.fuse(boss(R, q.x, q.y, g.zDifB + 0.3, g.zLed + 0.05, 5, 2.2, 8, bd));
  add({ id: 'diffuser', pull: g.n, name: '확산판 (PC 유백)', role: 'LED 점이 안 보이게 고르게 퍼뜨린다. 뒤 기둥 3곳에 LED 판을 나사 고정', material: 'PC 확산 2T', color: COLORS.pc, mold: true, group: 'face', shape: place(dif) });

  // LED 판 (MCPCB) + 방열판 (알루미늄): 시계 띠 위쪽만
  let led = disc(g.rLed, g.zLedB, g.zLed);
  let sp = disc(g.rLed, g.zSpB, g.zLedB);
  if (hasBand) { led = led.cut(below(yb + 1.5, g.zLedB, g.zLed)); sp = sp.cut(below(yb + 1.5, g.zSpB, g.zLedB)); }
  for (const b of g.bosses) sp = sp.cut(R.makeCylinder(1.7, 8, [b.panel[0], b.panel[1], g.zSpB - 3]));
  for (const b of g.bosses) led = led.cut(R.makeCylinder(3, 8, [b.panel[0], b.panel[1], g.zLedB - 3]));
  for (const q of g.posts) { led = led.cut(R.makeCylinder(1.4, 8, [q.x, q.y, g.zLedB - 3])); sp = sp.cut(R.makeCylinder(3, 8, [q.x, q.y, g.zSpB - 3])); }
  add({ id: 'led_board', name: 'LED 판 (MCPCB, 2,200K + 4,000K 두 채널)', role: '따뜻한 빛(수면)·밝은 빛(기상) 섞어 일출 연출', material: 'MCPCB 1.6T', color: COLORS.mcpcb, group: 'face', shape: place(led) });
  add({ id: 'spreader', name: '방열판 (알루미늄)', role: '보스 4곳에 나사 고정, 외부 비노출', material: '알루미늄 2T', color: COLORS.alu, group: 'face', shape: place(sp) });
  if (hasBand && g.clock.w > 20) {
    add({ id: 'clock', name: '도트 시계 모듈 (호박색)', role: '시:분 표시, 패브릭 띠 뒤', material: '모듈', color: COLORS.part, group: 'face', shape: place(box(R, [0, g.clock.y, g.clock.z], [g.clock.w, g.clock.h, g.clock.d])) });
  }

  // ---- 바닥: 무게판(접착) + 스탠드오프 3개 + 제어 기판
  const lay = pcbLayout('sphere_lamp', p);
  if (p.plate_t > 0) {
    add({ id: 'weight_plate', name: '바닥 무게판 (강판, 양면 접착)', role: '무게 중심을 낮춘다. 기판 스탠드오프 3개 압입', material: '강판', color: COLORS.steel, shape: R.makeCylinder(g.plateR, p.plate_t, [0, 0, w + 0.05]).cut(box(R, [0, g.plateCut - BIG / 2, w + p.plate_t / 2], [BIG, BIG, p.plate_t + 2])) });
  }
  for (const h of lay.holes.filter((x) => x.kind === 'mount')) {
    add({ id: `standoff_${h.id}`, name: '기판 스탠드오프 M2.5', material: '황동', color: COLORS.zinc, shape: R.makeCylinder(2.5, g.pcbZ - (w + p.plate_t) - 0.05, [h.x, h.y, w + p.plate_t + 0.05]) });
  }
  let pcb = R.makeCylinder(g.pcbR, 1.6, [0, 0, g.pcbZ]).cut(box(R, [0, g.yCut - BIG / 2, g.pcbZ + 0.8], [BIG, BIG, 4]));
  for (const h of lay.holes) pcb = pcb.cut(bar(R, 'z', [h.x, h.y, g.pcbZ + 0.8], h.d / 2, 4));
  add({ id: 'pcb', name: '제어 기판 (ESP32-S3·RTC·LED 드라이버 2채널)', material: 'FR-4 1.6T', color: COLORS.pcb, shape: pcb });
  // 뒤쪽 직각 부품 (기판 가장자리 → 외장 구멍), 오른쪽 다이얼
  const anchor = (id) => lay.anchors.find((x) => x.id === id);
  const jk = anchor('jack'), tg = anchor('toggle'), bt = anchor('bt'), dl = anchor('dial');
  add({ id: 'dc_jack', name: 'DC 잭 (12 V, 직각)', material: '부품', color: COLORS.part, shape: box(R, [jk.x, jk.y, g.pcbTop + 5.5], [9, 14, 11]) });
  add({ id: 'toggle_sw', name: '수면 모드 토글 (직각)', material: '부품', color: COLORS.part, shape: box(R, [tg.x, tg.y, g.swZ], [10, 6, 5]).fuse(box(R, [tg.x, tg.y + 4, g.swZ], [2.5, 3, 2.5])) });
  add({ id: 'bt_sw', name: '블루투스 버튼 (직각 택트)', material: '부품', color: COLORS.part, shape: box(R, [bt.x, bt.y, g.swZ], [6, 6, 5]).fuse(bar(R, 'y', [bt.x, bt.y + 3.8, g.swZ], 1.7, 2.4)) });
  // 엔코더·노브는 +X 방향으로 만든 뒤 dialAng 만큼 돌린다 (기판 가장자리 → 외장 구멍)
  const rWall = Math.sqrt(Math.max(0, g.R ** 2 - (g.dialZ - g.zc) ** 2)); // 바깥 벽 (다이얼 높이)
  const rEnc = Math.hypot(dl.x, dl.y);
  const turn = (shape) => shape.rotate(g.dialAng, [0, 0, 0], [0, 0, 1]);
  add({ id: 'encoder', name: '로터리 엔코더 (직각, 밝기)', material: '부품', color: COLORS.part, shape: turn(box(R, [rEnc, 0, g.dialZ], [7, 12.4, 12.4]).fuse(bar(R, 'x', [(rEnc + 3 + rWall - 2) / 2, 0, g.dialZ], 3, rWall - 2 - rEnc - 3))) });
  let knob = taper(R, 'circle', p.dial_d / 2, 0, 0, 0, 6, a);
  knob = knob.cut(taper(R, 'circle', 3.35, 0, 0, -0.5, 4.5, bd));
  add({ id: 'dial_knob', pull: [Math.cos((g.dialAng * Math.PI) / 180), Math.sin((g.dialAng * Math.PI) / 180), 0], name: '다이얼 노브 (오른쪽 뒤)', role: '돌리면 밝기, 누르면 켜기·끄기', material: matLabel(p.material), color: COLORS.knob, mold: true, shape: turn(knob.rotate(90, [0, 0, 0], [0, 1, 0]).translate([rWall - 1.5, 0, g.dialZ])) });

  if (lay.notes?.length) notes.push(...lay.notes.filter((x) => /넘|닿/.test(x)));
  return { parts, motion: null, overall: g.overall, look: { panel_proud: g.panelProud, lip: g.lip } };
}

const BUILDERS = { round_lamp: roundLamp, sphere_lamp: sphereLamp, box: boxCase, cylinder: cylinderCase, handheld: (R, p, notes) => boxCase(R, handheldAsBox(p), notes) };

/** 템플릿 + 치수 → 부품 솔리드. 치수는 범위 안으로 잘라서 쓴다 */
export function buildAssembly(R, template, rawParams) {
  const key = BUILDERS[template] ? template : 'box';
  const params = cleanParams(key, rawParams);
  const notes = [];
  const out = BUILDERS[key](R, params, notes);
  const skipped = notes.filter((n) => /모서리 R$/.test(n));
  const rest = notes.filter((n) => !/모서리 R$/.test(n));
  if (skipped.length) rest.push(`${skipped.join(', ')} 을 만들지 못해 빼고 그렸습니다 (R 을 줄이면 들어갈 수 있습니다).`);
  return { template: key, params, ...out, notes: rest };
}
