// 시제품 개발 파이프라인 검산: 핀 배정, 블루투스 UUID·값 변환, 펌웨어 뼈대, 회로 시작안 계산, SolidCraft 스크립트
// 실행: npm run check:devkit
import assert from 'node:assert/strict';
import { FEATURE_KINDS, makeFeature, assignPins, pinProblems, featureBom, MCUS, suggestFeatures } from '../src/lib/devkit/features.js';
import { randomBase, uuidAt, isUuid, buildGatt, pinUuids, encodeValue, decodeValue, bytesHex, firmwareSketch, protocolDoc } from '../src/lib/devkit/ble.js';
import { starterCircuit, featureBlock, hasBlock } from '../src/lib/devkit/circuitStarter.js';
import { defaultCadParams, topCutouts, solidcraftScript, mcpBrief, conceptBounds, cadParts } from '../src/lib/devkit/solidcraft.js';
import { Simulator } from '../src/lib/circuit/solver.js';
import { defaultRules, applyPress, effectiveLevels, describeRule } from '../src/lib/devkit/rules.js';
import { createSim, stepSim, setInput, appWrite, appValues, runtimeHours, ocv } from '../src/lib/devkit/deviceSim.js';
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

// ── 동작 규칙·동작 시뮬레이션 ──
const kit = ['button', 'motor', 'heater', 'temp', 'tilt', 'lid', 'led', 'battery'].map((k) => makeFeature(k));
const fid = (k) => kit.find((f) => f.kind === k).id;
const kitRules = defaultRules(kit);

ok('기본 규칙: 버튼→모터 단계, 뚜껑·기울기·배터리→구동부 끄기, 온도→히터 끄기, 표시등', () => {
  const text = kitRules.map((r) => describeRule(r, kit));
  assert.deepEqual(text, [
    '버튼 입력 을(를) 누르면 → DC 모터 (속도) 단계 바꾸기',
    '뚜껑 열림 감지 이(가) 열려 있으면 → 모든 구동부 끄기',
    '기울기 감지 이(가) 기울어지면 → 모든 구동부 끄기',
    '온도 센서 (NTC) 이(가) 70°C 이상이면 → 히터 (세기) 끄기',
    '배터리 잔량 이(가) 5% 이하이면 → 모든 구동부 끄기',
    '모든 구동부 이(가) 동작하면 → 표시 LED (밝기) 켜기',
  ]);
});

ok('버튼 규칙: 단계 바꾸기 0→40→70→100→0, 켜고 끄기', () => {
  let lv = {};
  const seq = [];
  for (let i = 0; i < 5; i++) { lv = applyPress(fid('button'), kitRules, kit, lv); seq.push(lv[fid('motor')]); }
  assert.deepEqual(seq, [40, 70, 100, 0, 40]);
  const t = [{ id: 'x', type: 'event', src: fid('button'), dst: fid('heater'), action: 'toggle' }];
  assert.equal(applyPress(fid('button'), t, kit, {})[fid('heater')], 100);
  assert.equal(applyPress(fid('button'), t, kit, { [fid('heater')]: 50 })[fid('heater')], 0);
});

ok('안전 조건: 뚜껑이 열리면 구동부만 꺼지고 표시등은 구동부를 따라 꺼진다', () => {
  const lv = { [fid('motor')]: 70, [fid('heater')]: 100 };
  const closed = effectiveLevels(lv, kitRules, kit, { [fid('lid')]: false, [fid('temp')]: 25, [fid('battery')]: 80 });
  assert.equal(closed.out[fid('motor')], 70); assert.equal(closed.out[fid('led')], 100);
  const open = effectiveLevels(lv, kitRules, kit, { [fid('lid')]: true, [fid('temp')]: 25, [fid('battery')]: 80 });
  assert.equal(open.out[fid('motor')], 0); assert.equal(open.out[fid('heater')], 0); assert.equal(open.out[fid('led')], 0);
  const hot = effectiveLevels(lv, kitRules, kit, { [fid('temp')]: 71, [fid('battery')]: 80 });
  assert.equal(hot.out[fid('heater')], 0); assert.equal(hot.out[fid('motor')], 70);
});

const press = (s, id) => { setInput(s, { pressed: { [id]: true } }); stepSim(s, 0.1); setInput(s, { pressed: {} }); stepSim(s, 0.1); };

ok('시뮬레이션: 버튼으로 모터가 돌고, 넘어지면 멈췄다가 세우면 다시 돈다 (배터리)', () => {
  const s = createSim({ features: kit, rules: kitRules, supply_v: 5 }, { source: 'battery', battery_mah: 2000, soc0: 80 });
  press(s, fid('button'));
  stepSim(s, 2);
  assert.equal(s.out[fid('motor')], 40);
  near(s.phys.motor[fid('motor')], 0.4, 0.02, '모터 속도');
  assert.ok(s.rails.i > 0.1 && s.rails.i < 0.3, `전류 ${s.rails.i}`);
  setInput(s, { tilt: { pitch: 80, roll: 0 } }); stepSim(s, 0.5);
  assert.equal(s.out[fid('motor')], 0);
  assert.ok(s.events.some((e) => e.kind === 'safe'));
  setInput(s, { tilt: { pitch: 10, roll: 5 } }); stepSim(s, 0.5);
  assert.equal(s.out[fid('motor')], 40, '세우면 요청값으로 돌아온다');
  assert.equal(s.mcu.resets, 0);
  const h = runtimeHours(s);
  assert.ok(h > 5 && h < 15, `사용 시간 ${h}`);
});

ok('기동 전류: 0.3 A 어댑터에 모터를 100 % 로 켜면 전압이 무너져 MCU 가 리셋되고, 출력이 꺼진 채 다시 부팅', () => {
  const full = [{ id: 'on', type: 'event', src: fid('button'), dst: fid('motor'), action: 'on' }];
  const s = createSim({ features: kit, rules: full, supply_v: 5 }, { source: 'adapter', adapter_v: 5, adapter_a: 0.3 });
  stepSim(s, 0.2);
  press(s, fid('button'));
  stepSim(s, 1);
  assert.ok(s.mcu.resets >= 1, '리셋');
  assert.ok(s.warnings['brownout-limit'], '한도 초과 경고');
  assert.equal(s.mcu.on, true, '다시 부팅');
  assert.equal(s.out[fid('motor')] || 0, 0, '부팅 후 꺼진 상태');
  // 1.5 A 어댑터면 리셋 없음
  const ok2 = createSim({ features: kit, rules: full, supply_v: 5 }, { source: 'adapter', adapter_v: 5, adapter_a: 1.5 });
  press(ok2, fid('button')); stepSim(ok2, 1);
  assert.equal(ok2.mcu.resets, 0);
});

ok('배터리 잔량이 적을 때 히터를 켜면 전압 강하로 리셋 (승압 5 W)', () => {
  const f2 = kit.filter((f) => f.kind !== 'battery');
  const s = createSim({ features: f2, rules: [], supply_v: 5 }, { source: 'battery', soc0: 3 });
  s.levels = { [fid('heater')]: 100 };
  stepSim(s, 0.5);
  assert.ok(s.mcu.resets >= 1);
  assert.ok(s.warnings['brownout-low']);
  near(ocv(50), 3.78, 1e-9, 'OCV 50 %');
});

ok('히터 온도: 규칙이 없으면 90 °C 넘게 올라 경고, 70 °C 규칙이 있으면 그 근처에서 끊긴다', () => {
  const run = (rules) => { const s = createSim({ features: kit, rules, supply_v: 5 }, { source: 'usb', usb_limit: 3, ambient: 25 }); s.levels = { [fid('heater')]: 100 }; let max = 0; for (let i = 0; i < 1500; i++) { stepSim(s, 1); max = Math.max(max, s.phys.heaterT); } return { s, max }; };
  const free = run([]);
  assert.ok(free.max > 90 && free.max < 95, `최고 ${free.max}`);
  assert.ok(free.s.warnings.hot);
  const guarded = run(kitRules);
  assert.ok(guarded.max < 72, `최고 ${guarded.max}`);
  assert.ok(!guarded.s.warnings.hot);
});

ok('설계 점검: 기울기 감지가 없으면 넘어져도 계속 도는 것을 알린다', () => {
  const f3 = [makeFeature('button'), makeFeature('motor')];
  const s = createSim({ features: f3, rules: defaultRules(f3), supply_v: 5 }, { source: 'usb' });
  press(s, f3[0].id);
  setInput(s, { tilt: { pitch: 85, roll: 0 } }); stepSim(s, 0.3);
  assert.ok(s.warnings.fallen);
  assert.ok(s.out[f3[1].id] > 0);
});

ok('앱 명령: 연결됐을 때만 쓰이고, 안전 조건이 걸리면 실제 출력은 0', () => {
  const s = createSim({ features: kit, rules: kitRules, supply_v: 5 }, { source: 'battery', usb_plugged: true });
  stepSim(s, 0.1);
  assert.equal(appWrite(s, fid('motor'), 60), false);
  setInput(s, { app: true });
  assert.equal(appWrite(s, fid('motor'), 60), true);
  stepSim(s, 0.1);
  assert.equal(appValues(s)[fid('motor')], 60);
  setInput(s, { lid: 1 }); stepSim(s, 0.1);
  assert.equal(appValues(s)[fid('motor')], 0);
  assert.equal(appValues(s)[fid('lid')], 1);
  // USB 전원인데 배터리 잔량 기능이 있으면 0 % 로 읽혀 막히고 경고
  const u = createSim({ features: kit, rules: kitRules, supply_v: 5 }, { source: 'usb' });
  setInput(u, { app: true }); stepSim(u, 0.1); appWrite(u, fid('motor'), 60); stepSim(u, 0.1);
  assert.equal(appValues(u)[fid('motor')], 0);
  assert.ok(u.warnings.nobatt);
});

ok('펌웨어: 동작 규칙이 C++ 로 들어간다', () => {
  const d = pinUuids({ uuid_base: randomBase(), device_name: 'K', mcu: 'esp32s3', features: assignPins(kit, 'esp32s3'), rules: kitRules });
  const code = firmwareSketch(d);
  ['void refreshOutputs()', 'onPress', 'nextStep', '>= 700', '<= 5', '동작 중 표시', 'digitalRead(PIN_F6_LID) == HIGH'].forEach((t) => assert.ok(code.includes(t), t));
  const count = (ch) => code.split(ch).length - 1;
  assert.equal(count('{'), count('}'));
});

console.log(`\n${n}개 검산 통과`);
