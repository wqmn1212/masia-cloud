// 동작 규칙: 버튼·센서 입력 → 출력(구동부). 동작 시뮬레이터와 ESP32 펌웨어가 같은 규칙을 쓴다.
//  event : 버튼을 누르면(눌리는 순간) 출력을 켜고 끄기·켜기·끄기·단계 바꾸기
//  guard : 조건이 맞는 동안 출력을 강제로 끈다 (뚜껑 열림, 넘어짐, 온도 이상, 배터리 부족, 버튼을 누르는 동안)
//  show  : 출력(또는 모든 구동부)이 동작하는 동안 표시등·시간 표시를 켠다
//  schedule : 토글 스위치(수면 모드)가 켜져 있으면 시각에 따라 취침 전 서서히 어둡게 → 소등, 기상 전 서서히 밝게
import { FEATURE_KINDS, OUTPUT_LEVELS, ALL_TARGET_KINDS, isOutput } from './features.js';

const ID = () => Math.random().toString(36).slice(2, 9);
export const ALL = '*';

export const EVENT_ACTIONS = { toggle: '켜고 끄기', cycle: '단계 바꾸기', on: '켜기', off: '끄기', pair: '앱 연결 (페어링)' };
export const SHOW_KINDS = ['led', 'display'];
/** 수면 일정 기본값 (사양서 예: 취침 23:00·감광 30분, 기상 08:00·증광 30분) */
export const SCHEDULE_DEFAULT = { bed: '23:00', dim_min: 30, wake: '08:00', rise_min: 30, wake_level: 100 };
export const hhmm = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return (((h || 0) * 60 + (m || 0)) % 1440 + 1440) % 1440; };
export const fmtClock = (sec) => { const m = Math.floor((((sec / 60) % 1440) + 1440) % 1440); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
export const GUARD_CONDS = {
  open: { label: '열려 있으면', kinds: ['lid'] },
  tilted: { label: '기울어지면', kinds: ['tilt'] },
  empty: { label: '물이 부족하면', kinds: ['water'] },
  pressed: { label: '눌린 동안', kinds: ['button'] },
  above: { label: '값이 이상이면', kinds: ['temp', 'analog', 'battery'], value: true },
  below: { label: '값이 이하이면', kinds: ['temp', 'analog', 'battery'], value: true },
};

const byKind = (features, kinds) => features.filter((f) => kinds.includes(f.kind));

/** 기능 목록으로 기본 규칙을 만든다 */
export function defaultRules(features) {
  const rules = [];
  const buttons = byKind(features, ['button']);
  const outs = features.filter((f) => isOutput(f.kind));
  const drives = outs.filter((f) => f.kind !== 'led');
  const leds = byKind(features, ['led']);
  const targets = drives.length ? drives : leds;
  // 첫 버튼들은 구동부를 하나씩 켜고 끄고(모터는 단계), 구동부보다 많은 버튼은 '모드' 버튼으로 단계를 바꾼다
  buttons.forEach((b, i) => {
    const t = targets[i % Math.max(1, targets.length)];
    if (!t) return;
    rules.push({ id: ID(), type: 'event', src: b.id, dst: t.id, action: t.kind === 'motor' || i >= targets.length ? 'cycle' : 'toggle' });
  });
  byKind(features, ['lid']).forEach((l) => drives.length && rules.push({ id: ID(), type: 'guard', src: l.id, cond: 'open', dst: ALL }));
  byKind(features, ['tilt']).forEach((t) => drives.length && rules.push({ id: ID(), type: 'guard', src: t.id, cond: 'tilted', dst: ALL }));
  const heaters = byKind(features, ['heater']);
  const boils = byKind(features, ['water']).length > 0; // 물을 끓이는 제품: 정상 100 °C, 공가열만 끊는다
  byKind(features, ['water']).forEach((w) => (heaters.length ? heaters : drives).forEach((h) => rules.push({ id: ID(), type: 'guard', src: w.id, cond: 'empty', dst: h.id })));
  byKind(features, ['temp']).forEach((t) => heaters.forEach((h) => rules.push({ id: ID(), type: 'guard', src: t.id, cond: 'above', value: boils ? 120 : 70, dst: h.id })));
  byKind(features, ['battery']).forEach((b) => drives.length && rules.push({ id: ID(), type: 'guard', src: b.id, cond: 'below', value: 5, dst: ALL }));
  // 버튼이 직접 켜지 않는 표시등은 '동작 중' 표시로
  const buttonTargets = new Set(rules.filter((r) => r.type === 'event').map((r) => r.dst));
  leds.filter((l) => !buttonTargets.has(l.id)).slice(0, 1).forEach((l) => drives.length && rules.push({ id: ID(), type: 'show', src: ALL, dst: l.id }));
  // 조명 제품: 시간 표시는 조명이 켜져 있을 때만, 수면 모드 스위치는 일정, 블루투스 버튼은 페어링
  const lights = byKind(features, ['light']);
  if (lights.length) {
    byKind(features, ['display']).forEach((d) => rules.push({ id: ID(), type: 'show', src: ALL, dst: d.id }));
    const sw = byKind(features, ['switch']).find((f) => /수면|sleep/i.test(f.name)) || byKind(features, ['switch'])[0];
    const front = lights.find((l) => l.face !== 'rear') || lights[0];
    if (sw) rules.push({ id: ID(), type: 'schedule', src: sw.id, dst: ALL, wake_dst: front.id, ...SCHEDULE_DEFAULT });
    buttons.filter((b) => /블루투스|bluetooth|bt|페어링/i.test(b.name)).forEach((b) => {
      const i = rules.findIndex((r) => r.type === 'event' && r.src === b.id);
      const pair = { id: ID(), type: 'event', src: b.id, dst: '', action: 'pair' };
      if (i >= 0) rules[i] = pair; else rules.push(pair);
    });
  }
  return rules;
}

export const newRule = (type, features) => {
  const outs = features.filter((f) => isOutput(f.kind));
  if (type === 'event') return { id: ID(), type, src: byKind(features, ['button'])[0]?.id || '', dst: outs[0]?.id || '', action: 'toggle' };
  if (type === 'show') return { id: ID(), type, src: ALL, dst: byKind(features, SHOW_KINDS)[0]?.id || '' };
  if (type === 'schedule') { const l = byKind(features, ['light']); return { id: ID(), type, src: byKind(features, ['switch'])[0]?.id || '', dst: ALL, wake_dst: (l.find((x) => x.face !== 'rear') || l[0])?.id || '', ...SCHEDULE_DEFAULT }; }
  const src = features.find((f) => Object.values(GUARD_CONDS).some((c) => c.kinds.includes(f.kind)));
  const cond = src ? Object.entries(GUARD_CONDS).find(([, c]) => c.kinds.includes(src.kind))[0] : 'open';
  return { id: ID(), type: 'guard', src: src?.id || '', cond, value: src?.kind === 'temp' ? (features.some((f) => f.kind === 'water') ? 120 : 70) : src?.kind === 'battery' ? 5 : 1650, dst: ALL };
};

/** 지워진 기능을 가리키는 규칙은 뺀다 */
export function validRules(rules, features) {
  const ids = new Set(features.map((f) => f.id));
  return (rules || []).filter((r) => (r.src === ALL || ids.has(r.src)) && (r.dst === ALL || ids.has(r.dst) || (r.type === 'event' && r.action === 'pair')) && (r.type !== 'schedule' || !r.wake_dst || ids.has(r.wake_dst)));
}

const nameOf = (features, id) => (id === ALL ? (features.some((f) => f.kind === 'light') ? '켜져 있는 조명·구동부' : '모든 구동부') : features.find((f) => f.id === id)?.name || '?');
const unitOf = (features, id) => FEATURE_KINDS[features.find((f) => f.id === id)?.kind]?.ble.unit || '';
export function describeRule(r, features) {
  if (r.type === 'event' && r.action === 'pair') return `${nameOf(features, r.src)} 을(를) 누르면 → 블루투스 페어링 (앱 연결)`;
  if (r.type === 'event') return `${nameOf(features, r.src)} 을(를) 누르면 → ${nameOf(features, r.dst)} ${EVENT_ACTIONS[r.action] || r.action}`;
  if (r.type === 'schedule') return `${nameOf(features, r.src)} 이(가) 켜져 있으면 → 취침 ${r.bed} 전 ${r.dim_min}분 동안 ${nameOf(features, r.dst)} 서서히 어둡게 → 소등, 기상 ${r.wake} 전 ${r.rise_min}분 동안 ${nameOf(features, r.wake_dst)} ${r.wake_level}% 까지 서서히 밝게`;
  if (r.type === 'show') return `${nameOf(features, r.src)} 이(가) 동작하면 → ${nameOf(features, r.dst)} 켜기`;
  const c = GUARD_CONDS[r.cond];
  const cond = c?.value ? `${r.value}${unitOf(features, r.src)} ${r.cond === 'above' ? '이상' : '이하'}이면` : c?.label;
  return `${nameOf(features, r.src)} 이(가) ${cond} → ${nameOf(features, r.dst)} 끄기`;
}

// ── 평가 (시뮬레이터) ──
const targetsOf = (dst, features) => (dst === ALL ? features.filter((f) => ALL_TARGET_KINDS.includes(f.kind)) : features.filter((f) => f.id === dst));

/** 버튼이 눌리는 순간: 요청 값(levels)을 바꾼다 */
export function applyPress(buttonId, rules, features, levels) {
  const next = { ...levels };
  rules.filter((r) => r.type === 'event' && r.src === buttonId).forEach((r) => {
    targetsOf(r.dst, features).forEach((f) => {
      const L = OUTPUT_LEVELS[f.kind];
      if (!L) return;
      const cur = Number(next[f.id]) || 0;
      if (r.action === 'on') next[f.id] = L.on;
      else if (r.action === 'off') next[f.id] = 0;
      else if (r.action === 'cycle') { const i = L.steps.indexOf(cur); next[f.id] = i >= 0 ? L.steps[(i + 1) % L.steps.length] : (L.steps.find((x) => x > cur) ?? 0); }
      else next[f.id] = cur > 0 ? 0 : L.on;
    });
  });
  return next;
}

/** 조건(guard) 하나가 지금 맞는가. inputs: { [feature_id]: bool | number } */
export function guardActive(r, inputs) {
  const v = inputs[r.src];
  if (r.cond === 'above') return Number.isFinite(v) && v >= Number(r.value);
  if (r.cond === 'below') return Number.isFinite(v) && v <= Number(r.value);
  return !!v;
}

/** 실제로 내보낼 값: 막힌 출력은 0, 표시 규칙은 켠다. 막은 규칙도 돌려준다 */
export function effectiveLevels(levels, rules, features, inputs) {
  const out = {};
  const blockedBy = {};
  rules.filter((r) => r.type === 'guard' && guardActive(r, inputs)).forEach((r) => targetsOf(r.dst, features).forEach((f) => { (blockedBy[f.id] ||= []).push(r.id); }));
  features.filter((f) => isOutput(f.kind)).forEach((f) => { out[f.id] = blockedBy[f.id] ? 0 : Number(levels[f.id]) || 0; });
  rules.filter((r) => r.type === 'show').forEach((r) => {
    const active = targetsOf(r.src, features).some((f) => out[f.id] > 0);
    const led = features.find((f) => f.id === r.dst);
    if (led && active && !blockedBy[led.id]) out[led.id] = Math.max(out[led.id], OUTPUT_LEVELS[led.kind]?.on || 1);
  });
  return { out, blockedBy };
}
