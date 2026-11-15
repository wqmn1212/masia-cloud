// 설계 확정(동결)과 변경 관리(ECO): 확정본 스냅샷과 지금 설정을 비교해 바뀐 점을 사람이 읽는 목록으로 만든다.
import { FEATURE_KINDS, MCUS } from './features.js';
import { TEMPLATES } from '../cad/catalog.js';

const KEYS = ['device_name', 'mcu', 'supply_v', 'features', 'rules', 'mold_design', 'hw', 'uuid_base'];

/** 확정할 내용 (요약·계산값·기록은 빼고 설계 결정만) */
export function snapshotOf(dev) {
  const s = {};
  for (const k of KEYS) if (dev?.[k] !== undefined) s[k] = JSON.parse(JSON.stringify(dev[k]));
  if (s.mold_design) s.mold_design = { template: s.mold_design.template, params: s.mold_design.params };
  if (s.hw) s.hw = { split: s.hw.split || [] };
  if (s.features) s.features = s.features.map(({ id, kind, name, pin, pins, power_w, cct, face, watch }) => ({ id, kind, name, pin: pin ?? null, pins: pins || null, power_w, cct, face, watch }));
  return s;
}

const fmt = (v) => (v == null || v === '' ? '없음' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** 확정본 → 지금 바뀐 점 [{ area, text }] */
export function diffDesign(base, now) {
  const a = base || {}, b = snapshotOf(now);
  const out = [];
  const push = (area, text) => out.push({ area, text });
  if (a.device_name !== b.device_name) push('장치', `장치 이름 ${fmt(a.device_name)} → ${fmt(b.device_name)}`);
  if (a.mcu !== b.mcu) push('회로', `MCU ${MCUS[a.mcu]?.module || fmt(a.mcu)} → ${MCUS[b.mcu]?.module || fmt(b.mcu)}`);
  if (Number(a.supply_v) !== Number(b.supply_v)) push('회로', `입력 전원 ${fmt(a.supply_v)} V → ${fmt(b.supply_v)} V`);
  const fa = new Map((a.features || []).map((f) => [f.id, f])), fb = new Map((b.features || []).map((f) => [f.id, f]));
  for (const [id, f] of fb) {
    const o = fa.get(id);
    if (!o) { push('기능', `추가: ${f.name} (${FEATURE_KINDS[f.kind]?.label || f.kind})`); continue; }
    if (o.name !== f.name) push('기능', `이름 바꿈: ${o.name} → ${f.name}`);
    if (o.kind !== f.kind) push('기능', `${f.name}: 종류 ${o.kind} → ${f.kind}`);
    if ((o.pin ?? null) !== (f.pin ?? null) || JSON.stringify(o.pins || null) !== JSON.stringify(f.pins || null)) push('회로', `${f.name}: 핀 ${fmt(o.pin)}${o.pins ? ` ${fmt(o.pins)}` : ''} → ${fmt(f.pin)}${f.pins ? ` ${fmt(f.pins)}` : ''}`);
    for (const k of ['power_w', 'cct', 'face', 'watch']) if (fmt(o[k]) !== fmt(f[k])) push('기능', `${f.name}: ${k} ${fmt(o[k])} → ${fmt(f[k])}`);
  }
  for (const [id, f] of fa) if (!fb.has(id)) push('기능', `삭제: ${f.name}`);
  if (JSON.stringify(a.rules || []) !== JSON.stringify(b.rules || [])) push('동작', `동작 규칙 ${(a.rules || []).length}개 → ${(b.rules || []).length}개 (내용 바뀜)`);
  const ma = a.mold_design || {}, mb = b.mold_design || {};
  if (ma.template !== mb.template) push('외장', `외장 형태 ${TEMPLATES[ma.template]?.label || fmt(ma.template)} → ${TEMPLATES[mb.template]?.label || fmt(mb.template)}`);
  else {
    const T = TEMPLATES[mb.template];
    const keys = new Set([...Object.keys(ma.params || {}), ...Object.keys(mb.params || {})]);
    for (const k of keys) if (fmt(ma.params?.[k]) !== fmt(mb.params?.[k])) { const p = T?.params?.find((x) => x.key === k); push('외장', `${p?.label || k} ${fmt(ma.params?.[k])} → ${fmt(mb.params?.[k])}${p?.unit ? ` ${p.unit}` : ''}`); }
  }
  if (JSON.stringify(a.hw?.split || []) !== JSON.stringify(b.hw?.split || [])) push('회로', `기판 나누기 ${(a.hw?.split || []).length ? '있음' : '없음'} → ${(b.hw?.split || []).length ? '있음' : '없음'}`);
  if (a.uuid_base !== b.uuid_base) push('블루투스', '블루투스 UUID 가 바뀌었습니다 (앱과 다시 맞춰야 함)');
  return out;
}

/** 영향 범위: 바뀐 영역 → 다시 해야 할 일 */
export function impactOf(changes) {
  const areas = new Set(changes.map((c) => c.area));
  const todo = [];
  if (areas.has('외장')) todo.push('금형 견적·금형 점검 다시 (외장 치수 변경)');
  if (areas.has('회로') || areas.has('기능')) todo.push('회로도·기판(거버) 다시 만들기, 부품표 갱신');
  if (areas.has('기능') || areas.has('동작') || areas.has('회로')) todo.push('펌웨어 다시 빌드·굽기, 동작 시험');
  if (areas.has('블루투스')) todo.push('앱 개발팀에 통신 문서 다시 보내기');
  return todo;
}
