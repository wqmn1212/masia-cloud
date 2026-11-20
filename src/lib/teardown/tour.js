// 작동 원리 3D 투어: 컨셉 부품(실제 형상)과 기능 목록으로 "어떻게 돌아가는지" 보여 줄 순서를 만든다.
// 형상은 새로 만들지 않는다 — 단계는 부품 id 만 가리킨다. AI 가 쓴 투어·답변도 cleanTour·cleanAnswer 로 실제 부품 id 만 남긴다.
// (서버 base44/shared/teardownTour.ts 의 cleanTour·cleanAnswer 와 같은 규칙. 검산이 둘을 비교한다)
//
// 단계: { id, title, caption, focus:[부품 id] (비면 전체), explode 0~1, view 'solid'|'glass'|'section',
//         camera?: { dir:[x,y,z], zoom }, flows:[{ from, to(부품 id 또는 'out'), kind }], actions:[{ part, kind }], dur(초) }

export const TOUR_VIEWS = ['solid', 'glass', 'section'];
export const VIEW_LABEL = { solid: '실물', glass: '투명 외장', section: '단면' };
export const FLOW_KINDS = {
  power: { label: '전원', color: '#f59e0b' },
  signal: { label: '신호', color: '#0ea5e9' },
  light: { label: '빛', color: '#facc15' },
  air: { label: '바람', color: '#22d3ee' },
  heat: { label: '열', color: '#ef4444' },
  sound: { label: '소리', color: '#a78bfa' },
  water: { label: '물', color: '#3b82f6' },
};
export const ACTION_KINDS = ['glow', 'blink', 'spin', 'turn', 'heat', 'buzz', 'swing', 'press'];
export const MAX_STEPS = 14;

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const num = (v, d) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const shortName = (s) => String(s || '').split(/\s[(—-]/)[0].trim() || String(s || '');
/** 받침 붙이기: 받침이 있으면 '을', 없으면 '를' (한글이 아니면 '을(를)') */
const josa = (word, pair) => {
  const c = String(word || '').trim().slice(-1).charCodeAt(0);
  if (!(c >= 0xac00 && c <= 0xd7a3)) return `${pair[0]}(${pair[1]})`;
  return (c - 0xac00) % 28 ? pair[0] : pair[1];
};
const eul = (w) => `${w}${josa(w, ['을', '를'])}`;
const iga = (w) => `${w}${josa(w, ['이', '가'])}`;
const eun = (w) => `${w}${josa(w, ['은', '는'])}`;
const list = (names, n = 4) => { const u = [...new Set(names.filter(Boolean))]; return u.length > n ? `${u.slice(0, n).join(' · ')} 외 ${u.length - n}개` : u.join(' · '); };

/** 기능 → 출력 동작·흐름 (기능 종류별) */
const OUT_OF = {
  light: { action: 'glow', out: 'light' },
  led: { action: 'blink', out: 'light' },
  display: { action: 'blink', out: 'light' },
  motor: { action: 'spin', out: null },
  heater: { action: 'heat', out: 'heat' },
  buzzer: { action: 'buzz', out: 'sound' },
  servo: { action: 'swing', out: null },
  relay: { action: 'blink', out: null },
};
const IN_OF = { button: 'press', switch: 'press', encoder: 'turn', analog: 'turn', lid: 'press' };
// 기능이 부품에 연결돼 있지 않을 때 부품 이름으로 찾는다
const NAME_HINT = {
  light: /조명|광원|LED\s*모듈|라이트|light|lamp/i,
  led: /표시\s*등|인디케이터|LED/i,
  display: /표시|디스플레이|시계|세그먼트|display/i,
  motor: /모터|팬|송풍|motor|fan/i,
  heater: /히터|발열|heater/i,
  buzzer: /부저|스피커|buzzer|speaker/i,
  servo: /서보|servo/i,
  button: /버튼|button/i,
  switch: /스위치|토글|switch|toggle/i,
  encoder: /다이얼|노브|dial|knob|encoder/i,
  battery: /배터리|전지|battery/i,
};
const AIRY = /팬|송풍|fan|blower|환기/i;
// 주 전원으로 보이는 부품: 잭·어댑터·USB·전원 → 배터리 (시계 유지용 동전 전지는 주 전원이 아니다)
const POWER_PARTS = [/DC\s*잭|어댑터|USB|전원\s*(잭|입력|단자)|jack|adapter/i, /배터리|리튬|battery/i, /전원|충전|케이블|power|cable/i];
const BACKUP_CELL = /동전|코인|CR\d{4}|백업|시계 유지/i;
const PCB_MAIN = /메인|제어|MCU|컨트롤|main|control/i;

// 부품 역할을 설명 뒤에 붙인다 (마침표가 없으면 붙인다)
const roleText = (p) => { const r = str(p?.role, 90); return r ? ` ${r}${/[.!?。]$/.test(r) ? '' : '.'}` : ''; };
const vol = (p) => Math.abs((Number(p.size?.x) || 1) * (Number(p.size?.y) || 1) * (Number(p.size?.z) || 1));

/** 기능이 가리키는 부품 (part_id → 같은 이름 → 이름 힌트) */
export function featurePart(f, parts) {
  if (!f) return null;
  if (f.part_id) { const p = parts.find((x) => x.id === f.part_id); if (p) return p; }
  const same = parts.find((x) => x.name === f.name);
  if (same) return same;
  const re = NAME_HINT[f.kind];
  if (!re) return null;
  return parts.find((x) => x.layer !== 'SHELL' && re.test(x.name || '')) || parts.find((x) => re.test(x.name || '')) || null;
}

/** 기능 목록이 없을 때(컨셉 단계) 부품 이름으로 짐작한 기능 */
export function inferFeatures(parts) {
  const out = [];
  const used = new Set();
  const order = ['light', 'motor', 'heater', 'buzzer', 'servo', 'display', 'encoder', 'button', 'switch'];
  for (const kind of order) {
    for (const p of parts) {
      if (used.has(p.id) || p.layer === 'PCB' || !NAME_HINT[kind].test(p.name || '')) continue;
      if (kind === 'display' && p.layer !== 'UI') continue;
      used.add(p.id);
      out.push({ id: `auto-${p.id}`, kind, name: p.name, part_id: p.id, inferred: true });
    }
  }
  return out;
}

/** 대표 제어 기판 (이름에 메인·제어·MCU → 가장 큰 기판) */
export function mainPcb(parts) {
  const pcbs = parts.filter((p) => p.layer === 'PCB');
  if (!pcbs.length) return null;
  return pcbs.find((p) => PCB_MAIN.test(p.name || '')) || [...pcbs].sort((a, b) => vol(b) - vol(a))[0];
}

const CAPTION_OUT = {
  light: (n, f, pcb) => `${pcb ? `${eun(pcb)} ` : ''}${eul(n)} PWM 으로 켜고 밝기를 조절합니다.${f && Number(f.power_w) > 0 ? ` (정격 ${f.power_w} W)` : ''}`,
  led: (n, f, pcb) => `${iga(n)} 상태를 빛으로 알려 줍니다.${pcb ? ` ${iga(pcb)} 밝기와 깜빡임을 정합니다.` : ''}`,
  display: (n) => `${iga(n)} 시간·상태를 숫자로 보여 줍니다.`,
  motor: (n, f, pcb, airy) => `${pcb ? `${iga(pcb)} ` : ''}${eul(n)} 돌립니다. 속도는 PWM 으로 조절합니다.${airy ? ' 돌면서 바람을 밀어냅니다.' : ''}`,
  heater: (n, f) => `${iga(n)} 전기를 열로 바꿉니다.${f && Number(f.power_w) > 0 ? ` (정격 ${f.power_w} W)` : ''} 온도 센서로 과열을 막습니다.`,
  buzzer: (n) => `${iga(n)} 소리로 알림을 줍니다.`,
  servo: (n) => `${iga(n)} 정해진 각도로 움직입니다.`,
  relay: (n) => `${iga(n)} 큰 전류가 흐르는 회로를 켜고 끕니다.`,
};
const CAPTION_IN = {
  button: (n, pcb) => `${eul(n)} 누르면 신호가 ${pcb || '제어 기판'}으로 전달됩니다.`,
  switch: (n, pcb) => `${eul(n)} 켜고 끄면 ${pcb || '제어 기판'}이 상태를 읽습니다.`,
  encoder: (n, pcb) => `${eul(n)} 돌리거나 누르면 ${pcb || '제어 기판'}이 방향과 횟수를 읽습니다.`,
  analog: (n, pcb) => `${eul(n)} 돌리면 ${pcb || '제어 기판'}이 값을 읽습니다.`,
  lid: (n) => `${iga(n)} 열리면 감지 스위치가 신호를 보냅니다.`,
};

/**
 * 기본 투어: 전체 → 외장 → 안쪽 → 제어 기판 → 조작부(입력) → 동작부(출력) → 분해
 * @param {{ parts, features?, title?, overall?, supplyV? }} input
 */
export function buildDefaultTour({ parts = [], features = [], title = '', overall = null, supplyV = null } = {}) {
  const P = (parts || []).filter((p) => p && p.id);
  if (!P.length) return { title: title || '작동 원리', source: 'default', steps: [] };
  const name = (p) => shortName(p?.name);
  const ids = (arr) => arr.map((p) => p.id);
  const shell = P.filter((p) => p.layer === 'SHELL');
  const inner = P.filter((p) => ['INTERNAL', 'PCB'].includes(p.layer));
  const ui = P.filter((p) => p.layer === 'UI');
  const pcb = mainPcb(P);
  const power = POWER_PARTS.map((re) => P.find((p) => p.layer !== 'SHELL' && p.id !== pcb?.id && re.test(p.name || '') && !BACKUP_CELL.test(p.name || ''))).find(Boolean);
  const feats = (features?.length ? features : inferFeatures(P)).map((f) => ({ f, part: featurePart(f, P) })).filter((x) => x.part);
  const steps = [];
  const sizeText = overall && overall.x ? `약 ${Math.round(overall.x)} × ${Math.round(overall.z)} × ${Math.round(overall.y)} mm, ` : '';

  steps.push({
    id: 'overview', title: title ? shortName(title) : '제품 전체',
    caption: `${sizeText}부품 ${P.length}개로 이루어져 있습니다. 어떻게 동작하는지 차례로 보여 드립니다.`,
    focus: [], explode: 0, view: 'solid', camera: { dir: [1, 0.55, 1.25], zoom: 1 }, flows: [], actions: [],
  });
  if (shell.length) {
    const mats = [...new Set(shell.map((p) => p.material).filter(Boolean))];
    steps.push({
      id: 'shell', title: '겉모양 (외장)',
      caption: `${list(shell.map(name))}${mats.length ? ` — ${list(mats, 3)}` : ''}. 손에 닿고 눈에 보이는 부분입니다.`,
      focus: ids(shell), explode: 0, view: 'solid', camera: { dir: [-1, 0.4, 1.2], zoom: 1 }, flows: [], actions: [],
    });
  }
  if (inner.length && shell.length) {
    steps.push({
      id: 'inside', title: '안을 들여다보면',
      caption: `외장을 투명하게 하면 안쪽에 ${list(inner.map(name), 5)}${josa(list(inner.map(name), 5), ['이', '가'])} 들어 있습니다.`,
      focus: ids(inner), explode: 0, view: 'glass', flows: [], actions: [],
    });
  }
  const outs = feats.filter((x) => OUT_OF[x.f.kind]);
  const ins = feats.filter((x) => IN_OF[x.f.kind]);
  if (pcb) {
    const flows = power ? [{ from: power.id, to: pcb.id, kind: 'power' }] : [];
    const outNames = list(outs.map((x) => name(x.part)), 3);
    steps.push({
      id: 'pcb', title: name(pcb),
      caption: `${eun(name(pcb))} 제품의 두뇌입니다. ${ins.length ? '조작 신호를 읽고 ' : ''}${outNames ? `${eul(outNames)} 제어합니다.` : '각 부품을 제어합니다.'}${supplyV ? ` 전원은 ${supplyV} V 입니다.` : power ? ` ${name(power)}에서 전원을 받습니다.` : ''}`,
      focus: [pcb.id, ...(power ? [power.id] : [])], explode: 0.25, view: 'glass', flows, actions: [],
    });
  }
  const pcbName = pcb ? name(pcb) : '';
  const seen = new Set();
  ins.slice(0, 3).forEach(({ f, part }) => {
    if (seen.has(part.id)) return; seen.add(part.id);
    const n = name(part);
    steps.push({
      id: `in-${part.id}`, title: `${n} (조작)`,
      caption: (CAPTION_IN[f.kind] || CAPTION_IN.button)(n, pcbName) + roleText(part),
      focus: [part.id, ...(pcb ? [pcb.id] : [])], explode: 0.1, view: part.layer === 'UI' || part.layer === 'SHELL' ? 'solid' : 'glass',
      flows: pcb ? [{ from: part.id, to: pcb.id, kind: 'signal' }] : [], actions: [{ part: part.id, kind: IN_OF[f.kind] }],
    });
  });
  outs.slice(0, 5).forEach(({ f, part }) => {
    if (seen.has(part.id)) return; seen.add(part.id);
    const n = name(part);
    const o = OUT_OF[f.kind];
    const airy = f.kind === 'motor' && AIRY.test(`${part.name} ${part.role || ''}`);
    const flows = [];
    if (pcb) flows.push({ from: pcb.id, to: part.id, kind: 'power' });
    if (o.out) flows.push({ from: part.id, to: 'out', kind: o.out });
    if (airy) flows.push({ from: part.id, to: 'out', kind: 'air' });
    // 같은 부품에 조명이 여럿이면(따뜻한 빛·밝은 빛) 함께 소개한다
    const twins = feats.filter((x) => x.part.id === part.id && x.f !== f && x.f.kind === f.kind).map((x) => shortName(x.f.name));
    steps.push({
      id: `out-${part.id}`, title: twins.length ? `${n} — ${[shortName(f.name), ...twins].join(' · ')}` : n,
      caption: (CAPTION_OUT[f.kind] || CAPTION_OUT.relay)(n, f, pcbName, airy) + roleText(part),
      focus: [part.id, ...(pcb && f.kind !== 'display' ? [pcb.id] : [])], explode: part.layer === 'SHELL' ? 0 : 0.15,
      view: part.layer === 'SHELL' || part.layer === 'UI' ? 'solid' : shell.length ? 'glass' : 'solid', flows, actions: [{ part: part.id, kind: o.action }],
    });
  });
  if (ui.length && !ins.length) {
    steps.push({
      id: 'ui', title: '조작·표시부', caption: `${list(ui.map(name))} — 사용자가 만지고 보는 부분입니다.`,
      focus: ids(ui), explode: 0, view: 'solid', flows: pcb ? ui.slice(0, 3).map((p) => ({ from: p.id, to: pcb.id, kind: 'signal' })) : [], actions: [],
    });
  }
  const count = (l) => P.filter((p) => p.layer === l).length;
  const parts2 = [['외장', count('SHELL')], ['기판', count('PCB')], ['내부', count('INTERNAL')], ['조작부', count('UI')], ['기타', count('OTHER')]].filter(([, c]) => c).map(([k, c]) => `${k} ${c}`).join(' · ');
  steps.push({
    id: 'explode', title: '분해해 보면', caption: `부품 ${P.length}개 — ${parts2}. 다시 조립하면 처음 모습이 됩니다.`,
    focus: [], explode: 1, view: 'solid', camera: { dir: [1.5, 0.7, 0.9], zoom: 1.15 }, flows: [], actions: [],
  });
  return cleanTour({ title: title || '작동 원리', source: 'default', steps }, P);
}

/** 시스템 버튼: 외장·조작부·기판·내부 + 기능별 (단계와 같은 모양) */
export function buildSystems({ parts = [], features = [] } = {}) {
  const P = (parts || []).filter((p) => p && p.id);
  const pcb = mainPcb(P);
  const out = [];
  const layer = (key, label, L, view) => {
    const ids = P.filter((p) => p.layer === L).map((p) => p.id);
    if (ids.length) out.push({ id: key, title: label, caption: `${label}: ${list(P.filter((p) => p.layer === L).map((p) => shortName(p.name)), 6)}`, focus: ids, explode: L === 'SHELL' ? 0 : 0.2, view, flows: [], actions: [] });
  };
  layer('sys-shell', '외장', 'SHELL', 'solid');
  layer('sys-ui', '조작부', 'UI', 'solid');
  layer('sys-pcb', '기판', 'PCB', 'glass');
  layer('sys-inner', '내부 부품', 'INTERNAL', 'glass');
  const feats = (features?.length ? features : inferFeatures(P)).map((f) => ({ f, part: featurePart(f, P) })).filter((x) => x.part);
  const seen = new Set();
  feats.forEach(({ f, part }) => {
    const o = OUT_OF[f.kind];
    const i = IN_OF[f.kind];
    if ((!o && !i) || seen.has(`${f.kind}:${part.id}`)) return;
    seen.add(`${f.kind}:${part.id}`);
    const flows = [];
    if (pcb && o) flows.push({ from: pcb.id, to: part.id, kind: 'power' });
    if (o?.out) flows.push({ from: part.id, to: 'out', kind: o.out });
    if (pcb && i) flows.push({ from: part.id, to: pcb.id, kind: 'signal' });
    out.push({
      id: `sys-${f.kind}-${part.id}`, title: shortName(f.name || part.name), kind: f.kind,
      caption: o ? (CAPTION_OUT[f.kind] || CAPTION_OUT.relay)(shortName(part.name), f, pcb ? shortName(pcb.name) : '', false) : (CAPTION_IN[f.kind] || CAPTION_IN.button)(shortName(part.name), pcb ? shortName(pcb.name) : ''),
      focus: [part.id, ...(pcb ? [pcb.id] : [])], explode: 0.15, view: part.layer === 'SHELL' || part.layer === 'UI' ? 'solid' : 'glass',
      flows, actions: [{ part: part.id, kind: o?.action || i }],
    });
  });
  return out.map((s) => cleanStep(s, new Set(P.map((p) => p.id)), 0)).filter(Boolean);
}

/** 단계에 붙일 정격값 (기능에 적은 값 기준 — 실제 측정값이 아니다) */
export function stepSpecs(step, { parts = [], features = [], supplyV = null } = {}) {
  if (!step) return [];
  const P = parts || [];
  const out = [];
  const ids = new Set([...(step.actions || []).map((a) => a.part), ...(step.focus || [])]);
  (features || []).forEach((f) => {
    const part = featurePart(f, P);
    if (!part || !ids.has(part.id)) return;
    const n = shortName(f.name);
    if (f.kind === 'light' || f.kind === 'heater') { if (Number(f.power_w) > 0) out.push({ label: n, value: `${f.power_w} W` }); }
    if (f.kind === 'light' && Number(f.cct) > 0) out.push({ label: `${n} 색온도`, value: `${f.cct} K` });
    if (Number.isInteger(f.pin)) out.push({ label: `${n} 핀`, value: `GPIO${f.pin}` });
  });
  if (supplyV && (step.flows || []).some((fl) => fl.kind === 'power')) out.unshift({ label: '전원', value: `${supplyV} V` });
  return out.slice(0, 6);
}

/** 단계 하나 정리: 실제 부품 id 만, 값 범위 고정. 제목·설명이 다 비면 null */
export function cleanStep(s, idSet, i = 0) {
  if (!s || typeof s !== 'object') return null;
  const title = str(s.title, 60);
  const caption = str(s.caption, 500);
  if (!title && !caption) return null;
  const focus = [...new Set((Array.isArray(s.focus) ? s.focus : []).map((x) => str(x, 80)).filter((x) => idSet.has(x)))].slice(0, 40);
  const flows = (Array.isArray(s.flows) ? s.flows : []).map((f) => ({ from: str(f?.from, 80), to: str(f?.to, 80), kind: str(f?.kind, 20) }))
    .filter((f) => idSet.has(f.from) && (f.to === 'out' || idSet.has(f.to)) && f.from !== f.to && FLOW_KINDS[f.kind]).slice(0, 8);
  const actions = (Array.isArray(s.actions) ? s.actions : []).map((a) => ({ part: str(a?.part, 80), kind: str(a?.kind, 20) }))
    .filter((a) => idSet.has(a.part) && ACTION_KINDS.includes(a.kind)).slice(0, 6);
  const dir = Array.isArray(s.camera?.dir) && s.camera.dir.length === 3 ? s.camera.dir.map((v) => num(v, 0)) : null;
  const camera = dir && Math.hypot(...dir) > 1e-3 ? { dir: dir.map((v) => Math.round(v * 1000) / 1000), zoom: clamp(num(s.camera.zoom, 1), 0.4, 3) } : null;
  const dur = clamp(num(s.dur, 2.8 + caption.length / 16), 2.5, 15);
  return {
    id: str(s.id, 60) || `s${i + 1}`, title: title || `단계 ${i + 1}`, caption, focus,
    explode: clamp(num(s.explode, 0), 0, 1), view: TOUR_VIEWS.includes(s.view) ? s.view : 'solid',
    ...(camera ? { camera } : {}), flows, actions, dur: Math.round(dur * 10) / 10,
  };
}

/** 투어 정리: AI·사용자가 만든 투어에서 없는 부품·잘못된 값을 걸러 낸다 */
export function cleanTour(tour, parts) {
  const idSet = new Set((parts || []).map((p) => p?.id).filter(Boolean));
  const steps = (Array.isArray(tour?.steps) ? tour.steps : []).slice(0, MAX_STEPS * 2).map((s, i) => cleanStep(s, idSet, i)).filter(Boolean).slice(0, MAX_STEPS);
  const used = new Set();
  steps.forEach((s, i) => { if (used.has(s.id)) s.id = `${s.id}-${i + 1}`; used.add(s.id); });
  return {
    title: str(tour?.title, 80) || '작동 원리',
    source: ['ai', 'default', 'edited'].includes(tour?.source) ? tour.source : 'ai',
    ...(str(tour?.at, 40) ? { at: str(tour.at, 40) } : {}),
    ...(str(tour?.by, 80) ? { by: str(tour.by, 80) } : {}),
    ...(Number.isFinite(Number(tour?.version)) && tour?.version != null ? { version: Number(tour.version) } : {}),
    steps,
  };
}

/** 질문 답변 정리: { answer, step (보여 줄 3D 장면), unknown } */
export function cleanAnswer(ans, parts) {
  const idSet = new Set((parts || []).map((p) => p?.id).filter(Boolean));
  const answer = str(ans?.answer, 1500);
  const step = cleanStep({ ...(ans?.step || {}), title: str(ans?.step?.title, 60) || '답변', caption: answer || str(ans?.step?.caption, 500) }, idSet, 0);
  return { answer, step, unknown: ans?.unknown === true, sources: (Array.isArray(ans?.sources) ? ans.sources : []).map((x) => str(x, 120)).filter(Boolean).slice(0, 6) };
}

/** 투어가 지금 부품과 맞는가: 가리키는 부품 중 사라진 것 수 */
export function tourMissing(tour, parts) {
  const idSet = new Set((parts || []).map((p) => p?.id));
  const arr = (v) => (Array.isArray(v) ? v : []);
  let miss = 0;
  arr(tour?.steps).forEach((s) => {
    if (!s || typeof s !== 'object') return;
    [...arr(s.focus), ...arr(s.flows).flatMap((f) => [f?.from, f?.to]).filter((x) => x !== 'out'), ...arr(s.actions).map((a) => a?.part)]
      .forEach((id) => { if (!idSet.has(id)) miss += 1; });
  });
  return miss;
}
