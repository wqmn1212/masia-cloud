// 컨셉 3D 편집 검산: 부품 범위(회전·도형), 요구 치수 점검·맞추기, 고른 부품만 병합, 편집 동작.
// 화면(src/lib/conceptEdit.js)과 서버(base44/shared/conceptEdit.ts)의 계산이 같은지도 비교한다.
// 실행: npm run check:concept-edit
import assert from 'node:assert/strict';
import * as S from '../base44/shared/conceptEdit.ts';
import * as C from '../src/lib/conceptEdit.js';
import * as THREE from 'three';
import { buildConceptGroup } from '../src/lib/conceptScene.js';

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('✓', name); };
const near = (a, b, t = 0.02) => assert.ok(Math.abs(a - b) <= t, `${a} ≠ ${b}`);

const parts = [
  { id: 'p1', name: '외장', layer: 'SHELL', shape: 'cylinder', size: { x: 120, y: 200, z: 120 }, position: { x: 0, y: 100, z: 0 }, rotation_deg: { x: 0, y: 0, z: 0 } },
  { id: 'p2', name: '버튼', layer: 'UI', shape: 'box', size: { x: 20, y: 6, z: 10 }, position: { x: 0, y: 150, z: 62 }, rotation_deg: { x: 90, y: 0, z: 0 } },
  { id: 'p3', name: '받침', layer: 'SHELL', shape: 'torus', size: { x: 140, y: 10, z: 140 }, position: { x: 0, y: 5, z: 0 }, rotation_deg: { x: 0, y: 0, z: 0 } },
  { id: 'p4', name: '그릇', layer: 'SHELL', shape: 'sphere_cut', cut: 0.5, size: { x: 100, y: 100, z: 100 }, position: { x: 0, y: 260, z: 0 }, rotation_deg: { x: 0, y: 0, z: 0 } },
  { id: 'p5', name: '기운 막대', layer: 'UI', shape: 'box', size: { x: 40, y: 2, z: 2 }, position: { x: 30, y: 230, z: 0 }, rotation_deg: { x: 0, y: 0, z: 45 } },
];

ok('부품 범위: 회전(90°는 높이↔깊이), 고리(바깥 지름), 자른 공(위쪽 잘림), 45° 기울기', () => {
  assert.deepEqual(S.partBounds(parts[1]).size, { x: 20, y: 10, z: 6 }, 'x 축 90° 회전이면 y·z 가 바뀐다');
  assert.deepEqual(S.partBounds(parts[2]).size, { x: 140, y: 10, z: 140 });
  const cut = S.partBounds(parts[3]);
  near(cut.min[1], 210); near(cut.max[1], 285); // 중심 260, 아래 −50, 위 +25(cut 0.5)
  near(S.partBounds(parts[4]).size.x, (40 + 2) / Math.SQRT2, 0.05);
  assert.deepEqual(S.sceneBounds(parts).size, { x: 140, y: 285, z: 140 });
});

ok('3D 화면(three.js)이 그리는 상자 범위와 같다 (회전 순서 XYZ 확인)', () => {
  const boxes = [{ id: 'r1', shape: 'box', size: { x: 30, y: 10, z: 6 }, position: { x: 5, y: 40, z: -3 }, rotation_deg: { x: 20, y: 35, z: -50 } }, parts[1], parts[4]];
  const built = buildConceptGroup(boxes);
  boxes.forEach((p, i) => {
    const b = new THREE.Box3().setFromObject(built.items[i].mesh);
    const mine = S.partBounds(p);
    [0, 1, 2].forEach((k) => { near(mine.min[k], b.min.getComponent(k), 0.02); near(mine.max[k], b.max.getComponent(k), 0.02); });
  });
});

ok('화면과 서버 계산이 같다 (범위·치수 점검·맞추기)', () => {
  for (const p of parts) assert.deepEqual(C.partBounds(p), S.partBounds(p));
  const locks = S.cleanLocks([{ axis: 'y', mm: 300 }, { axis: 'x', mm: 30, part_id: 'p2' }, { axis: 'z', mm: 160, tol: 2 }]);
  assert.deepEqual(C.cleanLocks(locks), locks);
  assert.deepEqual(C.checkLocks(parts, locks), S.checkLocks(parts, locks));
  assert.deepEqual(C.fitLocks(parts, locks), S.fitLocks(parts, locks));
  assert.deepEqual(C.fitLocks(parts, locks, ['p2']), S.fitLocks(parts, locks, ['p2']));
});

ok('요구 치수: 정리(잘못된 축·0 은 버림, 허용 기본 ±1) · 점검 · 없는 부품', () => {
  const locks = S.cleanLocks([{ axis: 'y', mm: 285.4 }, { axis: 'w', mm: 10 }, { axis: 'x', mm: 0 }, { axis: 'x', mm: 30, part_id: 'gone' }]);
  assert.deepEqual(locks.map((l) => [l.axis, l.mm, l.tol, l.part_id]), [['y', 285.4, 1, null], ['x', 10, 1, null], ['x', 30, 1, 'gone']], '모르는 축은 가로로, 0 은 버림');
  const c = S.checkLocks(parts, locks);
  assert.deepEqual(c.map((x) => [x.actual, x.ok, x.missing]), [[285, true, false], [140, false, false], [null, false, true]]);
  assert.match(S.locksText(locks, parts), /제품 전체 높이\(y\) 285\.4 mm \(허용 ±1\)/);
});

ok('제품 전체 치수는 본체로 잰다: 케이블 같은 기타(OTHER) 부품은 빼고, 맞출 때는 함께 옮긴다', () => {
  const withCable = [...parts, { id: 'c1', name: '케이블', layer: 'OTHER', shape: 'cylinder', size: { x: 4, y: 300, z: 4 }, position: { x: 0, y: 10, z: -200 }, rotation_deg: { x: 90, y: 0, z: 0 } }];
  const lock = S.cleanLocks([{ axis: 'z', mm: 140 }]);
  assert.equal(S.checkLocks(withCable, lock)[0].actual, 140, '케이블 300mm 는 깊이에 넣지 않는다');
  assert.ok(S.sceneBounds(withCable).size.z > 300, '화면 전체 범위에는 들어 있다');
  const f = S.fitLocks(withCable, S.cleanLocks([{ axis: 'x', mm: 280 }]));
  assert.equal(S.sceneBounds(S.bodyParts(f.parts)).size.x, 280);
  assert.deepEqual(C.fitLocks(withCable, lock), S.fitLocks(withCable, lock));
});

ok('맞추기: 전체 높이는 바닥 기준, 가로는 가운데 기준, 부품 치수는 그 부품만', () => {
  const locks = S.cleanLocks([{ axis: 'y', mm: 342 }, { axis: 'x', mm: 168 }, { axis: 'x', mm: 30, part_id: 'p2' }]);
  const f = S.fitLocks(parts, locks);
  const b = S.sceneBounds(f.parts);
  assert.deepEqual([b.size.y, b.size.x], [342, 168]);
  near(b.min[1], 0, 0.05); // 바닥은 그대로
  near((b.min[0] + b.max[0]) / 2, 0, 0.05);
  assert.equal(S.partBounds(f.parts.find((p) => p.id === 'p2')).size.x, 30);
  assert.equal(f.changes.length, 3);
  assert.equal(S.checkLocks(f.parts, locks).every((c) => c.ok), true, '맞춘 뒤 모두 통과');
  // 고른 부품만 바꾸기: 전체 치수는 건드리지 않고(다른 부품이 바뀌므로) 고른 부품 치수만
  const g = S.fitLocks(parts, locks, ['p2']);
  assert.deepEqual(g.parts.filter((p) => p.id !== 'p2'), parts.filter((p) => p.id !== 'p2'));
  assert.equal(g.changes.length, 1);
});

ok('고른 부품만 병합: 고르지 않은 부품 수정·삭제 무시, 새 부품 id, 안 준 속성은 유지', () => {
  const m = S.scopedMerge(parts, { parts: [{ keep_id: 'p2', color: '#ffcc00', size: { x: 24 } }, { keep_id: 'p1', size: { x: 1 } }, { name: '새 LED', shape: 'sphere', size: { x: 5, y: 5, z: 5 }, position: { x: 0, y: 180, z: 60 } }, { name: '크기 없음' }], remove_ids: ['p1', 'p4'] }, ['p2', 'p4']);
  assert.deepEqual(m.parts.map((p) => p.id), ['p1', 'p2', 'p3', 'p5', 'n1'], 'p4 는 골라서 삭제, p1 삭제는 무시');
  assert.deepEqual(m.parts[0], parts[0]);
  assert.deepEqual([m.parts[1].color, m.parts[1].size, m.parts[1].rotation_deg.x], ['#ffcc00', { x: 24, y: 6, z: 10 }, 90]);
  assert.deepEqual([m.changed, m.removed, m.added, m.ignored], [['p2'], ['p4'], ['n1'], 1]);
});

ok('직접 편집 정리: 겹치거나 잘못된 id 는 새 id, size 없는 부품은 버림', () => {
  const out = S.cleanEditedParts([parts[0], { ...parts[0] }, { ...parts[1], id: 'bad id!' }, { name: 'x' }]);
  assert.deepEqual(out.map((p) => p.id), ['p1', 'e1', 'e2']);
});

ok('편집 동작: 추가는 위쪽, 복제는 옆으로, 대칭은 x·회전 반전, 바뀐 점 요약', () => {
  const a = C.addPart(parts, 'cylinder');
  const np = a.parts.find((p) => p.id === a.id);
  assert.ok(C.partBounds(np).min[1] >= C.sceneBounds(parts).max[1] - 0.01, '맨 위에 올린다');
  const d = C.duplicatePart(parts, 'p2');
  assert.equal(d.parts.find((p) => p.id === d.id).position.x, 22);
  const mi = C.mirrorPart(parts, 'p5');
  const mp = mi.parts.find((p) => p.id === mi.id);
  assert.deepEqual([mp.position.x, mp.rotation_deg.z, mp.name], [-30, -45, '기운 막대 (대칭)']);
  const moved = C.updatePart(parts, 'p2', { position: { y: 160 } });
  assert.deepEqual(moved.find((p) => p.id === 'p2').position, { x: 0, y: 160, z: 62 }, '축 하나만 바꿔도 나머지는 유지');
  const diff = C.diffParts(parts, C.removePart(mi.parts.map((p) => (p.id === 'p2' ? moved[1] : p)), 'p3'));
  assert.deepEqual([diff.changed, diff.added, diff.removed], [['버튼'], ['기운 막대 (대칭)'], ['받침']]);
  assert.equal(C.diffText(diff), '수정 버튼 · 추가 기운 막대 (대칭) · 삭제 받침');
});

console.log(`\n${n}개 검산 통과`);
