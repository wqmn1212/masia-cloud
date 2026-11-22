// 부품 빼 보기: 어떤 부품이 빠지면 어떤 기능이 멈추는지와 그 이유.
// 전원·제어는 부품 이름·층으로 자동으로 찾고, 제품 기능(공기 정화·안개·야간 보기 등)은 제품 정의의 needs 로 판단한다.
// 버튼을 눌렀을 때의 실제 동작(단계·전압·과부하)은 가상 시제품(deviceSim)이 계산한다 — 여기는 "부품이 있느냐"만 본다.

const POWER_RE = /배터리|battery|USB|전원\s*입력|DC\s*잭|어댑터/i;
const CONTROL_RE = /메인\s*기판|제어\s*기판|MCU|마이컴|controller/i;
const shortName = (s) => String(s || '').split(/\s[(—-]/)[0].trim() || String(s || '');
const josa = (w, a, b) => { const c = String(w).trim().slice(-1).charCodeAt(0); if (!(c >= 0xac00 && c <= 0xd7a3)) return `${w}${a}(${b})`; return `${w}${(c - 0xac00) % 28 ? a : b}`; };

/** 전원 부품 (외장은 뺀다 — '배터리 덮개' 같은 것) */
export const powerParts = (parts) => (parts || []).filter((p) => p.layer !== 'SHELL' && POWER_RE.test(`${p.name} ${p.id}`));
/** 제어 부품: 이름에 메인·제어 기판·MCU 가 있는 것, 없으면 PCB 층에서 전원 부품이 아닌 가장 큰 것 */
export function controlParts(parts) {
  const named = (parts || []).filter((p) => p.layer !== 'SHELL' && CONTROL_RE.test(p.name || ''));
  if (named.length) return named;
  const vol = (p) => (Number(p.size?.x) || 1) * (Number(p.size?.y) || 1) * (Number(p.size?.z) || 1);
  const pcb = (parts || []).filter((p) => p.layer === 'PCB' && !POWER_RE.test(`${p.name} ${p.id}`)).sort((a, b) => vol(b) - vol(a))[0];
  return pcb ? [pcb] : [];
}

/**
 * product: { parts, features, functions }
 *  functions: [{ id, name, desc, feature?, needs: [{ ids:[부품 id], any?:true, why }] | '@power' | '@control', flows?, actions? }]
 * removed: 뺀 부품 id 들
 * → { power, control, features: {id:{ok, reason}}, functions: [{ id, name, desc, ok, reasons:[] }] }
 */
export function evaluate(product, removed = []) {
  const gone = new Set(removed);
  const parts = product.parts || [];
  const byId = new Map(parts.map((p) => [p.id, p]));
  const nm = (id) => shortName(byId.get(id)?.name || id);
  const pw = powerParts(parts);
  const pwLeft = pw.filter((p) => !gone.has(p.id));
  const power = {
    ok: pwLeft.length > 0,
    via: pwLeft.map((p) => shortName(p.name)),
    battery: pwLeft.some((p) => /배터리|battery/i.test(p.name)),
    usb: pwLeft.some((p) => /USB|어댑터|DC/i.test(p.name)),
    reason: pw.length && !pwLeft.length ? `전원 부품(${pw.map((p) => shortName(p.name)).join(' · ')})을 모두 빼서 켜지지 않습니다` : !pw.length ? '전원 부품이 정해지지 않았습니다' : '',
  };
  const ctl = controlParts(parts);
  const ctlLeft = ctl.filter((p) => !gone.has(p.id));
  const control = {
    ok: ctl.length > 0 && ctlLeft.length === ctl.length,
    reason: ctl.length && ctlLeft.length < ctl.length ? `${josa(ctl.filter((p) => gone.has(p.id)).map((p) => shortName(p.name)).join(' · '), '이', '가')} 없어 버튼을 눌러도 반응하지 않습니다` : '',
  };

  // 기능(전기): 버튼·출력·센서
  const feats = {};
  (product.features || []).forEach((f) => {
    const reasons = [];
    if (!power.ok) reasons.push(power.reason);
    else if (!control.ok && f.kind !== 'battery') reasons.push(control.reason);
    if (f.part_id && gone.has(f.part_id)) reasons.push(`${josa(nm(f.part_id), '이', '가')} 빠져 ${shortName(f.name)} 기능이 없습니다`);
    feats[f.id] = { ok: !reasons.length, reason: reasons[0] || '' };
  });
  // 출력을 켜는 버튼이 모두 빠졌으면 그 출력은 켤 수 없다
  const rules = product.rules || [];
  (product.features || []).forEach((f) => {
    const srcs = rules.filter((r) => r.type === 'event' && r.dst === f.id).map((r) => r.src);
    if (srcs.length && feats[f.id]?.ok && srcs.every((id) => !feats[id]?.ok)) {
      const b = (product.features || []).find((x) => x.id === srcs[0]);
      feats[f.id] = { ok: false, reason: `켜는 ${shortName(b?.name || '버튼')}이 없어 켤 수 없습니다` };
    }
  });

  // 제품 기능
  const functions = (product.functions || []).map((fn) => {
    const reasons = [];
    (fn.needs || []).forEach((n) => {
      if (n === '@power') { if (!power.ok) reasons.push(power.reason); return; }
      if (n === '@control') { if (!control.ok && power.ok) reasons.push(control.reason); return; }
      const ids = (n.ids || []).filter((id) => byId.has(id));
      const missing = ids.filter((id) => gone.has(id));
      const fail = n.any ? missing.length === ids.length && ids.length > 0 : missing.length > 0;
      if (fail) reasons.push(n.why || `${josa(missing.map(nm).join(' · '), '이', '가')} 없습니다`);
    });
    if (fn.feature && feats[fn.feature] && !feats[fn.feature].ok && !reasons.includes(feats[fn.feature].reason)) reasons.push(feats[fn.feature].reason);
    return { id: fn.id, name: fn.name, desc: fn.desc, ok: !reasons.length, reasons: [...new Set(reasons)] };
  });
  return { power, control, features: feats, functions };
}

/** 이 부품을 (지금 상태에서 더) 빼면 새로 안 되는 기능들 */
export function impactOf(product, removed, id) {
  const now = evaluate(product, removed);
  const after = evaluate(product, [...new Set([...removed, id])]);
  const okNow = new Set(now.functions.filter((f) => f.ok).map((f) => f.id));
  return after.functions.filter((f) => !f.ok && okNow.has(f.id));
}

/** 빼 볼 수 있는 부품 (외장·장식은 빼도 기능이 같으므로 기능에 쓰이는 부품만) */
export function removableParts(product) {
  const ids = new Set();
  powerParts(product.parts).forEach((p) => ids.add(p.id));
  controlParts(product.parts).forEach((p) => ids.add(p.id));
  (product.features || []).forEach((f) => f.part_id && ids.add(f.part_id));
  (product.functions || []).forEach((fn) => (fn.needs || []).forEach((n) => (n.ids || []).forEach((id) => ids.add(id))));
  return (product.parts || []).filter((p) => ids.has(p.id));
}

const ACTION_OF = { light: 'glow', led: 'glow', display: 'glow', motor: 'spin', heater: 'heat', buzzer: 'buzz', servo: 'swing' };

/**
 * 3D 에 보일 동작: 켜진 출력(sim out > 0)이면서 부품이 있고 기능이 살아 있는 것만.
 * 제품 기능의 흐름(fn.flows)·동작(fn.actions)은 그 기능이 되고 연결된 출력이 켜졌을 때 보인다. 뺀 부품을 지나는 흐름은 그리지 않는다.
 */
export function liveStep(product, check, out = {}, removed = []) {
  const gone = new Set(removed);
  const here = (id) => id === 'out' || !gone.has(id);
  const actions = []; const flows = [];
  const ctl = controlParts(product.parts).find((p) => !gone.has(p.id));
  const src = powerParts(product.parts).find((p) => !gone.has(p.id));
  const on = (f) => Number(out[f.id]) > 0 && check.features[f.id]?.ok && f.part_id && !gone.has(f.part_id);
  (product.features || []).forEach((f) => {
    if (!on(f)) return;
    if (ACTION_OF[f.kind]) actions.push({ part: f.part_id, kind: ACTION_OF[f.kind] });
    if (ctl && ctl.id !== f.part_id) flows.push({ from: ctl.id, to: f.part_id, kind: 'power' });
    if (f.kind === 'light') flows.push({ from: f.part_id, to: 'out', kind: 'light' });
  });
  if (flows.length && src && ctl && src.id !== ctl.id) flows.unshift({ from: src.id, to: ctl.id, kind: 'power' });
  (product.functions || []).forEach((fn) => {
    const ok = check.functions.find((x) => x.id === fn.id)?.ok;
    if (!ok || (fn.feature && !(Number(out[fn.feature]) > 0))) return;
    (fn.flows || []).filter((fl) => here(fl.from) && here(fl.to)).forEach((fl) => flows.push(fl));
    (fn.actions || []).filter((a) => here(a.part)).forEach((a) => actions.push(a));
  });
  const key = (x) => JSON.stringify(x);
  const uniq = (xs) => xs.filter((x, i) => xs.findIndex((y) => key(y) === key(x)) === i);
  return { id: 'live', title: '', caption: '', focus: [], flows: uniq(flows), actions: uniq(actions) };
}
