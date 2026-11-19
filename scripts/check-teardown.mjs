// 작동 원리 3D 검산: 기본 투어(실제 컨셉 부품 v3 조명), 부분별 보기, AI 투어·답변 정리(없는 부품 걸러 내기),
// 화면(src/lib/teardown/tour.js)과 서버(base44/shared/teardownTour.ts)의 정리 규칙이 같은지, 서버 tour·explain 동작, 고객 공개 스냅숏.
// 실행: npm run check:teardown
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as C from '../src/lib/teardown/tour.js';
import * as S from '../base44/shared/teardownTour.ts';
import { modelSnapshot, clientView } from '../base44/shared/protoClient.ts';

let n = 0;
const ok = async (name, fn) => { await fn(); n++; console.log('✓', name); };
const fx = JSON.parse(fs.readFileSync(new URL('./fixtures/renight-v3.json', import.meta.url), 'utf8'));
const parts = fx.parts;
const ids = new Set(parts.map((p) => p.id));
const allIds = (s) => [...s.focus, ...s.flows.flatMap((f) => [f.from, f.to]).filter((x) => x !== 'out'), ...s.actions.map((a) => a.part)];

await ok('기본 투어: 전체 → 외장 → 안쪽 → 기판 → 조작 → 동작 → 분해, 실제 부품 id 만', () => {
  const t = C.buildDefaultTour({ parts, features: fx.dev.features, title: fx.title, overall: fx.overall_mm, supplyV: 12 });
  const sid = t.steps.map((s) => s.id);
  assert.equal(sid[0], 'overview');
  assert.equal(sid.at(-1), 'explode');
  assert.deepEqual(sid.slice(1, 4), ['shell', 'inside', 'pcb']);
  assert.ok(t.steps.length <= C.MAX_STEPS);
  t.steps.forEach((s) => allIds(s).forEach((id) => assert.ok(ids.has(id), `${s.id}: ${id}`)));
  assert.equal(t.steps.at(-1).explode, 1);
  assert.equal(t.steps[0].focus.length, 0, '첫 단계는 전체');
  const pcb = t.steps.find((s) => s.id === 'pcb');
  assert.deepEqual(pcb.flows, [{ from: 'u_jack', to: 'i_pcb', kind: 'power' }], '주 전원은 DC 잭 (시계 유지용 동전 전지가 아니다)');
  assert.match(pcb.caption, /12 V/);
  const light = t.steps.find((s) => s.id === 'out-b_front');
  assert.deepEqual(light.actions, [{ part: 'b_front', kind: 'glow' }]);
  assert.ok(light.flows.some((f) => f.to === 'out' && f.kind === 'light'));
  assert.ok(t.steps.some((s) => s.id === 'in-u_toggle'), '기능의 part_id 가 옛 부품(u_knob)이어도 같은 이름으로 찾는다');
  assert.ok(!t.steps.some((s) => s.actions.some((a) => a.part === 'b_rear')), '이번 형상에 없는 후면 조명은 뺀다');
  assert.ok(t.steps.find((s) => s.id === 'in-u_dial').actions[0].kind === 'turn');
  assert.ok(t.steps.every((s) => s.dur >= 2.5 && s.dur <= 15));
});

await ok('기능 목록이 없을 때(컨셉 단계): 부품 이름으로 짐작 — 동전 전지는 표시부로 보지 않는다', () => {
  const t = C.buildDefaultTour({ parts, title: fx.title });
  const titles = t.steps.map((s) => s.title);
  assert.ok(titles.includes('호박색 도트 시계'));
  assert.ok(!titles.some((x) => /동전/.test(x)));
  const f = C.inferFeatures(parts);
  assert.ok(f.every((x) => x.inferred && ids.has(x.part_id)));
  assert.equal(C.buildDefaultTour({ parts: [] }).steps.length, 0);
});

await ok('부분별 보기 + 단계 정격값', () => {
  const sys = C.buildSystems({ parts, features: fx.dev.features });
  const t = sys.map((s) => s.title);
  ['외장', '조작부', '기판', '내부 부품'].forEach((x) => assert.ok(t.includes(x), x));
  assert.ok(sys.every((s) => allIds(s).every((id) => ids.has(id))));
  const tour = C.buildDefaultTour({ parts, features: fx.dev.features, supplyV: 12 });
  const specs = C.stepSpecs(tour.steps.find((s) => s.id === 'out-b_front'), { parts, features: fx.dev.features, supplyV: 12 });
  assert.deepEqual(specs.map((s) => s.value), ['12 V', '5 W', '4000 K', 'GPIO11']);
});

// AI 가 흔히 틀리는 모양: 없는 부품, 잘못된 종류, 범위 밖 값, 빈 단계, 중복 id
const messy = {
  title: '  레나잇 작동 원리  ', source: 'hacker', by: '직원', at: '2026-11-19T00:00:00Z',
  steps: [
    { id: 'a', title: '전체', caption: '공 모양 조명입니다.', focus: [], view: 'glass', explode: 3, camera: { dir: [0, 0, 0], zoom: 9 } },
    { id: 'a', title: '빛', caption: '앞면이 빛납니다.', focus: ['b_front', 'ghost', 'b_front'], flows: [{ from: 'i_pcb', to: 'b_front', kind: 'power' }, { from: 'b_front', to: 'out', kind: 'light' }, { from: 'ghost', to: 'out', kind: 'light' }, { from: 'i_pcb', to: 'b_front', kind: 'plasma' }], actions: [{ part: 'b_front', kind: 'glow' }, { part: 'b_front', kind: 'explode' }], view: 'xray', dur: 99 },
    { title: '', caption: '' },
    { title: '분해', explode: -1, camera: { dir: [1, '0.5', 1], zoom: 0.1 } },
    null, 'x',
  ],
};
await ok('AI 투어 정리: 없는 부품·종류는 버리고 값은 범위 안으로', () => {
  const t = C.cleanTour(messy, parts);
  assert.equal(t.title, '레나잇 작동 원리');
  assert.equal(t.source, 'ai');
  assert.equal(t.steps.length, 3, '빈 단계·잘못된 항목은 빠진다');
  const [a, b, c] = t.steps;
  assert.equal(a.explode, 1); assert.equal(a.camera, undefined, '방향이 0 이면 카메라 지정 없음');
  assert.notEqual(a.id, b.id, '중복 id 는 바꾼다');
  assert.deepEqual(b.focus, ['b_front']);
  assert.deepEqual(b.flows, [{ from: 'i_pcb', to: 'b_front', kind: 'power' }, { from: 'b_front', to: 'out', kind: 'light' }]);
  assert.deepEqual(b.actions, [{ part: 'b_front', kind: 'glow' }]);
  assert.equal(b.view, 'solid'); assert.equal(b.dur, 15);
  assert.equal(c.explode, 0); assert.deepEqual(c.camera, { dir: [1, 0.5, 1], zoom: 0.4 });
  assert.equal(C.tourMissing(messy, parts), 2, 'ghost 2곳');
});

await ok('화면과 서버의 정리 규칙이 같다 (투어·답변, 무작위 입력 300개)', () => {
  assert.deepEqual(S.cleanTour(messy, parts), C.cleanTour(messy, parts));
  const pick = (arr, r) => arr[Math.floor(r * arr.length)];
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pool = [...ids, 'ghost', 'out', '', null, 5];
  for (let i = 0; i < 300; i++) {
    const step = () => ({
      id: pick(['x', 'y', '', null], rnd()), title: pick(['제목', '', '  긴 제목'.repeat(20)], rnd()), caption: pick(['설명', '', 'ㄱ'.repeat(700)], rnd()),
      focus: Array.from({ length: Math.floor(rnd() * 5) }, () => pick(pool, rnd())),
      flows: Array.from({ length: Math.floor(rnd() * 4) }, () => ({ from: pick(pool, rnd()), to: pick(pool, rnd()), kind: pick(['power', 'light', 'x', 'heat'], rnd()) })),
      actions: Array.from({ length: Math.floor(rnd() * 3) }, () => ({ part: pick(pool, rnd()), kind: pick(['glow', 'spin', 'fly'], rnd()) })),
      explode: pick([0, 0.5, 2, -1, '0.3', null], rnd()), view: pick(['solid', 'glass', 'section', 'x'], rnd()),
      camera: rnd() > 0.5 ? { dir: [rnd() - 0.5, rnd(), pick([1, 'a', null], rnd())], zoom: pick([1, 0, 5, null], rnd()) } : undefined, dur: pick([1, 5, 30, null, 'x'], rnd()),
    });
    const tour = { title: pick(['t', '', null], rnd()), source: pick(['ai', 'edited', 'x'], rnd()), steps: Array.from({ length: Math.floor(rnd() * 18) }, step) };
    assert.deepEqual(S.cleanTour(tour, parts), C.cleanTour(tour, parts), `tour #${i}`);
    const ans = { answer: pick(['답', '', null], rnd()), unknown: rnd() > 0.5, sources: [pick(['a', 3, ''], rnd())], step: step() };
    assert.deepEqual(S.cleanAnswer(ans, parts), C.cleanAnswer(ans, parts), `answer #${i}`);
  }
  assert.deepEqual(S.FLOW_KINDS, C.FLOW_KINDS); assert.deepEqual(S.ACTION_KINDS, C.ACTION_KINDS); assert.deepEqual(S.TOUR_VIEWS, C.TOUR_VIEWS);
});

await ok('고객 공개 스냅숏: 투어를 정리해서 싣고 만든 사람 이름은 뺀다', () => {
  const snap = modelSnapshot({ dev: fx.dev, parts, title: fx.title, overall_mm: fx.overall_mm, tour: messy });
  assert.equal(snap.tour.steps.length, 3);
  assert.equal(snap.tour.by, undefined);
  assert.equal(modelSnapshot({ dev: fx.dev, parts }).tour, undefined, '투어가 없으면 고객 화면이 기본 투어를 만든다');
  const view = clientView({ id: 'p', title: 't', client_share: { model: { on: true, at: 'x', ...snap } } });
  assert.equal(view.model.tour.steps.length, 3);
});

// ── 서버: tour·explain
const call = async (body) => {
  const m = await import('../base44/functions/prototypeConcept/entry.ts');
  const res = await m.default(new Request('https://x', { method: 'POST', body: JSON.stringify(body) }));
  return { status: res.status, data: await res.json() };
};
globalThis.__user = { id: 'u1', full_name: '왕리', account_tier: 'sub', tenant_id: 't1' };
globalThis.__db = {
  ProtoProject: [{ id: 'pp', tenant_id: 't1', title: '레나잇', dev: fx.dev, files: [] }],
  ProtoConcept: [{ id: 'cc', project_id: 'pp', tenant_id: 't1', version_no: 3, preview: { title: fx.title, summary: '공 모양 수면 조명', parts, overall_mm: fx.overall_mm, design_notes: ['좌표: 바닥 중심'], render_url: 'https://r.example/x.png' } }],
};
const prompts = [];
let reply = null;
globalThis.__llm = (a) => { prompts.push(a.prompt); return reply; };

await ok('서버 tour: AI 투어를 정리해 이 컨셉에 저장 (버전·렌더는 그대로), 고친 투어 저장, 기본 투어로 되돌리기', async () => {
  reply = { title: 'AI 투어', steps: [...messy.steps, { title: '시계', caption: '시계가 보입니다', focus: ['b_clock'] }] };
  let r = await call({ action: 'tour', concept_id: 'cc', ask: '수면 모드 위주로' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const t = r.data.concept.preview.tour;
  assert.equal(t.source, 'ai'); assert.equal(t.version, 3); assert.equal(t.by, '왕리'); assert.equal(t.steps.length, 4);
  assert.equal(r.data.concept.preview.render_url, 'https://r.example/x.png', '렌더는 그대로');
  assert.equal(globalThis.__db.ProtoConcept.length, 1, '새 버전을 만들지 않는다');
  const p = prompts.at(-1);
  assert.match(p, /수면 모드 위주로/); assert.match(p, /b_front/); assert.match(p, /전면 기상등/); assert.match(p, /12 V/);
  assert.doesNotMatch(p, /"color"/, 'AI 에게는 색·도형 수치 대신 이름·역할·위치만');
  reply = { steps: [{ title: '하나', caption: 'ghost', focus: ['ghost'] }] };
  r = await call({ action: 'tour', concept_id: 'cc' });
  assert.equal(r.status, 502, '쓸 수 있는 단계가 너무 적으면 저장하지 않는다');
  assert.equal(globalThis.__db.ProtoConcept[0].preview.tour.source, 'ai');
  r = await call({ action: 'tour', concept_id: 'cc', tour: { steps: [{ title: '내가 고친 단계', focus: ['i_pcb', 'nope'] }] } });
  assert.equal(r.data.concept.preview.tour.source, 'edited');
  assert.deepEqual(r.data.concept.preview.tour.steps[0].focus, ['i_pcb']);
  r = await call({ action: 'tour', concept_id: 'cc', reset: true });
  assert.equal(r.data.concept.preview.tour, null);
});

await ok('서버 explain: 질문 → 답 + 3D 장면 (없는 부품 걸러 냄, 저장 안 함), 빈 질문·남의 팀 막기', async () => {
  reply = { answer: '다이얼을 돌리면 제어 기판이 LED 판 밝기를 PWM 으로 바꿉니다.', unknown: false, sources: ['다이얼 (오른쪽 뒤, 밝기)'], step: { title: '밝기 조절', focus: ['u_dial', 'i_pcb', 'ghost'], flows: [{ from: 'u_dial', to: 'i_pcb', kind: 'signal' }], actions: [{ part: 'u_dial', kind: 'turn' }], view: 'glass' } };
  const before = JSON.stringify(globalThis.__db);
  let r = await call({ action: 'explain', concept_id: 'cc', question: '밝기는 어떻게 바꿔요?', current: '제어 기판' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual(r.data.step.focus, ['u_dial', 'i_pcb']);
  assert.equal(r.data.step.caption, reply.answer, '장면 설명은 답 그대로');
  assert.match(prompts.at(-1), /밝기는 어떻게 바꿔요/); assert.match(prompts.at(-1), /\[지금 화면\] 제어 기판/);
  assert.equal(JSON.stringify(globalThis.__db), before, '답은 저장하지 않는다');
  r = await call({ action: 'explain', concept_id: 'cc', question: '   ' });
  assert.equal(r.status, 400);
  globalThis.__user = { id: 'u2', full_name: '남', account_tier: 'service', tenant_id: 't2' };
  r = await call({ action: 'explain', concept_id: 'cc', question: '보여줘' });
  assert.equal(r.status, 404, '다른 팀 컨셉은 찾을 수 없다');
  globalThis.__user = { id: 'u3', full_name: '고객', account_tier: 'client', tenant_id: 't1' };
  r = await call({ action: 'explain', concept_id: 'cc', question: '보여줘' });
  assert.equal(r.status, 403, '고객 계정은 직원용 질문 답변을 쓸 수 없다');
});

console.log(`teardown ok (${n})`);
