// 컨셉 3D 편집 공용: 부품 범위(회전 반영), 요구 치수 점검·맞추기, 고른 부품만 바꾸는 병합
// 화면 src/lib/conceptEdit.js 의 partBounds·sceneBounds·checkLocks·fitLocks 와 같은 계산이다 (check:concept-edit 가 둘을 비교한다).
// 좌표: 컨셉 장면 그대로 (단위 mm, Y 위, 원점 = 바닥 중심). size 는 회전 전 x(폭)·y(높이)·z(깊이), 회전은 three.js Euler XYZ.
import { cleanPart } from './protoConcept.ts';

export const AXES = ['x', 'y', 'z'];
export const AXIS_LABEL: Record<string, string> = { x: '가로', y: '높이', z: '깊이' };
const r2 = (v: number) => Math.round(v * 100) / 100;
const rad = (d: unknown) => ((Number(d) || 0) * Math.PI) / 180;

/** three.js Euler 'XYZ' 회전 행렬 (행 우선 3×3) */
export function rotMatrix(r: any) {
  const a = Math.cos(rad(r?.x)), b = Math.sin(rad(r?.x)), c = Math.cos(rad(r?.y)), d = Math.sin(rad(r?.y)), e = Math.cos(rad(r?.z)), f = Math.sin(rad(r?.z));
  const ae = a * e, af = a * f, be = b * e, bf = b * f;
  return [[c * e, -c * f, d], [af + be * d, ae - bf * d, -b * c], [bf - ae * d, be + af * d, a * c]];
}

/** 부품 로컬 상자 (회전 전, 중심 기준) — 도형마다 실제 모양이 차지하는 범위 */
function localBox(p: any) {
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
export function partBounds(p: any) {
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
export const bodyParts = (parts: any[]) => { const b = (parts || []).filter((p) => p.layer !== 'OTHER'); return b.length ? b : (parts || []); };

/** 장면 전체 범위 */
export function sceneBounds(parts: any[]) {
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
export function cleanLocks(list: unknown) {
  return (Array.isArray(list) ? list : []).slice(0, 20).map((l: any, i: number) => ({
    id: typeof l?.id === 'string' && /^[A-Za-z0-9_-]{1,24}$/.test(l.id) ? l.id : `L${i + 1}`,
    axis: AXES.includes(l?.axis) ? l.axis : 'x',
    mm: Math.max(0.1, Math.min(5000, Math.round((Number(l?.mm) || 0) * 100) / 100)),
    tol: Math.max(0.05, Math.min(100, Number(l?.tol) > 0 ? Math.round(Number(l.tol) * 100) / 100 : 1)),
    part_id: typeof l?.part_id === 'string' && l.part_id ? l.part_id.slice(0, 24) : null,
    label: typeof l?.label === 'string' ? l.label.slice(0, 60) : '',
  })).filter((l) => Number(l.mm) > 0.1);
}

export function measureLock(parts: any[], lock: any) {
  if (lock.part_id) { const p = (parts || []).find((x) => x.id === lock.part_id); return p ? partBounds(p).size[lock.axis] : null; }
  return sceneBounds(bodyParts(parts)).size[lock.axis];
}

/** 고정 치수마다 지금 값과 맞는지 */
export function checkLocks(parts: any[], locks: any[]) {
  return (locks || []).map((l) => {
    const actual = measureLock(parts, l);
    const diff = actual == null ? null : r2(actual - l.mm);
    return { ...l, actual, diff, ok: diff != null && Math.abs(diff) <= (l.tol || 1) + 1e-9, missing: actual == null };
  });
}

/** AI 에게 줄 '꼭 지킬 치수' 문장 */
export function locksText(locks: any[], parts: any[] = []) {
  if (!locks?.length) return '';
  const name = (id: string) => (parts.find((p) => p.id === id)?.name || id);
  return `[꼭 지킬 치수 — 결과가 이 값과 다르면 안 된다]\n${locks.map((l) => `- ${l.part_id ? `부품 '${name(l.part_id)}'(${l.part_id})` : '제품 전체'} ${AXIS_LABEL[l.axis]}(${l.axis}) ${l.mm} mm (허용 ±${l.tol})${l.label ? ` — ${l.label}` : ''}`).join('\n')}`;
}

// 부품을 장면 축 하나로 늘리고 줄인다: 위치는 기준점에서 비례로, 크기는 그 장면 축에 가장 많이 놓인 로컬 축을 바꾼다
function scalePart(p: any, axis: string, s: number, origin: number, movePos = true) {
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
export function fitLocks(parts: any[], locks: any[], onlyIds: string[] | null = null) {
  let out = (parts || []).map((p) => ({ ...p }));
  const changes: string[] = [];
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

// ── 고른 부품만 AI 로 바꾸기 ──
export const SCOPED_PART_LIMIT = 10;

/**
 * AI 결과를 기존 형상에 합친다. 고른 부품(ids)만 바뀌고 나머지는 그대로다.
 * ai.parts: keep_id 가 고른 부품 id 면 그 부품의 수정본, keep_id 가 없으면 새 부품. 고르지 않은 부품의 keep_id 는 무시한다.
 * ai.remove_ids: 고른 부품 중 없앨 것
 */
export function scopedMerge(oldParts: any[], ai: any, ids: string[]) {
  const sel = new Set(ids || []);
  const edits = new Map<string, any>();
  const added: any[] = [];
  let ignored = 0;
  for (const p of Array.isArray(ai?.parts) ? ai.parts : []) {
    if (!p || typeof p !== 'object') continue;
    const k = typeof p.keep_id === 'string' ? p.keep_id : '';
    if (k && sel.has(k)) edits.set(k, p);
    else if (k && (oldParts || []).some((o) => o.id === k)) ignored += 1; // 고르지 않은 부품을 고치려 함 → 버린다
    else if (p.size) added.push(p);
  }
  const remove = new Set((Array.isArray(ai?.remove_ids) ? ai.remove_ids : []).filter((x: any) => sel.has(x)));
  const used = new Set((oldParts || []).map((o) => o.id));
  let n = 1;
  const freshId = () => { while (used.has(`n${n}`)) n += 1; const id = `n${n}`; used.add(id); return id; };
  const merged = (oldParts || []).flatMap((o, i) => {
    if (remove.has(o.id)) return [];
    const e = edits.get(o.id);
    if (!e) return [o];
    const { keep_id: _k, id: _id, ...rest } = e;
    return [cleanPart({ ...o, ...rest, size: { ...o.size, ...(rest.size || {}) }, position: { ...o.position, ...(rest.position || {}) }, rotation_deg: { ...o.rotation_deg, ...(rest.rotation_deg || {}) } }, i, o.id)];
  });
  const fresh = added.slice(0, SCOPED_PART_LIMIT).map((p, i) => cleanPart(p, merged.length + i, freshId()));
  return { parts: [...merged, ...fresh], changed: [...edits.keys()], removed: [...remove], added: fresh.map((p) => p.id), ignored };
}

/** 화면에서 직접 고친 부품 목록 정리: id 를 지키고, 겹치는 id 는 새로 붙인다 */
export function cleanEditedParts(list: unknown, max = 60) {
  const used = new Set<string>();
  let n = 1;
  return (Array.isArray(list) ? list : []).filter((p: any) => p && typeof p === 'object' && p.size).slice(0, max).map((p: any, i: number) => {
    let id = typeof p.id === 'string' ? p.id : '';
    if (!id || used.has(id) || !/^[A-Za-z0-9_-]{1,24}$/.test(id)) { while (used.has(`e${n}`)) n += 1; id = `e${n}`; }
    used.add(id);
    return cleanPart(p, i, id);
  });
}

export const SCOPED_SCHEMA = {
  type: 'object',
  properties: {
    change_summary: { type: 'string' },
    parts: { type: 'array', items: { type: 'object', properties: {
      keep_id: { type: 'string' }, name: { type: 'string' }, role: { type: 'string' }, layer: { type: 'string' }, shape: { type: 'string' },
      size: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } } },
      position: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } } },
      rotation_deg: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } } },
      cut: { type: 'number' }, color: { type: 'string' }, finish: { type: 'string' }, material: { type: 'string' } } } },
    remove_ids: { type: 'array', items: { type: 'string' } },
    assumptions: { type: 'array', items: { type: 'string' } },
  },
};

export const SCOPED_RULES = `고른 부품만 바꾸는 규칙:
- 결과 parts 에는 수정한 '고른 부품'만 넣고, keep_id 에 그 부품의 원래 id 를 적는다. 바꾸지 않은 속성은 원래 값을 그대로 적는다.
- 요청에 꼭 필요할 때만 새 부품을 넣는다 (keep_id 없이). 고른 부품을 없애야 하면 remove_ids 에 그 id 를 넣는다.
- 고르지 않은 부품은 결과에 넣지 않는다. 넣어도 반영되지 않는다. 대신 고르지 않은 부품의 위치·크기를 보고 겹치거나 떠 있지 않게 맞춘다.
- change_summary 에 무엇을 어떻게 바꿨는지 짧게 쓴다.`;
