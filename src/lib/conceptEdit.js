// 컨셉 3D 편집 (화면): 부품 범위·요구 치수 점검·맞추기와 편집 동작 (추가·복제·대칭·삭제)
// 범위·치수 계산은 서버 base44/shared/conceptEdit.ts 와 같다 (check:concept-edit 가 둘을 비교한다).

export const AXES = ['x', 'y', 'z'];
export const AXIS_LABEL = { x: '가로', y: '높이', z: '깊이' };
const r2 = (v) => Math.round(v * 100) / 100;
const rad = (d) => ((Number(d) || 0) * Math.PI) / 180;

/** three.js Euler 'XYZ' 회전 행렬 (행 우선 3×3) */
export function rotMatrix(r) {
  const a = Math.cos(rad(r?.x)), b = Math.sin(rad(r?.x)), c = Math.cos(rad(r?.y)), d = Math.sin(rad(r?.y)), e = Math.cos(rad(r?.z)), f = Math.sin(rad(r?.z));
  const ae = a * e, af = a * f, be = b * e, bf = b * f;
  return [[c * e, -c * f, d], [af + be * d, ae - bf * d, -b * c], [bf - ae * d, be + af * d, a * c]];
}

/** 부품 로컬 상자 (회전 전, 중심 기준) — 도형마다 실제 모양이 차지하는 범위 */
function localBox(p) {
  const x = Math.max(0.1, Number(p.size?.x) || 1), y = Math.max(0.1, Number(p.size?.y) || 1), z = Math.max(0.1, Number(p.size?.z) || x);
  if (p.shape === 'torus') return { min: [-x / 2, -y / 2, -x / 2], max: [x / 2, y / 2, x / 2] };
  if (p.shape === 'sphere_cut') {
    // 로컬 +Y 쪽을 cut 위치에서 잘라낸 공: 아래 끝 −0.5, 위 끝 cut·0.5. 자른 면이 중심보다 아래면 폭은 자른 면 원의 지름
    const c = Math.max(-0.95, Math.min(0.95, Number(p.cut) || 0));
    const w = c < 0 ? Math.sqrt(1 - c * c) : 1;
    return { min: [-x / 2 * w, -y / 2, -z / 2 * w], max: [x / 2 * w, (y / 2) * c, z / 2 * w] };
  }
  return { min: [-x / 2, -y / 2, -z / 2], max: [x / 2, y / 2, z / 2] };
}

/** 부품이 장면에서 차지하는 범위 (회전 반영, 축 정렬 상자) */
export function partBounds(p) {
  const m = rotMatrix(p.rotation_deg);
  const lb = localBox(p);
  const pos = [Number(p.position?.x) || 0, Number(p.position?.y) || 0, Number(p.position?.z) || 0];
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let k = 0; k < 8; k++) {
    const v = [k & 1 ? lb.max[0] : lb.min[0], k & 2 ? lb.max[1] : lb.min[1], k & 4 ? lb.max[2] : lb.min[2]];
    for (let i = 0; i < 3; i++) {
      const w = m[i][0] * v[0] + m[i][1] * v[1] + m[i][2] * v[2] + pos[i];
      if (w < min[i]) min[i] = w;
      if (w > max[i]) max[i] = w;
    }
  }
  return { min, max, size: { x: r2(max[0] - min[0]), y: r2(max[1] - min[1]), z: r2(max[2] - min[2]) } };
}

/** 제품 본체: 케이블·받침 패드 같은 기타(OTHER) 부품을 뺀 부품 (모두 기타면 전체) — '제품 전체' 치수는 본체로 잰다 */
export const bodyParts = (parts) => { const b = (parts || []).filter((p) => p.layer !== 'OTHER'); return b.length ? b : (parts || []); };

/** 장면 전체 범위 */
export function sceneBounds(parts) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of parts || []) {
    const b = partBounds(p);
    for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], b.min[i]); max[i] = Math.max(max[i], b.max[i]); }
  }
  if (!Number.isFinite(min[0])) return { min: [0, 0, 0], max: [0, 0, 0], size: { x: 0, y: 0, z: 0 } };
  return { min, max, size: { x: r2(max[0] - min[0]), y: r2(max[1] - min[1]), z: r2(max[2] - min[2]) } };
}

// ── 요구 치수 고정 ──
// lock: { id, axis: 'x'|'y'|'z', mm, tol(허용 ±mm, 기본 1), part_id?: 없으면 제품 전체(본체: 기타 부품 제외), label? }
export function cleanLocks(list) {
  return (Array.isArray(list) ? list : []).slice(0, 20).map((l, i) => ({
    id: typeof l?.id === 'string' && /^[A-Za-z0-9_-]{1,24}$/.test(l.id) ? l.id : `L${i + 1}`,
    axis: AXES.includes(l?.axis) ? l.axis : 'x',
    mm: Math.max(0.1, Math.min(5000, Math.round((Number(l?.mm) || 0) * 100) / 100)),
    tol: Math.max(0.05, Math.min(100, Number(l?.tol) > 0 ? Math.round(Number(l.tol) * 100) / 100 : 1)),
    part_id: typeof l?.part_id === 'string' && l.part_id ? l.part_id.slice(0, 24) : null,
    label: typeof l?.label === 'string' ? l.label.slice(0, 60) : '',
  })).filter((l) => Number(l.mm) > 0.1);
}

export function measureLock(parts, lock) {
  if (lock.part_id) { const p = (parts || []).find((x) => x.id === lock.part_id); return p ? partBounds(p).size[lock.axis] : null; }
  return sceneBounds(bodyParts(parts)).size[lock.axis];
}

/** 고정 치수마다 지금 값과 맞는지 */
export function checkLocks(parts, locks) {
  return (locks || []).map((l) => {
    const actual = measureLock(parts, l);
    const diff = actual == null ? null : r2(actual - l.mm);
    return { ...l, actual, diff, ok: diff != null && Math.abs(diff) <= (l.tol || 1) + 1e-9, missing: actual == null };
  });
}

/** AI 에게 줄 '꼭 지킬 치수' 문장 */
export function locksText(locks, parts = []) {
  if (!locks?.length) return '';
  const name = (id) => (parts.find((p) => p.id === id)?.name || id);
  return `[꼭 지킬 치수 — 결과가 이 값과 다르면 안 된다]\n${locks.map((l) => `- ${l.part_id ? `부품 '${name(l.part_id)}'(${l.part_id})` : '제품 전체'} ${AXIS_LABEL[l.axis]}(${l.axis}) ${l.mm} mm (허용 ±${l.tol})${l.label ? ` — ${l.label}` : ''}`).join('\n')}`;
}

// 부품을 장면 축 하나로 늘리고 줄인다: 위치는 기준점에서 비례로, 크기는 그 장면 축에 가장 많이 놓인 로컬 축을 바꾼다
function scalePart(p, axis, s, origin, movePos = true) {
  const i = AXES.indexOf(axis);
  const m = rotMatrix(p.rotation_deg);
  let j = 0;
  for (let k = 1; k < 3; k++) if (Math.abs(m[i][k]) > Math.abs(m[i][j])) j = k;
  let key = AXES[j];
  if (p.shape === 'torus' && key === 'z') key = 'x'; // 고리는 x 가 바깥 지름 (z 를 쓰지 않는다)
  const size = { ...p.size, [key]: r2(Math.max(0.1, (Number(p.size?.[key]) || Number(p.size?.x) || 1) * s)) };
  if (p.shape === 'torus') size.z = size.x;
  const position = movePos ? { ...p.position, [axis]: r2(origin + ((Number(p.position?.[axis]) || 0) - origin) * s) } : p.position;
  return { ...p, size, position };
}

/**
 * 고정 치수에 맞춘다. 제품 전체 치수는 장면 전체를 그 축으로 늘리고(높이는 바닥, 가로·깊이는 가운데 기준),
 * 부품 치수는 그 부품만 자기 중심 기준으로 늘린다. onlyIds 를 주면 그 부품의 부품 치수만 맞춘다 (고른 부품만 바꾸기).
 */
export function fitLocks(parts, locks, onlyIds = null) {
  let out = (parts || []).map((p) => ({ ...p }));
  const changes = [];
  if (!onlyIds) {
    for (const l of (locks || []).filter((x) => !x.part_id)) {
      const b = sceneBounds(bodyParts(out));
      const cur = b.size[l.axis];
      if (!(cur > 0) || Math.abs(cur - l.mm) <= (l.tol || 1)) continue;
      const i = AXES.indexOf(l.axis);
      const origin = l.axis === 'y' ? b.min[i] : (b.min[i] + b.max[i]) / 2;
      const s = l.mm / cur;
      out = out.map((p) => scalePart(p, l.axis, s, origin));
      changes.push(`제품 전체 ${AXIS_LABEL[l.axis]} ${cur} → ${l.mm} mm`);
    }
  }
  for (const l of (locks || []).filter((x) => x.part_id && (!onlyIds || onlyIds.includes(x.part_id)))) {
    const idx = out.findIndex((p) => p.id === l.part_id);
    if (idx < 0) continue;
    const cur = partBounds(out[idx]).size[l.axis];
    if (!(cur > 0) || Math.abs(cur - l.mm) <= (l.tol || 1)) continue;
    out[idx] = scalePart(out[idx], l.axis, l.mm / cur, 0, false);
    changes.push(`${out[idx].name} ${AXIS_LABEL[l.axis]} ${cur} → ${l.mm} mm`);
  }
  return { parts: out, changes };
}

// ── 편집 동작 (화면 전용) ──
export const SHAPE_LABEL = { box: '상자', rounded_box: '둥근 상자', cylinder: '원통', sphere: '공', sphere_cut: '자른 공(그릇)', capsule: '캡슐', cone: '원뿔', torus: '고리' };
export const LAYER_LABEL = { SHELL: '외장', INTERNAL: '내부', PCB: '기판', UI: '버튼·화면', OTHER: '기타' };
export const FINISH_LABEL = { matte: '무광', gloss: '유광', metal: '금속', glass: '유리', rubber: '고무' };

const usedIds = (parts) => new Set((parts || []).map((p) => p.id));
export function nextPartId(parts, prefix = 'e') {
  const used = usedIds(parts);
  let n = 1;
  while (used.has(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** 부품 한 칸 바꾸기 (size·position·rotation_deg 는 축 단위로 합친다) */
export function updatePart(parts, id, patch) {
  return parts.map((p) => (p.id !== id ? p : {
    ...p, ...patch,
    ...(patch.size ? { size: { ...p.size, ...patch.size } } : {}),
    ...(patch.position ? { position: { ...p.position, ...patch.position } } : {}),
    ...(patch.rotation_deg ? { rotation_deg: { ...p.rotation_deg, ...patch.rotation_deg } } : {}),
  }));
}

/** 새 부품: 제품 위쪽 가운데에 놓는다 */
export function addPart(parts, shape = 'box') {
  const b = sceneBounds(parts);
  const s = Math.max(10, Math.round(Math.min(b.size.x || 40, b.size.z || 40) * 0.25));
  const p = {
    id: nextPartId(parts), name: `새 부품 (${SHAPE_LABEL[shape] || shape})`, role: '', layer: 'UI', shape,
    size: { x: s, y: shape === 'torus' ? Math.max(2, s / 5) : s, z: s }, position: { x: 0, y: r2((b.max[1] || 0) + s / 2), z: 0 },
    rotation_deg: { x: 0, y: 0, z: 0 }, color: '#94a3b8', finish: 'matte', material: '', ...(shape === 'sphere_cut' ? { cut: 0 } : {}),
  };
  return { parts: [...parts, p], id: p.id };
}

/** 복제: 오른쪽(+x)으로 자기 폭만큼 옆에 */
export function duplicatePart(parts, id) {
  const src = parts.find((p) => p.id === id);
  if (!src) return { parts, id: null };
  const w = partBounds(src).size.x;
  const p = { ...src, id: nextPartId(parts), name: `${src.name} 복사`, position: { ...src.position, x: r2(num(src.position?.x) + w + 2) } };
  return { parts: [...parts, p], id: p.id };
}

/** 좌우 대칭 복사: x 를 뒤집고 y·z 축 회전을 반대로 */
export function mirrorPart(parts, id) {
  const src = parts.find((p) => p.id === id);
  if (!src) return { parts, id: null };
  const p = {
    ...src, id: nextPartId(parts), name: `${src.name} (대칭)`,
    position: { ...src.position, x: r2(-num(src.position?.x)) },
    rotation_deg: { x: num(src.rotation_deg?.x), y: -num(src.rotation_deg?.y), z: -num(src.rotation_deg?.z) },
  };
  return { parts: [...parts, p], id: p.id };
}

export const removePart = (parts, id) => parts.filter((p) => p.id !== id);

/** 두 부품 목록에서 바뀐 부품 (저장 메모용) */
export function diffParts(before, after) {
  const a = new Map((before || []).map((p) => [p.id, JSON.stringify(p)]));
  const b = new Map((after || []).map((p) => [p.id, JSON.stringify(p)]));
  const name = (id) => (after.find((p) => p.id === id) || before.find((p) => p.id === id))?.name || id;
  const changed = [...b.keys()].filter((id) => a.has(id) && a.get(id) !== b.get(id)).map(name);
  const added = [...b.keys()].filter((id) => !a.has(id)).map(name);
  const removed = [...a.keys()].filter((id) => !b.has(id)).map(name);
  return { changed, added, removed, count: changed.length + added.length + removed.length };
}
export function diffText(d) {
  return [d.changed.length && `수정 ${d.changed.slice(0, 6).join(', ')}${d.changed.length > 6 ? ` 외 ${d.changed.length - 6}` : ''}`, d.added.length && `추가 ${d.added.join(', ')}`, d.removed.length && `삭제 ${d.removed.join(', ')}`].filter(Boolean).join(' · ');
}
