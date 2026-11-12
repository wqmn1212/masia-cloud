// 외형 3D(B 방식) 계산 검산: 윤곽 읽기·측면 판별·외형 크기·부품 맞춤
// 실행: npm run check:concept-hull
import assert from 'node:assert/strict';
import { silhouette, buildHullGeometry, sideLooksLikeFront, rescaleSide, topDetailParts, fitPartsToHull, topColor } from '../src/lib/conceptHull.js';

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('✓', name); };

/** 회색 배경(가장자리 밝기 bg)에 색 있는 도형을 그린 가짜 이미지. shape(x,y) 가 참이면 제품 */
function img(w, h, shape, { bg = 205, color = [230, 222, 205], speck = null } = {}) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const on = shape(x, y);
    const c = on ? color : speck && speck(x, y) ? [bg - 4, bg - 6, bg - 14] : [bg, bg, bg];
    data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
  }
  return { width: w, height: h, data };
}

// 정면: 폭 200 × 높이 200 둥근 사각, 측면: 폭 150 × 높이 200
const rect = (l, t, r, b) => (x, y) => x >= l && x <= r && y >= t && y <= b;
const front = silhouette(img(400, 400, rect(100, 100, 299, 299)));
const side = silhouette(img(400, 400, rect(125, 100, 274, 299)));

ok('정면 윤곽: 위·아래·폭', () => {
  assert.equal(front.top, 100); assert.equal(front.bottom, 299);
  assert.ok(Math.abs(front.width - 199) <= 1, `width ${front.width}`);
  assert.ok(Math.abs(front.cx - 199.5) <= 1);
});

ok('바닥 그림자(듬성듬성한 얼룩)는 윤곽에 넣지 않는다', () => {
  // 제품 아래 10줄에 몸통보다 넓게 퍼진 얼룩(색이 조금 있는 픽셀이 절반만)
  const shadow = (x, y) => y > 300 && y < 312 && x > 60 && x < 340 && (x + y) % 2 === 0;
  const s = silhouette(img(400, 400, rect(100, 100, 299, 299), { speck: shadow }));
  assert.equal(s.bottom, 299);
  assert.ok(s.width < 205, `width ${s.width}`);
});

ok('배경이 이미지 전체를 차지하면 윤곽 없음', () => {
  assert.equal(silhouette(img(100, 100, () => false)), null);
});

ok('외형 크기: 높이는 입력값, 폭·깊이는 이미지 비율', () => {
  const g = buildHullGeometry(front, side, { heightMm: 120, rows: 40, segments: 24 });
  assert.equal(g.size.y, 120);
  assert.ok(Math.abs(g.size.x - 120) < 2, `x ${g.size.x}`);
  assert.ok(Math.abs(g.size.z - 90) < 2, `z ${g.size.z}`);
  g.geometry.computeBoundingBox();
  const bb = g.geometry.boundingBox;
  assert.ok(Math.abs(bb.max.y - 120) < 0.01 && Math.abs(bb.min.y) < 0.01);
  assert.ok(Math.abs((bb.max.x - bb.min.x) - g.size.x) < 2);
  assert.ok(Math.abs((bb.max.z - bb.min.z) - g.size.z) < 2);
  assert.ok(g.geometry.getAttribute('uvF') && g.geometry.getAttribute('uvS'));
});

ok('측면이 정면과 같으면(뒷면) 측면이 아니라고 본다', () => {
  assert.equal(sideLooksLikeFront(front, side), false);
  const back = silhouette(img(400, 400, rect(101, 100, 300, 299)));
  assert.equal(sideLooksLikeFront(front, back), true);
});

ok('측면을 믿기 어려우면 주어진 깊이 비율로 다시 맞춘다', () => {
  const s2 = rescaleSide(front, 0.5);
  assert.ok(Math.abs(s2.width / s2.height - 0.5) < 0.01);
  assert.equal(s2.unreliable, true);
  const g = buildHullGeometry(front, s2, { heightMm: 100, rows: 20, segments: 16 });
  assert.ok(Math.abs(g.size.z - 50) < 1.5, `z ${g.size.z}`);
});

ok('윗면 작은 부품만 외형 위에 올린다', () => {
  const overall = { x: 120, y: 120, z: 100 };
  const parts = [
    { id: 'shell', layer: 'SHELL', size: { x: 120, y: 76, z: 100 }, position: { y: 78 } },
    { id: 'rim', layer: 'SHELL', size: { x: 30, y: 4, z: 30 }, position: { y: 118 } },
    { id: 'btn', layer: 'UI', size: { x: 10, y: 2, z: 10 }, position: { y: 20, z: 50 } },
    { id: 'tank', layer: 'INTERNAL', size: { x: 80, y: 40, z: 70 }, position: { y: 118 } },
  ];
  assert.deepEqual(topDetailParts(parts, overall).map((p) => p.id), ['rim']);
});

ok('부품을 외형 크기 비율대로 옮긴다', () => {
  const [p] = fitPartsToHull([{ size: { x: 40, y: 10, z: 20 }, position: { x: 10, y: 50, z: -20 } }], { x: 100, y: 100, z: 100 }, { x: 50, y: 100, z: 200 });
  assert.deepEqual(p.size, { x: 20, y: 10, z: 40 });
  assert.deepEqual(p.position, { x: 5, y: 50, z: -40 });
});

ok('윗면 색은 몸통 위쪽 평균', () => {
  const c = topColor(img(400, 400, rect(100, 100, 299, 299)), front);
  assert.ok(Math.abs(c[0] - 230 / 255) < 0.01 && Math.abs(c[2] - 205 / 255) < 0.01);
});

console.log(`\n${n} checks passed`);
