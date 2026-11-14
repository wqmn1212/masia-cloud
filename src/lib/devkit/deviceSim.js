// 가상 시제품: 전원(배터리·USB·어댑터) → 3.3 V 레귤레이터 → MCU(동작 규칙) → 구동부·센서를 시간에 따라 계산한다.
// 버튼 누르기·뚜껑 열기·기울이기·주변 온도·앱 명령을 넣으면 전압·전류·배터리·온도·모터 속도와 MCU 리셋까지 따라 바뀐다.
// 값은 데이터시트 수준의 근사 모델이며, 설계 초기에 "이 조합이면 무엇이 문제인가"를 찾는 용도다.
import { FEATURE_KINDS, OUTPUT_LEVELS, DRIVE_KINDS, isOutput, heaterWatts } from './features.js';
import { applyPress, effectiveLevels, validRules, ALL } from './rules.js';
import { DEFAULT_SIM_PARAMS, initThermal, updateThermal, thermalChecks } from './thermal.js';

export const POWER_SOURCES = {
  usb: { label: 'USB 전원', note: '5 V, PC 포트 0.5 A · 충전기 1.5~3 A' },
  adapter: { label: 'DC 어댑터', note: '전압·정격 전류 지정' },
  battery: { label: '리튬 배터리 1S', note: '3.0~4.2 V, 용량 지정, USB 로 충전' },
};
export const defaultPower = (features) => ({
  source: features.some((f) => f.kind === 'battery') ? 'battery' : 'usb',
  usb_limit: 1.5, adapter_v: 12, adapter_a: 2, battery_mah: 2000, soc0: 80, usb_plugged: false, ambient: 25,
  // 물을 끓이는 제품: 물탱크 용량·시작 물 양 (수위 감지가 있으면 물이 찬 상태로 시작)
  tank_ml: 3000, water_ml: features.some((f) => f.kind === 'water') ? 3000 : 0,
});

// 상수 (근사)
const K = {
  mcuApp: 0.012, sensor: 0.001, ldoDrop: 0.25, ldoQ: 0.0001,
  brownout: 2.8, bootOk: 3.0, bootTime: 0.35,
  usbRint: 0.25, adapterRint: 0.08, battRint: 0.15, chargeA: 0.5,
  motorTau: 0.3, motorBack: 0.85, motorFric: 0.04,
  heaterRth: 15, heaterC: 20, chamberMl: 60, waterC: 4.186, latent: 2260, lowWaterMl: 80, fuseC: 128,
  buzzerA: 0.02, servoMoveA: 0.25, servoIdleA: 0.008, servoSpeed: 300, ledA: 0.004,
  tiltSwitch: 45, fallen: 60,
};

/** 리튬 1S 무부하 전압 (잔량 %) */
export function ocv(soc) {
  const pts = [[0, 3.0], [5, 3.45], [10, 3.6], [30, 3.72], [50, 3.78], [70, 3.9], [90, 4.08], [100, 4.2]];
  const s = Math.max(0, Math.min(100, soc));
  for (let i = 1; i < pts.length; i++) if (s <= pts[i][0]) { const [a, va] = pts[i - 1], [b, vb] = pts[i]; return va + ((vb - va) * (s - a)) / (b - a); }
  return 4.2;
}

const tiltAngle = (t) => (Math.acos(Math.max(-1, Math.min(1, Math.cos((t.pitch * Math.PI) / 180) * Math.cos((t.roll * Math.PI) / 180)))) * 180) / Math.PI;

export function createSim(dev, power = {}, params = {}) {
  const features = dev.features || [];
  const p = { ...defaultPower(features), ...power };
  const heater = features.find((f) => f.kind === 'heater');
  const s = {
    params: { ...DEFAULT_SIM_PARAMS, ...(dev.sim_params || {}), ...params },
    features, rules: validRules(dev.rules, features), supplyV: Number(dev.supply_v) || 5, power: p,
    t: 0,
    input: { pressed: {}, lid: 0, tilt: { pitch: 0, roll: 0 }, dial: {}, app: false },
    levels: {}, prevPressed: {},
    mcu: { on: true, boot: 0, resets: 0, why: '' },
    phys: { soc: Number(p.soc0) || 80, heaterT: Number(p.ambient) || 25, motor: {}, servo: {}, water: Math.max(0, Number(p.water_ml) || 0), steamRate: 0, steamTotal: 0, fuseBlown: false },
    out: {}, blockedBy: {}, readings: {}, rails: { vin: 0, v33: 3.3, vdrive: 0, i: 0, iDrive: 0, i33: 0, limit: Infinity, overload: false },
    loads: [], history: [], events: [], warnings: {}, hasHeater: !!heater, lastSample: -1,
  };
  initThermal(s);
  return s;
}

/** 부품 값 바꾸기 (다음 계산부터 반영). 고친 결과는 경고가 '해결됨'으로 바뀌는 것으로 보인다 */
export function setParams(s, patch) {
  const changed = Object.keys(patch).filter((k) => s.params[k] !== patch[k]);
  if (!changed.length) return;
  Object.assign(s.params, patch);
  // 부품을 바꾼 것(레귤레이터 종류)은 새 부품이므로 내부 공기 온도에서 다시 시작한다
  if (changed.includes('reg') && s.thermal) delete s.thermal.nodes.reg;
  log(s, `부품 값 변경: ${changed.join(', ')}`);
}

const log = (s, text, kind = 'info') => { s.events.unshift({ t: s.t, text, kind }); if (s.events.length > 80) s.events.pop(); };
const warn = (s, key, text, level = 'warn') => {
  const w = s.warnings[key];
  if (!w) { s.warnings[key] = { key, text, level, t: s.t }; log(s, text, level); }
  else if (w.resolved) { Object.assign(w, { text, level, resolved: false, t: s.t }); log(s, text, level); }
  else w.text = text; // 숫자(온도·전류)는 최신 값으로
};
/** 조건이 풀리면 '해결됨'으로 표시한다 (부품 값을 고친 효과가 보이게) */
const resolve = (s, key) => {
  const w = s.warnings[key];
  if (w && !w.resolved) { w.resolved = true; w.resolvedT = s.t; log(s, `해결됨: ${w.text.split('.')[0]}`, 'safe'); }
};

/** 입력 바꾸기 (화면 조작) */
export function setInput(s, patch) {
  Object.assign(s.input, patch);
}
/** 앱(블루투스)에서 출력 값을 쓴다. MCU 가 꺼져 있으면 무시된다 */
export function appWrite(s, featureId, value) {
  if (!s.mcu.on || !s.input.app) return false;
  s.levels = { ...s.levels, [featureId]: value };
  const f = s.features.find((x) => x.id === featureId);
  log(s, `앱 → ${f?.name}: ${value}${FEATURE_KINDS[f?.kind]?.ble.unit || ''}`);
  return true;
}

/** 센서·입력 값 (펌웨어가 읽는 값과 같은 형식) */
function readInputs(s, vterm) {
  const r = {};
  const tilted = tiltAngle(s.input.tilt) > K.tiltSwitch;
  s.features.forEach((f) => {
    if (f.kind === 'button') r[f.id] = !!s.input.pressed[f.id];
    if (f.kind === 'lid') r[f.id] = s.input.lid > 0.15;
    if (f.kind === 'water') r[f.id] = s.phys.water < K.lowWaterMl; // 플로트가 내려가면 1 = 물 부족
    if (f.kind === 'tilt') r[f.id] = tilted;
    if (f.kind === 'analog') r[f.id] = Math.round((s.input.dial[f.id] ?? 0.5) * 3300);
    if (f.kind === 'temp') r[f.id] = Math.round((s.hasHeater ? s.phys.heaterT : s.power.ambient) * 10) / 10;
    if (f.kind === 'battery') r[f.id] = s.power.source === 'battery' ? Math.max(0, Math.min(100, Math.round(((vterm * 1000 - 3300) * 100) / 900))) : 0;
  });
  return r;
}

/** 출력 값과 레일 전압으로 부하 전류 계산 (구동 레일, 3.3 V 레일 따로) */
function loadsAt(s, out, vdrive, dt) {
  const loads = [];
  let iDrive = 0, i33 = (s.params.mcu_ma / 1000) * (s.mcu.on ? 1 : 0.05) + (s.mcu.on && s.input.app ? K.mcuApp : 0);
  if (s.mcu.on) loads.push({ name: 'MCU·블루투스', rail: '3.3V', i: i33 });
  s.features.forEach((f) => {
    const v = out[f.id] || 0;
    let i = 0, rail = 'drive';
    if (f.kind === 'led') { i = K.ledA * (v / 100); rail = '3.3V'; }
    if (f.kind === 'motor') {
      const sp = s.phys.motor[f.id] || 0;
      i = (vdrive / s.params.motor_ohm) * Math.max(0, v / 100 - K.motorBack * sp) + (v > 0 ? K.motorFric : 0);
    }
    if (f.kind === 'heater') { const r = (s.supplyV ** 2) / heaterWatts(f); i = s.phys.fuseBlown ? 0 : (vdrive / r) * (v / 100); }
    if (f.kind === 'buzzer') i = v > 0 ? K.buzzerA : 0;
    if (f.kind === 'relay') i = v > 0 ? vdrive / s.params.relay_ohm : 0;
    if (f.kind === 'servo') { const a = s.phys.servo[f.id] ?? 0; i = Math.abs(a - v) > 1 ? K.servoMoveA : K.servoIdleA; }
    if (['temp', 'analog', 'battery', 'button', 'lid', 'tilt'].includes(f.kind)) { i = K.sensor; rail = '3.3V'; }
    if (!i) return;
    if (rail === '3.3V') i33 += i; else iDrive += i;
    loads.push({ name: f.name, kind: f.kind, rail, i });
  });
  void dt;
  return { loads, iDrive, i33 };
}

/** 전원 → 레일 전압. 전류가 정해지면 원천 전압이 처지고, 한도를 넘으면 전압이 무너진다 */
function solveRails(s, out, dt) {
  const P = s.power;
  let vin = 5, rint = K.usbRint, limit = Infinity, battery = false;
  if (P.source === 'usb') { vin = 5; rint = K.usbRint; limit = Number(P.usb_limit) || 0.5; }
  if (P.source === 'adapter') { vin = Number(P.adapter_v) || 12; rint = K.adapterRint; limit = Number(P.adapter_a) || 1; }
  if (P.source === 'battery') {
    if (P.usb_plugged) { vin = 5; rint = K.usbRint; limit = 1.5; }
    else { vin = ocv(s.phys.soc); rint = K.battRint; battery = true; limit = s.phys.soc <= 0 ? 0 : 4; }
  }
  // 구동 레일: 원천이 구동 전압보다 낮으면 승압(효율 85 %), 높으면 그대로 (어댑터 전압 = 구동 전압으로 본다)
  const boost = vin + 0.3 < s.supplyV;
  // 단자 전압 v 에서 부하가 끌어가는 전류
  const demand = (v) => {
    const vdrive = boost ? s.supplyV * Math.min(1, v / Math.max(vin, 0.1)) : v;
    const r = loadsAt(s, out, vdrive, dt);
    const iDriveSrc = boost ? (r.iDrive * vdrive) / Math.max(v, 0.5) / (s.params.boost_eff / 100) : r.iDrive;
    // 3.3 V: LDO 는 출력 전류를 그대로 입력에서 끌고, 벅 컨버터는 전력 ÷ 효율 ÷ 입력 전압만큼 끈다
    const i33Src = s.params.reg === 'buck' ? (3.3 * r.i33) / (s.params.buck_eff / 100) / Math.max(v, 0.5) : r.i33 + K.ldoQ;
    return { ...r, vdrive, iSrc: iDriveSrc + i33Src };
  };
  // 전원이 줄 수 있는 전류 = min((vin − v)/rint, 한도). 부하 전류와 같아지는 v 를 이분법으로 찾는다
  let lo = 0, hi = vin;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (Math.min((vin - mid) / rint, limit) > demand(mid).iSrc) lo = mid; else hi = mid;
  }
  const vterm = lo;
  const res = demand(vterm);
  const iSrc = res.iSrc;
  const want = demand(vin).iSrc; // 전압이 처지지 않았다면 부하가 끌어갈 전류
  const v33 = s.params.reg === 'buck' ? (vterm >= 4.2 ? 3.3 : Math.max(0, vterm - 0.9)) : Math.max(0, Math.min(3.3, vterm - K.ldoDrop));
  s.rails = { vin: vterm, v33, vdrive: res.vdrive, i: iSrc, want, iDrive: res.iDrive, i33: res.i33, limit, overload: iSrc >= limit * 0.999 && (vin - vterm) / rint > limit, battery, boost };
  s.loads = res.loads;
  return vterm;
}

/** 시간 dt(초)만큼 진행. 큰 dt 는 잘게 나눠 계산한다 */
export function stepSim(s, dt) {
  // 5 ms 간격으로 나누되 한 번에 최대 400 칸 (600× 같은 빠른 재생에서는 순간 변화가 거칠어진다)
  const n = Math.max(1, Math.min(400, Math.ceil(dt / 0.005)));
  const h = dt / n;
  for (let k = 0; k < n; k++) tick(s, h);
  return s;
}

function tick(s, dt) {
  s.t += dt;
  const P = s.power;
  // 1. 입력 (전압은 직전 값으로 읽는다)
  const inputs = readInputs(s, s.rails.vin || ocv(s.phys.soc));
  s.readings = inputs;
  // 2. MCU: 버튼이 눌리는 순간 → 규칙
  if (s.mcu.on) {
    s.features.filter((f) => f.kind === 'button').forEach((f) => {
      const now = !!s.input.pressed[f.id];
      if (now && !s.prevPressed[f.id]) {
        const before = s.levels;
        s.levels = applyPress(f.id, s.rules, s.features, s.levels);
        const changed = s.features.filter((x) => (before[x.id] || 0) !== (s.levels[x.id] || 0));
        log(s, `${f.name} 누름${changed.length ? ` → ${changed.map((x) => `${x.name} ${s.levels[x.id]}${FEATURE_KINDS[x.kind].ble.unit}`).join(', ')}` : ' (연결된 동작 없음)'}`);
      }
      s.prevPressed[f.id] = now;
    });
  }
  const eff = s.mcu.on ? effectiveLevels(s.levels, s.rules, s.features, inputs) : { out: {}, blockedBy: {} };
  // 막힘이 새로 생기면 기록
  Object.keys(eff.blockedBy).forEach((id) => { if (!s.blockedBy[id] && (s.levels[id] || 0) > 0) log(s, `${s.features.find((f) => f.id === id)?.name} 꺼짐 (안전 조건)`, 'safe'); });
  s.out = eff.out; s.blockedBy = eff.blockedBy;
  // 3. 전원
  const vterm = solveRails(s, s.out, dt);
  // 4. MCU 전압 감시 (브라운아웃 → 리셋 → 부팅하면 출력 요청이 0 으로 돌아간다)
  if (s.mcu.on && s.rails.v33 < K.brownout) {
    s.mcu.on = false; s.mcu.boot = 0; s.mcu.resets += 1;
    const cause = s.rails.overload ? `부하가 약 ${s.rails.want.toFixed(2)} A 를 끌려 하는데 전원 한도는 ${s.rails.limit} A` : s.rails.battery ? `배터리 전압 ${s.rails.vin.toFixed(2)} V` : `입력 전압 ${s.rails.vin.toFixed(2)} V`;
    s.mcu.why = cause;
    log(s, `3.3 V 가 ${s.rails.v33.toFixed(2)} V 로 떨어져 MCU 가 리셋됨 (${cause})`, 'error');
    warn(s, `brownout-${s.rails.overload ? 'limit' : 'low'}`, s.rails.overload
      ? `전원 한도 초과로 MCU 가 리셋됩니다: ${cause}. 전원 용량을 키우거나, 구동부 기동 전류를 줄이세요 (소프트 스타트·PWM 램프).`
      : `전압 부족으로 MCU 가 리셋됩니다: ${cause}.`, 'error');
    s.levels = {}; s.prevPressed = {};
  } else if (!s.mcu.on) {
    if (s.rails.v33 >= K.bootOk) { s.mcu.boot += dt; if (s.mcu.boot >= K.bootTime) { s.mcu.on = true; log(s, 'MCU 부팅 완료 (출력은 꺼진 상태로 시작)'); } } else s.mcu.boot = 0;
  }
  // 5. 물리량
  s.features.forEach((f) => {
    const v = s.out[f.id] || 0;
    if (f.kind === 'motor') { const sp = s.phys.motor[f.id] || 0; s.phys.motor[f.id] = sp + ((v / 100) * Math.min(1, s.rails.vdrive / s.supplyV) - sp) * Math.min(1, dt / K.motorTau); }
    if (f.kind === 'servo') { const a = s.phys.servo[f.id] ?? 0; const d = v - a; s.phys.servo[f.id] = a + Math.sign(d) * Math.min(Math.abs(d), K.servoSpeed * dt); }
  });
  if (s.hasHeater) {
    const pw = s.phys.fuseBlown ? 0 : s.features.filter((f) => f.kind === 'heater').reduce((a, f) => a + ((s.rails.vdrive ** 2) / ((s.supplyV ** 2) / heaterWatts(f))) * ((s.out[f.id] || 0) / 100), 0);
    s.phys.heaterW = pw;
    // 가열 챔버의 물(최대 60 ml)이 열용량을 키우고, 100 °C 에서 남는 열은 물을 증발시킨다 (가습량)
    const chamber = Math.min(s.phys.water, K.chamberMl);
    const C = K.heaterC + K.waterC * chamber;
    s.phys.heaterT += (dt * (pw - (s.phys.heaterT - s.thermal.tin) / K.heaterRth)) / C; // 히터에서 새는 열은 외장 안 공기로
    let evap = 0;
    if (chamber > 0 && s.phys.heaterT > 100) {
      evap = Math.min(s.phys.water, ((s.phys.heaterT - 100) * C) / K.latent);
      s.phys.heaterT = 100;
      s.phys.water -= evap; s.phys.steamTotal += evap;
      if (s.phys.water <= 0) log(s, '물탱크가 비었습니다', 'warn');
    }
    const rate = (evap / dt) * 3600; // ml/h
    s.phys.steamRate += (rate - s.phys.steamRate) * Math.min(1, dt / 5);
    // 온도 퓨즈: 넘으면 끊어지고 히터는 다시 켜지지 않는다 (교체 필요)
    if (!s.phys.fuseBlown && s.phys.heaterT >= K.fuseC) {
      s.phys.fuseBlown = true;
      warn(s, 'fuse', `히터가 ${K.fuseC} °C 에 닿아 온도 퓨즈가 끊어졌습니다. 제품은 다시 켜지지 않고 퓨즈를 바꿔야 합니다. 그 전에 끊는 규칙(수위 감지, 120 °C 이상이면 히터 끄기)을 넣으세요.`, 'error');
    }
    if (pw > 1 && s.phys.water <= 0 && s.phys.heaterT > 105) warn(s, 'dry', `물이 없는데 히터가 켜져 있습니다 (공가열, ${Math.round(s.phys.heaterT)} °C). 수위 감지와 '물이 부족하면 히터 끄기' 규칙을 넣으세요.`, 'error');
  }
  if (P.source === 'battery') {
    if (P.usb_plugged) s.phys.soc = Math.min(100, s.phys.soc + (K.chargeA * dt * 100) / ((P.battery_mah / 1000) * 3600));
    else s.phys.soc = Math.max(0, s.phys.soc - (s.rails.i * dt * 100) / ((P.battery_mah / 1000) * 3600));
    if (s.phys.soc <= 0) warn(s, 'empty', '배터리가 다 닳아 장치가 꺼졌습니다.', 'error');
  }
  // 6. 설계 점검 (실제 위험이 생긴 순간에 한 번씩 알린다)
  const angle = tiltAngle(s.input.tilt);
  const driving = s.features.filter((f) => DRIVE_KINDS.includes(f.kind) && (s.out[f.id] || 0) > 0);
  if (angle > K.fallen && driving.length) warn(s, 'fallen', `넘어진 상태(${Math.round(angle)}°)에서도 ${driving.map((f) => f.name).join(', ')} 이(가) 계속 동작합니다. 기울기 감지와 '기울어지면 모든 구동부 끄기' 규칙을 넣으세요.`);
  if (s.input.lid > 0.5 && driving.length) warn(s, 'lid', `뚜껑이 열린 상태에서도 ${driving.map((f) => f.name).join(', ')} 이(가) 동작합니다. 뚜껑 열림 감지와 안전 규칙을 넣으세요.`);
  const boiling = s.phys.water > 0 || s.features.some((f) => f.kind === 'water');
  if (s.hasHeater && s.phys.heaterT > (boiling ? 115 : 90)) warn(s, 'hot', boiling ? `히터 온도가 ${Math.round(s.phys.heaterT)} °C 까지 올라갑니다 (물이 끓는 온도 100 °C 를 넘음). 120 °C 이상이면 히터를 끄는 규칙을 넣으세요.` : `히터 온도가 ${Math.round(s.phys.heaterT)} °C 까지 올라갑니다. 온도 센서로 히터를 끄는 규칙(예: 70 °C 이상)을 넣으세요.`);
  if (P.source !== 'battery' && s.features.some((f) => f.kind === 'battery') && Object.keys(s.blockedBy).length) warn(s, 'nobatt', '배터리 잔량 기능이 있는데 전원이 USB·어댑터라 잔량이 0 % 로 읽혀, 배터리 부족 안전 조건이 구동부를 막습니다. 전원을 배터리(+USB 충전)로 두세요.');
  if (s.rails.overload && s.mcu.on) warn(s, 'overload', `부하가 약 ${s.rails.want.toFixed(2)} A 를 끌려 해 전원 한도 ${s.rails.limit} A 에 걸리고, 전압이 ${s.rails.vin.toFixed(2)} V 로 처집니다.`);
  if (s.rails.battery && s.mcu.on && s.rails.vin < 3.4 && s.phys.soc > 0) warn(s, 'sag', `배터리 전압이 ${s.rails.vin.toFixed(2)} V 까지 처집니다. 잔량이 적을 때 구동부를 켜면 리셋될 수 있습니다.`);
  // 6-1. 발열·소비전력
  updateThermal(s, dt, K);
  thermalChecks(s, (key, text, level) => warn(s, key, text, level), (key) => resolve(s, key));
  if (!s.rails.overload) resolve(s, 'overload');
  // 7. 기록 (0.1 초마다)
  const slot = Math.floor(s.t * 10);
  if (slot !== s.lastSample) {
    s.lastSample = slot;
    const hot = s.powerNow.parts.filter((x) => x.temp != null && x.kind !== 'heater').sort((a, b) => b.temp - a.temp)[0];
    s.history.push({ t: s.t, v: s.rails.vin, v33: s.rails.v33, i: s.rails.i, soc: s.phys.soc, temp: s.hasHeater ? s.phys.heaterT : P.ambient, water: s.phys.water, steam: s.phys.steamRate, pw: s.powerNow.dc, wall: s.powerNow.wall, tin: s.thermal.tin, thot: hot ? hot.temp : s.thermal.tin, hotName: hot?.name });
    if (s.history.length > 1200) s.history.splice(0, s.history.length - 1200);
  }
  void vterm;
}

/** 앱(블루투스)에서 보이는 값: 입력은 센서 값, 출력은 실제로 내보내는 값 */
export function appValues(s) {
  const v = {};
  s.features.forEach((f) => {
    if (isOutput(f.kind)) v[f.id] = s.out[f.id] || 0;
    else if (f.kind !== 'custom') { const r = s.readings[f.id]; v[f.id] = typeof r === 'boolean' ? (r ? 1 : 0) : r; }
  });
  return v;
}

/** 지금 평균 전류로 본 배터리 사용 시간 (시간) */
export function runtimeHours(s, windowSec = 10) {
  if (s.power.source !== 'battery' || s.power.usb_plugged) return null;
  const recent = s.history.filter((h) => h.t >= s.t - windowSec);
  const avg = recent.length ? recent.reduce((a, h) => a + h.i, 0) / recent.length : s.rails.i;
  if (avg <= 0) return null;
  return ((s.phys.soc / 100) * (s.power.battery_mah / 1000)) / avg;
}

export const tiltOf = tiltAngle;
export { OUTPUT_LEVELS, ALL };

/** 물 채우기 (물탱크 가득) */
export function refill(s, ml) {
  s.phys.water = Math.max(0, Number(ml ?? s.power.tank_ml) || 0);
  log(s, `물을 ${Math.round(s.phys.water)} ml 채움`);
}
