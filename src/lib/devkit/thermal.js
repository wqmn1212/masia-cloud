// 발열·소비전력: 매 순간 부품마다 전력(W)과 발열(W)을 나누고, 부품·외장 내부 공기·외장 표면 온도를 시간에 따라 계산한다.
// 열 모델은 RC 근사: 부품 → (열저항 Rθ) → 외장 내부 공기 → (외장 표면적 × 대류 계수) → 주변.
// 값은 '부품 값 수정'에서 바꿀 수 있고, 바꾸면 바로 다음 계산부터 반영된다.
import { heaterWatts, lightSpec } from './features.js';

/** 바꿀 수 있는 부품 값 (화면의 '부품 값 수정' 표가 이 목록으로 만들어진다) */
export const SIM_PARAMS = [
  { group: '전원부', key: 'reg', label: '3.3 V 레귤레이터', type: 'select', default: 'ldo', options: [['ldo', 'LDO (ME6211·AP2112K, SOT-23)'], ['buck', '벅 컨버터 (MP1584·TPS62 계열)']], help: 'LDO 는 (입력 − 3.3 V) × 전류가 그대로 열이 됩니다. 입력이 6 V 를 넘으면 벅 컨버터를 쓰세요.' },
  { group: '전원부', key: 'ldo_vmax', label: 'LDO 최대 입력', unit: 'V', default: 6.5, min: 3.5, max: 40, step: 0.5 },
  { group: '전원부', key: 'ldo_rth', label: 'LDO 열저항', unit: '°C/W', default: 250, min: 20, max: 400, step: 5, help: 'SOT-23-5 ≈ 250, SOT-89 ≈ 130, DPAK ≈ 60' },
  { group: '전원부', key: 'buck_eff', label: '벅 컨버터 효율', unit: '%', default: 85, min: 50, max: 98, step: 1 },
  { group: '전원부', key: 'boost_eff', label: '승압 효율 (배터리 → 구동 전압)', unit: '%', default: 85, min: 50, max: 98, step: 1 },
  { group: '전원부', key: 'adapter_eff', label: '어댑터·충전기 효율', unit: '%', default: 88, min: 50, max: 98, step: 1, help: '콘센트 소비전력 = 제품 입력 전력 ÷ 효율' },
  { group: '구동 스위치 (MOSFET)', key: 'fet_rds', label: 'Rds(on)', unit: 'mΩ', default: 45, min: 1, max: 2000, step: 1, help: 'AO3400 ≈ 45 (3.3 V 게이트), IRLZ44N ≈ 25, IRLB8721 ≈ 9' },
  { group: '구동 스위치 (MOSFET)', key: 'fet_rth', label: '열저항 (접합 → 내부 공기)', unit: '°C/W', default: 125, min: 2, max: 400, step: 1, help: 'SOT-23 ≈ 125, DPAK ≈ 50, TO-220 ≈ 62 (방열판 달면 ≈ 10)' },
  { group: '구동 스위치 (MOSFET)', key: 'fet_tmax', label: '최대 접합 온도', unit: '°C', default: 150, min: 85, max: 200, step: 5 },
  { group: 'MCU·부하', key: 'mcu_ma', label: 'MCU·블루투스 평균 전류', unit: 'mA', default: 35, min: 1, max: 500, step: 1 },
  { group: 'MCU·부하', key: 'mcu_tmax', label: 'MCU 모듈 최대 주변 온도', unit: '°C', default: 85, min: 50, max: 125, step: 5 },
  { group: 'MCU·부하', key: 'motor_ohm', label: 'DC 모터 권선 저항', unit: 'Ω', default: 10, min: 0.2, max: 500, step: 0.1 },
  { group: 'MCU·부하', key: 'relay_ohm', label: '릴레이 코일 저항', unit: 'Ω', default: 70, min: 5, max: 2000, step: 1 },
  { group: '조명 LED', key: 'driver_eff', label: 'LED 드라이버 효율', unit: '%', default: 90, min: 60, max: 98, step: 1, help: '정전류 벅 LED 드라이버 ≈ 88~93 %' },
  { group: '조명 LED', key: 'led_rth', label: 'LED 판 열저항 (판 → 내부 공기)', unit: '°C/W', default: 8, min: 1, max: 60, step: 0.5, help: 'MCPCB + 중앙 알루미늄 방열판 ≈ 6~8, 방열판 없이 FR-4 ≈ 15~25' },
  { group: '외장·열', key: 'case_w', label: '외장 폭', unit: 'mm', default: 120, min: 10, max: 2000, step: 1 },
  { group: '외장·열', key: 'case_d', label: '외장 깊이', unit: 'mm', default: 80, min: 10, max: 2000, step: 1 },
  { group: '외장·열', key: 'case_h', label: '외장 높이', unit: 'mm', default: 50, min: 5, max: 2000, step: 1 },
  { group: '외장·열', key: 'case_hc', label: '외장 열전달 계수', unit: 'W/m²K', default: 8, min: 2, max: 60, step: 0.5, help: '밀폐 플라스틱 자연 대류 ≈ 6~8, 통풍구 ≈ 10~15, 팬 ≈ 25 이상' },
  { group: '외장·열', key: 'inside_max', label: '내부 공기 한계', unit: '°C', default: 60, min: 30, max: 120, step: 1 },
  { group: '외장·열', key: 'touch_max', label: '손 닿는 외장 표면 한계', unit: '°C', default: 48, min: 30, max: 90, step: 1 },
  { group: '전기요금', key: 'price_kwh', label: '전기요금', unit: '원/kWh', default: 150, min: 0, max: 2000, step: 1 },
  { group: '전기요금', key: 'hours_day', label: '하루 사용 시간', unit: '시간', default: 8, min: 0, max: 24, step: 0.5 },
];
export const DEFAULT_SIM_PARAMS = Object.fromEntries(SIM_PARAMS.map((p) => [p.key, p.default]));

const TAU = 10; // 작은 부품의 열 시간 상수 (초)
const VF = 0.4; // 환류 다이오드 순방향 전압

/** 외장 열저항 (°C/W) 과 열용량 (J/K): 표면적 × 대류 계수 */
export function caseThermal(p) {
  const w = p.case_w / 1000, d = p.case_d / 1000, h = p.case_h / 1000;
  const area = 2 * (w * d + w * h + d * h);
  return { area, rth: 1 / (Math.max(0.5, p.case_hc) * Math.max(area, 1e-4)), cap: Math.max(20, 2500 * area) };
}

export function initThermal(s) {
  const amb = Number(s.power.ambient) || 25;
  s.thermal = { tin: amb, nodes: {}, surface: amb };
  s.energy = { wh: 0, wallWh: 0 };
  s.powerNow = { dc: 0, wall: 0, parts: [] };
  s.heat = { parts: [], internal: 0 };
}

/**
 * 이번 순간의 전력·발열을 부품마다 나누고 온도를 dt 만큼 진행한다. deviceSim 의 tick 끝에서 부른다.
 * 전력의 합 = 전원 입력 전력이 되도록 나눈다 (스위치·레귤레이터 손실은 부하 몫에서 뺀다).
 */
export function updateThermal(s, dt, K) {
  const p = s.params, r = s.rails, amb = Number(s.power.ambient) || 25;
  const parts = [];
  const add = (key, name, kind, w, heat, extra = {}) => { if (w > 1e-5 || heat > 1e-5 || extra.always) parts.push({ key, name, kind, w: Math.max(0, w), heat: Math.max(0, heat), ...extra }); };
  // 3.3 V 쪽
  const v33 = r.v33;
  s.loads.filter((l) => l.rail === '3.3V').forEach((l) => add(`l-${l.name}`, l.name, l.kind || 'mcu', v33 * l.i, v33 * l.i));
  const i33 = r.i33;
  if (p.reg === 'buck') { const out = v33 * i33; add('reg', '벅 컨버터 (3.3 V)', 'reg', out * (100 / p.buck_eff - 1), out * (100 / p.buck_eff - 1), { rth: 40, tmax: 125, always: true }); }
  else { const loss = Math.max(0, r.vin - v33) * i33 + r.vin * K.ldoQ; add('reg', 'LDO (3.3 V)', 'reg', loss, loss, { rth: p.ldo_rth, tmax: 125, always: true }); } // 대기 전류 포함
  // 구동 레일
  const rds = p.fet_rds / 1000;
  s.features.forEach((f) => {
    const d = (s.out[f.id] || 0) / 100;
    const load = s.loads.find((l) => l.name === f.name && l.kind === f.kind);
    const i = load?.i || 0;
    if (f.kind === 'heater') {
      const R = (s.supplyV ** 2) / heaterWatts(f);
      const ion = s.phys.fuseBlown ? 0 : r.vdrive / R;
      const fet = ion * ion * rds * d;
      add(`fet-${f.id}`, `${f.name} 스위치 (MOSFET)`, 'fet', fet, fet, { rth: p.fet_rth, tmax: p.fet_tmax, always: true });
      // 히터 전력은 물·공기를 데우고, 외장 안으로 새는 몫만 내부 발열로 센다
      const leak = Math.max(0, (s.phys.heaterT - s.thermal.tin) / K.heaterRth);
      add(`heater-${f.id}`, f.name, 'heater', r.vdrive * i - fet, leak, { temp: s.phys.heaterT, tmax: K.fuseC, always: true, rated: heaterWatts(f) });
    } else if (f.kind === 'motor') {
      const ion = d > 0 ? i / d : 0;
      const fet = ion * ion * rds * d, dio = d > 0 && d < 1 ? VF * ion * (1 - d) : 0;
      add(`fet-${f.id}`, `${f.name} 스위치 (MOSFET)`, 'fet', fet, fet, { rth: p.fet_rth, tmax: p.fet_tmax, always: true });
      if (dio > 0) add(`dio-${f.id}`, `${f.name} 환류 다이오드`, 'diode', dio, dio, { rth: 200, tmax: 125 });
      add(`motor-${f.id}`, f.name, 'motor', r.vdrive * i - fet - dio, r.vdrive * i - fet - dio);
    } else if (f.kind === 'light') {
      // LED 판: 들어간 전력 중 빛으로 나가는 몫(약 32 %)을 뺀 나머지가 판의 열. 드라이버 손실은 따로
      const ls = lightSpec(f);
      const pin = r.vdrive * i, pled = pin * (p.driver_eff / 100);
      add(`led-${f.id}`, `${f.name} LED 판`, 'led', pled, pled * (1 - K.radiant), { rth: p.led_rth, tmax: ls.cutoff_c, always: true, rated: ls.power_w });
      add(`drv-${f.id}`, `${f.name} 드라이버`, 'reg', pin - pled, pin - pled, { rth: K.drvRth, tmax: 125, always: true });
    } else if (load && load.rail !== '3.3V') add(`l-${f.id}`, f.name, f.kind, r.vdrive * i, r.vdrive * i);
  });
  if (r.boost) { const pd = r.vdrive * r.iDrive; const loss = pd * (100 / p.boost_eff - 1); add('boost', '승압 컨버터', 'reg', loss, loss, { rth: 40, tmax: 125 }); }

  // 온도: 부품 → 내부 공기 → 주변
  const internal = parts.reduce((a, x) => a + x.heat, 0);
  const ct = caseThermal(p);
  s.thermal.tin += (dt * (internal - (s.thermal.tin - amb) / ct.rth)) / ct.cap;
  parts.forEach((x) => {
    if (!x.rth) return;
    const t = s.thermal.nodes[x.key] ?? s.thermal.tin;
    const C = TAU / x.rth;
    s.thermal.nodes[x.key] = t + (dt * (x.heat - (t - s.thermal.tin) / x.rth)) / C;
    x.temp = s.thermal.nodes[x.key];
  });
  s.thermal.surface = amb + (s.thermal.tin - amb) * 0.6;
  // MCU 모듈은 내부 공기 온도를 기준으로 본다
  const mcu = parts.find((x) => x.key === 'l-MCU·블루투스');
  if (mcu) { mcu.temp = s.thermal.tin + mcu.heat * 40; mcu.tmax = p.mcu_tmax; }

  // 전력·전력량
  const dc = r.vin * r.i;
  const charging = s.power.source === 'battery' && s.power.usb_plugged ? 4.2 * K.chargeA : 0;
  const wallSide = s.power.source === 'adapter' || s.power.source === 'usb' || (s.power.source === 'battery' && s.power.usb_plugged);
  const wall = wallSide ? (dc + charging) / (p.adapter_eff / 100) : 0;
  s.energy.wh += (dc * dt) / 3600;
  s.energy.wallWh += (wall * dt) / 3600;
  s.powerNow = { dc, wall, parts };
  s.heat = { parts: parts.filter((x) => x.heat > 1e-4 || x.rth), internal, caseRth: ct.rth, area: ct.area };
}

/** 온도·전압 한계 점검 (warn 은 deviceSim 의 경고 함수) */
export function thermalChecks(s, warn, resolve = () => {}) {
  const p = s.params;
  if (p.reg === 'ldo' && s.rails.vin > p.ldo_vmax + 0.05 && s.mcu.on) warn('ldo-vmax', `3.3 V LDO 입력이 ${s.rails.vin.toFixed(1)} V 로 최대 ${p.ldo_vmax} V 를 넘습니다. 실제 부품은 바로 고장 날 수 있습니다. '부품 값 수정'에서 레귤레이터를 벅 컨버터로 바꾸세요.`, 'error');
  else resolve('ldo-vmax');
  const hot = new Set();
  s.powerNow.parts.forEach((x) => {
    if (x.temp == null || x.tmax == null || x.temp <= x.tmax || x.kind === 'led') return; // LED 판은 하드웨어 차단 경고로 따로 알린다
    hot.add(`heat-${x.key}`);
    const tip = x.kind === 'fet' ? 'Rds(on) 이 낮은 MOSFET, 큰 패키지(DPAK·TO-220)나 방열판을 쓰세요.' : x.kind === 'reg' ? '입력 전압을 낮추거나 벅 컨버터로 바꾸세요.' : x.kind === 'heater' ? '온도 센서 규칙으로 더 일찍 끊으세요.' : '발열을 줄이거나 열이 빠지게 하세요.';
    warn(`heat-${x.key}`, `${x.name} 온도가 ${Math.round(x.temp)} °C 로 한계 ${x.tmax} °C 를 넘습니다 (발열 ${x.heat.toFixed(2)} W). ${tip}`, 'error');
  });
  // 한계 아래로 1 °C 넘게 내려오면 해결됨 (경계에서 깜빡이지 않게)
  Object.keys(s.warnings).filter((k) => k.startsWith('heat-') && !hot.has(k)).forEach((k) => {
    const x = s.powerNow.parts.find((y) => `heat-${y.key}` === k);
    if (!x || x.temp == null || x.temp < x.tmax - 1) resolve(k);
  });
  if (s.thermal.tin < p.inside_max - 1) resolve('inside-hot');
  if (s.thermal.surface < p.touch_max - 1) resolve('surface-hot');
  if (s.thermal.tin > p.inside_max) warn('inside-hot', `외장 내부 공기가 ${Math.round(s.thermal.tin)} °C 로 한계 ${p.inside_max} °C 를 넘습니다 (내부 발열 ${s.heat.internal.toFixed(1)} W). 통풍구(열전달 계수↑)나 외장을 키우는 것을 검토하세요.`);
  if (s.thermal.surface > p.touch_max) warn('surface-hot', `외장 표면이 약 ${Math.round(s.thermal.surface)} °C 로 손 닿는 한계 ${p.touch_max} °C 를 넘습니다.`);
}

/** 최근 평균 콘센트 전력으로 본 한 달 전기요금 (원)과 하루 전력량 (Wh) */
export function monthlyCost(s, windowSec = 30) {
  const recent = s.history.filter((h) => h.t >= s.t - windowSec && h.wall != null);
  const w = recent.length ? recent.reduce((a, h) => a + h.wall, 0) / recent.length : s.powerNow.wall;
  const day = w * s.params.hours_day;
  return { avgW: w, dayWh: day, won: Math.round((day * 30 / 1000) * s.params.price_kwh) };
}
