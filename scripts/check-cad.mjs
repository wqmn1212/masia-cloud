// 금형용 설계(CAD 템플릿) 검산: 솔리드 생성 · STEP 왕복 · 조립 간섭 · 금형 점검 · 컨셉 치수 추정
// 실행: npm run check:cad  (OpenCascade WASM 을 Node 에서 띄운다, 1~3분)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ocInit = (await import(path.join(root, 'node_modules/replicad-opencascadejs/dist/replicad_single.js'))).default;
const R = await import(path.join(root, 'node_modules/replicad/dist/replicad.js'));
R.setOC(await ocInit({ wasmBinary: fs.readFileSync(path.join(root, 'node_modules/replicad-opencascadejs/dist/replicad_single.wasm')) }));
const { buildAssembly } = await import('../src/lib/cad/builders.js');
const { defaultParams, cleanParams, guessFromConcept, TEMPLATE_KEYS } = await import('../src/lib/cad/catalog.js');
const { checkInterference } = await import('../src/lib/cad/interference.js');
const { analyzeMold } = await import('../src/lib/moldReview/analyzeCore.js');
const { buildMoldReport } = await import('../src/lib/moldReview/report.js');
const occtimportjs = (await import(path.join(root, 'node_modules/occt-import-js/dist/occt-import-js.js'))).default;
const occt = await occtimportjs();

let pass = 0;
const fails = [];
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`✓ ${name}`); } else { fails.push(name); console.log(`✗ ${name}${detail ? ` — ${detail}` : ''}`); }
};
// 워커와 같은 정밀도 (angularTolerance 는 라디안)
const viewMesh = (s) => { const m = s.mesh({ tolerance: 0.08, angularTolerance: 0.2 }); return { V: Float32Array.from(m.vertices), F: Uint32Array.from(m.triangles) }; };
const moldMesh = (s) => { const m = s.mesh({ tolerance: 0.05, angularTolerance: 0.1 }); return { V: Float32Array.from(m.vertices), F: Uint32Array.from(m.triangles) }; };
const interference = (asm) => checkInterference(asm.parts.map((p) => ({ id: p.id, name: p.name, group: p.group, ...viewMesh(p.shape) })), { motion: asm.motion });
const moldOf = (part) => {
  const m = moldMesh(part.shape);
  const res = analyzeMold(m.V, m.F, part.pull ? { pullDir: part.pull } : {}, () => {}); // 화면과 같이: 설계가 정한 빼기 축이 있으면 그것
  return { res, rep: buildMoldReport(res, { materialKey: /^PC/.test(part.material) ? 'PC' : 'ABS' }) };
};
const levelOf = (rep, id) => rep.items.find((i) => i.id === id)?.level;
const build = (t, extra = {}) => buildAssembly(R, t, { ...defaultParams(t), ...extra });

// 1. 템플릿마다 기본 치수로 만들고 STEP 으로 내보낸 뒤 다시 읽는다
const built = {};
for (const t of TEMPLATE_KEYS) {
  const t0 = Date.now();
  const asm = build(t);
  built[t] = asm;
  const molded = asm.parts.filter((p) => p.mold);
  check(`${t}: 기본 치수로 부품 ${asm.parts.length}개 생성 (사출 ${molded.length}), 메모 없음`, asm.parts.length >= 5 && molded.length >= 2 && asm.notes.length === 0, `${asm.notes.join(' / ')} (${Date.now() - t0} ms)`);
  const { stepName } = await import('../src/lib/cad/catalog.js');
  const blob = R.exportSTEP(asm.parts.map((p) => ({ shape: p.shape, name: stepName(p), color: p.color })), { unit: 'MM' });
  const buf = new Uint8Array(await blob.arrayBuffer());
  const text = new TextDecoder().decode(buf);
  const back = occt.ReadStepFile(buf, null);
  const names = new Set(back.meshes.map((m) => m.name));
  check(`${t}: STEP(mm) 를 앱의 STEP 읽기로 다시 열면 부품 ${asm.parts.length}개·이름이 그대로`, back.success && back.meshes.length === asm.parts.length && asm.parts.every((p) => names.has(stepName(p))) && /SI_UNIT\(\.MILLI\.,\.METRE\.\)/.test(text), `${back.meshes.length}개`);
}

// 2. 조립 간섭
const lamp = interference(built.round_lamp);
check('원형 조명: 조립 상태에서 파고드는 부품 없음', lamp.overlaps.length === 0, lamp.overlaps.map((o) => `${o.aName}/${o.bName} ${o.depth.toFixed(2)}`).join(', '));
const tight = lamp.motion.issues.filter((i) => /하우징/.test(i.aName) && i.bName === '받침대 하우징');
check('원형 조명: 갭 4 mm · 두께 28 mm 면 ±15° 에서 하우징과 받침대 틈이 0.5 mm 아래로 좁아진다 (앞·뒤 양쪽)', tight.length === 2 && tight.every((i) => Math.abs(i.angle) === 15 && (i.kind === 'overlap' || i.gap < 0.5)), JSON.stringify(tight.map((i) => [i.angle, i.kind, i.gap?.toFixed(2)])));
const lamp6 = interference(build('round_lamp', { gap: 6 }));
check('원형 조명: 갭 6 mm 로 늘리면 기울여도 여유 있음', lamp6.overlaps.length === 0 && lamp6.motion.issues.length === 0, JSON.stringify(lamp6.motion.issues.map((i) => [i.aName, i.angle, i.gap])));
const lamp3 = interference(build('round_lamp', { gap: 3 }));
check('원형 조명: 갭 3 mm 면 15° 에서 실제로 파고든다', lamp3.motion.issues.some((i) => i.kind === 'overlap' && Math.abs(i.angle) === 15 && i.depth > 0.2), JSON.stringify(lamp3.motion.issues.map((i) => [i.kind, i.angle, i.depth?.toFixed(2)])));
for (const t of ['box', 'cylinder']) {
  const r = interference(built[t]);
  check(`${t}: 조립 상태에서 파고드는 부품 없음`, r.overlaps.length === 0, r.overlaps.map((o) => `${o.aName}/${o.bName} ${o.depth.toFixed(2)}`).join(', '));
}
// 일부러 겹치게: 배터리를 두껍게 하면 기판과 겹친다
const fat = build('box', { battery: 14 });
const fatR = interference(fat);
check('사각: 배터리를 14 mm 로 키우면 메모와 함께 기판 간섭을 찾는다', fat.notes.some((n) => /배터리/.test(n)) && fatR.overlaps.some((o) => [o.aName, o.bName].some((n) => /배터리/.test(n))), fat.notes.join(' / '));

// 3. 금형 점검: 템플릿이 만든 사출 부품은 구배·언더컷이 기본으로 해결되어 있어야 한다
for (const t of TEMPLATE_KEYS) {
  for (const p of built[t].parts.filter((x) => x.mold)) {
    if ((t === 'round_lamp' && p.id === 'base_shell') || (t === 'sphere_lamp' && p.id === 'shell')) continue; // 벽 구멍(슬라이드)이 있는 외장은 따로 본다
    const { res, rep } = moldOf(p);
    check(`${t}/${p.name}: 구배 부족 없음 · 언더컷 없음 · 살두께 ${res.summary.nominal.toFixed(2)} mm`, levelOf(rep, 'draft') !== 'hi' && res.undercuts.length === 0 && Math.abs(res.summary.nominal - (/확산/.test(p.name) ? 1.5 : 2)) < 0.7, `draft ${levelOf(rep, 'draft')} · 언더컷 ${res.undercuts.length}`);
  }
}
const baseHole = moldOf(built.round_lamp.parts.find((p) => p.id === 'base_shell'));
const baseNotch = moldOf(build('round_lamp', { hole_style: 'notch' }).parts.find((p) => p.id === 'base_shell'));
const slides = (r) => r.res.undercuts.filter((u) => u.type === 'slide').length;
check(`원형 조명 받침대: 벽 구멍이면 슬라이드 ${slides(baseHole)}개, 아래로 트인 홈이면 언더컷 0개`, slides(baseHole) >= 3 && baseNotch.res.undercuts.length === 0, `notch 언더컷 ${baseNotch.res.undercuts.length}`);

// 4. 치수 정리 · 컨셉 추정 · 경고
const c = cleanParams('round_lamp', { dia: 9999, thick: 'x', bosses: 5, hole_style: 'zzz' });
check('치수 범위 밖·잘못된 값은 범위 안·기본값으로', c.dia === 300 && c.thick === 28 && c.bosses === 4 && c.hole_style === 'hole');
const preview = { overall_mm: { x: 150, y: 190, z: 72 }, parts: [
  { id: 'b_rim', name: '본체 테두리 링', layer: 'SHELL', shape: 'cylinder', size: { x: 150, y: 28, z: 150 }, position: { x: 0, y: 115, z: 0 }, rotation_deg: { x: 90, y: 0, z: 0 } },
  { id: 'h_axle', name: '마찰 힌지 축', layer: 'INTERNAL', shape: 'cylinder', size: { x: 5, y: 46, z: 5 }, position: { x: 0, y: 18, z: 0 }, rotation_deg: { x: 0, y: 0, z: 90 } },
  { id: 's_base', name: '받침대', layer: 'SHELL', shape: 'cylinder', size: { x: 66, y: 36, z: 70 }, position: { x: 0, y: 18, z: 0 }, rotation_deg: { x: 0, y: 0, z: 0 } },
  { id: 'u_dial', name: '다이얼 버튼', layer: 'UI', shape: 'cylinder', size: { x: 12, y: 3, z: 12 }, position: { x: 0, y: 15, z: 35.8 }, rotation_deg: { x: 90, y: 0, z: 0 } },
] };
const g = guessFromConcept(preview);
check('컨셉(Ø150 원판 + 받침대)에서 원형 조명 템플릿·치수 추정', g.template === 'round_lamp' && g.params.dia === 150 && g.params.thick === 28 && g.params.base_w === 66 && g.params.base_d === 70 && g.params.base_h === 36 && g.params.gap === 4 && g.params.pivot_h === 18, JSON.stringify(g));
check('컨셉이 없으면 사각 하우징으로 시작', guessFromConcept(null).template === 'box');
const narrow = build('round_lamp', { bezel: 7 });
check('테두리가 좁아 보스가 발광창에 걸리면 보스를 빼고 필요한 폭을 알려 준다', narrow.notes.some((n) => /보스를 뺐습니다/.test(n) && /mm 이상/.test(n)));

// 기판 부품(높이 상자)을 넣은 간섭: 무니스 견본 회로의 자동 배치 결과를 원형 조명 외장에 넣는다
{
  const lib = await import('../src/lib/hw/kicadLib.data.js');
  const { buildHwPackage } = await import('../src/lib/hw/exportHw.js');
  const { pcbPartBoxes, skipPcbPair, partHeight } = await import('../src/lib/cad/pcbParts.js');
  const { dev, title } = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'pcb-sample.json'), 'utf8'));
  const pkg = buildHwPackage(dev, lib, { title, seed: 'p1' });
  const boxes = pcbPartBoxes(pkg.boards[0]);
  const asm = build('round_lamp', dev.mold_design?.params || {});
  const view = asm.parts.map((p) => ({ id: p.id, name: p.name, group: p.group, ...viewMesh(p.shape) }));
  const pcbGroup = view.find((v) => v.id === 'pcb')?.group;
  const r = checkInterference([...view, ...boxes.map((b) => ({ id: b.id, name: b.name, group: pcbGroup, V: b.mesh.V, F: b.mesh.F }))], { motion: asm.motion, skip: skipPcbPair });
  const hits = r.overlaps.filter((o) => o.a.startsWith('pcbc_') || o.b.startsWith('pcbc_'));
  check(`기판 부품 ${boxes.length}개(높이 ${Math.max(...boxes.map((b) => b.h))} mm 까지)를 넣어도 외장과 파고들지 않는다`, boxes.length > 20 && hits.length === 0, hits.map((o) => `${o.aName}↔${o.bName} ${o.depth.toFixed(2)}`).join(' | '));
  check('뒷면 부품은 기판 아래 빈 높이보다 낮다', pkg.boards[0].pcb.place.list.filter((o) => o.side === 'B').every((o) => partHeight(o.c.part.fp) <= pkg.boards[0].layout.backClear));
  // 일부러 키 큰 부품을 뒷면에 넣으면 잡아낸다
  const tall = boxes.find((b) => b.side === 'F');
  const { boxMesh } = await import('../src/lib/cad/pcbParts.js');
  const bad = boxMesh(tall.rect, pkg.boards[0].layout.z - 6, pkg.boards[0].layout.z);
  const r2 = checkInterference([...view, { id: 'pcbc_TEST', name: '시험 부품', group: pcbGroup, V: bad.V, F: bad.F }], { skip: skipPcbPair });
  check('기판 아래로 6 mm 내려간 부품은 간섭으로 잡힌다', r2.overlaps.some((o) => o.a === 'pcbc_TEST' || o.b === 'pcbc_TEST'));
}

// 구형 셸 조명 (비스듬히 자른 공): 간섭·외장 금형(빼기 방향 자동)·기판 D 외곽·컨셉 추정
{
  const { sphereGeom } = await import('../src/lib/cad/sphereGeom.js');
  const { pcbLayout } = await import('../src/lib/cad/pcbLayout.js');
  const sp = built.sphere_lamp;
  const gs = sphereGeom(defaultParams('sphere_lamp'));
  check(`구형 조명: 기본 Ø180 크기 ${sp.overall.x}×${sp.overall.y}×${sp.overall.z} mm, 판이 테두리 위로 ${gs.panelProud} mm, 앞 입술 ${gs.lip} mm`, sp.overall.x === 180 && sp.overall.z > 140 && sp.overall.z < 175 && gs.panelProud > 0 && gs.panelProud < 12 && gs.lip > 15);
  const si = interference(sp);
  check('구형 조명: 조립 상태에서 파고드는 부품 없음', si.overlaps.length === 0, si.overlaps.map((o) => `${o.aName}/${o.bName} ${o.depth.toFixed(2)}`).join(', '));
  check('구형 조명: 방열판 고정 보스 4곳 (시계 띠 위)', gs.bosses.length === 4 && gs.bosses.every((b) => b.panel[1] > gs.yb));
  const shell = sp.parts.find((p) => p.id === 'shell');
  const auto = analyzeMold(...Object.values(moldMesh(shell.shape)), {}, () => {});
  const tiltOk = Math.abs(auto.pull.dir[2]) > 0.3 && Math.abs(auto.pull.dir[1]) > 0.3;
  check(`구형 조명: 외장 빼기 방향을 자동으로도 비스듬한 테두리 법선으로 찾는다 (${auto.pull.label})`, tiltOk, JSON.stringify(auto.pull.dir));
  const sm = moldOf(shell);
  const lifters = sm.res.undercuts.filter((u) => u.type !== 'slide');
  check(`구형 조명 외장: 보스 뿌리까지 언더컷 없음, 옆 구멍만 슬라이드 ${sm.res.undercuts.length - lifters.length}개, 구배 부족 없음`, lifters.length === 0 && levelOf(sm.rep, 'draft') !== 'hi', JSON.stringify(sm.res.undercuts.map((u) => u.type)));
  const lay = pcbLayout('sphere_lamp', defaultParams('sphere_lamp'));
  check('구형 조명: 기판은 앞을 자른 D 모양, 뒤 잭·토글·버튼과 오른쪽 뒤 엔코더 자리', lay.kind === 'poly' && Math.min(...lay.outline.map((q) => q[1])) >= gs.yCut - 0.01 && ['jack', 'toggle', 'bt', 'dial'].every((id) => lay.anchors.some((a) => a.id === id)));
  check('구형 조명: 시계 모듈 아래는 부품 높이 제한 구역', lay.zones.some((z) => /시계/.test(z.label) && z.maxH < 3));
  const fwd = build('sphere_lamp', { face_off: 12 });
  check('구형 조명: 자르는 면을 앞으로 내밀면 언더컷을 알려 준다', fwd.notes.some((n) => /언더컷/.test(n)));
  const ball = guessFromConcept({ parts: [{ id: 'shell', layer: 'SHELL', shape: 'sphere', size: { x: 180, y: 176, z: 180 }, position: { x: 0, y: 88, z: 0 } }], cad_hint: { template: 'sphere_lamp', params: { face_tilt: 30 } } });
  check('구형 조명: 공 모양 외장 컨셉에서 구형 템플릿·지름·힌트 치수 추정', ball.template === 'sphere_lamp' && ball.params.dia === 180 && ball.params.face_tilt === 30);
}

console.log(`\n${pass}개 검산 통과${fails.length ? `, ${fails.length}개 실패` : ''}`);
if (fails.length) process.exit(1);
