// 컨셉 외형 3D (B 방식): 고른 시안의 정면·측면 이미지 윤곽으로 형태를 만들고, 그 이미지를 표면에 입힌다.
//
// 1) 윤곽: 배경(무채색 회색)과 제품(색이 있거나 배경보다 밝은 부분)을 나눠 줄마다 왼쪽·오른쪽 끝을 찾는다.
// 2) 형태: 높이마다 정면 폭 × 측면 깊이의 둥근 사각 단면(초타원)을 쌓는다. 두 윤곽의 교집합에 모서리를 둥글린 모양이다.
// 3) 표면: 앞·뒤를 보는 면은 정면 이미지, 옆을 보는 면은 측면 이미지를 투영해 입힌다 (시안의 색·분할선·버튼이 그대로 보인다).
// 단위는 mm, Y 위, 원점은 바닥 중심, +Z 정면 (기존 컨셉 장면과 같다).
import * as THREE from 'three';

/** 이미지 → 줄마다 제품 윤곽 [{y, l, r}] (픽셀). 배경은 가장자리 색으로 추정한다 */
export function silhouette(img, { chromaMin = 8, brightMin = 30, minRun = 10, gap = 3 } = {}) {
  const { width: w, height: h, data } = img;
  const at = (x, y) => { const i = (y * w + x) * 4; return [data[i], data[i + 1], data[i + 2]]; };
  const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const rows = [];
  for (let y = 0; y < h; y++) {
    const bl = lum(at(4, y)), br = lum(at(w - 5, y));
    // 줄마다 제품 픽셀의 가장 긴 연속 구간 (작은 틈은 메우고, 바닥 반사 같은 흩어진 점은 버린다)
    let best = null, start = -1, last = -1, n = 0;
    const close = () => { if (start >= 0 && last - start + 1 >= minRun && (!best || last - start > best.r - best.l)) best = { l: start, r: last, n }; };
    for (let x = 0; x < w; x++) {
      const c = at(x, y);
      const bg = bl + ((br - bl) * x) / (w - 1);
      const on = Math.max(...c) - Math.min(...c) >= chromaMin || lum(c) - bg >= brightMin;
      if (!on) continue;
      if (start < 0 || x - last > gap + 1) { close(); start = x; n = 0; }
      last = x; n++;
    }
    close();
    // 듬성듬성한 구간(바닥 그림자 얼룩)은 제품이 아니다
    if (best && best.n / (best.r - best.l + 1) >= 0.6) rows.push({ y, l: best.l, r: best.r });
  }
  if (!rows.length) return null;
  // 가장 큰 연속 구간만 남긴다 (위쪽 김·아래 그림자 같은 떨어진 조각 제거)
  const groups = [];
  rows.forEach((row) => { const g = groups[groups.length - 1]; if (g && row.y - g[g.length - 1].y <= 2) g.push(row); else groups.push([row]); });
  let main = groups.sort((a, b) => b.length - a.length)[0];
  // 아래쪽 바닥 그림자: 몸통보다 넓게 퍼진 줄은 잘라낸다
  const mid = main.slice(Math.floor(main.length * 0.2), Math.ceil(main.length * 0.85));
  const ref = Math.max(...mid.map((r) => r.r - r.l));
  while (main.length > 10 && main[main.length - 1].r - main[main.length - 1].l > ref * 1.01) main = main.slice(0, -1);
  // 남은 줄도 몸통 좌우 범위 밖으로는 못 나가게 (한쪽으로 번진 그림자)
  const ml = Math.min(...mid.map((r) => r.l)), mr = Math.max(...mid.map((r) => r.r));
  main = main.map((r) => ({ ...r, l: Math.max(r.l, ml), r: Math.min(r.r, mr) }));
  main = smoothRows(main, Math.max(3, Math.round(main.length * 0.025)));
  const top = main[0].y, bottom = main[main.length - 1].y;
  const left = Math.min(...main.map((r) => r.l)), right = Math.max(...main.map((r) => r.r));
  return { rows: main, top, bottom, cx: (left + right) / 2, width: right - left, height: bottom - top, imgW: w, imgH: h };
}

// 줄마다 들쭉날쭉한 윤곽을 이동 평균으로 고른다 (그대로 쓰면 표면에 가로 줄무늬가 생긴다)
function smoothRows(rows, k) {
  return rows.map((row, i) => {
    let l = 0, r = 0, c = 0;
    for (let j = Math.max(0, i - k); j <= Math.min(rows.length - 1, i + k); j++) { l += rows[j].l; r += rows[j].r; c++; }
    return { y: row.y, l: l / c, r: r / c };
  });
}

/** 정면 이미지 몸통 위쪽 가운데의 평균색 (윗면 색으로 쓴다) */
export function topColor(img, sil) {
  const { width: w, data } = img;
  const y0 = Math.round(sil.top + sil.height * 0.15), y1 = Math.round(sil.top + sil.height * 0.3);
  const x0 = Math.round(sil.cx - sil.width * 0.15), x1 = Math.round(sil.cx + sil.width * 0.15);
  const sum = [0, 0, 0]; let n = 0;
  for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) { const i = (y * w + x) * 4; sum[0] += data[i]; sum[1] += data[i + 1]; sum[2] += data[i + 2]; n++; }
  return sum.map((v) => v / n / 255);
}

const rowAt = (sil, py) => {
  let best = null;
  for (const r of sil.rows) if (!best || Math.abs(r.y - py) < Math.abs(best.y - py)) best = r;
  return best;
};

/**
 * 정면·측면 윤곽 → 외형 메시. heightMm 는 전체 높이(측정·입력값).
 * 측면 이미지는 정면이 왼쪽을 보는 오른쪽 측면이어야 한다.
 */
export function buildHullGeometry(front, side, { heightMm = 100, rows = 220, segments = 160, roundness = 4 } = {}) {
  const sF = heightMm / front.height, sS = heightMm / side.height;
  const e = 2 / roundness;
  const pos = [], uvF = [], uvS = [], idx = [];
  const ring = (h) => {
    const fr = rowAt(front, front.bottom - h / sF), sr = rowAt(side, side.bottom - h / sS);
    const xl = (fr.l - front.cx) * sF, xr = (fr.r - front.cx) * sF;
    const zf = -(sr.l - side.cx) * sS, zb = -(sr.r - side.cx) * sS; // 측면: 왼쪽이 정면(+Z)
    return { xc: (xl + xr) / 2, zc: (zf + zb) / 2, a: (xr - xl) / 2, b: (zf - zb) / 2 };
  };
  const push = (x, y, z) => {
    pos.push(x, y, z);
    uvF.push((x / sF + front.cx) / front.imgW, 1 - (front.bottom - y / sF) / front.imgH);
    uvS.push((side.cx - z / sS) / side.imgW, 1 - (side.bottom - y / sS) / side.imgH);
  };
  for (let i = 0; i <= rows; i++) {
    const h = (heightMm * i) / rows;
    const { xc, zc, a, b } = ring(Math.min(h, heightMm - 0.01));
    for (let j = 0; j < segments; j++) {
      const t = (2 * Math.PI * j) / segments;
      const c = Math.cos(t), s = Math.sin(t);
      push(xc + a * Math.sign(c) * Math.abs(c) ** e, h, zc + b * Math.sign(s) * Math.abs(s) ** e);
    }
  }
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * segments + j, b = i * segments + ((j + 1) % segments);
      idx.push(a, a + segments, b, b, a + segments, b + segments);
    }
  }
  // 위·아래 마감
  const capTop = pos.length / 3; push(ring(heightMm - 0.01).xc, heightMm, ring(heightMm - 0.01).zc);
  const capBot = pos.length / 3; push(ring(0).xc, 0, ring(0).zc);
  for (let j = 0; j < segments; j++) {
    const n = (j + 1) % segments;
    idx.push(rows * segments + j, capTop, rows * segments + n);
    idx.push(j, n, capBot);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uvF', new THREE.Float32BufferAttribute(uvF, 2));
  g.setAttribute('uvS', new THREE.Float32BufferAttribute(uvS, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const top = ring(heightMm * 0.995);
  return { geometry: g, size: { x: front.width * sF, y: heightMm, z: side.width * sS }, top: { y: heightMm, xc: top.xc, zc: top.zc, a: top.a, b: top.b } };
}

/** 정면·측면 이미지를 면 방향에 따라 섞어 입히는 재질 (사진에 이미 빛이 있어 조명은 약하게만) */
export function hullMaterial(texFront, texSide, { opacity = 1, top = [0.92, 0.9, 0.86], capFrom = 1e9, capTo = 1e9 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { tF: { value: texFront }, tS: { value: texSide }, opacity: { value: opacity }, topC: { value: new THREE.Vector3(...top) }, capFrom: { value: capFrom }, capTo: { value: capTo }, light: { value: new THREE.Vector3(0.5, 0.8, 0.6).normalize() } },
    vertexShader: `attribute vec2 uvF; attribute vec2 uvS; varying vec2 vF; varying vec2 vS; varying vec3 vN; varying float vY;
      void main(){ vF = uvF; vS = uvS; vN = normalize(normal); vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D tF; uniform sampler2D tS; uniform float opacity; uniform vec3 light; uniform vec3 topC; uniform float capFrom; uniform float capTo; varying vec2 vF; varying vec2 vS; varying vec3 vN; varying float vY;
      void main(){ vec3 n = normalize(vN);
        float wf = pow(abs(n.z), 4.0) + 1e-3; float ws = pow(abs(n.x), 4.0);
        vec3 c = (texture2D(tF, vF).rgb * wf + texture2D(tS, vS).rgb * ws) / (wf + ws);
        // 위·아래를 보는 면은 이미지에 정보가 없어 몸통 색으로 칠한다
        // 정면 이미지 맨 위 띠는 윗면이 비스듬히 찍힌 부분이라 옆면에 그대로 입히면 구멍이 두 번 보인다 → 몸통 색으로
        float wt = max(smoothstep(0.55, 0.9, abs(n.y)), smoothstep(capFrom, capTo, vY)); c = mix(c, topC, wt);
        float l = 0.9 + 0.2 * max(dot(n, light), 0.0); gl_FragColor = vec4(c * l, opacity); }`,
    transparent: opacity < 1,
    depthWrite: opacity >= 1,
    side: THREE.DoubleSide,
  });
}
