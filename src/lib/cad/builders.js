// 템플릿 치수 → 부품별 솔리드 (단위 mm, Z 위, 앞 = −Y). replicad 모듈(R)을 받아서 쓴다.
// 결과: { parts: [{ id, name, role, material, color, mold, group, shape }], motion, notes }
//  - mold: 사출 부품이면 true (금형 점검 대상)
//  - group: 'body' 는 회전하는 묶음 (motion 으로 돌려 보며 간섭을 본다)
import { taper, pin, boss, rib, bar, box, notch, slotZ, screwThrough, attempt, tanD } from './geom.js';
import { cleanParams, MATERIALS } from './catalog.js';

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
  const pcbZ = plateT + 1, pcbTop = pcbZ + 1.6;
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
  // 기판: 안쪽 타원에 들어가는 정사각 (보스와 2 mm 띄움)
  const fit = Math.sqrt(0.85 / (1 / (rxi - 1) ** 2 + 1 / (ryi - 1) ** 2));
  const pcbHalf = Math.min(fit, sideX - 3 - 2, rearY - 3 - 2);
  add({ id: 'pcb', name: '제어 기판 (ESP32-C3)', material: 'FR-4 1.6T', color: COLORS.pcb, shape: box(R, [0, 0, pcbZ + 0.8], [2 * pcbHalf, 2 * pcbHalf, 1.6]) });
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
  if (ribH >= 1.5 && D / 4 > p.button_d / 2 + 2) {
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
    add({ id: 'battery', name: '배터리 (리튬 폴리머)', material: '부품', color: '#6E7B8B', shape: box(R, [0, 0, bz0 + p.battery / 2], [Math.min(50, p.pcb_w - 10), Math.min(34, p.pcb_d - 6), p.battery]) });
  }
  add({ id: 'pcb', name: '메인 기판', material: 'FR-4 1.6T', color: COLORS.pcb, shape: box(R, [0, 0, pcbZ + 0.8], [p.pcb_w, p.pcb_d, 1.6]) });
  const n = p.buttons;
  const pitch = p.button_d + 8;
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * pitch;
    if (Math.abs(x) + p.button_d / 2 > W / 2 - dw - 4) { notes.push(`버튼 ${n}개가 윗면에 다 들어가지 않습니다.`); break; }
    upper = upper.cut(slotZ(R, x, 0, p.button_d, p.button_d, H - w - 0.5, H + 0.5, a, p.button_d / 2 - 0.01));
    const capR = p.button_d / 2 - 0.3;
    const cap = R.makeCylinder(capR, w + 1.2, [x, 0, H - w - 0.2]).fuse(R.makeCylinder(capR + 1.2, 1, [x, 0, H - w - 1.05])).fuse(R.makeCylinder(2, H - w - 1.05 - (pcbTop + 5) + 0.2, [x, 0, pcbTop + 5]));
    add({ id: `button_${i + 1}`, name: `버튼 ${i + 1}`, material: matLabel(p.material), color: COLORS.knob, shape: cap });
    add({ id: `tact_${i + 1}`, name: `택트 스위치 ${i + 1}`, material: '부품', color: COLORS.part, shape: box(R, [x, 0, pcbTop + 2.5], [6, 6, 5]) });
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

const BUILDERS = { round_lamp: roundLamp, box: boxCase, cylinder: cylinderCase };

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
