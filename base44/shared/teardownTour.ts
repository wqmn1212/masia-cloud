// 작동 원리 3D 투어 (서버): AI 가 쓴 투어·질문 답변을 실제 부품 id 만 남기게 정리한다.
// 화면 src/lib/teardown/tour.js 의 cleanStep·cleanTour·cleanAnswer 와 같은 규칙 (npm run check:teardown 이 비교한다).
// AI 는 설명과 순서만 쓴다. 형상(부품 모양·위치)은 컨셉 부품 그대로 쓰고 새로 만들지 않는다.

export const TOUR_VIEWS = ['solid', 'glass', 'section'];
export const VIEW_LABEL = { solid: '실물', glass: '투명 외장', section: '단면' };
export const FLOW_KINDS: Record<string, { label: string; color: string }> = {
  power: { label: '전원', color: '#f59e0b' },
  signal: { label: '신호', color: '#0ea5e9' },
  light: { label: '빛', color: '#facc15' },
  air: { label: '바람', color: '#22d3ee' },
  heat: { label: '열', color: '#ef4444' },
  sound: { label: '소리', color: '#a78bfa' },
  water: { label: '물', color: '#3b82f6' },
};
export const ACTION_KINDS: string[] = ['glow', 'blink', 'spin', 'turn', 'heat', 'buzz', 'swing', 'press'];
export const MAX_STEPS = 14;

const str = (v: any, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const num = (v: any, d: number) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** 단계 하나 정리: 실제 부품 id 만, 값 범위 고정. 제목·설명이 다 비면 null */
export function cleanStep(s: any, idSet: Set<string>, i = 0): any {
  if (!s || typeof s !== 'object') return null;
  const title = str(s.title, 60);
  const caption = str(s.caption, 500);
  if (!title && !caption) return null;
  const focus = [...new Set((Array.isArray(s.focus) ? s.focus : []).map((x: any) => str(x, 80)).filter((x: string) => idSet.has(x)))].slice(0, 40);
  const flows = (Array.isArray(s.flows) ? s.flows : []).map((f: any) => ({ from: str(f?.from, 80), to: str(f?.to, 80), kind: str(f?.kind, 20) }))
    .filter((f: any) => idSet.has(f.from) && (f.to === 'out' || idSet.has(f.to)) && f.from !== f.to && FLOW_KINDS[f.kind]).slice(0, 8);
  const actions = (Array.isArray(s.actions) ? s.actions : []).map((a: any) => ({ part: str(a?.part, 80), kind: str(a?.kind, 20) }))
    .filter((a: any) => idSet.has(a.part) && ACTION_KINDS.includes(a.kind)).slice(0, 6);
  const dir = Array.isArray(s.camera?.dir) && s.camera.dir.length === 3 ? s.camera.dir.map((v: any) => num(v, 0)) : null;
  const camera = dir && Math.hypot(...dir) > 1e-3 ? { dir: dir.map((v: number) => Math.round(v * 1000) / 1000), zoom: clamp(num(s.camera.zoom, 1), 0.4, 3) } : null;
  const dur = clamp(num(s.dur, 2.8 + caption.length / 16), 2.5, 15);
  return {
    id: str(s.id, 60) || `s${i + 1}`, title: title || `단계 ${i + 1}`, caption, focus,
    explode: clamp(num(s.explode, 0), 0, 1), view: TOUR_VIEWS.includes(s.view) ? s.view : 'solid',
    ...(camera ? { camera } : {}), flows, actions, dur: Math.round(dur * 10) / 10,
  };
}

/** 투어 정리: AI·사용자가 만든 투어에서 없는 부품·잘못된 값을 걸러 낸다 */
export function cleanTour(tour: any, parts: any[]): any {
  const idSet = new Set((parts || []).map((p: any) => p?.id).filter(Boolean));
  const steps = (Array.isArray(tour?.steps) ? tour.steps : []).slice(0, MAX_STEPS * 2).map((s: any, i: number) => cleanStep(s, idSet, i)).filter(Boolean).slice(0, MAX_STEPS);
  const used = new Set();
  steps.forEach((s: any, i: number) => { if (used.has(s.id)) s.id = `${s.id}-${i + 1}`; used.add(s.id); });
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
export function cleanAnswer(ans: any, parts: any[]): any {
  const idSet = new Set((parts || []).map((p: any) => p?.id).filter(Boolean));
  const answer = str(ans?.answer, 1500);
  const step = cleanStep({ ...(ans?.step || {}), title: str(ans?.step?.title, 60) || '답변', caption: answer || str(ans?.step?.caption, 500) }, idSet, 0);
  return { answer, step, unknown: ans?.unknown === true, sources: (Array.isArray(ans?.sources) ? ans.sources : []).map((x: any) => str(x, 120)).filter(Boolean).slice(0, 6) };
}


const stepProps = {
  id: { type: 'string' }, title: { type: 'string' }, caption: { type: 'string' },
  focus: { type: 'array', items: { type: 'string' } },
  explode: { type: 'number' }, view: { type: 'string', enum: TOUR_VIEWS },
  camera: { type: 'object', properties: { dir: { type: 'array', items: { type: 'number' } }, zoom: { type: 'number' } } },
  flows: { type: 'array', items: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, kind: { type: 'string', enum: Object.keys(FLOW_KINDS) } } } },
  actions: { type: 'array', items: { type: 'object', properties: { part: { type: 'string' }, kind: { type: 'string', enum: ACTION_KINDS } } } },
  dur: { type: 'number' },
};
export const TOUR_SCHEMA = { type: 'object', properties: { title: { type: 'string' }, steps: { type: 'array', items: { type: 'object', properties: stepProps } } } };
export const ANSWER_SCHEMA = {
  type: 'object',
  properties: { answer: { type: 'string' }, unknown: { type: 'boolean' }, sources: { type: 'array', items: { type: 'string' } }, step: { type: 'object', properties: stepProps } },
};

const RULES = `[3D 장면 규칙]
- 부품은 위 [부품] 의 id 로만 가리킨다. 목록에 없는 부품·기능을 지어내지 않는다.
- focus: 이 장면에서 강조할 부품 id (비우면 제품 전체). 다른 부품은 흐리게 보인다.
- view: solid(실물) · glass(외장을 투명하게 — 안쪽 부품을 보여 줄 때) · section(외장을 세로로 잘라 단면 — 앞뒤로 쌓인 구조를 보여 줄 때).
- explode: 0(조립) ~ 1(완전 분해). 안쪽 부품을 떼어 보여 줄 때 0.2~0.6, 전체 구성을 보여 줄 때 1.
- flows: 부품 사이 흐름 {from, to, kind}. to 가 'out' 이면 그 부품에서 바깥으로 나간다(빛·바람·열·소리). kind: power(전원) signal(신호) light(빛) air(바람) heat(열) sound(소리) water(물).
- actions: 부품 동작 {part, kind}. glow(빛남) blink(깜빡임) spin(회전) turn(다이얼 돌림) heat(발열) buzz(진동) swing(각도 움직임) press(누름).
- camera 는 쓰지 않아도 된다 (앱이 강조 부품 쪽으로 맞춘다). 쓰면 dir 은 제품 중심에서 카메라 쪽 방향 [x, y, z] (+x 오른쪽, +y 위, +z 앞).
- 설명(caption)은 고객이 듣는 쉬운 한국어 한두 문장. 부품 이름·역할·재질·기능 값은 주어진 자료에 있는 것만 쓰고, 자료에 없는 수치는 쓰지 않는다.`;

/** 투어 만들기 프롬프트 */
export function tourPrompt(ctx: { title: string; summary: string; parts: any[]; features: any[]; supplyV: any; notes: string[]; ask: string }) {
  return `너는 제품 개발 회사의 엔지니어다. 고객 미팅에서 제품이 "어떻게 동작하는지" 3D 로 설명하는 자동 투어의 순서와 설명을 쓴다.
투어는 앱이 컨셉 3D 부품으로 그대로 재생한다: 각 단계마다 카메라가 강조 부품으로 움직이고, 보기 방식·분해 정도·전원/신호/빛 흐름·부품 동작이 바뀌며 설명이 나온다.

[제품] ${ctx.title}
[요약] ${ctx.summary}
[부품] ${JSON.stringify(ctx.parts).slice(0, 14000)}
[기능] ${JSON.stringify(ctx.features).slice(0, 5000)}
${ctx.supplyV ? `[공급 전압] ${ctx.supplyV} V\n` : ''}${ctx.notes.length ? `[설계 메모] ${ctx.notes.join(' / ').slice(0, 3000)}\n` : ''}${ctx.ask ? `[요청] ${ctx.ask}\n` : ''}
${RULES}

[투어 구성]
- 6~10 단계. 첫 단계는 제품 전체(focus 비움, solid, explode 0), 마지막 단계는 전체 분해(explode 1)로 끝낸다.
- 사용자가 실제로 하는 순서(전원 → 켜기 → 조작 → 동작 → 안전 장치)를 따라, 각 기능이 어떤 부품에서 시작해 어디로 이어지는지 흐름으로 보여 준다.
- 한 단계에 하나의 이야기만. dur(초)는 설명 길이에 맞춰 4~9.`;
}

/** 질문 답변 프롬프트 */
export function explainPrompt(ctx: { title: string; summary: string; parts: any[]; features: any[]; supplyV: any; notes: string[]; question: string; current: string }) {
  return `너는 제품 개발 회사의 엔지니어다. 고객 미팅 중 받은 질문에 답하고, 답을 3D 장면 하나로 보여 준다.

[제품] ${ctx.title}
[요약] ${ctx.summary}
[부품] ${JSON.stringify(ctx.parts).slice(0, 14000)}
[기능] ${JSON.stringify(ctx.features).slice(0, 5000)}
${ctx.supplyV ? `[공급 전압] ${ctx.supplyV} V\n` : ''}${ctx.notes.length ? `[설계 메모] ${ctx.notes.join(' / ').slice(0, 3000)}\n` : ''}${ctx.current ? `[지금 화면] ${ctx.current}\n` : ''}
[질문] ${ctx.question}

${RULES}

[답변]
- answer: 질문에 대한 답 2~4문장. 자료로 답할 수 없는 부분은 "아직 정해지지 않았습니다" 처럼 솔직히 말하고 unknown 을 true 로 한다. 추측한 내용은 (추정)이라고 붙인다.
- sources: 답의 근거가 된 자료 항목 (부품 이름·기능 이름·설계 메모).
- step: 답을 보여 줄 장면 하나 (title 은 짧게, focus·view·explode·flows·actions).`;
}

/** AI 에게 줄 부품 요약 (모양 수치는 위치 판단에 필요한 만큼만) */
export const partsBrief = (parts: any[]) => (parts || []).map((p: any) => ({
  id: p.id, name: p.name, layer: p.layer, role: p.role || undefined, material: p.material || undefined,
  position: p.position ? { x: Math.round(Number(p.position.x) || 0), y: Math.round(Number(p.position.y) || 0), z: Math.round(Number(p.position.z) || 0) } : undefined,
}));
export const featuresBrief = (features: any[]) => (Array.isArray(features) ? features : []).slice(0, 40).map((f: any) => ({
  id: f.id, kind: f.kind, name: f.name, part_id: f.part_id || undefined, power_w: f.power_w || undefined, cct: f.cct || undefined, note: f.note || undefined,
}));
