// 공개 3D 쇼룸 검산: 부품을 빼면 어떤 기능이 왜 멈추는지, 버튼을 누르면(가상 시제품) 무엇이 켜지고 3D 에 무엇이 보이는지.
// 실행: npm run check:showroom
import assert from 'node:assert/strict';
import { PRODUCTS, productBySlug } from '../src/lib/showroom/products.js';
import { evaluate, liveStep, impactOf, removableParts, powerParts, controlParts } from '../src/lib/showroom/workCheck.js';
import { createSim, stepSim, setInput } from '../src/lib/devkit/deviceSim.js';
import { assemblySteps, buildAt, checklist, totalSec, fmtSec } from '../src/lib/showroom/assembly.js';

const press = (s, id) => { setInput(s, { pressed: { [id]: true } }); stepSim(s, 0.05); setInput(s, { pressed: { [id]: false } }); stepSim(s, 0.05); };
const fn = (c, id) => c.functions.find((f) => f.id === id);
const sim = (p) => { const s = createSim({ features: p.features, rules: p.rules, supply_v: p.supplyV }, { source: 'usb', usb_plugged: true }); stepSim(s, 0.5); return s; };

// 모든 제품: 정의가 맞는지 (부품 id·기능 id·규칙 대상이 실제로 있는지)
for (const p of PRODUCTS) {
  const ids = new Set(p.parts.map((x) => x.id));
  const fids = new Set(p.features.map((f) => f.id));
  assert.equal(ids.size, p.parts.length, `${p.slug}: 부품 id 중복`);
  p.features.forEach((f) => f.part_id && assert.ok(ids.has(f.part_id), `${p.slug}: ${f.id} 의 부품 ${f.part_id} 없음`));
  p.rules.forEach((r) => { assert.ok(r.src === '*' || fids.has(r.src), `${p.slug}: 규칙 src ${r.src}`); assert.ok(r.dst === '*' || fids.has(r.dst), `${p.slug}: 규칙 dst ${r.dst}`); });
  p.functions.forEach((f) => {
    (f.needs || []).forEach((n) => (typeof n === 'string' ? assert.ok(['@power', '@control'].includes(n)) : n.ids.forEach((id) => assert.ok(ids.has(id), `${p.slug}/${f.id}: 부품 ${id} 없음`))));
    if (f.feature) assert.ok(fids.has(f.feature), `${p.slug}/${f.id}: 기능 ${f.feature} 없음`);
    [...(f.flows || []).flatMap((x) => [x.from, x.to]), ...(f.actions || []).map((a) => a.part)].forEach((id) => assert.ok(id === 'out' || ids.has(id), `${p.slug}/${f.id}: 흐름 부품 ${id} 없음`));
  });
  assert.ok(powerParts(p.parts).length > 0, `${p.slug}: 전원 부품`);
  assert.ok(controlParts(p.parts).length > 0, `${p.slug}: 제어 부품`);
  const all = evaluate(p, []);
  assert.ok(all.power.ok && all.control.ok, `${p.slug}: 다 있으면 켜진다`);
  assert.deepEqual(all.functions.filter((f) => !f.ok).map((f) => f.id), [], `${p.slug}: 다 있으면 모든 기능이 된다`);
  assert.ok(removableParts(p).length >= 5, `${p.slug}: 빼 볼 부품`);
  // 아무 부품이나 하나씩 빼도 깨지지 않고, 이유는 비어 있지 않다
  p.parts.forEach((x) => evaluate(p, [x.id]).functions.forEach((f) => f.ok || assert.ok(f.reasons.length && f.reasons.every(Boolean), `${p.slug}: ${x.id} 뺄 때 이유`)));
}

// 공기청정기
{
  const p = productBySlug('air-purifier');
  assert.deepEqual(powerParts(p.parts).map((x) => x.id), ['d11'], '전원은 USB-C');
  assert.deepEqual(controlParts(p.parts).map((x) => x.id), ['d10']);
  // 필터를 빼면: 바람은 나오지만 먼지는 못 거른다
  let c = evaluate(p, ['d9']);
  assert.equal(fn(c, 'wind').ok, true);
  assert.equal(fn(c, 'clean').ok, false);
  assert.match(fn(c, 'clean').reasons[0], /필터가 없어 바람은 나오지만/);
  // 팬을 빼면 바람·먼지 거르기 둘 다
  c = evaluate(p, ['d8']);
  assert.equal(fn(c, 'wind').ok, false); assert.equal(fn(c, 'clean').ok, false);
  assert.equal(fn(c, 'speed').ok, true, '버튼은 그대로');
  // USB-C 를 빼면 전부 (손가락 보호는 전원과 무관)
  c = evaluate(p, ['d11']);
  assert.equal(c.power.ok, false);
  assert.match(c.power.reason, /USB-C 포트.*모두 빼서 켜지지 않습니다/);
  assert.deepEqual(c.functions.filter((f) => f.ok).map((f) => f.id), ['safe']);
  // 제어 기판을 빼면: 버튼을 눌러도 반응 없음
  c = evaluate(p, ['d10']);
  assert.equal(c.control.ok, false);
  assert.match(fn(c, 'wind').reasons[0], /제어 기판이 없어 버튼을 눌러도 반응하지 않습니다/);
  // 버튼을 빼면 팬을 켤 수 없다 (규칙으로 버튼 → 팬)
  c = evaluate(p, ['d7']);
  assert.equal(c.features.f_fan.ok, false);
  assert.match(c.features.f_fan.reason, /켜는 터치 버튼이 없어/);
  assert.equal(fn(c, 'wind').ok, false);
  // 그릴을 빼면 안전
  assert.match(fn(evaluate(p, ['d5']), 'safe').reasons[0], /손가락이 닿습니다/);
  // 영향: 필터 → 먼지 거르기만
  assert.deepEqual(impactOf(p, [], 'd9').map((f) => f.id), ['clean']);
  assert.deepEqual(impactOf(p, ['d9'], 'd9').map((f) => f.id), [], '이미 뺀 부품은 영향 없음');
  assert.deepEqual(impactOf(p, [], 'd1').map((f) => f.id), [], '외장 케이스는 기능과 무관');

  // 버튼 누르기: 1 → 2 → 3 → 끄기, 표시등은 팬이 도는 동안
  const s = sim(p);
  assert.equal(Number(s.out.f_fan) || 0, 0);
  press(s, 'f_btn'); assert.equal(s.out.f_fan, 40); assert.ok(s.out.f_led > 0, 'LED 는 팬과 함께');
  press(s, 'f_btn'); assert.equal(s.out.f_fan, 70);
  press(s, 'f_btn'); assert.equal(s.out.f_fan, 100);
  press(s, 'f_btn'); assert.equal(Number(s.out.f_fan) || 0, 0); stepSim(s, 0.2); assert.equal(Number(s.out.f_led) || 0, 0);
  press(s, 'f_btn');
  // 3D: 다 있으면 팬 회전 + 흡입 → 필터 → 팬 → 밖
  let live = liveStep(p, evaluate(p, []), s.out, []);
  assert.ok(live.actions.some((a) => a.part === 'd8' && a.kind === 'spin'));
  assert.ok(live.actions.some((a) => a.part === 'd6' && a.kind === 'glow'));
  assert.ok(live.flows.some((f) => f.from === 'd9' && f.to === 'd8' && f.kind === 'air'));
  assert.ok(live.flows.some((f) => f.from === 'd11' && f.to === 'd10' && f.kind === 'power'), '전원 → 제어');
  // 필터를 빼면 필터를 지나는 흐름은 사라지고 바람은 남는다
  live = liveStep(p, evaluate(p, ['d9']), s.out, ['d9']);
  assert.ok(!live.flows.some((f) => f.from === 'd9' || f.to === 'd9'));
  assert.ok(live.flows.some((f) => f.from === 'd8' && f.to === 'out'));
  // 팬을 빼면 회전도 바람도 없다
  live = liveStep(p, evaluate(p, ['d8']), s.out, ['d8']);
  assert.ok(!live.actions.some((a) => a.part === 'd8'));
  assert.ok(!live.flows.some((f) => f.kind === 'air'));
  // 전원을 빼면 아무것도
  live = liveStep(p, evaluate(p, ['d11']), s.out, ['d11']);
  assert.deepEqual([live.flows.length, live.actions.length], [0, 0]);
}

// 가습기
{
  const p = productBySlug('humidifier');
  let c = evaluate(p, ['h_wick']);
  assert.equal(fn(c, 'mist').ok, false);
  assert.match(fn(c, 'mist').reasons[0], /심지가 없어 진동판까지 물이 올라오지 않습니다/);
  assert.equal(fn(c, 'mood').ok, true, '무드등은 된다');
  c = evaluate(p, ['h_level']);
  assert.equal(fn(c, 'mist').ok, true, '수위 센서가 없어도 안개는 나온다');
  assert.equal(fn(c, 'dry').ok, false, '하지만 물이 떨어져도 멈추지 않는다');
  c = evaluate(p, ['h_usb']);
  assert.equal(c.power.ok, false);
  const s = sim(p);
  press(s, 'f_btn'); assert.equal(s.out.f_mist, 1); assert.ok(s.out.f_led > 0, '안개가 나오는 동안 무드등');
  const live = liveStep(p, evaluate(p, []), s.out, []);
  assert.ok(live.flows.some((f) => f.from === 'h_wick' && f.to === 'h_disc' && f.kind === 'water'));
  assert.ok(live.actions.some((a) => a.part === 'h_led' && a.kind === 'glow'));
  press(s, 'f_btn'); assert.equal(Number(s.out.f_mist) || 0, 0);
}

// 야간투시경
{
  const p = productBySlug('night-vision');
  assert.deepEqual(powerParts(p.parts).map((x) => x.id).sort(), ['i_bat1', 'i_bat2', 'u_usbc']);
  // 배터리 둘을 빼도 USB-C 로 켜지지만, 들고 다니기는 안 된다
  let c = evaluate(p, ['i_bat1', 'i_bat2']);
  assert.equal(c.power.ok, true); assert.equal(c.power.battery, false); assert.equal(c.power.usb, true);
  assert.equal(fn(c, 'carry').ok, false);
  assert.equal(fn(c, 'see').ok, true);
  // 배터리 하나만 빼면 여전히 들고 다닐 수 있다
  assert.equal(fn(evaluate(p, ['i_bat1']), 'carry').ok, true);
  // 전원 셋을 다 빼면 꺼진다
  assert.equal(evaluate(p, ['i_bat1', 'i_bat2', 'u_usbc']).power.ok, false);
  // OLED 하나만 빼면: 보이긴 하지만 두 눈으로는 아니다
  c = evaluate(p, ['i_oledR']);
  assert.equal(fn(c, 'see').ok, true); assert.equal(fn(c, 'both').ok, false);
  c = evaluate(p, ['i_oledL', 'i_oledR']);
  assert.equal(fn(c, 'see').ok, false);
  // 센서를 빼면 영상에 기대는 기능이 모두 멈춘다
  c = evaluate(p, ['i_sensor']);
  ['see', 'both', 'dark', 'day', 'rec'].forEach((id) => assert.equal(fn(c, id).ok, false, id));
  assert.equal(fn(c, 'phone').ok, true, '휴대폰 연결 자체는 된다');
  // 적외선 LED 를 빼면 완전 암흑만
  assert.deepEqual(impactOf(p, [], 'i_irled').map((f) => f.id), ['dark']);
  // 메인 기판·MCU 둘 다 제어 부품
  assert.equal(evaluate(p, ['i_mcu']).control.ok, false);
  // 버튼: 전원 → 화면, 적외선 단계 끔 → 30 → 100
  const s = sim(p);
  press(s, 'f_pwr'); assert.equal(s.out.f_screen, 1);
  press(s, 'f_irbtn'); assert.ok(s.out.f_ir > 0, '적외선 1단');
  let live = liveStep(p, evaluate(p, []), s.out, []);
  assert.ok(live.flows.some((f) => f.from === 'i_sensor' && f.to === 'b_main' && f.kind === 'signal'));
  assert.ok(live.flows.some((f) => f.from === 'i_irled' && f.to === 'out' && f.kind === 'light'));
  assert.ok(live.actions.some((a) => a.part === 'i_oledL' && a.kind === 'glow'));
  // 적외선 LED 를 빼면 빛 흐름이 없다. 오른쪽 OLED 를 빼면 그쪽 영상 흐름이 없다
  live = liveStep(p, evaluate(p, ['i_irled', 'i_oledR']), s.out, ['i_irled', 'i_oledR']);
  assert.ok(!live.flows.some((f) => f.kind === 'light'));
  assert.ok(!live.flows.some((f) => f.to === 'i_oledR'));
  assert.ok(live.flows.some((f) => f.to === 'i_oledL'));
}

// 조립 순서: 모든 부품이 정확히 한 단계에 한 번, 앞 단계 부품은 계속 보이고 뒤 단계 부품은 안 보인다
for (const p of PRODUCTS) {
  const steps = assemblySteps(p);
  assert.ok(steps[0].prep, `${p.slug}: 0단계는 부품 확인`);
  const used = steps.flatMap((s) => s.parts);
  const ids = p.parts.map((x) => x.id);
  assert.deepEqual([...used].sort(), [...ids].sort(), `${p.slug}: 모든 부품이 한 번씩 (빠짐: ${ids.filter((i) => !used.includes(i))}, 중복·없는 id: ${used.filter((i, k) => used.indexOf(i) !== k || !ids.includes(i))})`);
  steps.forEach((s, i) => {
    assert.ok(s.title && s.how?.length && s.check && s.sec > 0, `${p.slug} ${i}단계: 제목·작업·검사·시간`);
    const b = buildAt(p, steps, i);
    if (s.prep) { assert.equal(b.explode, 1); assert.equal(b.shown.length, ids.length); return; }
    s.parts.forEach((id) => assert.ok(b.shown.includes(id) && b.enter.includes(id)));
    steps.slice(0, i).flatMap((x) => x.parts).forEach((id) => assert.ok(b.shown.includes(id), `${p.slug} ${i}단계: 앞 단계 ${id} 가 보여야`));
    if (s.parts.length) steps.slice(i + 1).flatMap((x) => x.parts).forEach((id) => assert.ok(!b.shown.includes(id), `${p.slug} ${i}단계: 뒤 단계 ${id} 는 아직`));
    assert.ok(['up', 'down', 'front', 'back', 'left', 'right'].includes(b.from));
  });
  assert.ok(steps.at(-1).demo, `${p.slug}: 마지막은 작동 검사`);
  assert.ok(totalSec(steps) > 60);
}
{
  const nv = checklist(productBySlug('night-vision').parts);
  assert.equal(nv.find((x) => x.name === '고무 그립').n, 2, '왼쪽·오른쪽은 묶음');
  assert.equal(nv.find((x) => x.name === '배터리 18650 3,500 mAh').n, 2, '(1)·(2) 묶음');
  assert.equal(fmtSec(270), '4분 30초'); assert.equal(fmtSec(45), '45초'); assert.equal(fmtSec(120), '2분');
}

console.log(`✓ 쇼룸 검산 통과 (제품 ${PRODUCTS.length}개 · 부품 빼 보기 · 버튼 작동 · 3D 흐름 · 조립 순서)`);
