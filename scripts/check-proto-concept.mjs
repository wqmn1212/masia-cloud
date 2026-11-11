// 시제품 컨셉 검산: 형상 정리·금형 규칙 계산과 서버 함수(prototypeConcept)의 권한·참고 자료 업로드·렌더 이미지 규칙.
// 실행: npm run check:proto-concept
import assert from 'node:assert/strict';
import { cleanScene } from '../base44/shared/protoConcept.ts';
import { moldRuleChecks } from '../base44/shared/protoMold.ts';
import { compareSketch, koFix } from '../base44/shared/protoSketch.ts';
import { buildConceptGroup } from '../src/lib/conceptScene.js';
import { imageSize, cleanVision, measureVision, fitScene, visionHint, sceneBounds } from '../base44/shared/protoVision.ts';

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
// ── 이미지 크기 읽기: PNG·JPEG(EXIF 회전)·WebP
const png = (w, h) => { const b = new Uint8Array(40); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); const v = new DataView(b.buffer); v.setUint32(16, w); v.setUint32(20, h); return b; };
assert.deepEqual(imageSize(png(600, 400)), { w: 600, h: 400 });
const jpeg = (w, h, orient) => {
  const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orient, 0, 0, 0, 0, 0, 0];
  const app1 = [0xff, 0xe1, 0, exif.length + 2, ...exif];
  const sof = [0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  return new Uint8Array([0xff, 0xd8, ...app1, ...sof, 0, 0, 0, 0]);
};
assert.deepEqual(imageSize(jpeg(400, 300, 1)), { w: 400, h: 300 });
assert.deepEqual(imageSize(jpeg(400, 300, 6)), { w: 300, h: 400 }, '휴대폰 세로 사진(EXIF 회전)은 가로·세로를 바꾼다');
const webp = new Uint8Array(40); webp.set([...'RIFF'].map((c) => c.charCodeAt(0))); webp.set([...'WEBPVP8X'].map((c) => c.charCodeAt(0)), 8); webp.set([0xff, 0x03, 0x00, 0xc7, 0x02, 0x00], 24);
assert.deepEqual(imageSize(webp), { w: 1024, h: 712 });
assert.equal(imageSize(new Uint8Array(40)), null);

// ── 측정: 정면(폭/높이 0.5)·측면(깊이/높이 0.375)·높이 200mm 표기 → 100 × 200 × 75
const AI_VISION = {
  images: [
    { image_index: 0, kind: 'PHOTO', orientation: 'SQUARE', views: [{ view: 'FRONT', perspective: 'LOW', front_side: 'UNKNOWN', box: [300, 100, 700, 900], parts: [{ key: 'body', name: '본체', box: [300, 100, 700, 900] }, { key: 'display', name: '화면', box: [450, 300, 550, 350] }] }], dimensions: [{ text: 'H 200', value_mm: 200, axis: 'HEIGHT', target: 'overall' }], product_text: ['AEGIS'] },
    { image_index: 1, kind: 'PHOTO', orientation: 'SQUARE', views: [{ view: 'SIDE', perspective: 'LOW', front_side: 'RIGHT', box: [350, 100, 650, 900], parts: [{ key: 'display', box: [640, 300, 650, 350] }] }], dimensions: [] },
    { image_index: 2, kind: 'PHOTO', orientation: 'LANDSCAPE', views: [{ view: 'PERSPECTIVE', perspective: 'HIGH', box: [100, 100, 900, 900], parts: [] }] },
  ],
  appearance: 'white matte body', notes: [],
};
const vision = cleanVision(AI_VISION, [{ id: 'f1', name: 'front.jpg', width_px: 1000, height_px: 1000 }, { id: 'f2', name: 'side.jpg', width_px: 1000, height_px: 1000 }, { id: 'f3', name: 'angle.jpg', width_px: 1000, height_px: 750 }]);
const meas = measureVision(vision);
assert.deepEqual(meas.ratios, { xy: 0.5, zy: 0.38 });
assert.deepEqual(meas.overall_mm, { x: 100, y: 200, z: 75 });
assert.deepEqual([meas.used.FRONT, meas.used.SIDE, meas.skipped.length], [1, 1, 1], '비스듬한 사진은 비율 측정에서 뺀다');
const disp = meas.parts.find((p) => p.key === 'display');
assert.deepEqual([disp.fx, disp.fy, disp.fw].map((v) => Math.round(v * 1000) / 1000), [0, 0.719, 0.25]);
assert.ok(disp.fz > 0.45, '측면에서 앞쪽(오른쪽)에 있으면 z 가 +');
assert.match(visionHint(vision, meas), /폭\/높이 0\.5[\s\S]*display/);
// 세로로 본 사진인데 픽셀 크기가 가로면(EXIF 차이) 바꿔서 계산한다
assert.deepEqual([cleanVision({ images: [{ image_index: 0, orientation: 'PORTRAIT', views: [] }] }, [{ id: 'a', name: 'a.jpg', width_px: 400, height_px: 300 }]).images[0].w], [300]);

// ── 보정: AI 형상이 정사각에 가깝게 나와도 이미지 비율·치수와 겉 부품 위치에 맞춘다
const rawScene = cleanScene({ overall_mm: { x: 120, y: 160, z: 100 }, parts: [
  { name: '본체', ref_key: 'body', layer: 'SHELL', shape: 'box', size: { x: 120, y: 160, z: 100 }, position: { x: 0, y: 80, z: 0 } },
  { name: '화면', ref_key: 'display', layer: 'UI', shape: 'box', size: { x: 60, y: 30, z: 2 }, position: { x: 20, y: 60, z: 51 } },
  { name: '팬', layer: 'INTERNAL', shape: 'cylinder', size: { x: 80, y: 30, z: 80 }, position: { x: 0, y: 120, z: 0 } },
] });
const { scene: fitted, fit } = fitScene(rawScene, meas);
const fb = sceneBounds(fitted.parts);
assert.ok(Math.abs(fb.size.y - 200) < 3 && Math.abs(fb.size.x / fb.size.y - 0.5) < 0.03 && Math.abs(fb.size.z / fb.size.y - 0.375) < 0.05, `전체 크기 ${JSON.stringify(fb.size)}`);
const dispPart = fitted.parts.find((p) => p.ref_key === 'display');
assert.ok(Math.abs(dispPart.position.x) < 1 && Math.abs(dispPart.position.y - 0.719 * fb.size.y) < 3 && Math.abs(dispPart.size.x - 0.25 * fb.size.x) < 1, `화면 위치 ${JSON.stringify(dispPart)}`);
assert.equal(fitted.parts.find((p) => p.name === '팬').size.y, 37.5, '내부 부품은 전체 배율만 따른다');
assert.deepEqual(fit.ratios.map((r) => r.label), ['폭/높이', '깊이/높이']);
assert.ok(fit.ratios[0].after === 0.5 && fit.ratios[0].before === 0.75);
assert.ok(fit.snapped.some((s) => s.key === 'display'));
// 측정이 형상과 지나치게 다르면 한 번에 1.6배까지만 보정하고 알린다
const { fit: fit2 } = fitScene(rawScene, { ...meas, overall_mm: { x: 20, y: 200, z: 75 }, ratios: { xy: 0.1, zy: 0.38 } });
assert.ok(fit2.warnings.some((w) => /크게 달라/.test(w)));
// 측정값이 없으면 형상을 그대로 둔다
assert.deepEqual(fitScene(rawScene, null).scene, rawScene);

// ── 중국어 표기 정리
assert.equal(koFix('约300mm 높이, 20mm 左右'), '약 300mm 높이, 20mm 정도');
assert.equal(cleanScene({ summary: '约300mm 높이의 조명', parts: [] }).summary, '약 300mm 높이의 조명');

// ── 스케치 비교: 스케치 정면 비율 대비 시안 차이, 비스듬한 스케치는 비교하지 않음
const skVis = cleanVision({ images: [
  { image_index: 0, views: [{ view: 'FRONT', perspective: 'MEDIUM', box: [300, 100, 700, 900], parts: [] }] },
  { image_index: 1, views: [{ view: 'FRONT', perspective: 'LOW', box: [300, 100, 700, 900], parts: [] }] },
  { image_index: 2, views: [{ view: 'FRONT', perspective: 'LOW', box: [337, 100, 637, 900], parts: [] }] },
] }, [{ id: 's', name: 's.png', width_px: 600, height_px: 800 }, { id: 'a', name: 'a', width_px: 1000, height_px: 1000 }, { id: 'b', name: 'b', width_px: 1000, height_px: 1000 }]);
const skCmp = compareSketch(skVis, 1);
assert.deepEqual([skCmp.sketch_ratio, skCmp.variants.map((v) => [v.ratio, v.diff_pct, v.warn])], [0.38, [[0.5, 32, true], [0.38, 0, false]]]);
assert.match(compareSketch(cleanVision({ images: [{ image_index: 0, views: [{ view: 'PERSPECTIVE', perspective: 'HIGH', box: [0, 0, 500, 500] }] }] }, [{ id: 's', width_px: 10, height_px: 10 }, { id: 'a', width_px: 10, height_px: 10 }]), 1).sketch_note, /비스듬/);

// ── 분해 보기: 세로로 긴 제품도 부품이 너무 멀리 가지 않고, 카메라가 맞출 범위를 알려 준다
const tall = buildConceptGroup([
  { id: 'a', layer: 'SHELL', shape: 'box', size: { x: 90, y: 260, z: 30 }, position: { x: 0, y: 170, z: 0 } },
  { id: 'b', layer: 'SHELL', shape: 'box', size: { x: 126, y: 50, z: 128 }, position: { x: 0, y: 25, z: 0 } },
]);
assert.ok(tall.items.every((it) => it.explode.length() <= tall.radius * 0.9 + 1e-6));
assert.ok(tall.explodedRadius >= tall.radius && tall.explodedRadius < tall.radius * 2.2, `분해 범위 ${tall.explodedRadius} / ${tall.radius}`);

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
  if (keys.includes('variants') && keys.includes('shape')) return globalThis.__skPlan || { shape: 'A tall rectangle twice as tall as wide on a low base.', parts: ['body', 'base'], variants: [{ label: '화이트 무광', style: 'white matte' }, { label: '우드', style: 'oak base' }, { label: '블랙', style: 'black metal' }], notes: ['뒷면은 스케치에 없음'] };
  if (keys.includes('questions')) return { title: '미니 공기청정기', summary: '책상용', reference_kind: globalThis.__refKind || 'PHOTO', questions: [{ question: '높이는?', why: '형상', default_assumption: '200mm' }], assumptions: ['USB 전원으로 가정'] };
  if (keys.includes('parts')) return SCENE;
  if (keys.includes('actuators')) return { summary: '팬 1개', actuators: [{ id: 'fan', label: '팬', kind: 'PUMP_FAN', rated_voltage_v: 5, rated_current_a: 0.3, value_source: 'ASSUMED' }], steps: [{ name: '운전', duration_s: 10, states: [{ actuator_id: 'fan', on: true }] }], assumptions: ['팬 0.3A 로 가정'] };
  if (keys.includes('images')) {
    if (globalThis.__visionFail) throw new Error('vision down');
    if (globalThis.__skVision && a.file_urls.length === 4) return globalThis.__skVision;
    return globalThis.__visionKind ? { ...AI_VISION, images: AI_VISION.images.map((i) => ({ ...i, kind: globalThis.__visionKind })) } : AI_VISION;
  }
  if (keys.includes('verdict')) return { verdict: 'MAYBE', summary: '보완 필요', findings: [{ part_id: 'p1', category: 'DRAFT', severity: 'HIGH', title: '구배' }, { part_id: 'zzz', category: 'NOPE', title: '모르는 위치' }] };
  throw new Error('unexpected schema');
};
let imgFail = false;
globalThis.fetch = async () => ({ ok: false, arrayBuffer: async () => new ArrayBuffer(0) });
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
// 첨부 이미지(sketch.png)를 먼저 분석하고, 측정값을 형상 AI 에 넘긴 뒤 보정 기록을 남긴다
const visionCall = calls.llm.find((c) => 'images' in c.response_json_schema.properties);
assert.ok(visionCall && visionCall.file_urls.length === 1);
assert.match(calls.llm.find((c) => 'parts' in c.response_json_schema.properties).prompt, /\[이미지 측정값/);
assert.deepEqual(concept.preview.image_fit.files, ['sketch.png']);
assert.match(concept.preview.image_fit.warnings.join(' '), /이미지 크기를 읽지 못한/, '픽셀 크기를 모르면 비율은 쓰지 않는다');
assert.equal(concept.preview.vision_appearance, 'white matte body');
r = await call({ action: 'render', concept_id: concept.id });
assert.equal(r.status, 200, JSON.stringify(r.data));
concept = r.data.concept;
assert.deepEqual([concept.preview.render_url, concept.preview.render_version, concept.preview.render_pending], ['https://img.example/r1.png', 1, false]);
assert.deepEqual(calls.img[0].existing_image_urls, ['https://files.example/private://sketch.png'], '처음(brief)에 올린 사진도 렌더 참고 이미지로 쓴다');

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
// 이미지 분석이 실패해도 형상은 만들고 그 사실을 남긴다. 글로만 바꾼 변경은 이미지 보정을 하지 않는다
assert.ok(!r.data.concept.preview.image_fit || r.data.concept.preview.image_fit.files.length, '사진을 다시 쓴 변경은 그 사진으로 측정');
globalThis.__visionFail = true;
r = await call({ action: 'revise', concept_id: v3.id, change_request: '', uploads: [{ name: 'other.png', type: 'image/png', data: Buffer.from(png(800, 600)).toString('base64') }] });
assert.equal(r.status, 200, JSON.stringify(r.data));
assert.match(r.data.concept.preview.image_fit.warnings[0], /이미지 분석에 실패/);
assert.deepEqual(globalThis.__db.ProtoProject.find((p) => p.id === project.id).files.filter((f) => f.name === 'other.png').map((f) => [f.width_px, f.height_px]), [[800, 600]], '올린 사진의 픽셀 크기를 저장한다');
globalThis.__visionFail = false;
r = await call({ action: 'revise', concept_id: v3.id, change_request: '모서리를 둥글게' });
assert.equal(r.data.concept.preview.image_fit, undefined);
// PDF 만 올린 변경은 렌더를 다시 만들지 않는다
r = await call({ action: 'revise', concept_id: v3.id, change_request: '', uploads: [{ name: 'spec2.pdf', type: 'application/pdf', data: b64('pdf2') }] });
assert.deepEqual([r.data.concept.preview.render_pending, r.data.render_pending], [false, false]);

// 스케치를 첨부한 변경은 렌더 참고 이미지로 쓰지 않는다 (선·글자가 렌더에 찍힘)
globalThis.__visionKind = 'SKETCH';
r = await call({ action: 'revise', concept_id: v3.id, change_request: '', uploads: [{ name: 'rough.png', type: 'image/png', data: Buffer.from(png(500, 700)).toString('base64') }] });
assert.deepEqual([r.data.concept.preview.render_pending, r.data.concept.preview.render_ref_ids], [false, []]);
globalThis.__visionKind = null;

// ── 스케치 정리: 정면 시안 3장 → 고르기 → 측면 → 두 장으로 3D
const pngBytes = (w, h) => png(w, h).buffer;
globalThis.fetch = async (url) => (String(url).startsWith('https://img.example') ? { ok: true, status: 200, arrayBuffer: async () => pngBytes(1000, 1000) } : { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) });
globalThis.__refKind = 'SKETCH';
r = await call({ action: 'brief', idea: '책상 위 양면 조명 스케치', uploads: [{ name: 'sketch.png', type: 'image/png', data: Buffer.from(png(600, 800)).toString('base64') }] });
assert.equal(r.status, 200, JSON.stringify(r.data));
let sc = r.data.concept;
const skProject = () => globalThis.__db.ProtoProject.find((p) => p.id === sc.project_id);
assert.deepEqual([sc.reference_kind, sc.ref_file_ids.length], ['SKETCH', 1], '손 스케치로 판단하고 이 컨셉의 자료를 기억한다');
globalThis.__skVision = { images: [
  { image_index: 0, views: [{ view: 'FRONT', perspective: 'MEDIUM', box: [300, 100, 700, 900], parts: [] }] },
  { image_index: 1, views: [{ view: 'FRONT', perspective: 'LOW', box: [300, 100, 700, 900], parts: [] }] },
  { image_index: 2, views: [{ view: 'FRONT', perspective: 'LOW', box: [325, 100, 675, 900], parts: [] }] },
  { image_index: 3, views: [{ view: 'FRONT', perspective: 'LOW', box: [337, 100, 637, 900], parts: [] }] },
] };
const imgBefore = calls.img.length;
r = await call({ action: 'sketch', concept_id: sc.id });
assert.equal(r.status, 200, JSON.stringify(r.data));
sc = r.data.concept;
assert.equal(calls.img.length - imgBefore, 3, '정면 시안 3장');
assert.ok(calls.img.slice(imgBefore).every((c) => /FRONT view/.test(c.prompt) && c.existing_image_urls[0].includes('sketch.png')), '스케치를 참고 이미지로 넣는다');
assert.deepEqual([sc.sketch.status, sc.sketch.sketch_ratio, sc.sketch.variants.map((v) => [v.diff_pct, v.warn])], ['CHOOSE', 0.38, [[32, true], [16, true], [0, false]]]);
assert.equal((await call({ action: 'sketch', concept_id: sc.id, step: 'side', variant: 7 })).status, 400, '없는 시안');
r = await call({ action: 'sketch', concept_id: sc.id, step: 'side', variant: 2 });
assert.equal(r.status, 200, JSON.stringify(r.data));
sc = r.data.concept;
assert.match(calls.img.at(-1).prompt, /RIGHT SIDE view/);
assert.equal(calls.img.at(-1).existing_image_urls[0], sc.sketch.variants[2].url, '고른 정면 시안을 기준으로 측면을 만든다');
const skFiles = skProject().files.filter((f) => sc.sketch.file_ids.includes(f.id));
assert.deepEqual([sc.sketch.status, sc.sketch.chosen, skFiles.map((f) => [f.note, f.width_px])], ['READY', 2, [['스케치 정리 이미지(정면)', 1000], ['스케치 정리 이미지(측면)', 1000]]]);
globalThis.__skVision = null;
const llmBefore = calls.llm.length;
r = await call({ action: 'generate', concept_id: sc.id, answers: [] });
assert.equal(r.status, 200, JSON.stringify(r.data));
const genVision = calls.llm.slice(llmBefore).find((c) => 'images' in c.response_json_schema.properties);
assert.deepEqual(genVision.file_urls, skFiles.map((f) => `https://files.example/${f.uri}`), '정리한 정면·측면 두 장으로 측정한다');
assert.deepEqual(r.data.concept.preview.render_ref_ids, sc.sketch.file_ids, '렌더 참고 이미지도 그 두 장');
assert.equal((await call({ action: 'sketch', concept_id: sc.id })).status, 400, '프리뷰를 만든 뒤에는 스케치 정리를 다시 하지 않는다');
globalThis.__refKind = null;

// 처음(brief)에 올린 사진도 렌더 참고 이미지로 쓴다
r = await call({ action: 'brief', idea: '사진으로 만드는 조명 컨셉', uploads: [{ name: 'photo.png', type: 'image/png', data: Buffer.from(png(800, 800)).toString('base64') }] });
const pc = r.data.concept;
r = await call({ action: 'generate', concept_id: pc.id, answers: [] });
assert.deepEqual(r.data.concept.preview.render_ref_ids, pc.ref_file_ids, 'brief 때 올린 사진이 렌더 참고 이미지가 된다');

// 사출·금형 검토: 판정·위치·분류를 정리하고 규칙 계산을 붙인다
r = await call({ action: 'mold', concept_id: v2.id, inputs: { material: 'ABS', wall_mm: 2, draft_deg: 0.2 } });
assert.equal(r.status, 200, JSON.stringify(r.data));
const mold = r.data.concept.mold;
assert.equal(mold.verdict, 'CONDITIONAL', '모르는 판정은 보완 후 진행');
assert.deepEqual(mold.findings.map((f) => [f.part_id, f.category, f.severity]), [['p1', 'DRAFT', 'HIGH'], ['', 'OTHER', 'MEDIUM']]);
assert.ok(mold.rules.checks.some((c) => c.category === 'DRAFT'));
console.log('proto-concept functions ok');
