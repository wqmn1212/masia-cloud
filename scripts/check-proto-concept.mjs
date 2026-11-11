// 시제품 컨셉 검산: 형상 정리·금형 규칙 계산과 서버 함수(prototypeConcept)의 권한·참고 자료 업로드·렌더 이미지 규칙.
// 실행: npm run check:proto-concept
import assert from 'node:assert/strict';
import { cleanScene } from '../base44/shared/protoConcept.ts';
import { moldRuleChecks } from '../base44/shared/protoMold.ts';

// ── 형상 정리: id 는 서버가 p1.. 로, 범위 밖 값은 자르고, 잘못된 값은 기본값
const scene = cleanScene({
  overall_mm: { x: 120, y: 80 },
  parts: [
    { name: '본체', layer: 'SHELL', shape: 'cylinder', size: { x: 100, y: 80 }, position: { x: 1e9, y: -3 }, color: 'red', finish: 'shiny' },
    { name: '크기 없음' },
    { name: '버튼', layer: 'NOPE', shape: 'star', size: { x: 0, y: 99999, z: 5 }, rotation_deg: { x: 720 }, color: '#00ff00' },
  ],
});
assert.deepEqual(scene.parts.map((p) => p.id), ['p1', 'p2'], '크기 없는 부품은 버리고 id 를 다시 붙인다');
assert.deepEqual(scene.parts[0].size, { x: 100, y: 80, z: 100 }, 'z 가 없으면 x 와 같게');
assert.equal(scene.parts[0].position.x, 5000, '좌표는 ±5000mm 로 자른다');
assert.equal(scene.parts[0].color, '#b9c2d0', '색은 #RRGGBB 만');
assert.equal(scene.parts[0].finish, 'matte');
assert.deepEqual([scene.parts[1].layer, scene.parts[1].shape], ['OTHER', 'box'], '모르는 구분·도형은 기본값');
assert.deepEqual(scene.parts[1].size, { x: 0.1, y: 5000, z: 5 });
assert.equal(scene.parts[1].rotation_deg.x, 360);
assert.deepEqual(scene.overall_mm, { x: 120, y: 80, z: 120 });
assert.equal(cleanScene({ parts: Array.from({ length: 60 }, () => ({ size: { x: 1, y: 1 } })) }).parts.length, 40, '부품은 40개까지');
assert.equal(cleanScene(null).parts.length, 0);

// ── 금형 규칙 계산
let m = moldRuleChecks({ material: 'ABS', length_mm: 120, width_mm: 80, height_mm: 60, wall_mm: 2, wall_max_mm: 3.5, rib_mm: 1.6, draft_deg: 0.8, texture_depth_mm: 0.05 });
assert.deepEqual(m.checks.map((c) => `${c.severity}:${c.category}`), ['HIGH:SINK', 'MEDIUM:SINK', 'MEDIUM:DRAFT'], '두께 편차·리브·구배');
assert.equal(m.metrics.draft_required_deg, 3.5, '높이 50mm 초과 1.5° + 부식 0.05mm(0.025mm당 1°) 2°');
assert.equal(m.metrics.rib_max_mm, 1.2);
assert.deepEqual(m.metrics.shrink_mm, [0.48, 0.84]);
assert.deepEqual(m.unknowns, []);
m = moldRuleChecks({ material: 'PP', wall_mm: 0.6, draft_deg: 0.2, undercuts: '측면 걸림 홈' });
assert.ok(m.checks.some((c) => c.severity === 'HIGH' && c.category === 'THICKNESS'), 'PP 최소 살 0.8mm 미만');
assert.ok(m.checks.some((c) => c.severity === 'HIGH' && c.category === 'DRAFT'), '구배 0.5° 미만');
assert.ok(m.checks.some((c) => c.category === 'UNDERCUT'));
assert.equal(m.unknowns.length, 1, '가로·세로가 없으면 유동 길이비는 미확인');
m = moldRuleChecks({ material: 'PC', length_mm: 400, width_mm: 300, height_mm: 20, wall_mm: 1.2 });
assert.ok(m.checks.some((c) => c.severity === 'HIGH' && c.category === 'FLOW'), `PC 유동 길이비 초과 (${m.metrics.flow_ratio})`);
assert.equal(moldRuleChecks({ material: 'XYZ' }).metrics.material_name, 'ABS', '모르는 재질은 ABS 기준');
assert.equal(moldRuleChecks({}).unknowns.length, 3);
console.log('proto-concept modules ok');

// ── 서버 함수
const call = async (body) => {
  const m = await import('../base44/functions/prototypeConcept/entry.ts');
  const res = await m.default(new Request('https://x', { method: 'POST', body: JSON.stringify(body) }));
  return { status: res.status, data: await res.json() };
};
const STAFF = { id: 'u1', full_name: '왕리', account_tier: 'sub', tenant_id: 't1' };
const OTHER = { id: 'u2', full_name: '남', account_tier: 'service', tenant_id: 't2' };
const CLIENT = { id: 'u3', full_name: '고객', account_tier: 'client', tenant_id: 't9' };
globalThis.__db = {
  ProtoProject: [{ id: 'victim', tenant_id: 't2', title: '남의 시제품', files: [{ id: 'vf', name: 'secret.png', uri: 'private://secret.png', category: 'DRAWING' }] }],
  ProtoConcept: [],
};
const calls = { llm: [], img: [] };
const SCENE = { summary: '원통형 공기청정기', overall_mm: { x: 120, y: 200 }, parts: [{ name: '외장', layer: 'SHELL', shape: 'cylinder', size: { x: 120, y: 200 }, position: { x: 0, y: 100, z: 0 } }, { name: '팬', layer: 'INTERNAL', shape: 'cylinder', size: { x: 80, y: 30 }, position: { x: 0, y: 150, z: 0 } }], assumptions: ['높이 200mm 로 가정'] };
globalThis.__llm = (a) => {
  calls.llm.push(a);
  const keys = Object.keys(a.response_json_schema.properties);
  if (keys.includes('questions')) return { title: '미니 공기청정기', summary: '책상용', questions: [{ question: '높이는?', why: '형상', default_assumption: '200mm' }], assumptions: ['USB 전원으로 가정'] };
  if (keys.includes('parts')) return SCENE;
  if (keys.includes('actuators')) return { summary: '팬 1개', actuators: [{ id: 'fan', label: '팬', kind: 'PUMP_FAN', rated_voltage_v: 5, rated_current_a: 0.3, value_source: 'ASSUMED' }], steps: [{ name: '운전', duration_s: 10, states: [{ actuator_id: 'fan', on: true }] }], assumptions: ['팬 0.3A 로 가정'] };
  if (keys.includes('verdict')) return { verdict: 'MAYBE', summary: '보완 필요', findings: [{ part_id: 'p1', category: 'DRAFT', severity: 'HIGH', title: '구배' }, { part_id: 'zzz', category: 'NOPE', title: '모르는 위치' }] };
  throw new Error('unexpected schema');
};
let imgFail = false;
globalThis.__img = (a) => { calls.img.push(a); if (imgFail) throw new Error('quota'); return { url: `https://img.example/r${calls.img.length}.png` }; };
const b64 = (s) => Buffer.from(s).toString('base64');

globalThis.__user = null;
assert.equal((await call({ action: 'brief', idea: '공기청정기' })).status, 401);
globalThis.__user = CLIENT;
assert.equal((await call({ action: 'brief', idea: '공기청정기' })).status, 403, '고객 계정은 쓸 수 없다');
globalThis.__user = STAFF;
assert.equal((await call({ action: 'nope' })).status, 400);
assert.equal((await call({ action: 'brief', idea: 'abc' })).status, 400, '아이디어가 너무 짧음');
assert.equal((await call({ action: 'brief', idea: '공기청정기', project_id: 'victim' })).status, 404, '다른 팀 시제품에는 붙일 수 없다');

// 참고 자료: 서버가 직접 올린 파일만 쓰고, 화면이 보낸 파일 주소(files)는 무시한다
let r = await call({
  action: 'brief', idea: '책상 위 원통형 미니 공기청정기', title: '',
  files: [{ id: 'x', name: 'secret.png', uri: 'private://secret.png', category: 'REFERENCE' }],
  uploads: [{ name: 'sketch.png', type: 'image/png', data: b64('png') }, { name: 'notes.docx', type: 'application/msword', data: b64('doc') }],
});
assert.equal(r.status, 200, JSON.stringify(r.data));
const project = globalThis.__db.ProtoProject.find((p) => p.id === r.data.project_id);
assert.equal(project.tenant_id, 't1');
assert.deepEqual(project.files.map((f) => [f.name, f.uri, f.category]), [['sketch.png', 'private://sketch.png', 'REFERENCE']], '서버가 올린 사진만, 문서·남의 주소는 제외');
assert.deepEqual(calls.llm[0].file_urls, ['https://files.example/private://sketch.png'], 'AI 에는 서버가 올린 파일만 서명해서 준다');
let concept = r.data.concept;
assert.deepEqual([concept.version_no, concept.status, concept.questions[0].id], [1, 'BRIEF', 'q1']);

// 3D 프리뷰: 형상만 저장하고 렌더는 이어서 render 로 만든다 (한 요청에 묶으면 실행 시간 제한에 걸린다)
r = await call({ action: 'generate', concept_id: concept.id, answers: [{ id: 'q1', answer: '180mm' }] });
assert.equal(r.status, 200, JSON.stringify(r.data));
concept = r.data.concept;
assert.deepEqual([concept.status, concept.questions[0].answer, concept.preview.parts.length], ['READY', '180mm', 2]);
assert.deepEqual([concept.preview.render_url, concept.preview.render_pending, r.data.render_pending], ['', true, true]);
assert.equal(calls.img.length, 0, 'generate 는 이미지를 만들지 않는다');
r = await call({ action: 'render', concept_id: concept.id });
assert.equal(r.status, 200, JSON.stringify(r.data));
concept = r.data.concept;
assert.deepEqual([concept.preview.render_url, concept.preview.render_version, concept.preview.render_pending], ['https://img.example/r1.png', 1, false]);
assert.equal(calls.img[0].existing_image_urls, undefined, '첨부 사진이 없으면 참고 이미지를 넣지 않는다');

// 다른 팀은 컨셉을 다룰 수 없다
globalThis.__user = OTHER;
assert.equal((await call({ action: 'render', concept_id: concept.id })).status, 404);
globalThis.__user = STAFF;

// 회로 검토는 다음 버전에서 '형상이 바뀜'으로 넘어간다
assert.equal((await call({ action: 'circuit', concept_id: concept.id, inputs: {} })).status, 400, '공급 전압 필수');
r = await call({ action: 'circuit', concept_id: concept.id, inputs: { supply_voltage_v: 5, supply_limit_a: 1 } });
assert.equal(r.status, 200, JSON.stringify(r.data));
assert.deepEqual(r.data.concept.circuit.actuators.map((a) => [a.id, a.value_source]), [['a1', 'ASSUMED']], '부하 id 는 서버가 다시 붙인다');
assert.equal(r.data.concept.circuit.steps[0].states[0].actuator_id, 'a1');
assert.ok(r.data.concept.circuit.calc, '전류·전력은 앱이 계산');

// 변경 요청: 형상만 새로 만들고 렌더 이미지는 만들지 않는다 (이전 렌더를 v1 기준으로 남김)
r = await call({ action: 'revise', concept_id: concept.id, change_request: '높이를 20mm 줄여 주세요' });
assert.equal(r.status, 200, JSON.stringify(r.data));
const v2 = r.data.concept;
assert.equal(calls.img.length, 1, '변경 때는 이미지 생성을 하지 않는다');
assert.deepEqual([v2.version_no, v2.based_on_id, v2.preview.render_url, v2.preview.render_version], [2, concept.id, 'https://img.example/r1.png', 1]);
assert.equal(v2.circuit.stale, true);

// 렌더 요청: 지금 버전 기준으로 다시 만든다
r = await call({ action: 'render', concept_id: v2.id });
assert.equal(r.status, 200, JSON.stringify(r.data));
assert.deepEqual([r.data.concept.preview.render_url, r.data.concept.preview.render_version], ['https://img.example/r2.png', 2]);
assert.match(calls.img[1].prompt, /높이를 20mm 줄여 주세요/, '변경 요청이 렌더 설명에 들어간다');
imgFail = true;
r = await call({ action: 'render', concept_id: v2.id });
assert.equal(r.status, 502);
const after = globalThis.__db.ProtoConcept.find((c) => c.id === v2.id);
assert.equal(after.preview.render_url, 'https://img.example/r2.png', '실패해도 기존 렌더는 남긴다');
assert.match(after.preview.render_error, /quota/);
imgFail = false;

// 사진을 첨부한 변경: 새 버전은 바로 저장하고, 렌더는 그 사진을 참고 이미지로 넣어 이어서 만든다
const filesBefore = globalThis.__db.ProtoProject.find((p) => p.id === project.id).files.length;
const photo = { name: 'new-look.jpg', type: 'image/jpeg', data: b64('jpeg-bytes') };
r = await call({ action: 'revise', concept_id: v2.id, change_request: '', uploads: [photo, { name: 'spec.pdf', type: 'application/pdf', data: b64('pdf') }] });
assert.equal(r.status, 200, JSON.stringify(r.data));
const v3 = r.data.concept;
const imgCount = calls.img.length;
assert.equal(imgCount, 3, '변경 요청 안에서는 이미지를 만들지 않는다');
assert.match(v3.change_request, /새로 첨부한 자료/, '글 없이 자료만 올려도 변경 요청이 된다');
assert.deepEqual([v3.preview.render_pending, r.data.render_pending, v3.preview.render_url, v3.preview.render_ref_ids.length], [true, true, 'https://img.example/r2.png', 1], '사진만 참고 이미지로, 이전 렌더는 남긴다');
let files = globalThis.__db.ProtoProject.find((p) => p.id === project.id).files;
assert.equal(files.length, filesBefore + 2);
const photoFile = files.find((f) => f.id === v3.preview.render_ref_ids[0]);
assert.equal(photoFile.name, 'new-look.jpg');
r = await call({ action: 'render', concept_id: v3.id });
assert.equal(r.status, 200, JSON.stringify(r.data));
assert.deepEqual(calls.img[imgCount].existing_image_urls, [`https://files.example/${photoFile.uri}`], '첨부 사진을 참고 이미지로 넣는다');
assert.deepEqual([r.data.concept.preview.render_version, r.data.concept.preview.render_pending], [3, false]);
// 같은 파일로 다시 시도해도 프로젝트 파일에 두 번 저장하지 않는다
r = await call({ action: 'revise', concept_id: v3.id, change_request: '색을 조금 더 밝게', uploads: [photo] });
assert.equal(r.status, 200, JSON.stringify(r.data));
files = globalThis.__db.ProtoProject.find((p) => p.id === project.id).files;
assert.equal(files.length, filesBefore + 2, '이름·크기가 같은 파일은 다시 쓴다');
assert.deepEqual(r.data.concept.preview.render_ref_ids, [photoFile.id]);
// PDF 만 올린 변경은 렌더를 다시 만들지 않는다
r = await call({ action: 'revise', concept_id: v3.id, change_request: '', uploads: [{ name: 'spec2.pdf', type: 'application/pdf', data: b64('pdf2') }] });
assert.deepEqual([r.data.concept.preview.render_pending, r.data.render_pending], [false, false]);

// 사출·금형 검토: 판정·위치·분류를 정리하고 규칙 계산을 붙인다
r = await call({ action: 'mold', concept_id: v2.id, inputs: { material: 'ABS', wall_mm: 2, draft_deg: 0.2 } });
assert.equal(r.status, 200, JSON.stringify(r.data));
const mold = r.data.concept.mold;
assert.equal(mold.verdict, 'CONDITIONAL', '모르는 판정은 보완 후 진행');
assert.deepEqual(mold.findings.map((f) => [f.part_id, f.category, f.severity]), [['p1', 'DRAFT', 'HIGH'], ['', 'OTHER', 'MEDIUM']]);
assert.ok(mold.rules.checks.some((c) => c.category === 'DRAFT'));
console.log('proto-concept functions ok');
