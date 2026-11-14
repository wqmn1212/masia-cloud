// 시제품 개발 파이프라인 검산: 핀 배정, 블루투스 UUID·값 변환, 펌웨어 뼈대, 회로 시작안 계산, SolidCraft 스크립트
// 실행: npm run check:devkit
import assert from 'node:assert/strict';
import { FEATURE_KINDS, makeFeature, assignPins, pinProblems, featureBom, MCUS, suggestFeatures } from '../src/lib/devkit/features.js';
import { randomBase, uuidAt, isUuid, buildGatt, pinUuids, encodeValue, decodeValue, bytesHex, firmwareSketch, protocolDoc } from '../src/lib/devkit/ble.js';
import { starterCircuit, featureBlock, hasBlock } from '../src/lib/devkit/circuitStarter.js';
import { defaultCadParams, topCutouts, solidcraftScript, mcpBrief, conceptBounds, cadParts } from '../src/lib/devkit/solidcraft.js';
import { Simulator } from '../src/lib/circuit/solver.js';
import { defaultRules, applyPress, effectiveLevels, describeRule } from '../src/lib/devkit/rules.js';
import { createSim, stepSim, setInput, appWrite, appValues, runtimeHours, ocv, refill, turnDial, setClock, clockText, pivotClearance } from '../src/lib/devkit/deviceSim.js';
import { shellParts, mainShellId, partParams, partCutouts } from '../src/lib/devkit/solidcraft.js';
import { drawingSvg, pickScale } from '../src/lib/devkit/drawing.js';
import { DEFAULT_SIM_PARAMS, SIM_PARAMS, caseThermal, monthlyCost } from '../src/lib/devkit/thermal.js';
import { setParams } from '../src/lib/devkit/deviceSim.js';
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
kit.find((f) => f.kind === 'heater').power_w = 5; // 아래 검산은 5 W 히터 기준
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
  assert.ok(free.max > 90 && free.max < 110, `최고 ${free.max}`); // 새는 열이 작은 외장 안 공기를 데워 조금 더 오른다
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
  ['void refreshOutputs()', 'onPress', 'nextStep', '>= 700', '<= 5', '동작 중 표시', 'digitalRead(PIN_F6_LID) == HIGH', '== INT16_MIN || in'].forEach((t) => assert.ok(code.includes(t), t));
  const count = (ch) => code.split(ch).length - 1;
  assert.equal(count('{'), count('}'));
});

// ── 가열식 가습기 (끓임·수위·공가열·외장 부품별 도면) ──
const hhParts = [
  { id: 'p1', name: '하부 본체', layer: 'SHELL', shape: 'rounded_box', size: { x: 180, y: 110, z: 180 }, position: { x: 0, y: 55, z: 0 }, material: 'PP' },
  { id: 'p2', name: '물탱크', layer: 'SHELL', shape: 'rounded_box', size: { x: 172, y: 150, z: 172 }, position: { x: 0, y: 186, z: 0 } },
  { id: 'p3', name: '물탱크 뚜껑', layer: 'SHELL', shape: 'cylinder', size: { x: 70, y: 12, z: 70 }, position: { x: -40, y: 267, z: -40 } },
  { id: 'p5', name: '고무 발', layer: 'SHELL', shape: 'cylinder', size: { x: 16, y: 4, z: 16 }, position: { x: 70, y: 2, z: 70 } },
  { id: 'p6', name: '가열 챔버', layer: 'INTERNAL', shape: 'cylinder', size: { x: 72, y: 55, z: 72 }, position: { x: 0, y: 72, z: -10 } },
  { id: 'p7', name: '후막 히터 48 W', layer: 'INTERNAL', shape: 'cylinder', size: { x: 64, y: 5, z: 64 }, position: { x: 0, y: 41, z: -10 } },
  { id: 'p8', name: '히터 온도 센서', layer: 'INTERNAL', shape: 'cylinder', size: { x: 5, y: 8, z: 5 }, position: { x: -26, y: 35, z: -10 } },
  { id: 'p9', name: '온도 퓨즈', layer: 'INTERNAL', shape: 'box', size: { x: 10, y: 4, z: 4 }, position: { x: 26, y: 35, z: -10 } },
  { id: 'p10', name: '수위 감지 플로트', layer: 'INTERNAL', role: '리드 스위치', shape: 'cylinder', size: { x: 16, y: 18, z: 16 }, position: { x: 52, y: 80, z: -10 } },
  { id: 'p14', name: '전원 버튼', layer: 'UI', shape: 'cylinder', size: { x: 14, y: 3, z: 14 }, position: { x: 22, y: 62, z: 91.5 }, rotation_deg: { x: 90, y: 0, z: 0 } },
  { id: 'p15', name: '모드 버튼', layer: 'UI', shape: 'cylinder', size: { x: 14, y: 3, z: 14 }, position: { x: 48, y: 62, z: 91.5 }, rotation_deg: { x: 90, y: 0, z: 0 } },
  { id: 'p17', name: 'DC 잭', layer: 'UI', shape: 'box', size: { x: 12, y: 10, z: 4 }, position: { x: 0, y: 25, z: -91 } },
];

ok('가습기 부품 → 기능: 히터 48 W, 센서는 온도, 플로트는 수위, 퓨즈·챔버는 건너뜀', () => {
  const f = suggestFeatures(hhParts);
  assert.deepEqual(f.map((x) => `${x.kind}:${x.name}`), ['heater:후막 히터 48 W', 'temp:히터 온도 센서', 'water:수위 감지 플로트', 'button:전원 버튼', 'button:모드 버튼']);
  assert.equal(f[0].power_w, 48);
  assert.deepEqual(pinProblems(assignPins(f, 'esp32c3'), 'esp32c3'), []);
});

const hh = assignPins([...suggestFeatures(hhParts), makeFeature('tilt'), makeFeature('led')], 'esp32c3');
const hid = (k) => hh.find((f) => f.kind === k).id;
const hhRules = defaultRules(hh);

ok('가습기 기본 규칙: 전원 켜고 끄기·모드 단계, 물 부족·120 °C·기울어짐이면 히터 끄기', () => {
  const t = hhRules.map((r) => describeRule(r, hh));
  assert.ok(t.includes('전원 버튼 을(를) 누르면 → 후막 히터 48 W 켜고 끄기'), t.join('\n'));
  assert.ok(t.includes('모드 버튼 을(를) 누르면 → 후막 히터 48 W 단계 바꾸기'));
  assert.ok(t.includes('수위 감지 플로트 이(가) 물이 부족하면 → 후막 히터 48 W 끄기'));
  assert.ok(t.includes('히터 온도 센서 이(가) 120°C 이상이면 → 후막 히터 48 W 끄기'));
  assert.ok(!t.some((x) => x.includes('70°C')), '끓는 제품에 70 °C 차단은 없어야 한다');
});

const boil = (rules, water, sec) => {
  const s = createSim({ features: hh, rules, supply_v: 24 }, { source: 'adapter', adapter_v: 24, adapter_a: 2.5, water_ml: water, tank_ml: 3000 });
  s.levels = { [hid('heater')]: 100 };
  let maxT = 0;
  for (let i = 0; i < sec; i++) { stepSim(s, 1); maxT = Math.max(maxT, s.phys.heaterT); }
  return { s, maxT };
};

ok('끓임: 48 W 히터가 24 V 에서 약 2 A, 물은 100 °C 에서 끓고 가습량은 약 60~70 ml/h', () => {
  const { s, maxT } = boil(hhRules, 3000, 900);
  near(s.rails.i, 2.05, 0.1, '입력 전류');
  near(maxT, 100, 0.01, '최고 온도');
  assert.ok(s.phys.steamRate > 55 && s.phys.steamRate < 75, `가습량 ${s.phys.steamRate}`);
  assert.ok(s.phys.water < 3000 && s.phys.water > 2950);
  assert.ok(!s.warnings.hot && !s.warnings.fuse && !s.warnings.dry);
});

ok('공가열: 규칙이 없으면 물이 다 끓은 뒤 온도 퓨즈(128 °C)가 끊어지고 다시 켜지지 않는다', () => {
  const { s } = boil([], 10, 900); // 10 ml 가 다 끓는 데 약 10분
  assert.equal(s.phys.water, 0);
  assert.ok(s.phys.fuseBlown);
  assert.ok(s.warnings.fuse && s.warnings.dry);
  assert.equal(s.loads.find((l) => l.kind === 'heater')?.i || 0, 0);
});

ok('공가열 보호: 수위 감지가 물 부족에서 히터를 끊어 퓨즈가 살아 있다. 물을 채우면 다시 가열', () => {
  const { s, maxT } = boil(hhRules, 120, 3600); // 데우는 데 약 8분, 40 ml 를 끓이는 데 약 35분 → 80 ml 밑에서 플로트가 끊는다
  assert.ok(!s.phys.fuseBlown, `최고 ${maxT}`);
  assert.equal(s.out[hid('heater')], 0);
  assert.ok(maxT < 128);
  refill(s, 1000); stepSim(s, 120);
  assert.equal(s.out[hid('heater')], 100);
  near(s.phys.heaterT, 100, 0.01, '다시 끓음');
});

ok('어댑터가 작으면: 24 V 1.5 A 에서 48 W 히터는 한도에 걸린다', () => {
  const s = createSim({ features: hh, rules: hhRules, supply_v: 24 }, { source: 'adapter', adapter_v: 24, adapter_a: 1.5, water_ml: 3000 });
  s.levels = { [hid('heater')]: 100 };
  stepSim(s, 2);
  assert.ok(s.warnings.overload || s.warnings['brownout-limit']);
});

ok('외장 부품별: 본체는 앞면 버튼·뒷면 잭, 물탱크는 윗면 뚜껑 자리, 고무 발은 개구부가 아님', () => {
  assert.deepEqual(shellParts(hhParts).map((p) => p.id), ['p2', 'p1']);
  assert.equal(mainShellId(hhParts), 'p1');
  const base = partCutouts(hhParts, 'p1');
  assert.deepEqual(base.map((c) => `${c.face}:${c.name}`), ['front:전원 버튼', 'front:모드 버튼', 'back:DC 잭']);
  assert.deepEqual(base[0], { id: 'p14', name: '전원 버튼', face: 'front', kind: 'circle', x: 22, z: -48, d: 14 });
  assert.deepEqual(partCutouts(hhParts, 'p2').map((c) => `${c.face}:${c.name}:${c.d}`), ['top:물탱크 뚜껑:70']);
  const p = partParams(hhParts, 'p1');
  assert.deepEqual([p.width, p.depth, p.height, p.corner], [180, 180, 110, 8]);
  const sc = solidcraftScript(p, base);
  const fe = sc.commands.findIndex((c) => c.command === 'sketch.create' && c.params.plane === 'XZ');
  assert.ok(fe > 0, '앞면 스케치');
  assert.deepEqual(sc.commands[fe + 1].params, { center: [22, 48], diameter: 14 });
  assert.ok(!sc.commands.some((c) => JSON.stringify(c.params).includes('DC')), '뒷면은 스크립트에 넣지 않는다');
});

ok('설계 도면: A3 3면도·치수·구멍 표·표제란, 척도 자동, 글자 이스케이프', () => {
  const p = partParams(hhParts, 'p1');
  const d = drawingSvg({ title: 'HH<1> & 시험', partName: '하부 본체', material: 'PP', params: p, cutouts: partCutouts(hhParts, 'p1'), date: '2026-11-14', docNo: 'HH1-01' });
  assert.equal(d.scale, '1:2');
  ['평면도', '정면도', '우측면도', '등각도', '구멍·개구부 표', '3각법', 'KS B ISO 2768-m', 'HH1-01', 'R8', '>180<', '>110<', 'Ø14', '위에서 48', 'HH&lt;1&gt; &amp; 시험'].forEach((t) => assert.ok(d.svg.includes(t), t));
  assert.ok(!d.svg.includes('HH<1>'));
  assert.ok(!/NaN|undefined/.test(d.svg));
  assert.equal(d.svg.split('class="hidden"').length - 1, 1, '뒷면 잭은 숨은선 하나');
  assert.deepEqual(pickScale(20, 15, 10), [5, '5:1']);
  assert.deepEqual(pickScale(600, 400, 900)[1], '1:10');
});

// ── 발열·소비전력·부품 값 수정 ──
const heatSim = (params = {}, power = {}) => {
  const s = createSim({ features: hh, rules: hhRules, supply_v: 24 }, { source: 'adapter', adapter_v: 24, adapter_a: 2.5, water_ml: 3000, ...power }, { case_w: 180, case_d: 180, case_h: 110, ...params });
  s.levels = { [hid('heater')]: 100 };
  return s;
};
const run = (s, sec) => { for (let i = 0; i < sec; i++) stepSim(s, 1); return s; };
const sumW = (s) => s.powerNow.parts.reduce((a, x) => a + x.w, 0);

ok('전력 나누기: 부품별 전력의 합 = 전원 입력 전력, 콘센트 = 입력 ÷ 어댑터 효율', () => {
  const s = run(heatSim(), 600);
  near(sumW(s), s.powerNow.dc, 1e-6, '부품 합');
  near(s.powerNow.wall, s.powerNow.dc / 0.88, 1e-6, '콘센트');
  near(s.powerNow.dc, 48.4, 0.6, 'DC 입력');
});

ok('LDO 에 24 V: (24 − 3.3) V × 전류만큼 열 → 과열·입력 초과 경고, 벅으로 바꾸면 해결됨', () => {
  const s = run(heatSim(), 300);
  const ldo = s.powerNow.parts.find((x) => x.key === 'reg');
  near(ldo.heat, (s.rails.vin - 3.3) * s.rails.i33 + s.rails.vin * 0.0001, 1e-9, 'LDO 손실 (대기 전류 포함)');
  assert.ok(ldo.temp > 125, `LDO ${ldo.temp}`);
  assert.ok(s.warnings['ldo-vmax'] && s.warnings['heat-reg']);
  setParams(s, { reg: 'buck' }); run(s, 120);
  const buck = s.powerNow.parts.find((x) => x.key === 'reg');
  assert.ok(buck.temp < 40, `벅 ${buck.temp}`);
  assert.ok(s.warnings['ldo-vmax'].resolved && s.warnings['heat-reg'].resolved);
  assert.ok(s.events.some((e) => e.text.startsWith('해결됨')));
});

ok('MOSFET 발열: 손실 = I² × Rds(on), 80 W 히터를 SOT-23 에 걸면 온도가 오르고 Rds·열저항을 고치면 내려간다', () => {
  const a = run(heatSim({ reg: 'buck' }, { adapter_a: 5 }), 10);
  a.features.find((f) => f.kind === 'heater').power_w = 80; // 화면에서 히터 W 를 바꾼 것과 같다
  run(a, 300);
  const fet = a.powerNow.parts.find((x) => x.kind === 'fet');
  const ion = a.rails.vdrive / (24 * 24 / 80);
  near(fet.heat, ion * ion * 0.045, 1e-6, 'MOSFET 손실');
  const hotT = fet.temp;
  setParams(a, { fet_rds: 9, fet_rth: 50 }); run(a, 120);
  const cool = a.powerNow.parts.find((x) => x.kind === 'fet').temp;
  assert.ok(hotT > 85 && cool < 45, `${hotT} → ${cool}`);
});

ok('외장 열: 표면적·대류 계수로 내부 공기가 오르고, 작은 밀폐 외장은 더 뜨겁다', () => {
  const big = caseThermal({ ...DEFAULT_SIM_PARAMS, case_w: 180, case_d: 180, case_h: 110 });
  near(big.area, 0.1440, 1e-4, '표면적'); near(big.rth, 1 / (8 * 0.144), 1e-6, '열저항');
  const small = run(heatSim({ reg: 'buck', case_w: 80, case_d: 60, case_h: 40, case_hc: 6, inside_max: 50 }), 3000);
  const large = run(heatSim({ reg: 'buck', inside_max: 50 }), 3000);
  assert.ok(small.thermal.tin > large.thermal.tin + 15, `${small.thermal.tin} vs ${large.thermal.tin}`);
  assert.ok(small.warnings['inside-hot'] && !large.warnings['inside-hot']);
  setParams(small, { case_hc: 15 }); run(small, 3000); // 통풍구를 낸 것
  assert.ok(small.warnings['inside-hot'].resolved, `통풍구 뒤 ${small.thermal.tin}`);
});

ok('전력량·전기요금: Wh 누적 = 평균 전력 × 시간, 월 요금 = 콘센트 W × 하루 시간 × 30 × 단가', () => {
  const s = run(heatSim({ reg: 'buck' }), 3600);
  assert.ok(s.energy.wh > 40 && s.energy.wh < 50, `${s.energy.wh} Wh`);
  const c = monthlyCost(s);
  near(c.won, Math.round(c.avgW * 8 * 30 / 1000 * 150), 1, '월 요금');
  setParams(s, { price_kwh: 300 }); assert.ok(Math.abs(monthlyCost(s).won - c.won * 2) <= 2);
});

ok('부품 값 목록: 모든 항목에 기본값·단위(선택형 제외)', () => {
  SIM_PARAMS.forEach((p) => { assert.ok(p.default !== undefined, p.key); if (p.type !== 'select') assert.ok(p.unit && p.min < p.max, p.key); });
  assert.ok(featureBom(hh, 'esp32c3', 24).some((b) => b.name.startsWith('벅 컨버터 24 V')));
  assert.ok(featureBom(hh, 'esp32c3', 5).some((b) => b.name.startsWith('LDO')));
});

// ── 양면 수면 조명 (무니스): 조명 모듈·시계·다이얼·수면 일정·과열 차단·본체 기울기 ──
const lamp = assignPins([
  { ...makeFeature('light', '전면 기상등 (4000K)'), id: 'front', face: 'front', power_w: 5, cct: 4000 },
  { ...makeFeature('light', '후면 수면등 (2700K)'), id: 'rear', face: 'rear', power_w: 1.8, cct: 2700 },
  { ...makeFeature('display', '호박색 시계'), id: 'clock' },
  { ...makeFeature('encoder', '다이얼 버튼'), id: 'dial' },
  { ...makeFeature('switch', '수면 모드 토글'), id: 'sleep' },
  { ...makeFeature('button', '블루투스 버튼'), id: 'bt' },
  { ...makeFeature('temp', '전면 LED 판 온도'), id: 'ntc', watch: 'front' },
], 'esp32c3');
const lampRules = defaultRules(lamp);
const pivot = { origin: { y: 18, z: 0 }, min: -15, max: 15, check: { bottom_y: 40, base_top_y: 36, half_t: 14 } };
const lampSim = (params = {}, power = {}) => createSim({ features: lamp, rules: lampRules, supply_v: 12, pivot }, { source: 'adapter', adapter_v: 12, adapter_a: 1.5, clock0: '22:25', ...power }, { reg: 'buck', case_w: 150, case_d: 28, case_h: 150, ...params });
const hold = (s, id, sec) => { setInput(s, { pressed: { ...s.input.pressed, [id]: true } }); stepSim(s, sec); setInput(s, { pressed: { ...s.input.pressed, [id]: false } }); stepSim(s, 0.05); };

ok('조명 기본 규칙: 시계는 조명이 켜져 있을 때만, 수면 모드 스위치 → 일정, 블루투스 버튼 → 페어링', () => {
  const t = lampRules.map((r) => describeRule(r, lamp));
  assert.ok(t.some((x) => x.includes('호박색 시계 켜기')), t.join('\n'));
  assert.ok(t.some((x) => x.startsWith('수면 모드 토글 이(가) 켜져 있으면 → 취침 23:00 전 30분')), t.join('\n'));
  assert.ok(t.includes('블루투스 버튼 을(를) 누르면 → 블루투스 페어링 (앱 연결)'));
  const fw = firmwareSketch({ features: lamp, rules: lampRules, mcu: 'esp32c3', uuid_base: randomBase(() => 0.5) });
  assert.ok(fw.includes('ledcAttach(PIN_F') && fw.includes('TODO 수면 일정') && fw.includes('BLEDevice::startAdvertising();  // 블루투스 페어링'));
});

ok('다이얼: 짧게 누르면 뒤 수면등 60 % 가 서서히 켜지고 시계도 켜짐, 길게 누르면 앞으로, 돌리면 밝기', () => {
  const s = lampSim();
  hold(s, 'dial', 0.2);
  assert.equal(s.levels.rear, 60); assert.equal(s.levels.front || 0, 0);
  assert.ok(s.phys.light.rear > 0 && s.phys.light.rear < 60, `번쩍임 없이 서서히 ${s.phys.light.rear}`);
  stepSim(s, 2);
  assert.ok(Math.abs(s.phys.light.rear - 60) < 0.1 && s.out.clock === 1);
  hold(s, 'dial', 1.0); // 길게 → 앞
  assert.equal(s.levels.front, 60); assert.equal(s.levels.rear, 0);
  turnDial(s, 'dial', 4); stepSim(s, 0.1);
  assert.equal(s.levels.front, 80);
  turnDial(s, 'dial', -20); stepSim(s, 0.1);
  assert.ok(s.levels.front >= 1 && s.levels.front < 10, `${s.levels.front}`);
  hold(s, 'dial', 0.2); stepSim(s, 2);
  assert.ok(!s.levels.front && s.out.clock === 0, '끄면 시계도 꺼짐');
});

ok('광량: 전면 5 W 100 % → 45 cm 약 715 lux (500 lux 목표 + 여유), 1 % 에서는 1 lux 아래 (감마 2.2)', () => {
  const s = lampSim();
  s.levels = { front: 100 }; stepSim(s, 3);
  const lux = s.phys.lux.front;
  assert.ok(lux > 640 && lux < 720, `${lux}`); // 12 V 레일에서 드라이버까지 처짐 약간
  s.levels = { front: 1 }; stepSim(s, 3);
  assert.ok(s.phys.lux.front < 1 && s.phys.lux.front > 0, `${s.phys.lux.front}`);
  s.levels = { front: 100, rear: 100 }; stepSim(s, 3);
  assert.ok(s.powerNow.dc > 7 && s.powerNow.dc < 9.5, `양면 최대 ${s.powerNow.dc} W`);
});

ok('수면 일정: 22:30 부터 30분 감광 → 23:00 소등(시계도), 07:30 부터 기상등 증광 → 08:00 100 %', () => {
  const s = lampSim();
  setInput(s, { switches: { sleep: true } });
  s.levels = { rear: 60 }; stepSim(s, 4 * 60); // 22:29
  assert.ok(Math.abs(s.levels.rear - 60) < 0.01, `${clockText(s)} ${s.levels.rear}`);
  stepSim(s, 16 * 60); // 22:45
  assert.ok(Math.abs(s.levels.rear - 30) < 1, `${clockText(s)} ${s.levels.rear}`);
  stepSim(s, 16 * 60); // 23:01
  assert.ok(!s.levels.rear && s.out.clock === 0, `${clockText(s)}`);
  setClock(s, '07:44'); stepSim(s, 61);
  assert.ok(Math.abs(s.levels.front - 50) < 4, `${clockText(s)} ${s.levels.front}`);
  stepSim(s, 16 * 60);
  assert.equal(s.levels.front, 100); assert.equal(s.out.clock, 1);
  assert.ok(s.events.some((e) => e.text.includes('기상 최대 밝기')));
});

ok('LED 판 과열: 방열판 없이(열저항 20) 밀폐(열전달 3)면 85 °C 하드웨어 차단 → 식으면 다시 허용', () => {
  const s = lampSim({ led_rth: 20, case_hc: 3 });
  s.levels = { front: 100, rear: 100 };
  let cutAt = null, peak = 0;
  for (let i = 0; i < 3600 && cutAt == null; i++) { stepSim(s, 1); peak = Math.max(peak, s.readings.ntc); if (s.phys.cut.front) cutAt = s.t; }
  assert.ok(cutAt != null && s.warnings['cut-front'], '차단');
  assert.equal(s.out.front, 0);
  assert.ok(peak >= 83, `NTC 최고 ${peak}`);
  for (let i = 0; i < 1200 && s.phys.cut.front; i++) stepSim(s, 1);
  assert.ok(!s.phys.cut.front, '식으면 다시 허용');
  const ok8 = lampSim(); ok8.levels = { front: 100, rear: 100 }; for (let i = 0; i < 3600; i++) stepSim(ok8, 1);
  assert.ok(!ok8.phys.cut.front && ok8.thermal.nodes['led-front'] < 75, `기본 방열 ${ok8.thermal.nodes['led-front']}`);
});

ok('본체 기울기: 회전축이 받침대 가운데(높이 18)면 4 mm 갭으로 15° 에서 닿고, 갭 5 mm 면 비켜감', () => {
  near(pivotClearance(pivot, 0), 4, 1e-9, '정자세 갭');
  assert.ok(pivotClearance(pivot, 15) < 0 && pivotClearance(pivot, 15) > -0.6, `${pivotClearance(pivot, 15)}`);
  assert.ok(pivotClearance({ ...pivot, check: { ...pivot.check, bottom_y: 41 } }, 15) > 0.3);
  const s = lampSim(); setInput(s, { pivot: 15 }); stepSim(s, 0.1);
  assert.ok(s.warnings.pivot && /4\.\d mm 이상/.test(s.warnings.pivot.text), s.warnings.pivot?.text);
  setInput(s, { pivot: 8 }); stepSim(s, 0.1);
  assert.ok(s.warnings.pivot.resolved);
});

ok('블루투스 버튼: 누르면 페어링되어 앱 연결, 앱에서 밝기를 바꿀 수 있다', () => {
  const s = lampSim();
  assert.ok(!s.input.app);
  hold(s, 'bt', 0.1);
  assert.ok(s.input.app && appWrite(s, 'front', 40));
  stepSim(s, 2); assert.ok(Math.abs(appValues(s).front - 40) < 0.01);
});

console.log(`\n${n}개 검산 통과`);
