// 구형 셸 조명 (sphere_lamp) 치수 계산 — CAD 엔진 없이 쓰는 숫자만 (builders.js 의 솔리드와 pcbLayout.js 의 기판이 함께 쓴다)
//
// 형태: 지름 dia 의 구를 뒤로 누운 평면으로 자른 그릇(외장) + 그 안에 비스듬히 선 패브릭 발광판.
//  - 외장 테두리 면: 뒤로 (face_tilt + rim_open)° 누움, 중심에서 face_off 만큼 앞. 외장은 한 덩어리로 이 면의 법선(nR) 방향으로 뺀다.
//  - 패브릭 판 면: 뒤로 face_tilt° 누움, 중심에서 recess 만큼 뒤. 테두리 면보다 rim_open° 덜 누워서
//    위쪽은 패브릭 판이 테두리 위로 살짝 나오고, 아래쪽은 외장이 판 앞으로 두툼한 입술처럼 감싼다 (참고 사진의 모습).
// 바닥은 flat_d 지름만큼 평평하게 잘라 세운다.
//
// 좌표 (CAD): X 오른쪽, Y 뒤 (앞 = −Y), Z 위, 단위 mm. 바닥 중심이 원점.
// 로컬 좌표: 구 중심이 원점, +Z = 면 바깥(앞 위), +Y = 면 위쪽. 판 로컬(toWorld)과 테두리 로컬(toWorldR) 두 가지.
//   로컬 → CAD: X 축으로 (90 − 기울기)° 돌린 뒤 구 중심 높이 zc 만큼 올린다.
//
// 발광면 쌓임 (판 로컬 z, 앞 → 뒤): 패브릭 0.6 · 패브릭 프레임 2.5 · 공기 3 · 확산판 2 · 혼광 거리 mix · LED 판 1.6 · 방열판 2
// 아래쪽 띠(clock_h)는 도트 시계 자리: 어두운 패브릭, 프레임 칸막이로 위쪽 빛과 나눈다.

const DEG = Math.PI / 180;
const r2 = (v) => Math.round(v * 100) / 100;

export function sphereGeom(p) {
  const R = p.dia / 2, w = p.wall, Ri = R - w;
  const rf = Math.min(p.flat_d / 2, R * 0.7);
  const zc = Math.sqrt(R * R - rf * rf); // 구 중심 높이 (바닥이 평평하게 잘린 만큼 내려앉는다)
  const t = p.face_tilt, th = (90 - t) * DEG; // 판
  const tr = Math.min(80, t + (p.rim_open || 0)), thR = (90 - tr) * DEG; // 테두리
  const dA = (tr - t) * DEG; // 판 → 테두리 각도 차
  const off = p.face_off;
  const ro = Math.sqrt(Math.max(0, R * R - off * off)); // 테두리 면에서 바깥 구의 반지름
  // 발광면 쌓임 (판 로컬 z)
  const zFab = -p.recess, zFabB = zFab - 0.6, zFrB = zFabB - 2.5, zDif = zFrB - 3, zDifB = zDif - 2;
  const zLed = zDifB - p.mix, zLedB = zLed - 1.6, zSpB = zLedB - 2;
  const innerAt = (z) => Math.sqrt(Math.max(0, Ri * Ri - z * z)); // 판 로컬 z 에서 안쪽 구 반지름
  const rp = Math.min(innerAt(zFab), innerAt(zFrB)) - 1.2; // 패브릭 판 반지름 (안쪽 벽에서 1.2 mm)
  const win = rp - 6; // 프레임 창 반지름 (테두리 6 mm 에 패브릭을 감아 붙인다)
  const yb = -(win - p.clock_h); // 시계 띠 윗선 (판 로컬 y)
  const rLed = Math.min(win + 1, innerAt(zSpB) - 2.5);

  // 판 로컬 → CAD, 테두리 로컬 → CAD
  const rotX = (a) => ([x, y, z]) => [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a) + zc];
  const toWorld = rotX(th), toWorldR = rotX(thR);
  const n = [0, -Math.sin(th), Math.cos(th)], nR = [0, -Math.sin(thR), Math.cos(thR)];
  // 테두리 로컬 (x, y, z) → 판 로컬: X 축으로 −dA
  const rimToPanel = ([x, y, z]) => [x, y * Math.cos(dA) + z * Math.sin(dA), -y * Math.sin(dA) + z * Math.cos(dA)];

  // 방열판 고정 보스: 외장 빼기 방향(테두리 로컬 z)과 평행하게 안쪽 벽에서 솟아, 끝은 방열판 뒷면(판 로컬 z = zSpB)에 맞춰 비스듬히
  const rbBoss = Math.min(rLed - 8, win - 6);
  const bosses = [];
  for (const a of [40, 140, 200, 340]) { // 위 2곳 + 시계 띠 위 2곳
    const x = rbBoss * Math.cos(a * DEG), yR = rbBoss * Math.sin(a * DEG);
    const zTip = (zSpB + yR * Math.sin(dA)) / Math.cos(dA); // 테두리 로컬 z 에서 방열판 뒷면과 만나는 곳
    const [, yP] = rimToPanel([x, yR, zTip]);
    const zWall = -Math.sqrt(Math.max(0, Ri * Ri - x * x - yR * yR));
    if (yP > yb + 6 && zTip - zWall > 4) bosses.push({ x, y: yR, zTip, zWall, panel: [x, yP] });
  }
  // 확산판 뒤 기둥 3곳 (0°, 90°, 180°): LED 판을 뒤에서 나사로 고정. 패브릭 프레임은 확산판 가장자리에 걸림 3곳으로 끼운다
  const posts = [0, 90, 180].map((a) => ({ x: (win - 4) * Math.cos(a * DEG), y: (win - 4) * Math.sin(a * DEG) }));
  const clipR = win + 2 + 1.6; // 확산판 가장자리(win + 2) 바깥
  const clips = [15, 90, 165].map((a) => ({ a, x: clipR * Math.cos(a * DEG), y: clipR * Math.sin(a * DEG) }));
  // 시계 모듈 (도트 LED, 띠 가운데)
  const bandMid = (yb + -win) / 2;
  const clock = { w: Math.min(72, 2 * Math.sqrt(Math.max(0, win * win - (yb - 2) ** 2)) - 10), h: Math.max(8, Math.min(16, p.clock_h - 8)), d: 6, y: bandMid + 1.5, z: zFrB - 3 };

  // 바닥: 무게판(접착) 위에 제어 기판을 스탠드오프 3개로
  const plateT = p.plate_t;
  const pcbZ = w + plateT + 6, pcbTop = pcbZ + 1.6;
  const innerR = (zw) => Math.sqrt(Math.max(0, Ri * Ri - (zc - zw) ** 2)); // CAD 높이 zw 에서 안쪽 구 반지름
  const pcbR = Math.min(p.pcb_r, innerR(pcbZ) - 0.8);
  const plateR = innerR(w + 0.05) - 1; // 바닥 안쪽 면이 오목해 무게판 아래 끝 기준
  // 기판 앞 끝: 발광면 쌓임(시계 모듈 뒤 끝) 뒤로 1 mm. 판 로컬 z = −y·sin + (z − zc)·cos
  const faceBack = Math.min(clock.z - clock.d / 2, zFrB) - 1;
  const yCut = ((pcbTop - zc) * Math.cos(th) - faceBack) / Math.sin(th);
  // 무게판 앞 끝: 패브릭 프레임 뒤로 1 mm (무게판 윗면 높이 기준)
  const plateCut = ((w + plateT - zc) * Math.cos(th) - (zFrB - 1)) / Math.sin(th);
  const mountR = Math.min(plateR - 5, pcbR - 5);
  const dialAng = 35; // 오른쪽에서 뒤로 35° (발광면 아래 끝을 피한다)
  // 뒤쪽 버튼·잭, 오른쪽 다이얼 높이 (기판 위)
  const swZ = pcbTop + 3.2, jackZ = pcbTop + 5.5, dialZ = pcbTop + 7;
  const wallYAt = (x, z) => Math.sqrt(Math.max(0, R * R - x * x - (z - zc) ** 2)); // 바깥 벽 (뒤 +Y)
  // 크기: 위 끝 = 테두리 위 끝과 판 위 끝 중 높은 쪽, 앞 끝 = 테두리 아래 앞 끝과 판 아래 끝 중 앞쪽
  const rimTop = toWorldR([0, ro, off]), panTop = toWorld([0, rp, zFab]);
  const rimLow = toWorldR([0, -ro, off]), panLow = toWorld([0, -rp, zFab]);
  const front = Math.max(-rimLow[1], -panLow[1], -rimTop[1], -panTop[1]);
  return {
    R, Ri, w, rf, zc, t, th, tr, thR, dA, off, ro, n, nR, toWorld, toWorldR, rimToPanel,
    zFab, zFabB, zFrB, zDif, zDifB, zLed, zLedB, zSpB, rp, win, yb, rLed, rbBoss, bosses, posts, clips, clipR, clock,
    plateT, pcbZ: r2(pcbZ), pcbTop: r2(pcbTop), pcbR: r2(pcbR), plateR, plateCut: r2(plateCut), yCut: r2(yCut), mountR, dialAng, faceBack, swZ, jackZ, dialZ, innerR, wallYAt,
    // 판이 테두리 위로 나온 높이(위), 외장 입술이 판 앞으로 나온 깊이(아래)
    panelProud: r2(panTop[2] - rimTop[2]), lip: r2(panLow[1] - rimLow[1]),
    front: r2(front),
    overall: { x: p.dia, y: r2(R + front), z: r2(Math.max(rimTop[2], panTop[2])) },
  };
}
