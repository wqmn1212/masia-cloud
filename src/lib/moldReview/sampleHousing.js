// 체험·자체 시험용 사출 하우징 (단위 mm, 75 × 46 × 22)
// 일부러 넣은 문제: 구배 0° 벽(Y 쪽), 두꺼운 리브(2.4mm), 얇은 리브(1.0mm), 보스(코어 핀), 윗면 관통 구멍,
// 측면 창(언더컷), 얇은 플랜지(0.8mm). X 쪽 벽은 구배 1.5°, 기본 살 두께 2.0mm.
// SDF 를 surface nets 로 메시로 바꾼다.

const TAN1 = Math.tan(Math.PI / 180);
const H = 22, WALL = 2;
const hxo = (z) => 35 - Math.max(0, Math.min(H, z)) * 1.5 * TAN1; // X 벽 구배 1.5°
const hyo = () => 23; // Y 벽 구배 0°

function rect(px, py, hx, hy, r) {
  const qx = Math.abs(px) - (hx - r), qy = Math.abs(py) - (hy - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
function box(px, py, pz, cx, cy, cz, hx, hy, hz) {
  const qx = Math.abs(px - cx) - hx, qy = Math.abs(py - cy) - hy, qz = Math.abs(pz - cz) - hz;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0);
}
function cyl(px, py, pz, cx, cy, r, z0, z1) {
  const d = Math.hypot(px - cx, py - cy) - r;
  const dz = Math.max(z0 - pz, pz - z1);
  return Math.hypot(Math.max(d, 0), Math.max(dz, 0)) + Math.min(Math.max(d, dz), 0);
}
const union = Math.min, inter = Math.max, minus = (a, b) => Math.max(a, -b);

function sdf(x, y, z) {
  const rt = 2; // 윗 모서리 R2
  const dxy = rect(x, y, hxo(z), hyo(z), 4);
  const qa = dxy + rt, qb = z - H + rt;
  let outer = Math.hypot(Math.max(qa, 0), Math.max(qb, 0)) + Math.min(Math.max(qa, qb), 0) - rt;
  outer = inter(outer, -z);
  const inner = inter(rect(x, y, hxo(z) - WALL, hyo(z) - WALL, 2), z - (H - WALL), -z - 2);
  let part = minus(outer, inner);
  const rib1hw = 1.2 - (H - WALL - z) * TAN1; // 두꺼운 리브 2.4mm, 구배 1°
  const rib1 = inter(Math.abs(y - 9) - rib1hw, Math.abs(x) - 26, z - (H - WALL + 0.5), 8 - z);
  const rib2hw = 0.5 - (H - WALL - z) * 0.5 * TAN1; // 얇은 리브 1.0mm
  const rib2 = inter(Math.abs(x - 6) - rib2hw, Math.abs(y) - 15, z - (H - WALL + 0.5), 10 - z);
  const bossR = 4 - (H - WALL - z) * TAN1;
  const boss = minus(cyl(x, y, z, -22, -8, bossR, 6, H - WALL + 0.5), cyl(x, y, z, -22, -8, 1.5, 0, 18.5));
  part = union(part, inter(union(rib1, rib2, boss), outer));
  part = union(part, box(x, y, z, 37.5, 0, 0.4, 3.2, 12, 0.4)); // 얇은 플랜지 0.8mm
  part = minus(part, cyl(x, y, z, 18, 0, 3, -5, 30)); // 윗면 관통 구멍 R3
  part = minus(part, box(x, y, z, 0, 23, 10, 7, 4, 3)); // 측면 창 → 언더컷
  return part;
}

/** @returns {{ positions: Float32Array, indices: Uint32Array, name: string }} */
export function makeSampleHousing(h = 0.5) {
  const x0 = -42, y0 = -28, z0 = -2;
  const nx = Math.ceil(84 / h), ny = Math.ceil(56 / h), nz = Math.ceil(27 / h);
  const sx = nx + 1, sy = ny + 1, sz = nz + 1;
  const field = new Float32Array(sx * sy * sz);
  const id = (i, j, k) => i + sx * (j + sy * k);
  for (let k = 0; k < sz; k++) for (let j = 0; j < sy; j++) for (let i = 0; i < sx; i++) field[id(i, j, k)] = sdf(x0 + i * h, y0 + j * h, z0 + k * h);
  const cellV = new Int32Array(nx * ny * nz).fill(-1);
  const cid = (i, j, k) => i + nx * (j + ny * k);
  const pos = [];
  const EDGES = [[0, 0, 0, 1, 0, 0], [0, 1, 0, 1, 1, 0], [0, 0, 1, 1, 0, 1], [0, 1, 1, 1, 1, 1], [0, 0, 0, 0, 1, 0], [1, 0, 0, 1, 1, 0], [0, 0, 1, 0, 1, 1], [1, 0, 1, 1, 1, 1], [0, 0, 0, 0, 0, 1], [1, 0, 0, 1, 0, 1], [0, 1, 0, 0, 1, 1], [1, 1, 0, 1, 1, 1]];
  const grad = (x, y, z) => {
    const e = 0.01;
    const gx = sdf(x + e, y, z) - sdf(x - e, y, z), gy = sdf(x, y + e, z) - sdf(x, y - e, z), gz = sdf(x, y, z + e) - sdf(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1;
    return [gx / l, gy / l, gz / l];
  };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let ax = 0, ay = 0, az = 0, c = 0;
    for (const [a, b, cc, d, e2, f] of EDGES) {
      const fa = field[id(i + a, j + b, k + cc)], fb = field[id(i + d, j + e2, k + f)];
      if ((fa < 0) !== (fb < 0)) {
        const t = fa / (fa - fb);
        ax += a + (d - a) * t;
        ay += b + (e2 - b) * t;
        az += cc + (f - cc) * t;
        c++;
      }
    }
    if (!c) continue;
    let px = x0 + (i + ax / c) * h, py = y0 + (j + ay / c) * h, pz = z0 + (k + az / c) * h;
    for (let it = 0; it < 3; it++) {
      const d = sdf(px, py, pz);
      const g = grad(px, py, pz);
      px -= d * g[0];
      py -= d * g[1];
      pz -= d * g[2];
    }
    cellV[cid(i, j, k)] = pos.length / 3;
    pos.push(px, py, pz);
  }
  const tris = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) tris.push(a, c, b, a, d, c);
    else tris.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz; k++) for (let j = 1; j < ny; j++) for (let i = 0; i < nx; i++) {
    const fa = field[id(i, j, k)], fb = field[id(i + 1, j, k)];
    if ((fa < 0) !== (fb < 0)) quad(cellV[cid(i, j - 1, k - 1)], cellV[cid(i, j, k - 1)], cellV[cid(i, j, k)], cellV[cid(i, j - 1, k)], !(fa < 0));
  }
  for (let k = 1; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 1; i < nx; i++) {
    const fa = field[id(i, j, k)], fb = field[id(i, j + 1, k)];
    if ((fa < 0) !== (fb < 0)) quad(cellV[cid(i - 1, j, k - 1)], cellV[cid(i - 1, j, k)], cellV[cid(i, j, k)], cellV[cid(i, j, k - 1)], !(fa < 0));
  }
  for (let k = 0; k < nz; k++) for (let j = 1; j < ny; j++) for (let i = 1; i < nx; i++) {
    const fa = field[id(i, j, k)], fb = field[id(i, j, k + 1)];
    if ((fa < 0) !== (fb < 0)) quad(cellV[cid(i - 1, j - 1, k)], cellV[cid(i, j - 1, k)], cellV[cid(i, j, k)], cellV[cid(i - 1, j, k)], !(fa < 0));
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(tris), name: '샘플 하우징 (75 × 46 × 22mm)' };
}
