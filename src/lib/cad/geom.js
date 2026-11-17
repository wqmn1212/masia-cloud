// 금형용 솔리드를 만드는 기본 도형 (단위 mm, Z 위). replicad 모듈(R)을 받아서 쓴다.
// 이 파일은 replicad 를 직접 import 하지 않는다 → 화면 번들에 CAD 엔진이 끌려오지 않는다 (워커와 Node 검산에서만 R 을 넘긴다).
//
// 사출 부품은 빼기 방향(Z)과 평행한 면이 없어야 하므로, 모든 기둥은 구배(deg)를 준 로프트로 만든다.
// 껍데기는 OpenCascade shell 대신 "바깥 − 안쪽" 으로 만든다 (모서리 R 과 shell 을 같이 쓰면 자주 실패한다).

const DEG = Math.PI / 180;
export const tanD = (deg) => Math.tan(deg * DEG);

/** 실패해도 멈추지 않고 대신값을 돌려준다 (모서리 R 같은 마감 작업용). notes 에 무엇을 건너뛰었는지 남긴다 */
export function attempt(fn, fallback, notes, label) {
  try {
    const v = fn();
    if (v) return v;
  } catch { /* 아래에서 기록 */ }
  if (notes && label) notes.push(label);
  return fallback;
}

function section(R, kind, a, b, r, z) {
  if (kind === 'circle') return R.drawCircle(a).sketchOnPlane('XY', z);
  if (kind === 'ellipse') {
    if (Math.abs(a - b) < 1e-3) return R.drawCircle(a).sketchOnPlane('XY', z);
    // drawEllipse 는 큰 반지름이 X 축이어야 안정적이다 → 세로가 길면 돌린다
    if (a >= b) return R.drawEllipse(a, b).sketchOnPlane('XY', z);
    return R.drawEllipse(b, a).rotate(90, [0, 0]).sketchOnPlane('XY', z);
  }
  // 둥근 사각: a·b 는 전체 폭·깊이, r 은 모서리 R
  const rr = Math.max(0.2, Math.min(r, a / 2 - 0.05, b / 2 - 0.05));
  return R.drawRoundedRectangle(a, b, rr).sketchOnPlane('XY', z);
}

/**
 * z0 → z1 로 갈수록 한쪽(바깥 치수 기준) 이 deg 만큼 안으로 기우는 기둥.
 * kind: 'circle'(a = 반지름) | 'ellipse'(a, b = 반지름) | 'rrect'(a, b = 폭·깊이, r = 모서리 R)
 * deg > 0 이면 z1 쪽이 좁다. z1 < z0 이어도 된다 (그때도 z1 쪽이 좁다).
 */
export function taper(R, kind, a, b, r, z0, z1, deg) {
  const d = Math.abs(z1 - z0) * tanD(deg);
  const lo = Math.min(z0, z1), hi = Math.max(z0, z1);
  const narrowAtHi = z1 > z0;
  const k = kind === 'rrect' ? 2 : 1; // 둥근 사각은 폭·깊이가 양쪽으로 줄어든다
  if (kind === 'circle' || (kind === 'ellipse' && Math.abs(a - b) < 1e-3)) {
    // 원뿔대는 사다리꼴 단면을 Z 축으로 돌려 만든다 (해석 곡면이라 불리언이 빠르고 구배가 정확하다)
    const rn = Math.max(0.3, a - d);
    const rLo = narrowAtHi ? a : rn, rHi = narrowAtHi ? rn : a;
    return R.draw([0, lo]).lineTo([rLo, lo]).lineTo([rHi, hi]).lineTo([0, hi]).close().sketchOnPlane('XZ').revolve([0, 0, 1]);
  }
  const wide = section(R, kind, a, b, r, narrowAtHi ? lo : hi);
  const narrow = section(R, kind, Math.max(0.3, a - k * d), Math.max(0.3, (b ?? a) - k * d), Math.max(0.2, r - d), narrowAtHi ? hi : lo);
  return narrowAtHi ? wide.loftWith(narrow, { ruled: true }) : narrow.loftWith(wide, { ruled: true });
}

/** 원뿔대 기둥 (뿌리 지름 → 끝으로 갈수록 가늘어짐), 위치 (x, y) */
export function pin(R, x, y, zRoot, zTip, rRoot, deg) {
  return taper(R, 'circle', rRoot, rRoot, 0, zRoot, zTip, deg).translate([x, y, 0]);
}

/**
 * 나사 보스: 뿌리(zRoot)에서 끝(zTip)으로 가늘어지는 기둥 + 끝에서 파 들어간 구멍.
 * 구멍도 입구 쪽이 넓게 구배를 준다 (코어 핀이 빠지도록).
 */
export function boss(R, x, y, zRoot, zTip, od, hole, holeDepth, deg) {
  const body = pin(R, x, y, zRoot, zTip, od / 2, deg);
  if (!hole) return body;
  const dir = Math.sign(zRoot - zTip) || 1;
  const bottom = zTip + dir * Math.min(holeDepth, Math.abs(zRoot - zTip) - 0.6);
  // 구멍: 입구(zTip)가 넓고 안쪽(bottom)이 좁다
  const cut = taper(R, 'circle', hole / 2, hole / 2, 0, zTip - dir * 0.5, bottom, deg).translate([x, y, 0]);
  return body.cut(cut);
}

/**
 * 나사 통과 구멍 깎개: 바깥 면(zFace)에서 머리 자리(Ø5.4, 바깥이 넓다), 안쪽 보스 끝(zTip)에서 통과 구멍(Ø2.9, 끝이 넓다).
 * 두 구멍이 머리 자리 바닥에서 만나므로 어느 쪽에도 반대 구배가 생기지 않는다.
 */
export function screwThrough(R, x, y, zFace, zTip, wall, deg) {
  const dir = Math.sign(zTip - zFace) || 1;
  const zCb = zFace + dir * Math.max(0.6, wall - 0.6);
  const head = taper(R, 'circle', 2.7 + (wall + 0.5) * tanD(deg), 0, 0, zFace - dir * 0.5, zCb, deg);
  const len = Math.abs(zTip - zCb) + 0.6;
  const hole = taper(R, 'circle', 1.45 + len * tanD(deg), 0, 0, zTip + dir * 0.6, zCb - dir * 0.05, deg);
  return head.fuse(hole).translate([x, y, 0]);
}

/** 리브: 두께 t 의 판, 뿌리 → 끝으로 얇아진다. 시작·끝점 (x0,y0)-(x1,y1), 높이 zRoot→zTip */
export function rib(R, x0, y0, x1, y1, zRoot, zTip, t, deg) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const ang = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
  const plate = taper(R, 'rrect', len, t, 0, zRoot, zTip, deg);
  return plate.rotate(ang, [0, 0, 0], [0, 0, 1]).translate([(x0 + x1) / 2, (y0 + y1) / 2, 0]);
}

/** 축 방향 구멍을 내는 원통 (dir: 'x' | 'y' | 'z'), 중심 c, 길이 len */
export function bar(R, dir, c, radius, len) {
  const d = dir === 'x' ? [1, 0, 0] : dir === 'y' ? [0, 1, 0] : [0, 0, 1];
  const start = [c[0] - (d[0] * len) / 2, c[1] - (d[1] * len) / 2, c[2] - (d[2] * len) / 2];
  return R.makeCylinder(radius, len, start, d);
}

/** 상자 (중심·크기) */
export function box(R, c, s) {
  return R.makeBox([c[0] - s[0] / 2, c[1] - s[1] / 2, c[2] - s[2] / 2], [c[0] + s[0] / 2, c[1] + s[1] / 2, c[2] + s[2] / 2]);
}

/**
 * 아래(z0)로 트인 홈: 벽 구멍 대신 쓰면 슬라이드 없이 뺄 수 있다.
 * 폭 w 는 바닥에서 넓고 위로 갈수록 deg 만큼 좁아진다. axis: 벽을 뚫는 방향 ('x'|'y'), 중심 (cx, cy), 깊이 len
 */
export function notch(R, axis, cx, cy, z0, z1, w, len, deg) {
  const a = axis === 'x' ? len : w, b = axis === 'x' ? w : len;
  const d = Math.abs(z1 - z0) * tanD(deg); // z0 에서 넓고 z1 쪽으로 좁아진다 (위·아래 어느 쪽이든)
  const lo = R.drawRectangle(a, b).sketchOnPlane('XY', z0);
  const hi = R.drawRectangle(axis === 'x' ? a : Math.max(0.5, a - 2 * d), axis === 'x' ? Math.max(0.5, b - 2 * d) : b).sketchOnPlane('XY', z1);
  return lo.loftWith(hi, { ruled: true }).translate([cx, cy, 0]);
}

/** 판 구멍(빼기 방향과 평행): 바깥(zOut) 쪽이 넓다 */
export function slotZ(R, cx, cy, w, l, zIn, zOut, deg, r = 0.6) {
  return taper(R, 'rrect', w + 2 * Math.abs(zOut - zIn) * tanD(deg), l + 2 * Math.abs(zOut - zIn) * tanD(deg), r, zOut, zIn, deg).translate([cx, cy, 0]);
}

export function fuseAll(list) {
  let s = null;
  for (const x of list) if (x) s = s ? s.fuse(x) : x;
  return s;
}
