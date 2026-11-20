// PCB 아트웍 기하 계산 (단위 mm, KiCad 좌표: x 오른쪽, y 아래). 화면·검산이 같이 쓴다.
// 동박 모양은 두 가지 기본 도형으로 나타낸다:
//   cap  = 선분 a–b 를 반지름 r 로 두껍게 한 모양 (트랙, 둥근 패드, 비아는 a=b 인 원)
//   poly = 다각형 (사각 패드, 동박면 채움)

export const EPS = 1e-9;
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
export const len = (a) => Math.hypot(a[0], a[1]);
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const clamp01 = (t) => Math.max(0, Math.min(1, t));

/** KiCad 회전: 화면에서 반시계 방향 deg (y 가 아래이므로 x' = x cos + y sin, y' = −x sin + y cos) */
export function rot(p, deg) {
  const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  return [p[0] * c + p[1] * s, -p[0] * s + p[1] * c];
}

/** 점과 선분 사이 거리 */
export function pointSeg(p, a, b) {
  const ab = sub(b, a), l2 = dot(ab, ab);
  if (l2 < EPS) return dist(p, a);
  const t = clamp01(dot(sub(p, a), ab) / l2);
  return dist(p, [a[0] + ab[0] * t, a[1] + ab[1] * t]);
}
/** 선분 위에서 점에 가장 가까운 점 */
export function closestOnSeg(p, a, b) {
  const ab = sub(b, a), l2 = dot(ab, ab);
  if (l2 < EPS) return a;
  const t = clamp01(dot(sub(p, a), ab) / l2);
  return [a[0] + ab[0] * t, a[1] + ab[1] * t];
}
const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
function segsCross(a, b, c, d) {
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
/** 두 선분 사이 거리 (교차하면 0) */
export function segSeg(a, b, c, d) {
  if (segsCross(a, b, c, d)) return 0;
  return Math.min(pointSeg(a, c, d), pointSeg(b, c, d), pointSeg(c, a, b), pointSeg(d, a, b));
}
/** 다각형 안의 점 (짝홀 규칙) */
export function inPoly(p, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi + 1e-30) + xi) inside = !inside;
  }
  return inside;
}
export function polyArea(pts) {
  let s = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) s += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  return Math.abs(s) / 2;
}
const edges = (pts) => pts.map((p, i) => [p, pts[(i + 1) % pts.length]]);

/** 두 도형 사이 빈 거리 (겹치면 0 이하) */
export function gap(A, B) {
  if (A.kind === 'cap' && B.kind === 'cap') return segSeg(A.a, A.b, B.a, B.b) - A.r - B.r;
  if (A.kind === 'poly' && B.kind === 'cap') return gap(B, A);
  if (A.kind === 'cap' && B.kind === 'poly') {
    if (inPoly(A.a, B.pts) || inPoly(A.b, B.pts)) return -A.r;
    let m = Infinity;
    for (const [p, q] of edges(B.pts)) m = Math.min(m, segSeg(A.a, A.b, p, q));
    return m - A.r;
  }
  if (inPoly(A.pts[0], B.pts) || inPoly(B.pts[0], A.pts)) return 0;
  let m = Infinity;
  for (const [p, q] of edges(A.pts)) for (const [r, s] of edges(B.pts)) m = Math.min(m, segSeg(p, q, r, s));
  return m;
}

/** 도형 경계 상자 [x0, y0, x1, y1] */
export function bbox(S) {
  if (S.kind === 'cap') return [Math.min(S.a[0], S.b[0]) - S.r, Math.min(S.a[1], S.b[1]) - S.r, Math.max(S.a[0], S.b[0]) + S.r, Math.max(S.a[1], S.b[1]) + S.r];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of S.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0, y0, x1, y1];
}
export const boxesNear = (a, b, m = 0) => a[0] - m <= b[2] && b[0] - m <= a[2] && a[1] - m <= b[3] && b[1] - m <= a[3];

/** 세 점을 지나는 원호 → 꺾은선 (KiCad arc: start·mid·end) */
export function arcPoints(s, m, e, segs = 12) {
  const ax = s[0], ay = s[1], bx = m[0], by = m[1], cx = e[0], cy = e[1];
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < EPS) return [s, e];
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
  const r = Math.hypot(ax - ux, ay - uy);
  const a0 = Math.atan2(ay - uy, ax - ux), am = Math.atan2(by - uy, bx - ux), a1 = Math.atan2(cy - uy, cx - ux);
  // 시작 → 중간 → 끝 방향으로 도는 쪽을 고른다
  const norm = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const ccw = norm(am - a0) < norm(a1 - a0);
  const sweep = ccw ? norm(a1 - a0) : -norm(a0 - a1);
  return Array.from({ length: segs + 1 }, (_, i) => { const a = a0 + (sweep * i) / segs; return [ux + r * Math.cos(a), uy + r * Math.sin(a)]; });
}

/** 원 → 다각형 */
export const circlePoly = (c, r, n = 24) => Array.from({ length: n }, (_, i) => [c[0] + r * Math.cos((2 * Math.PI * i) / n), c[1] + r * Math.sin((2 * Math.PI * i) / n)]);

/** 끊어진 선분들을 닫힌 고리로 잇는다 (기판 외곽) */
export function chainLoops(segs, tol = 0.01) {
  const left = segs.map((s) => [s[0], s[s.length - 1], s]);
  const loops = [];
  while (left.length) {
    const [, , first] = left.shift();
    const pts = [...first];
    let grown = true;
    while (grown) {
      grown = false;
      const end = pts[pts.length - 1];
      for (let i = 0; i < left.length; i++) {
        const [a, b, s] = left[i];
        if (dist(a, end) < tol) { pts.push(...s.slice(1)); left.splice(i, 1); grown = true; break; }
        if (dist(b, end) < tol) { pts.push(...[...s].reverse().slice(1)); left.splice(i, 1); grown = true; break; }
      }
    }
    if (pts.length > 2 && dist(pts[0], pts[pts.length - 1]) < tol) pts.pop();
    loops.push(pts);
  }
  return loops;
}
