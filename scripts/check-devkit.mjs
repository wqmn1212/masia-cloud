// 시제품 개발 파이프라인 검산: 핀 배정, 블루투스 UUID·값 변환, 펌웨어 뼈대, 회로 시작안 계산, SolidCraft 스크립트
// 실행: npm run check:devkit
import assert from 'node:assert/strict';
import { FEATURE_KINDS, makeFeature, assignPins, pinProblems, featureBom, MCUS, suggestFeatures } from '../src/lib/devkit/features.js';
import { randomBase, uuidAt, isUuid, buildGatt, pinUuids, encodeValue, decodeValue, bytesHex, firmwareSketch, protocolDoc } from '../src/lib/devkit/ble.js';
import { starterCircuit, featureBlock, hasBlock } from '../src/lib/devkit/circuitStarter.js';
import { defaultCadParams, topCutouts, solidcraftScript, mcpBrief, conceptBounds, cadParts } from '../src/lib/devkit/solidcraft.js';
import { Simulator } from '../src/lib/circuit/solver.js';
import { operatingPoint } from '../src/lib/circuit/analysis.js';
import { buildTopology } from '../src/lib/circuit/topology.js';

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('✓', name); };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} (기대 ${b} ± ${tol})`);

const kinds = Object.keys(FEATURE_KINDS);
const all = kinds.map((k) => makeFeature(k));

ok('핀 배정: 센서는 ADC 핀, 겹침 없음, 사용자 핀 유지', () => {
  const f = assignPins([{ ...makeFeature('led'), pin: 21 }, makeFeature('temp'), makeFeature('button'), makeFeature('custom')], 'esp32c3');
  assert.equal(f[0].pin, 21);
  assert.ok(MCUS.esp32c3.adc.includes(f[1].pin), '온도 센서가 ADC 핀');
  assert.equal(f[3].pin, null, '명령 항목은 핀 없음');
  assert.equal(new Set(f.filter((x) => x.pin != null).map((x) => x.pin)).size, 3);
  assert.deepEqual(pinProblems(f, 'esp32c3'), []);
  const clash = pinProblems([{ ...makeFeature('led'), pin: 5 }, { ...makeFeature('motor'), pin: 5 }], 'esp32c3');
  assert.equal(clash.length, 1);
});

ok('핀 부족: ESP32-C3 에 버튼 12개면 경고, S3 로 바꾸면 해결', () => {
  const many = Array.from({ length: 12 }, () => makeFeature('button'));
  assert.ok(pinProblems(assignPins(many, 'esp32c3'), 'esp32c3').length > 0);
  assert.deepEqual(pinProblems(assignPins(many, 'esp32s3'), 'esp32s3'), []);
});

ok('부품 목록: 같은 부품은 합친다', () => {
  const bom = featureBom([makeFeature('motor'), makeFeature('heater')], 'esp32c3');
  const pull = bom.find((b) => b.name === '저항 100 kΩ (풀다운)');
  assert.equal(pull.qty, 2);
  assert.ok(bom[0].name.includes('ESP32-C3'));
});

ok('UUID: 기준값에서 항목 번호만 바뀌고, 한 번 정하면 순서를 바꿔도 그대로', () => {
  let s = 1; const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const base = randomBase(rand);
  assert.ok(isUuid(base), base);
  assert.equal(uuidAt(base, 0x1001).slice(4, 8), '1001');
  const dev = pinUuids({ uuid_base: base, device_name: 'TEST', features: assignPins([makeFeature('led'), makeFeature('button')]) });
  const g1 = buildGatt(dev);
  const g2 = buildGatt({ ...dev, features: [...dev.features].reverse() });
  assert.equal(g1.chars.find((c) => c.kind === 'led').uuid, g2.chars.find((c) => c.kind === 'led').uuid);
  assert.equal(new Set([g1.service, g1.info.uuid, ...g1.chars.map((c) => c.uuid)]).size, 4);
  // 새 기능을 더해도 이미 정한 UUID 와 겹치지 않는다
  const g3 = buildGatt({ ...dev, features: [...dev.features, makeFeature('motor')] });
  assert.equal(new Set(g3.chars.map((c) => c.uuid)).size, 3);
});

ok('값 ↔ 바이트: 리틀 엔디언·배율·범위 제한', () => {
  const temp = { type: 'i16', scale: 0.1, min: -400, max: 1250 };
  assert.equal(bytesHex(encodeValue(temp, 25.3)), 'fd 00');
  assert.equal(decodeValue(temp, encodeValue(temp, -12.5)), -12.5);
  const pct = { type: 'u8', scale: 1, min: 0, max: 100 };
  assert.equal(bytesHex(encodeValue(pct, 150)), '64');
  const hz = { type: 'u16', scale: 1, min: 0, max: 8000 };
  assert.equal(bytesHex(encodeValue(hz, 2000)), 'd0 07');
  assert.equal(decodeValue(hz, new Uint8Array([0xd0, 0x07])), 2000);
  const raw = { type: 'bytes' };
  assert.equal(bytesHex(encodeValue(raw, '01 0a FF')), '01 0a ff');
  assert.equal(bytesHex(encodeValue(raw, 'hi')), '68 69');
});

const dev = pinUuids({ uuid_base: randomBase(), device_name: 'AEGIS-TEST', mcu: 'esp32c3', supply_v: 5, features: assignPins(all, 'esp32s3') });
ok('펌웨어 뼈대: 모든 기능의 UUID·핀·처리 코드, 괄호 짝', () => {
  const code = firmwareSketch({ ...dev, mcu: 'esp32s3' });
  const g = buildGatt(dev);
  g.chars.forEach((c) => assert.ok(code.includes(c.uuid), `${c.name} UUID`));
  assert.ok(code.includes(g.service));
  const count = (ch) => code.split(ch).length - 1;
  assert.equal(count('{'), count('}'), '중괄호 짝');
  assert.equal(count('('), count(')'), '소괄호 짝');
  ['ledcAttach', 'servoWrite', 'readNtcTenths', 'batteryPercent', 'INPUT_PULLUP', 'ledcWriteTone', 'BLE2902', 'startAdvertising'].forEach((s) => assert.ok(code.includes(s), s));
  assert.ok(!/undefined|NaN|\[object/.test(code), '빈 값 없음');
});

ok('프로토콜 문서: 특성 표와 예시 바이트', () => {
  const doc = protocolDoc(dev, { title: '테스트' });
  const g = buildGatt(dev);
  g.chars.forEach((c) => assert.ok(doc.includes(c.uuid)));
  assert.ok(doc.includes('25.3 → `fd 00`'), '온도 예시');
  assert.ok(!/undefined|NaN/.test(doc));
});

// ── 회로 시작안 ──
const settings = { supply_v: 5 };
ok('회로 시작안: 모든 블록이 연결 경고 없이 만들어진다', () => {
  const c = starterCircuit(all, settings);
  assert.equal(c.blocks.length, kinds.filter(hasBlock).length);
  const topo = buildTopology(c);
  assert.ok(!topo.error, topo.error);
  const bad = (topo.warnings || []).filter((w) => /연결|unconnected/i.test(String(w)));
  assert.deepEqual(bad, []);
  assert.ok(c.dt <= 1 / 20000 / 25 + 1e-12, `dt ${c.dt}`);
});

const block = (kind) => ({ parts: featureBlock(makeFeature(kind), settings) });
const probeV = (c, r) => { const s = new Simulator(c, { mode: 'dc' }); s.solveDC(); const p = c.parts.find((x) => x.type === 'probe'); return s.voltageAt(p.x1, p.y1); };

ok('버튼: 뗐을 때 핀 3.3 V, 누르면 0 V', () => {
  const c = block('button');
  near(probeV(c), 3.3, 1e-3, '뗌');
  c.parts.find((p) => p.type === 'switch').props.closed = true;
  near(probeV(c), 0, 0.01, '누름');
});

ok('NTC 분압: 25 °C 에서 1.65 V, 배터리 4.2 V → 2.1 V', () => {
  near(probeV(block('temp')), 1.65, 1e-3, '온도 센서');
  near(probeV(block('battery')), 2.1, 1e-3, '배터리');
});

ok('LED: 50 % PWM 평균 전류가 (3.3 − Vf) / 330 의 절반 근처', () => {
  const c = block('led');
  const led = c.parts.find((p) => p.type === 'led');
  const s = new Simulator(c, { dt: 5e-6 });
  let sum = 0;
  const steps = 800; // 1 kHz 4주기
  for (let k = 0; k < steps; k++) { s.step(); sum += Math.abs(s.info(led.id).current || 0); }
  const avg = sum / steps;
  assert.ok(avg > 0.0015 && avg < 0.0035, `평균 ${avg}`);
});

ok('모터: 20 kHz PWM 에서 MOSFET 이 스위칭하고 다이오드가 환류한다', () => {
  const c = block('motor');
  const s = new Simulator(c, { dt: 1e-6 });
  const coil = c.parts.find((p) => p.type === 'inductor');
  const diode = c.parts.find((p) => p.type === 'diode');
  let iMax = 0, dMax = 0;
  for (let k = 0; k < 3000; k++) { s.step(); iMax = Math.max(iMax, Math.abs(s.info(coil.id).current || 0)); dMax = Math.max(dMax, Math.abs(s.info(diode.id).current || 0)); }
  assert.ok(!s.error, s.error);
  assert.ok(iMax > 0.05 && iMax < 0.5, `코일 전류 ${iMax}`);
  assert.ok(dMax > 0.01, `환류 전류 ${dMax}`);
});

ok('릴레이·부저·서보·히터·다이얼 블록이 계산된다', () => {
  ['relay', 'buzzer', 'servo', 'heater', 'analog'].forEach((k) => {
    const c = block(k);
    const op = operatingPoint(c);
    assert.ok(!op.error, `${k}: ${op.error}`);
  });
  near(probeV(block('analog')), 1.65, 1e-3, '다이얼 가운데');
});

// ── SolidCraft ──
const preview = {
  overall_mm: { x: 100, y: 40, z: 60 },
  parts: [
    { id: 'a', name: '상부 케이스', layer: 'SHELL', shape: 'rounded_box', size: { x: 100, y: 20, z: 60 }, position: { x: 10, y: 30, z: 5 } },
    { id: 'b', name: '하부 케이스', layer: 'SHELL', shape: 'box', size: { x: 100, y: 20, z: 60 }, position: { x: 10, y: 10, z: 5 } },
    { id: 'c', name: '전원 버튼', layer: 'UI', shape: 'cylinder', size: { x: 12, y: 3, z: 12 }, position: { x: 40, y: 40.5, z: 15 } },
    { id: 'd', name: '표시창', layer: 'UI', shape: 'box', size: { x: 30, y: 1, z: 10 }, position: { x: 0, y: 39.8, z: -10 } },
    { id: 'e', name: '옆 스위치', layer: 'UI', shape: 'box', size: { x: 4, y: 8, z: 8 }, position: { x: 60, y: 20, z: 5 } },
    { id: 'f', name: '기판', layer: 'PCB', shape: 'box', size: { x: 80, y: 2, z: 50 }, position: { x: 10, y: 8, z: 5 } },
  ],
};

ok('컨셉 범위·좌표 변환: 윗면 중심이 원점, 앞쪽(+z) → −Y', () => {
  const b = conceptBounds(preview.parts);
  near(b.width, 100, 1e-9, '폭'); near(b.height, 40, 1e-9, '높이'); near(b.depth, 60, 1e-9, '깊이');
  const p = cadParts(preview.parts).find((x) => x.id === 'c');
  assert.deepEqual(p.center_mm, [30, -10, 0.5]);
  assert.deepEqual(p.size_mm, [12, 12, 3]);
});

ok('윗면 자리: 위에 있는 조작부만 (옆 스위치 제외)', () => {
  const params = defaultCadParams(preview);
  assert.deepEqual([params.shape, params.width, params.depth, params.height], ['box', 100, 60, 40]);
  const cuts = topCutouts(preview.parts, params);
  assert.deepEqual(cuts.map((c) => c.name), ['전원 버튼', '표시창']);
  assert.deepEqual(cuts[0], { id: 'c', name: '전원 버튼', kind: 'circle', x: 30, y: -10, d: 12 });
  assert.deepEqual([cuts[1].x, cuts[1].y, cuts[1].w, cuts[1].h], [-10, 15, 30, 10]);
});

ok('SolidCraft 스크립트: 공개 예제와 같은 명령·인자만, 순서대로', () => {
  const params = defaultCadParams(preview);
  const s = solidcraftScript(params, topCutouts(preview.parts, params));
  assert.deepEqual(Object.keys(s), ['commands']);
  const allowed = { 'parameters.change': ['name', 'expression'], 'sketch.create': ['plane', 'name'], 'sketch.line': ['points', 'closed', 'ids'], 'sketch.circle.center': ['center', 'diameter'], 'sketch.finish': [], 'solid.extrude': ['distance', 'direction', 'body_name', 'operation'], 'solid.fillet': ['edges', 'radius'] };
  s.commands.forEach((c) => {
    assert.ok(allowed[c.command], c.command);
    Object.keys(c.params).forEach((k) => assert.ok(allowed[c.command].includes(k), `${c.command}.${k}`));
  });
  const names = s.commands.map((c) => c.command);
  assert.equal(names.filter((x) => x === 'sketch.create').length, names.filter((x) => x === 'sketch.finish').length);
  const body = s.commands.find((c) => c.command === 'solid.extrude');
  assert.deepEqual(body.params, { distance: 'height', direction: 'negative', body_name: 'Housing' });
  const cut = s.commands.filter((c) => c.command === 'solid.extrude')[1];
  assert.equal(cut.params.operation, 'cut');
  const outline = s.commands.find((c) => c.command === 'sketch.line');
  assert.deepEqual(outline.params.points, [[-50, -30], [50, -30], [50, 30], [-50, 30]]);
  const fillet = s.commands.find((c) => c.command === 'solid.fillet');
  assert.deepEqual(fillet.params.edges[0], [50, 30, -20]);
  assert.equal(fillet.params.radius, 6);
});

ok('원형 몸통·AI 작업 지시서', () => {
  const round = { parts: [{ id: 'r', name: '몸통', layer: 'SHELL', shape: 'cylinder', size: { x: 70, y: 120, z: 70 }, position: { x: 0, y: 60, z: 0 } }] };
  const params = defaultCadParams(round);
  assert.equal(params.shape, 'round');
  const s = solidcraftScript(params, []);
  assert.ok(s.commands.some((c) => c.command === 'sketch.circle.center' && c.params.diameter === 70));
  assert.ok(!s.commands.some((c) => c.command === 'solid.fillet'));
  const brief = mcpBrief({ project: { title: '테스트' }, concept: { preview }, params: defaultCadParams(preview), cutouts: topCutouts(preview.parts, defaultCadParams(preview)), features: [makeFeature('button'), makeFeature('led')], outBase: 'test-housing' });
  ['describe_command', 'check_parameters', 'test-housing.step', '전원 버튼', '버튼 구멍'].forEach((t) => assert.ok(brief.includes(t), t));
  assert.ok(!/undefined|NaN/.test(brief));
});

ok('컨셉 부품 → 기능 추정: 이름 우선, 기판 설명은 무시', () => {
  const got = suggestFeatures([
    { name: '전원 및 모드 버튼', layer: 'UI', role: '전원' },
    { name: '상태 표시등', layer: 'UI', role: '버튼 옆에서 상태를 보여 줌' },
    { name: '전원 및 제어 기판', layer: 'PCB', role: '버튼 입력과 진동자 구동' },
    { name: '초음파 진동자', layer: 'INTERNAL', role: '물을 분무하는 모터 대신 진동' },
    { name: '물탱크', layer: 'SHELL', role: '배터리 없음' },
  ]);
  assert.deepEqual(got.map((f) => [f.kind, f.name]), [['button', '전원 및 모드 버튼'], ['led', '상태 표시등'], ['motor', '초음파 진동자']]);
});

console.log(`\n${n}개 검산 통과`);
