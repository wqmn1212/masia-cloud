// 금형 사전 검토 엔진 — 메시 기하 도구 (단위 mm)
// 정점 병합 · 긴 간선 분할 · 면 방향 통일 · BVH · 광선 교차 · 최근접점 · 최단 거리
// DOM·three.js 를 쓰지 않으므로 웹 워커와 Node 양쪽에서 돌아간다.

/**
 * 같은 위치의 정점을 합치고 퇴화 삼각형을 버린다.
 * STEP 변환 결과는 면마다 정점을 따로 주므로 이 단계가 없으면 면 사이 연결이 끊긴다.
 */
export function weldVertices(positions, indices) {
  const count = positions.length / 3;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  const diag = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) || 1;
  const q = diag * 2e-6;
  const map = new Map();
  const remap = new Uint32Array(count);
  const V = [];
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    const key = `${Math.round(x / q)},${Math.round(y / q)},${Math.round(z / q)}`;
    let v = map.get(key);
    if (v === undefined) {
      v = V.length / 3;
      map.set(key, v);
      V.push(x, y, z);
    }
    remap[i] = v;
  }
  const src = indices && indices.length ? indices : null;
  const triCount = src ? src.length / 3 : count / 3;
  const F = [];
  for (let t = 0; t < triCount; t++) {
    const a = remap[src ? src[t * 3] : t * 3];
    const b = remap[src ? src[t * 3 + 1] : t * 3 + 1];
    const c = remap[src ? src[t * 3 + 2] : t * 3 + 2];
    if (a !== b && b !== c && a !== c) F.push(a, b, c);
  }
  return {
    V: new Float64Array(V),
    F: new Uint32Array(F),
    diag,
    bbox: [minX, minY, minZ, maxX, maxY, maxZ],
  };
}

/**
 * maxEdge 보다 긴 간선을 반으로 나눈다. 같은 간선은 양쪽 삼각형이 같은 중점을 써서 틈이 생기지 않는다.
 * STEP 메시는 평면에 길쭉한 삼각형이 많아 면 단위 판정(언더컷·두께)이 거칠어지는 것을 막는다.
 */
export function refineLongEdges(Vin, Fin, maxEdge, maxTris) {
  const V = Array.from(Vin);
  let F = Array.from(Fin);
  const limit2 = maxEdge * maxEdge;
  for (let pass = 0; pass < 12; pass++) {
    const nv = V.length / 3;
    const mid = new Map();
    let marked = 0;
    const len2 = (a, b) => (V[a * 3] - V[b * 3]) ** 2 + (V[a * 3 + 1] - V[b * 3 + 1]) ** 2 + (V[a * 3 + 2] - V[b * 3 + 2]) ** 2;
    for (let t = 0; t < F.length; t += 3) {
      for (let k = 0; k < 3; k++) {
        const a = F[t + k], b = F[t + ((k + 1) % 3)];
        const key = a < b ? a * nv + b : b * nv + a;
        if (!mid.has(key) && len2(a, b) > limit2) {
          mid.set(key, -1);
          marked++;
        }
      }
    }
    if (!marked || F.length / 3 + marked * 2 > maxTris) break;
    const midpoint = (a, b) => {
      const key = a < b ? a * nv + b : b * nv + a;
      let v = mid.get(key);
      if (v === undefined) return -1;
      if (v < 0) {
        v = V.length / 3;
        V.push((V[a * 3] + V[b * 3]) / 2, (V[a * 3 + 1] + V[b * 3 + 1]) / 2, (V[a * 3 + 2] + V[b * 3 + 2]) / 2);
        mid.set(key, v);
      }
      return v;
    };
    const NF = [];
    for (let t = 0; t < F.length; t += 3) {
      const a = F[t], b = F[t + 1], c = F[t + 2];
      const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
      const cnt = (ab >= 0) + (bc >= 0) + (ca >= 0);
      if (cnt === 0) NF.push(a, b, c);
      else if (cnt === 3) NF.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
      else if (cnt === 1) {
        if (ab >= 0) NF.push(a, ab, c, ab, b, c);
        else if (bc >= 0) NF.push(a, b, bc, a, bc, c);
        else NF.push(a, b, ca, ca, b, c);
      } else if (ab < 0) NF.push(a, b, bc, a, bc, ca, ca, bc, c);
      else if (bc < 0) NF.push(a, ab, ca, ab, b, c, ab, c, ca);
      else NF.push(a, ab, c, ab, bc, c, ab, b, bc);
    }
    F = NF;
  }
  return { V: new Float64Array(V), F: new Uint32Array(F) };
}

/** 삼각형별 단위 법선·면적·무게중심 */
export function computeFaceData(V, F) {
  const nt = F.length / 3;
  const N = new Float64Array(nt * 3), A = new Float64Array(nt), C = new Float64Array(nt * 3);
  for (let t = 0; t < nt; t++) {
    const a = F[t * 3] * 3, b = F[t * 3 + 1] * 3, c = F[t * 3 + 2] * 3;
    const e1x = V[b] - V[a], e1y = V[b + 1] - V[a + 1], e1z = V[b + 2] - V[a + 2];
    const e2x = V[c] - V[a], e2y = V[c + 1] - V[a + 1], e2z = V[c + 2] - V[a + 2];
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    const l = Math.hypot(nx, ny, nz) || 1e-12;
    A[t] = l / 2;
    N[t * 3] = nx / l;
    N[t * 3 + 1] = ny / l;
    N[t * 3 + 2] = nz / l;
    C[t * 3] = (V[a] + V[b] + V[c]) / 3;
    C[t * 3 + 1] = (V[a + 1] + V[b + 1] + V[c + 1]) / 3;
    C[t * 3 + 2] = (V[a + 2] + V[b + 2] + V[c + 2]) / 3;
  }
  return { N, A, C };
}

/** 원점 기준 부호 있는 부피 (법선이 바깥을 향하면 양수) */
export function signedVolume(V, F, tris) {
  let vol = 0;
  const list = tris || null;
  const n = list ? list.length : F.length / 3;
  for (let i = 0; i < n; i++) {
    const t = list ? list[i] : i;
    const a = F[t * 3] * 3, b = F[t * 3 + 1] * 3, c = F[t * 3 + 2] * 3;
    vol += (V[a] * (V[b + 1] * V[c + 2] - V[b + 2] * V[c + 1])
      - V[a + 1] * (V[b] * V[c + 2] - V[b + 2] * V[c])
      + V[a + 2] * (V[b] * V[c + 1] - V[b + 1] * V[c])) / 6;
  }
  return vol;
}

/**
 * 간선 인접 관계.
 *  triNb[t*3+k]    간선 (F[t*3+k], F[t*3+(k+1)%3]) 건너편 삼각형 (없으면 -1)
 *  slotEdge[t*3+k] 그 간선의 번호
 *  edges           [a, b, t1, t2] 반복 (a < b, t2 = -1 이면 경계 간선)
 * 세 개 이상의 삼각형이 공유하는 비다양체 간선은 처음 두 개만 잇는다.
 */
export function buildTopology(F, nv) {
  const nt = F.length / 3;
  const map = new Map();
  const triNb = new Int32Array(nt * 3).fill(-1);
  const slotEdge = new Int32Array(nt * 3);
  const edges = [];
  for (let t = 0; t < nt; t++) {
    for (let k = 0; k < 3; k++) {
      const a = F[t * 3 + k], b = F[t * 3 + ((k + 1) % 3)];
      const key = a < b ? a * nv + b : b * nv + a;
      const e = map.get(key);
      if (e === undefined) {
        map.set(key, edges.length);
        slotEdge[t * 3 + k] = edges.length / 4;
        edges.push(a < b ? a : b, a < b ? b : a, t * 3 + k, -1);
      } else {
        slotEdge[t * 3 + k] = e / 4;
        if (edges[e + 3] === -1) {
          const slot = edges[e + 2];
          edges[e + 3] = t * 3 + k;
          triNb[t * 3 + k] = Math.floor(slot / 3);
          triNb[slot] = t;
        }
      }
    }
  }
  // 슬롯 → 삼각형 번호
  const E = new Int32Array(edges);
  for (let i = 0; i < E.length; i += 4) {
    E[i + 2] = Math.floor(E[i + 2] / 3);
    if (E[i + 3] >= 0) E[i + 3] = Math.floor(E[i + 3] / 3);
  }
  return { triNb, slotEdge, edges: E };
}

/** 삼각형 감김을 뒤집는다. 슬롯 순서가 바뀌므로 인접 정보도 함께 바꾼다 */
export function flipTriangle(F, triNb, slotEdge, t) {
  const tmp = F[t * 3 + 1];
  F[t * 3 + 1] = F[t * 3 + 2];
  F[t * 3 + 2] = tmp;
  // (a,b,c) → (a,c,b): 새 간선 0 = 옛 간선 2, 새 간선 2 = 옛 간선 0
  const n0 = triNb[t * 3];
  triNb[t * 3] = triNb[t * 3 + 2];
  triNb[t * 3 + 2] = n0;
  const e0 = slotEdge[t * 3];
  slotEdge[t * 3] = slotEdge[t * 3 + 2];
  slotEdge[t * 3 + 2] = e0;
}

/**
 * 연결 성분마다 삼각형 감김 방향을 통일한다 (STL 처럼 방향이 섞인 파일 대비).
 * 방향을 뒤집은 삼각형이 있으면 flippedAny = true.
 */
export function unifyWinding(F, triNb, slotEdge) {
  const nt = F.length / 3;
  const seen = new Uint8Array(nt);
  const comp = new Int32Array(nt).fill(-1);
  const components = [];
  let flippedAny = false;
  const hasDirectedEdge = (t, a, b) => {
    for (let k = 0; k < 3; k++) if (F[t * 3 + k] === a && F[t * 3 + ((k + 1) % 3)] === b) return true;
    return false;
  };
  for (let s = 0; s < nt; s++) {
    if (seen[s]) continue;
    const id = components.length;
    const list = [s];
    seen[s] = 1;
    comp[s] = id;
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      for (let k = 0; k < 3; k++) {
        const u = triNb[t * 3 + k];
        if (u < 0 || seen[u]) continue;
        const a = F[t * 3 + k], b = F[t * 3 + ((k + 1) % 3)];
        // 이웃이 같은 방향의 간선을 가지면 감김이 반대 → 이웃을 뒤집는다
        if (hasDirectedEdge(u, a, b)) {
          flipTriangle(F, triNb, slotEdge, u);
          flippedAny = true;
        }
        seen[u] = 1;
        comp[u] = id;
        list.push(u);
      }
    }
    components.push(list);
  }
  return { flippedAny, comp, components };
}

// ---------- BVH ----------

/** 삼각형 BVH (중심점 기준 중간값 분할, 잎당 4개 이하) */
export function buildBvh(V, F) {
  const nt = F.length / 3;
  const tb = new Float32Array(nt * 6), tc = new Float32Array(nt * 3);
  for (let t = 0; t < nt; t++) {
    let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
    for (let k = 0; k < 3; k++) {
      const v = F[t * 3 + k] * 3, x = V[v], y = V[v + 1], z = V[v + 2];
      if (x < mnx) mnx = x;
      if (y < mny) mny = y;
      if (z < mnz) mnz = z;
      if (x > mxx) mxx = x;
      if (y > mxy) mxy = y;
      if (z > mxz) mxz = z;
    }
    tb[t * 6] = mnx; tb[t * 6 + 1] = mny; tb[t * 6 + 2] = mnz;
    tb[t * 6 + 3] = mxx; tb[t * 6 + 4] = mxy; tb[t * 6 + 5] = mxz;
    tc[t * 3] = (mnx + mxx) / 2; tc[t * 3 + 1] = (mny + mxy) / 2; tc[t * 3 + 2] = (mnz + mxz) / 2;
  }
  const order = new Uint32Array(nt);
  for (let i = 0; i < nt; i++) order[i] = i;
  const maxNodes = Math.max(1, nt * 2);
  const nb = new Float32Array(maxNodes * 6);
  const left = new Int32Array(maxNodes), right = new Int32Array(maxNodes);
  const start = new Int32Array(maxNodes), cnt = new Int32Array(maxNodes);
  let count = 1;
  const stack = [[0, nt, 0]];
  while (stack.length) {
    const [s, e, n] = stack.pop();
    let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
    let cmnx = Infinity, cmny = Infinity, cmnz = Infinity, cmxx = -Infinity, cmxy = -Infinity, cmxz = -Infinity;
    for (let i = s; i < e; i++) {
      const t = order[i], o = t * 6;
      if (tb[o] < mnx) mnx = tb[o];
      if (tb[o + 1] < mny) mny = tb[o + 1];
      if (tb[o + 2] < mnz) mnz = tb[o + 2];
      if (tb[o + 3] > mxx) mxx = tb[o + 3];
      if (tb[o + 4] > mxy) mxy = tb[o + 4];
      if (tb[o + 5] > mxz) mxz = tb[o + 5];
      const cx = tc[t * 3], cy = tc[t * 3 + 1], cz = tc[t * 3 + 2];
      if (cx < cmnx) cmnx = cx;
      if (cy < cmny) cmny = cy;
      if (cz < cmnz) cmnz = cz;
      if (cx > cmxx) cmxx = cx;
      if (cy > cmxy) cmxy = cy;
      if (cz > cmxz) cmxz = cz;
    }
    nb[n * 6] = mnx; nb[n * 6 + 1] = mny; nb[n * 6 + 2] = mnz;
    nb[n * 6 + 3] = mxx; nb[n * 6 + 4] = mxy; nb[n * 6 + 5] = mxz;
    if (e - s <= 4) {
      left[n] = -1;
      start[n] = s;
      cnt[n] = e - s;
      continue;
    }
    const ex = cmxx - cmnx, ey = cmxy - cmny, ez = cmxz - cmnz;
    const axis = ex >= ey && ex >= ez ? 0 : ey >= ez ? 1 : 2;
    const mid = axis === 0 ? (cmnx + cmxx) / 2 : axis === 1 ? (cmny + cmxy) / 2 : (cmnz + cmxz) / 2;
    let i = s, j = e - 1;
    while (i <= j) {
      if (tc[order[i] * 3 + axis] < mid) i++;
      else {
        const tmp = order[i];
        order[i] = order[j];
        order[j] = tmp;
        j--;
      }
    }
    let m = i;
    if (m === s || m === e) m = (s + e) >> 1;
    const L = count++, R = count++;
    left[n] = L;
    right[n] = R;
    stack.push([s, m, L], [m, e, R]);
  }
  return { V, F, nb, left, right, start, cnt, order, stack: new Int32Array(256), lastHit: -1 };
}

function slabHit(nb, n, ox, oy, oz, ix, iy, iz, tmax) {
  const o = n * 6;
  let t1 = (nb[o] - ox) * ix, t2 = (nb[o + 3] - ox) * ix;
  let tmin = Math.min(t1, t2), tm = Math.max(t1, t2);
  t1 = (nb[o + 1] - oy) * iy;
  t2 = (nb[o + 4] - oy) * iy;
  tmin = Math.max(tmin, Math.min(t1, t2));
  tm = Math.min(tm, Math.max(t1, t2));
  t1 = (nb[o + 2] - oz) * iz;
  t2 = (nb[o + 5] - oz) * iz;
  tmin = Math.max(tmin, Math.min(t1, t2));
  tm = Math.min(tm, Math.max(t1, t2));
  return tm >= Math.max(tmin, 0) && tmin <= tmax;
}

function growStack(bvh, size) {
  if (size < bvh.stack.length) return;
  const next = new Int32Array(bvh.stack.length * 2);
  next.set(bvh.stack);
  bvh.stack = next;
}

/** Möller–Trumbore. 교차 거리 (없으면 -1) */
function hitTriangle(V, F, t, ox, oy, oz, dx, dy, dz) {
  const a = F[t * 3] * 3, b = F[t * 3 + 1] * 3, c = F[t * 3 + 2] * 3;
  const e1x = V[b] - V[a], e1y = V[b + 1] - V[a + 1], e1z = V[b + 2] - V[a + 2];
  const e2x = V[c] - V[a], e2y = V[c + 1] - V[a + 1], e2z = V[c + 2] - V[a + 2];
  const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-12) return -1;
  const inv = 1 / det;
  const sx = ox - V[a], sy = oy - V[a + 1], sz = oz - V[a + 2];
  const u = (sx * px + sy * py + sz * pz) * inv;
  if (u < 0 || u > 1) return -1;
  const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
  const v = (dx * qx + dy * qy + dz * qz) * inv;
  if (v < 0 || u + v > 1) return -1;
  const d = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return d > 1e-6 ? d : -1;
}

/**
 * 가장 가까운 교차 거리 (없으면 Infinity). anyHit 이면 첫 교차에서 멈춘다.
 * 맞은 삼각형은 bvh.lastHit 에 남는다.
 */
export function raycast(bvh, ox, oy, oz, dx, dy, dz, skip = -1, anyHit = false) {
  const { V, F, nb, left, right, start, cnt, order } = bvh;
  const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
  let best = Infinity;
  bvh.lastHit = -1;
  let sp = 0;
  bvh.stack[sp++] = 0;
  while (sp) {
    const n = bvh.stack[--sp];
    if (!slabHit(nb, n, ox, oy, oz, ix, iy, iz, best)) continue;
    if (left[n] < 0) {
      for (let i = start[n], end = start[n] + cnt[n]; i < end; i++) {
        const t = order[i];
        if (t === skip) continue;
        const d = hitTriangle(V, F, t, ox, oy, oz, dx, dy, dz);
        if (d > 0 && d < best) {
          best = d;
          bvh.lastHit = t;
          if (anyHit) return best;
        }
      }
    } else {
      growStack(bvh, sp + 2);
      bvh.stack[sp++] = left[n];
      bvh.stack[sp++] = right[n];
    }
  }
  return best;
}

/** 광선이 지나는 모든 교차 수 (안·밖 판정용) */
export function countHits(bvh, ox, oy, oz, dx, dy, dz) {
  const { V, F, nb, left, right, start, cnt, order } = bvh;
  const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
  let hits = 0;
  let sp = 0;
  bvh.stack[sp++] = 0;
  while (sp) {
    const n = bvh.stack[--sp];
    if (!slabHit(nb, n, ox, oy, oz, ix, iy, iz, Infinity)) continue;
    if (left[n] < 0) {
      for (let i = start[n], end = start[n] + cnt[n]; i < end; i++) {
        if (hitTriangle(V, F, order[i], ox, oy, oz, dx, dy, dz) > 0) hits++;
      }
    } else {
      growStack(bvh, sp + 2);
      bvh.stack[sp++] = left[n];
      bvh.stack[sp++] = right[n];
    }
  }
  return hits;
}

function closestOnTriangle(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz, out) {
  const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) { out[0] = ax; out[1] = ay; out[2] = az; return; }
  const bpx = px - bx, bpy = py - by, bpz = pz - bz;
  const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) { out[0] = bx; out[1] = by; out[2] = bz; return; }
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    out[0] = ax + v * abx; out[1] = ay + v * aby; out[2] = az + v * abz;
    return;
  }
  const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
  const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) { out[0] = cx; out[1] = cy; out[2] = cz; return; }
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    out[0] = ax + w * acx; out[1] = ay + w * acy; out[2] = az + w * acz;
    return;
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
    out[0] = bx + w * (cx - bx); out[1] = by + w * (cy - by); out[2] = bz + w * (cz - bz);
    return;
  }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  out[0] = ax + abx * v + acx * w;
  out[1] = ay + aby * v + acy * w;
  out[2] = az + abz * v + acz * w;
}

const tmpPoint = [0, 0, 0];

/** maxDist 안에서 가장 가까운 표면 점. 거리 반환 (없으면 Infinity), 점은 out 에, 삼각형은 bvh.lastHit 에 쓴다 */
export function nearestPoint(bvh, px, py, pz, maxDist, out) {
  const { V, F, nb, left, right, start, cnt, order } = bvh;
  let best = maxDist * maxDist;
  bvh.lastHit = -1;
  let found = false;
  let sp = 0;
  bvh.stack[sp++] = 0;
  while (sp) {
    const n = bvh.stack[--sp], o = n * 6;
    const dx = Math.max(nb[o] - px, 0, px - nb[o + 3]);
    const dy = Math.max(nb[o + 1] - py, 0, py - nb[o + 4]);
    const dz = Math.max(nb[o + 2] - pz, 0, pz - nb[o + 5]);
    if (dx * dx + dy * dy + dz * dz > best) continue;
    if (left[n] < 0) {
      for (let i = start[n], end = start[n] + cnt[n]; i < end; i++) {
        const t = order[i], a = F[t * 3] * 3, b = F[t * 3 + 1] * 3, c = F[t * 3 + 2] * 3;
        closestOnTriangle(px, py, pz, V[a], V[a + 1], V[a + 2], V[b], V[b + 1], V[b + 2], V[c], V[c + 1], V[c + 2], tmpPoint);
        const d2 = (tmpPoint[0] - px) ** 2 + (tmpPoint[1] - py) ** 2 + (tmpPoint[2] - pz) ** 2;
        if (d2 < best) {
          best = d2;
          out[0] = tmpPoint[0];
          out[1] = tmpPoint[1];
          out[2] = tmpPoint[2];
          bvh.lastHit = t;
          found = true;
        }
      }
    } else {
      // 가까운 자식을 먼저 꺼내도록 먼 쪽을 먼저 쌓는다 → 최솟값이 빨리 줄어 가지치기가 잘 된다
      const l = left[n], r = right[n];
      const dl = boxDist2(nb, l, px, py, pz), dr = boxDist2(nb, r, px, py, pz);
      growStack(bvh, sp + 2);
      if (dl < dr) {
        if (dr <= best) bvh.stack[sp++] = r;
        if (dl <= best) bvh.stack[sp++] = l;
      } else {
        if (dl <= best) bvh.stack[sp++] = l;
        if (dr <= best) bvh.stack[sp++] = r;
      }
    }
  }
  return found ? Math.sqrt(best) : Infinity;
}

function boxDist2(nb, n, px, py, pz) {
  const o = n * 6;
  const dx = Math.max(nb[o] - px, 0, px - nb[o + 3]);
  const dy = Math.max(nb[o + 1] - py, 0, py - nb[o + 4]);
  const dz = Math.max(nb[o + 2] - pz, 0, pz - nb[o + 5]);
  return dx * dx + dy * dy + dz * dz;
}

// ---------- 그래프 ----------

/** 간선 목록 [a, b, w, len] 으로 CSR 인접 구조를 만든다 */
export function buildGraph(nv, list) {
  const deg = new Int32Array(nv + 1);
  for (let i = 0; i < list.length; i += 4) {
    deg[list[i]]++;
    deg[list[i + 1]]++;
  }
  const startIdx = new Int32Array(nv + 1);
  for (let i = 0; i < nv; i++) startIdx[i + 1] = startIdx[i] + deg[i];
  const fill = startIdx.slice(0, nv);
  const to = new Int32Array(startIdx[nv]);
  const w = new Float64Array(startIdx[nv]);
  const len = new Float64Array(startIdx[nv]);
  for (let i = 0; i < list.length; i += 4) {
    const a = list[i], b = list[i + 1];
    to[fill[a]] = b; w[fill[a]] = list[i + 2]; len[fill[a]++] = list[i + 3];
    to[fill[b]] = a; w[fill[b]] = list[i + 2]; len[fill[b]++] = list[i + 3];
  }
  return { nv, start: startIdx, to, w, len };
}

/**
 * 다중 출발점 최단 거리 (이진 힙).
 * geo: 고른 경로를 따라 실제 길이를 함께 누적한다 (가중 거리와 다를 때 유동 길이용).
 * allowed: 지나갈 수 있는 정점만 1 (생략하면 전체)
 */
export function shortestPaths(graph, sources, { withParent = false, withGeo = false, allowed = null, maxDist = Infinity } = {}) {
  const { nv, start, to, w, len } = graph;
  const dist = new Float64Array(nv).fill(Infinity);
  const geo = withGeo ? new Float64Array(nv).fill(Infinity) : null;
  const parent = withParent ? new Int32Array(nv).fill(-1) : null;
  const order = withParent ? new Int32Array(nv) : null;
  let oc = 0;
  let cap = Math.max(64, nv);
  let hk = new Float64Array(cap), hv = new Int32Array(cap);
  let hs = 0;
  const push = (k, v) => {
    if (hs >= cap) {
      cap *= 2;
      const nk = new Float64Array(cap), nvv = new Int32Array(cap);
      nk.set(hk);
      nvv.set(hv);
      hk = nk;
      hv = nvv;
    }
    let i = hs++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hk[p] <= k) break;
      hk[i] = hk[p];
      hv[i] = hv[p];
      i = p;
    }
    hk[i] = k;
    hv[i] = v;
  };
  for (const s of sources) {
    dist[s] = 0;
    if (geo) geo[s] = 0;
    push(0, s);
  }
  while (hs) {
    const d = hk[0], u = hv[0];
    const k = hk[--hs], last = hv[hs];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= hs) break;
      if (c + 1 < hs && hk[c + 1] < hk[c]) c++;
      if (hk[c] >= k) break;
      hk[i] = hk[c];
      hv[i] = hv[c];
      i = c;
    }
    hk[i] = k;
    hv[i] = last;
    if (d > dist[u] || d > maxDist) continue;
    if (order) order[oc++] = u;
    for (let e = start[u]; e < start[u + 1]; e++) {
      const v = to[e];
      if (allowed && !allowed[v]) continue;
      const nd = d + w[e];
      if (nd < dist[v]) {
        dist[v] = nd;
        if (geo) geo[v] = geo[u] + len[e];
        if (parent) parent[v] = u;
        push(nd, v);
      }
    }
  }
  return { dist, geo, parent, order: order ? order.subarray(0, oc) : null };
}

/** 가중 중앙값 */
export function weightedMedian(values, weights) {
  const idx = [];
  for (let i = 0; i < values.length; i++) if (Number.isFinite(values[i])) idx.push(i);
  idx.sort((a, b) => values[a] - values[b]);
  let total = 0;
  for (const i of idx) total += weights[i];
  let acc = 0;
  for (const i of idx) {
    acc += weights[i];
    if (acc >= total / 2) return values[i];
  }
  return 0;
}

/** 3×3 대칭 행렬의 고유벡터 (야코비 회전). 고유값 내림차순 */
export function symmetricEigen3(m) {
  const a = [[m[0], m[1], m[2]], [m[1], m[3], m[4]], [m[2], m[4], m[5]]];
  const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 24; sweep++) {
    let off = 0;
    for (let p = 0; p < 3; p++) for (let q = p + 1; q < 3; q++) off += a[p][q] * a[p][q];
    if (off < 1e-18) break;
    for (let p = 0; p < 3; p++) {
      for (let q = p + 1; q < 3; q++) {
        if (Math.abs(a[p][q]) < 1e-15) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < 3; k++) {
          const akp = a[k][p], akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < 3; k++) {
          const apk = a[p][k], aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < 3; k++) {
          const vkp = v[k][p], vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const out = [0, 1, 2].map((i) => ({ value: a[i][i], vector: [v[0][i], v[1][i], v[2][i]] }));
  return out.sort((x, y) => y.value - x.value);
}
