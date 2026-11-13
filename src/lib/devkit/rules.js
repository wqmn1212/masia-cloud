// 동작 규칙: 버튼·센서 입력 → 출력(구동부). 동작 시뮬레이터와 ESP32 펌웨어가 같은 규칙을 쓴다.
//  event : 버튼을 누르면(눌리는 순간) 출력을 켜고 끄기·켜기·끄기·단계 바꾸기
//  guard : 조건이 맞는 동안 출력을 강제로 끈다 (뚜껑 열림, 넘어짐, 온도 이상, 배터리 부족, 버튼을 누르는 동안)
//  show  : 출력(또는 모든 구동부)이 동작하는 동안 표시등을 켠다
import { FEATURE_KINDS, OUTPUT_LEVELS, DRIVE_KINDS, isOutput } from './features.js';

const ID = () => Math.random().toString(36).slice(2, 9);
export const ALL = '*';

export const EVENT_ACTIONS = { toggle: '켜고 끄기', cycle: '단계 바꾸기', on: '켜기', off: '끄기' };
export const GUARD_CONDS = {
  open: { label: '열려 있으면', kinds: ['lid'] },
  tilted: { label: '기울어지면', kinds: ['tilt'] },
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
  buttons.forEach((b, i) => {
    const t = targets[i % Math.max(1, targets.length)];
    if (!t) return;
    rules.push({ id: ID(), type: 'event', src: b.id, dst: t.id, action: t.kind === 'motor' ? 'cycle' : 'toggle' });
  });
  byKind(features, ['lid']).forEach((l) => drives.length && rules.push({ id: ID(), type: 'guard', src: l.id, cond: 'open', dst: ALL }));
  byKind(features, ['tilt']).forEach((t) => drives.length && rules.push({ id: ID(), type: 'guard', src: t.id, cond: 'tilted', dst: ALL }));
  const heaters = byKind(features, ['heater']);
  byKind(features, ['temp']).forEach((t) => heaters.forEach((h) => rules.push({ id: ID(), type: 'guard', src: t.id, cond: 'above', value: 70, dst: h.id })));
  byKind(features, ['battery']).forEach((b) => drives.length && rules.push({ id: ID(), type: 'guard', src: b.id, cond: 'below', value: 5, dst: ALL }));
  // 버튼이 직접 켜지 않는 표시등은 '동작 중' 표시로
  const buttonTargets = new Set(rules.filter((r) => r.type === 'event').map((r) => r.dst));
  leds.filter((l) => !buttonTargets.has(l.id)).slice(0, 1).forEach((l) => drives.length && rules.push({ id: ID(), type: 'show', src: ALL, dst: l.id }));
  return rules;
}

export const newRule = (type, features) => {
  const outs = features.filter((f) => isOutput(f.kind));
  if (type === 'event') return { id: ID(), type, src: byKind(features, ['button'])[0]?.id || '', dst: outs[0]?.id || '', action: 'toggle' };
  if (type === 'show') return { id: ID(), type, src: ALL, dst: byKind(features, ['led'])[0]?.id || '' };
  const src = features.find((f) => Object.values(GUARD_CONDS).some((c) => c.kinds.includes(f.kind)));
  const cond = src ? Object.entries(GUARD_CONDS).find(([, c]) => c.kinds.includes(src.kind))[0] : 'open';
  return { id: ID(), type: 'guard', src: src?.id || '', cond, value: src?.kind === 'temp' ? 70 : src?.kind === 'battery' ? 5 : 1650, dst: ALL };
};

/** 지워진 기능을 가리키는 규칙은 뺀다 */
export function validRules(rules, features) {
  const ids = new Set(features.map((f) => f.id));
  return (rules || []).filter((r) => (r.src === ALL || ids.has(r.src)) && (r.dst === ALL || ids.has(r.dst)));
}

const nameOf = (features, id) => (id === ALL ? '모든 구동부' : features.find((f) => f.id === id)?.name || '?');
const unitOf = (features, id) => FEATURE_KINDS[features.find((f) => f.id === id)?.kind]?.ble.unit || '';
export function describeRule(r, features) {
  if (r.type === 'event') return `${nameOf(features, r.src)} 을(를) 누르면 → ${nameOf(features, r.dst)} ${EVENT_ACTIONS[r.action] || r.action}`;
  if (r.type === 'show') return `${nameOf(features, r.src)} 이(가) 동작하면 → ${nameOf(features, r.dst)} 켜기`;
  const c = GUARD_CONDS[r.cond];
  const cond = c?.value ? `${r.value}${unitOf(features, r.src)} ${r.cond === 'above' ? '이상' : '이하'}이면` : c?.label;
  return `${nameOf(features, r.src)} 이(가) ${cond} → ${nameOf(features, r.dst)} 끄기`;
}

// ── 평가 (시뮬레이터) ──
const targetsOf = (dst, features) => (dst === ALL ? features.filter((f) => DRIVE_KINDS.includes(f.kind)) : features.filter((f) => f.id === dst));

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
