// ESP32 펌웨어 (Arduino-ESP32 코어 3.x, 내장 BLE 라이브러리)
// 동작 시뮬레이터와 같은 동작 규칙(rules.js)을 C++ 로 옮긴다: 버튼 → 출력 요청값(lvl), 안전 조건 → 막기, 표시등 → 실제 출력(out)
// 조명 제품: 다이얼(엔코더) 밝기·켜는 면, 감마 2.2 + 11비트 PWM + 디더링 감광, 서서히 따라가기, 수면 일정, 시계(RTC PCF8563), 시간 표시(STP16CP05 ×2)
// 시스템 항목: 시각 맞추기, 수면 일정 저장, 센서 보정(2점, 비휘발 저장), 응답 시간 확인(에코)
import { FEATURE_KINDS, MCUS, OUTPUT_LEVELS, ALL_TARGET_KINDS, isOutput, lightSpec, pinPlan } from './features.js';
import { buildGatt, TYPE_BYTES } from './ble.js';
import { validRules, defaultRules, ALL, hhmm, SCHEDULE_DEFAULT } from './rules.js';

const cType = { u8: 'uint8_t', u16: 'uint16_t', i16: 'int16_t', u32: 'uint32_t' };
const nm = (c) => `F${c.index}_${c.kind.toUpperCase()}`;
const PIN = (c, sub = '') => `PIN_${nm(c)}${sub ? `_${sub.toUpperCase()}` : ''}`;
const hasPin = (c) => Number.isInteger(c.pin);
const CAL_KINDS = ['temp', 'analog', 'battery'];

function setupCode(c) {
  if (!hasPin(c)) return `  // ${c.name}: 핀이 없습니다 (MCU 를 바꾸거나 핀을 정하세요)`;
  const P = PIN(c);
  switch (c.kind) {
    case 'button': case 'lid': case 'tilt': case 'water': case 'switch': return `  pinMode(${P}, INPUT_PULLUP);`;
    case 'encoder': return `  pinMode(${P}, INPUT_PULLUP);${c.pins?.a != null ? `\n  pinMode(${PIN(c, 'a')}, INPUT_PULLUP);\n  pinMode(${PIN(c, 'b')}, INPUT_PULLUP);\n  attachInterrupt(digitalPinToInterrupt(${PIN(c, 'a')}), encIsr${c.index}, CHANGE);\n  attachInterrupt(digitalPinToInterrupt(${PIN(c, 'b')}), encIsr${c.index}, CHANGE);` : ''}`;
    case 'relay': return `  pinMode(${P}, OUTPUT);\n  digitalWrite(${P}, LOW);`;
    case 'display': return `  pinMode(${PIN(c, 'sdi')}, OUTPUT);\n  pinMode(${PIN(c, 'clk')}, OUTPUT);\n  pinMode(${PIN(c, 'le')}, OUTPUT);\n  ledcAttach(${P}, 1000, 10);  // OE: 낮을수록 밝다 (끄기 = 1023)\n  ledcWrite(${P}, 1023);\n  dispShift${c.index}(0);`;
    case 'light': return `  ledcAttach(${P}, ${FEATURE_KINDS.light.freq}, LIGHT_BITS);\n  ledcWrite(${P}, 0);`;
    case 'led': case 'heater': case 'motor': return `  ledcAttach(${P}, ${FEATURE_KINDS[c.kind].freq}, 10);\n  ledcWrite(${P}, 0);`;
    case 'buzzer': return `  ledcAttach(${P}, 2000, 10);\n  ledcWriteTone(${P}, 0);`;
    case 'servo': return `  ledcAttach(${P}, 50, 14);\n  servoWrite(${P}, 0);`;
    case 'temp': case 'analog': case 'battery': return `  analogSetPinAttenuation(${P}, ADC_11db);`;
    default: return '';
  }
}

function driveCode(c) {
  if (!hasPin(c)) return '';
  const P = PIN(c);
  switch (c.kind) {
    case 'relay': return `digitalWrite(${P}, v ? HIGH : LOW);`;
    case 'display': return `dispOn${c.index} = v != 0; dispRefresh${c.index}();`;
    case 'light': return `lightTarget[${c.li}] = v > 100 ? 100 : v;  // 실제 PWM 은 updateLights() 가 서서히 따라간다`;
    case 'led': case 'motor': case 'heater': return `ledcWrite(${P}, (uint32_t)(v > 100 ? 100 : v) * 1023 / 100);`;
    case 'buzzer': return `ledcWriteTone(${P}, v);`;
    case 'servo': return `servoWrite(${P}, v > 180 ? 180 : v);`;
    default: return '';
  }
}

function readCode(c) {
  if (!hasPin(c)) return '0';
  const P = PIN(c);
  switch (c.kind) {
    case 'button': case 'switch': case 'encoder': return `(uint8_t)(digitalRead(${P}) == LOW)`; // 누르면·켜면 0 V (다이얼은 누름 스위치)
    case 'lid': case 'tilt': case 'water': return `(uint8_t)(digitalRead(${P}) == HIGH)`; // 열림·기울어짐·물 부족이면 접점이 열려 3.3 V
    case 'temp': return `(int16_t)calApply(${c.index}, readNtcTenths(${P}), INT16_MIN)`;
    case 'analog': return `(uint16_t)calApply(${c.index}, analogReadMilliVolts(${P}), -1)`;
    case 'battery': return `(uint8_t)constrain(calApply(${c.index}, batteryPercent(${P}), -1), 0, 100)`;
    default: return '0';
  }
}
const rawCode = (c) => (!hasPin(c) ? '0' : c.kind === 'temp' ? `readNtcTenths(${PIN(c)})` : c.kind === 'analog' ? `analogReadMilliVolts(${PIN(c)})` : c.kind === 'battery' ? `batteryPercent(${PIN(c)})` : '0');

// 조건값을 펌웨어 단위로 (온도는 ×10)
const condValue = (c, v) => (c.kind === 'temp' ? Math.round(Number(v) * 10) : Math.round(Number(v)));

// 7세그먼트 a~g (비트 0~6), 점(콜론) 비트 7
const SEG = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f];

export function firmwareSketch(dev, { version = '0.2.0' } = {}) {
  const mcu = MCUS[dev?.mcu] ? dev.mcu : 'esp32c3';
  const plan = pinPlan((dev?.features || []).filter((f) => FEATURE_KINDS[f.kind]), mcu, dev?.rules);
  const devP = { ...dev, features: plan.features };
  const g = buildGatt(devP);
  const byFeature = new Map(plan.features.map((f) => [f.id, f]));
  const chars = g.chars.map((c) => ({ ...c, pins: byFeature.get(c.feature_id)?.pins, face: byFeature.get(c.feature_id)?.face, spec: c.kind === 'light' ? lightSpec(byFeature.get(c.feature_id)) : null }));
  const byId = new Map(chars.map((c) => [c.feature_id, c]));
  const features = plan.features;
  const rules = validRules(dev?.rules ?? defaultRules(features), features); // 규칙을 아직 저장하지 않았으면 기본 규칙
  const outs = chars.filter((c) => isOutput(c.kind));
  const lights = outs.filter((c) => c.kind === 'light');
  lights.forEach((c, i) => { c.li = i; });
  const encoders = chars.filter((c) => c.kind === 'encoder');
  const displays = chars.filter((c) => c.kind === 'display');
  const ins = chars.filter((c) => !isOutput(c.kind) && c.type !== 'bytes' && !(c.kind === 'encoder' && lights.length)); // 조명 제품의 다이얼은 아래 lampControls 가 읽는다
  const cals = chars.filter((c) => CAL_KINDS.includes(c.kind));
  const sched = rules.find((r) => r.type === 'schedule');
  const sys = Object.fromEntries((g.sys || []).map((s) => [s.key, s]));
  const clock = !!sys.time;
  const targets = (dst) => (dst === ALL ? outs.filter((c) => ALL_TARGET_KINDS.includes(c.kind)) : outs.filter((c) => c.feature_id === dst));
  const L = [];

  L.push(`// ${g.device_name} 펌웨어 — AEGIS 시제품 개발 워크벤치에서 만듦 (v${version})`);
  L.push(`// 보드: ${MCUS[mcu].board} (${MCUS[mcu].fqbn}) · Arduino-ESP32 코어 3.x (내장 BLE·Preferences·Wire 라이브러리만 씀)`);
  L.push('// 동작 규칙은 워크벤치의 동작 시뮬레이션과 같습니다. BLE 값은 모두 리틀 엔디언.');
  L.push('#include <Arduino.h>', '#include <BLEDevice.h>', '#include <BLEServer.h>', '#include <BLE2902.h>', '#include <Preferences.h>');
  if (clock) L.push('#include <Wire.h>', '#include <time.h>');
  L.push('');
  L.push(`#define DEVICE_NAME   "${g.device_name}"`, `#define FW_VERSION    "${version}"`, `#define SERVICE_UUID  "${g.service}"`, `#define INFO_UUID     "${g.info.uuid}"`);
  (g.sys || []).forEach((s) => L.push(`#define SYS_${s.key.toUpperCase()}_UUID "${s.uuid}"  // ${s.name}`));
  chars.forEach((c) => {
    L.push(`#define UUID_${nm(c)} "${c.uuid}"  // ${c.name}`);
    if (hasPin(c)) L.push(`#define ${PIN(c)}  ${c.pin}${c.kind === 'encoder' ? '  // 누름' : c.kind === 'display' ? '  // OE (밝기·끄기)' : ''}`);
    Object.entries(c.pins || {}).forEach(([k, v]) => { if (Number.isInteger(v)) L.push(`#define ${PIN(c, k)}  ${v}`); });
  });
  if (clock && plan.i2c) L.push(`#define PIN_I2C_SDA  ${plan.i2c.sda}`, `#define PIN_I2C_SCL  ${plan.i2c.scl}`, '#define RTC_ADDR     0x51  // PCF8563');
  if (lights.length) L.push('#define LIGHT_BITS   11      // 20 kHz 에서 쓸 수 있는 최대 분해능 (80 MHz / 20 kHz = 4000 → 2048 단계)', '#define LIGHT_MAX    2047');
  L.push('', 'BLEServer* server = nullptr;', 'bool connected = false;', 'Preferences prefs;');
  chars.forEach((c) => L.push(`BLECharacteristic* ch${c.index} = nullptr;  // ${c.name}`));
  (g.sys || []).forEach((s) => L.push(`BLECharacteristic* sys_${s.key} = nullptr;  // ${s.name}`));
  L.push('', '// 입력 (센서·버튼)');
  ins.forEach((c) => L.push(`${cType[c.type]} in${c.index} = 0;  // ${c.name}`));
  chars.filter((c) => c.kind === 'button').forEach((c) => L.push(`uint8_t prev${c.index} = 0;`));
  if (outs.length) {
    L.push('// 출력: lvl = 버튼·앱·다이얼·일정이 요청한 값, out = 안전 조건을 거쳐 실제로 내보내는 값');
    outs.forEach((c) => L.push(`uint16_t lvl${c.index} = 0, out${c.index} = 0xFFFF;  // ${c.name}`));
  }
  L.push('');

  // ── 센서 보정 ──
  L.push('// 센서 보정 (2점 보정: 보정값 = 원시값 × 배율/1000 + 오프셋). 블루투스 "센서 보정" 항목으로 쓰고 비휘발 메모리에 저장', `int16_t calOff[${chars.length + 1}] = {0};`, `uint16_t calGain[${chars.length + 1}] = {${Array.from({ length: chars.length + 1 }, () => '1000').join(', ')}};`);
  L.push('int32_t calApply(int i, int32_t raw, int32_t invalid) {', '  if (raw == invalid) return raw;  // 센서 끊김 등은 그대로', '  return (int32_t)((int64_t)raw * calGain[i] / 1000) + calOff[i];', '}');
  L.push('void calLoad() {', '  prefs.begin("cal", true);', `  for (int i = 1; i <= ${chars.length}; i++) {`, '    char k[8];', '    snprintf(k, sizeof(k), "o%d", i); calOff[i] = prefs.getShort(k, 0);', '    snprintf(k, sizeof(k), "g%d", i); calGain[i] = prefs.getUShort(k, 1000);', '  }', '  prefs.end();', '}');
  L.push('void calSave(int i) {', '  prefs.begin("cal", false);', '  char k[8];', '  snprintf(k, sizeof(k), "o%d", i); prefs.putShort(k, calOff[i]);', '  snprintf(k, sizeof(k), "g%d", i); prefs.putUShort(k, calGain[i]);', '  prefs.end();', '}', '');

  if (chars.some((c) => c.kind === 'servo')) L.push('// 서보: 0~180° → 500~2500 µs 펄스 (50 Hz, 14비트)', 'void servoWrite(int pin, int deg) {', '  uint32_t us = 500 + (uint32_t)deg * 2000 / 180;', '  ledcWrite(pin, us * 16383 / 20000);', '}', '');
  if (chars.some((c) => c.kind === 'temp')) L.push('// NTC 10k B3950 (아래쪽) + 10k (위쪽) 분압 → 온도 ×0.1 °C', 'int16_t readNtcTenths(int pin) {', '  float mv = analogReadMilliVolts(pin);', '  if (mv <= 1 || mv >= 3299) return INT16_MIN;', '  float r = 10000.0f * mv / (3300.0f - mv);', '  float t = 1.0f / (1.0f / 298.15f + logf(r / 10000.0f) / 3950.0f) - 273.15f;', '  return (int16_t)lroundf(t * 10);', '}', '');
  if (chars.some((c) => c.kind === 'battery')) L.push('// 100k/100k 분압 → 배터리 전압 → 잔량 % (3.3~4.2 V 직선 근사)', 'int32_t batteryPercent(int pin) {', '  int mv = analogReadMilliVolts(pin) * 2;', '  return constrain((mv - 3300) * 100 / 900, 0, 100);', '}', '');
  if (rules.some((r) => r.type === 'event' && r.action === 'cycle')) L.push('// 단계 바꾸기: 지금 값 다음 단계로 (마지막이면 처음으로)', 'uint16_t nextStep(const uint16_t* s, int n, uint16_t cur) {', '  for (int i = 0; i < n; i++) if (s[i] == cur) return s[(i + 1) % n];', '  for (int i = 0; i < n; i++) if (s[i] > cur) return s[i];', '  return s[0];', '}', '');

  // ── 조명 감광 ──
  if (lights.length) {
    L.push('// 조명: 목표 밝기(%)를 fade 시간 동안 서서히 따라가고, 감마 2.2 로 광량을 맞춘다.',
      '// 11비트 PWM 한 단계(1/2048)보다 어두운 값은 1 ms 마다 시그마-델타 디더링으로 평균을 맞춰 1 % 아래에서도 계단이 보이지 않게 한다.',
      `const int LIGHT_PINS[${lights.length}] = {${lights.map((c) => (hasPin(c) ? PIN(c) : '-1')).join(', ')}};`,
      `const float LIGHT_FADE_S[${lights.length}] = {${lights.map((c) => `${c.spec.fade_s}f`).join(', ')}};`,
      `const uint8_t LIGHT_FACE[${lights.length}] = {${lights.map((c) => (c.face === 'rear' ? 0 : 1)).join(', ')}};  // 0 = 뒤, 1 = 앞`,
      `uint16_t lightTarget[${lights.length}] = {0};`, `float lightNow[${lights.length}] = {0};`, `float lightErr[${lights.length}] = {0};`,
      'void updateLights() {', '  static uint32_t last = 0;', '  uint32_t now = micros();', '  if (now - last < 1000) return;', '  float dt = (now - last) / 1e6f;', '  last = now;',
      `  for (int i = 0; i < ${lights.length}; i++) {`, '    if (LIGHT_PINS[i] < 0) continue;', '    float tgt = lightTarget[i], step = 100.0f / LIGHT_FADE_S[i] * dt;',
      '    if (tgt == 0 && lightNow[i] < 0.5f) lightNow[i] = 0;  // 끌 때는 잔광 없이',
      '    else if (fabsf(tgt - lightNow[i]) <= step) lightNow[i] = tgt; else lightNow[i] += tgt > lightNow[i] ? step : -step;',
      '    float want = powf(lightNow[i] / 100.0f, 2.2f) * LIGHT_MAX + lightErr[i];', '    uint32_t duty = (uint32_t)constrain((int)floorf(want), 0, LIGHT_MAX);', '    lightErr[i] = lightNow[i] > 0 ? want - duty : 0;', '    ledcWrite(LIGHT_PINS[i], duty);', '  }', '}', '');
  }

  // ── 시계 (RTC PCF8563 + 소프트웨어 시계) ──
  if (clock) {
    L.push('// 시계: 부팅할 때 RTC(PCF8563, 동전 전지)에서 읽고, 앱이 "장치 시각"을 쓰면 RTC 도 맞춘다. 시각은 현지 시각 초(1970 기준)',
      'uint32_t clockBase = 0, clockAtMs = 0;', 'bool clockValid = false;',
      'uint32_t nowLocal() { return clockBase + (millis() - clockAtMs) / 1000; }',
      'static uint8_t bcd2(uint8_t v) { return (v >> 4) * 10 + (v & 0x0f); }', 'static uint8_t dec2(uint8_t v) { return ((v / 10) << 4) | (v % 10); }',
      'bool rtcRead() {', '  Wire.beginTransmission(RTC_ADDR); Wire.write(0x02);', '  if (Wire.endTransmission(false) != 0) return false;', '  if (Wire.requestFrom((uint16_t)RTC_ADDR, (size_t)7) != 7) return false;',
      '  uint8_t s = Wire.read(), mi = Wire.read(), h = Wire.read(), d = Wire.read(); Wire.read(); uint8_t mo = Wire.read(), y = Wire.read();',
      '  if (s & 0x80) return false;  // 전지가 빠졌던 적이 있음 → 시각을 믿을 수 없다',
      '  struct tm t = {}; t.tm_sec = bcd2(s & 0x7f); t.tm_min = bcd2(mi & 0x7f); t.tm_hour = bcd2(h & 0x3f); t.tm_mday = bcd2(d & 0x3f); t.tm_mon = bcd2(mo & 0x1f) - 1; t.tm_year = 100 + bcd2(y);',
      '  setenv("TZ", "UTC0", 1); tzset();', '  clockBase = (uint32_t)mktime(&t); clockAtMs = millis(); clockValid = true;', '  return true;', '}',
      'void rtcWrite(uint32_t local) {', '  time_t tt = local; struct tm t; gmtime_r(&tt, &t);', '  Wire.beginTransmission(RTC_ADDR); Wire.write(0x02);',
      '  Wire.write(dec2(t.tm_sec)); Wire.write(dec2(t.tm_min)); Wire.write(dec2(t.tm_hour)); Wire.write(dec2(t.tm_mday)); Wire.write(t.tm_wday); Wire.write(dec2(t.tm_mon + 1)); Wire.write(dec2(t.tm_year % 100));',
      '  Wire.endTransmission();', '}',
      'void clockSet(uint32_t local) { clockBase = local; clockAtMs = millis(); clockValid = true; rtcWrite(local); }',
      'int minuteOfDay() { return (int)((nowLocal() % 86400) / 60); }', '');
  }

  // ── 시간 표시 (STP16CP05 ×2, 32 세그먼트 정적 구동) ──
  displays.forEach((c) => {
    L.push(`// ${c.name}: 정전류 드라이버 2개(32 출력)를 직렬로 → 4자리 × 8 세그먼트를 정적으로 켠다 (깜빡임 없음)`,
      `const uint8_t SEG7[10] = {${SEG.map((v) => `0x${v.toString(16).padStart(2, '0')}`).join(', ')}};`,
      `bool dispOn${c.index} = false;`,
      `void dispShift${c.index}(uint32_t bits) {`, `  digitalWrite(${PIN(c, 'le')}, LOW);`, '  for (int i = 31; i >= 0; i--) {', `    digitalWrite(${PIN(c, 'sdi')}, (bits >> i) & 1);`, `    digitalWrite(${PIN(c, 'clk')}, HIGH); delayMicroseconds(1); digitalWrite(${PIN(c, 'clk')}, LOW);`, '  }', `  digitalWrite(${PIN(c, 'le')}, HIGH); delayMicroseconds(1); digitalWrite(${PIN(c, 'le')}, LOW);`, '}',
      `void dispRefresh${c.index}() {`, `  if (!dispOn${c.index}${clock ? ' || !clockValid' : ''}) { ledcWrite(${PIN(c)}, 1023); return; }  // OE 높음 = 꺼짐`,
      clock ? '  int m = minuteOfDay(), hh = m / 60, mm = m % 60;' : '  int hh = 0, mm = 0;',
      '  bool colon = (millis() / 500) % 2;', '  uint32_t b = ((uint32_t)SEG7[hh / 10] << 24) | ((uint32_t)(SEG7[hh % 10] | (colon ? 0x80 : 0)) << 16) | ((uint32_t)SEG7[mm / 10] << 8) | SEG7[mm % 10];',
      `  dispShift${c.index}(b);`, `  ledcWrite(${PIN(c)}, 1023 - 600);  // 밝기 약 60 %`, '}', '');
  });

  // ── 출력 구동 + 알림 ──
  outs.forEach((c) => {
    const d = driveCode(c);
    L.push(`void drive${c.index}(uint16_t v) {  // ${c.name}`, d ? `  ${d}` : '  // 핀 없음', `  ${cType[c.type]} b = (${cType[c.type]})v;`, `  ch${c.index}->setValue((uint8_t*)&b, sizeof(b));`, `  if (connected) ch${c.index}->notify();`, '}');
  });
  if (outs.length) L.push('');

  // ── 안전 조건·표시 규칙 ──
  L.push('// 안전 조건을 적용해 실제 출력을 정한다 (동작 규칙: 안전 조건 → 끄기, 표시등)', 'void refreshOutputs() {');
  outs.forEach((c) => L.push(`  bool block${c.index} = false;`));
  rules.filter((r) => r.type === 'guard').forEach((r) => {
    const src = byId.get(r.src);
    const ts = targets(r.dst);
    if (!src || !ts.length || src.kind === 'encoder') return;
    // 온도 센서가 끊기거나 합선되면(INT16_MIN) 막는 쪽으로 — 히터가 보호 없이 켜지지 않게 (fail-safe)
    const fault = src.kind === 'temp' ? `in${src.index} == INT16_MIN || ` : '';
    const fixed = r.cond === 'above' ? `${fault}in${src.index} >= ${condValue(src, r.value)}` : r.cond === 'below' ? `${fault}in${src.index} <= ${condValue(src, r.value)}` : `in${src.index}`;
    L.push(`  if (${fixed}) { ${ts.map((t) => `block${t.index} = true;`).join(' ')} }  // ${src.name} → ${r.dst === ALL ? '모든 구동부' : ts[0].name} 끄기`);
  });
  outs.forEach((c) => L.push(`  uint16_t e${c.index} = block${c.index} ? 0 : lvl${c.index};`));
  rules.filter((r) => r.type === 'show').forEach((r) => {
    const led = outs.find((c) => c.feature_id === r.dst);
    const srcs = targets(r.src).filter((c) => c !== led);
    if (!led || !srcs.length) return;
    L.push(`  if ((${srcs.map((c) => `e${c.index} > 0`).join(' || ')}) && !block${led.index}) e${led.index} = ${OUTPUT_LEVELS[led.kind].on};  // 동작 중 표시`);
  });
  outs.forEach((c) => L.push(`  if (e${c.index} != out${c.index}) { out${c.index} = e${c.index}; drive${c.index}(e${c.index}); }`));
  L.push('}', '');

  // ── 다이얼 A·B상 (4체배 디코더, 인터럽트) ──
  encoders.filter((e) => e.pins?.a != null).forEach((e) => {
    L.push(`volatile int16_t encCount${e.index} = 0;`, `volatile uint8_t encState${e.index} = 0;`,
      `void IRAM_ATTR encIsr${e.index}() {  // ${e.name}`, '  static const int8_t T[16] = {0, -1, 1, 0, 1, 0, 0, -1, -1, 0, 0, 1, 0, 1, -1, 0};', `  uint8_t s = (digitalRead(${PIN(e, 'a')}) << 1) | digitalRead(${PIN(e, 'b')});`, `  encState${e.index} = ((encState${e.index} << 2) | s) & 0x0f;`, `  encCount${e.index} += T[encState${e.index}];`, '}', '');
  });
  // ── 조명 다이얼 (돌리기·짧게·길게 누르기) ──
  if (encoders.length && lights.length) {
    const e = encoders[0];
    const faceLights = (face) => lights.filter((c) => lights.length === 1 || face === 2 || (face === 1 ? c.face !== 'rear' : c.face === 'rear'));
    L.push(`// ${e.name}: 돌리면 밝기(어두운 쪽 1 %, 밝은 쪽 5 % 씩), 짧게 누르면 켜기·끄기, 0.8 초 이상 누르면 켜는 면 바꾸기 (뒤 → 앞 → 앞뒤)`,
      'uint8_t lampFace = 0;  // 0 = 뒤(수면등), 1 = 앞(기상등), 2 = 앞뒤', 'uint8_t lampBright = 60;',
      'bool lampOn() { return ' + lights.map((c) => `lvl${c.index} > 0`).join(' || ') + '; }',
      'void applyFace() {', ...lights.map((c) => `  lvl${c.index} = (${[0, 1, 2].filter((f) => faceLights(f).includes(c)).map((f) => `lampFace == ${f}`).join(' || ') || 'false'}) ? lampBright : 0;`), '}',
      'void notifyBright() {', `  uint8_t b = lampBright; ch${e.index}->setValue(&b, 1); if (connected) ch${e.index}->notify();`, '}',
      'void lampControls() {', '  static uint32_t downAt = 0; static bool longDone = false, wasDown = false;', `  bool down = digitalRead(${PIN(e)}) == LOW;`,
      '  if (down && !wasDown) { downAt = millis(); longDone = false; }', '  if (down && !longDone && millis() - downAt >= 800) { longDone = true; lampFace = (lampFace + 1) % 3; if (lampOn()) applyFace(); refreshOutputs(); }',
      '  if (!down && wasDown && !longDone && millis() - downAt >= 30) {', `    if (lampOn()) { ${lights.map((c) => `lvl${c.index} = 0;`).join(' ')} } else applyFace();`, '    refreshOutputs();', '  }', '  wasDown = down;',
      ...(e.pins?.a != null ? [`  noInterrupts(); int16_t steps = encCount${e.index} / 4; encCount${e.index} -= steps * 4; interrupts();`] : ['  int16_t steps = 0;  // A·B 핀이 없어 돌림을 읽지 못한다']),
      '  if (steps) {', '    int b = lampBright;', '    for (int k = 0; k < abs(steps); k++) b += (steps > 0 ? 1 : -1) * ((b < 10 || (b == 10 && steps < 0)) ? 1 : 5);', '    lampBright = constrain(b, 1, 100);', '    if (lampOn()) applyFace();', '    notifyBright();', '    refreshOutputs();', '  }', '}', '');
  }

  // ── 수면 일정 ──
  if (sched && clock && lights.length) {
    const sw = byId.get(sched.src);
    const wakeL = lights.find((c) => c.feature_id === sched.wake_dst) || lights[0];
    const dimL = sched.dst === ALL ? lights : lights.filter((c) => c.feature_id === sched.dst);
    const s = { ...SCHEDULE_DEFAULT, ...sched };
    const [bh, bm] = [Math.floor(hhmm(s.bed) / 60), hhmm(s.bed) % 60], [wh, wm] = [Math.floor(hhmm(s.wake) / 60), hhmm(s.wake) % 60];
    L.push(`// 수면 일정: ${sw ? sw.name : '토글'} 이 켜져 있으면 취침 전 감광 → 소등, 기상 전 증광 → 기상 밝기. 일정은 앱("수면 일정")에서 바꾸고 장치에 저장한다`,
      `uint8_t schedCfg[8] = {1, ${bh}, ${bm}, ${Number(s.dim_min) || 0}, ${wh}, ${wm}, ${Number(s.rise_min) || 0}, ${Number(s.wake_level) || 100}};  // 켜짐, 취침 시·분, 감광 분, 기상 시·분, 증광 분, 기상 밝기`,
      'uint8_t schedPhase = 255;  // 0 꺼짐, 1 낮, 2 감광, 3 밤, 4 증광', `uint16_t dimFrom[${lights.length}] = {0};`,
      'void schedLoad() { prefs.begin("sched", true); if (prefs.getBytesLength("cfg") == 8) prefs.getBytes("cfg", schedCfg, 8); prefs.end(); }',
      'void schedSave() { prefs.begin("sched", false); prefs.putBytes("cfg", schedCfg, 8); prefs.end(); }',
      'static bool within(int a, int b, int t) { return ((t - a + 1440) % 1440) < ((b - a + 1440) % 1440); }',
      'void schedule() {', `  bool on = schedCfg[0] && clockValid && ${sw ? `in${sw.index}` : 'true'};`, '  int m = minuteOfDay();', '  int bed = schedCfg[1] * 60 + schedCfg[2], wake = schedCfg[4] * 60 + schedCfg[5];',
      '  int dimStart = (bed - schedCfg[3] + 1440) % 1440, riseStart = (wake - schedCfg[6] + 1440) % 1440;',
      '  uint8_t ph = !on ? 0 : within(dimStart, bed, m) ? 2 : within(bed, riseStart, m) ? 3 : within(riseStart, wake, m) ? 4 : 1;',
      '  if (ph != schedPhase) {', `    if (ph == 2) { ${lights.map((c) => `dimFrom[${c.li}] = lvl${c.index};`).join(' ')} }`, `    if (ph == 1 && schedPhase == 4) lvl${wakeL.index} = schedCfg[7];`, '    schedPhase = ph;', '  }',
      '  if (ph == 2) {', '    float left = (float)((bed - m + 1440) % 1440) / max(1, (int)schedCfg[3]);', ...dimL.map((c) => `    lvl${c.index} = (uint16_t)(dimFrom[${c.li}] * constrain(left, 0.0f, 1.0f));`), '  }',
      `  if (ph == 3) { ${lights.map((c) => `lvl${c.index} = 0;`).join(' ')} }`,
      '  if (ph == 4) {', '    float done = 1.0f - (float)((wake - m + 1440) % 1440) / max(1, (int)schedCfg[6]);', `    lvl${wakeL.index} = (uint16_t)(schedCfg[7] * constrain(done, 0.0f, 1.0f));`, '  }', '}', '');
  }

  // ── 버튼 이벤트 ──
  chars.filter((c) => c.kind === 'button').forEach((b) => {
    const evs = rules.filter((r) => r.type === 'event' && r.src === b.feature_id);
    L.push(`void onPress${b.index}() {  // ${b.name} 누름`);
    if (!evs.length) L.push('  Serial.println("버튼: 연결한 동작 없음");');
    if (evs.some((r) => r.action === 'pair')) L.push('  BLEDevice::startAdvertising();  // 블루투스 페어링: 앱 연결 대기', '  Serial.println("페어링 광고 시작");');
    evs.filter((r) => r.action !== 'pair').forEach((r) => targets(r.dst).forEach((t) => {
      const Lv = OUTPUT_LEVELS[t.kind];
      if (r.action === 'on') L.push(`  lvl${t.index} = ${Lv.on};  // ${t.name} 켜기`);
      else if (r.action === 'off') L.push(`  lvl${t.index} = 0;  // ${t.name} 끄기`);
      else if (r.action === 'cycle') L.push(`  { static const uint16_t s[] = {${Lv.steps.join(', ')}}; lvl${t.index} = nextStep(s, ${Lv.steps.length}, lvl${t.index}); }  // ${t.name} 단계 바꾸기`);
      else L.push(`  lvl${t.index} = lvl${t.index} ? 0 : ${Lv.on};  // ${t.name} 켜고 끄기`);
    }));
    L.push('}', '');
  });

  L.push('class ServerCallbacks : public BLEServerCallbacks {', '  void onConnect(BLEServer*) override { connected = true; }', '  void onDisconnect(BLEServer*) override { connected = false; BLEDevice::startAdvertising(); }', '};', '');
  const writable = chars.filter((c) => c.access.includes('write'));
  L.push('// 앱이 쓴 값: 출력은 요청값(lvl)으로 받고 안전 조건을 거쳐 내보낸다. 시스템 항목(시각·일정·보정·응답 확인)도 여기서', 'class WriteCallbacks : public BLECharacteristicCallbacks {', '  void onWrite(BLECharacteristic* c) override {', '    String d = c->getValue();', '    const uint8_t* b = (const uint8_t*)d.c_str();', '    size_t n = d.length();');
  L.push('    if (c == sys_ping) { sys_ping->setValue((uint8_t*)b, n); sys_ping->notify(); return; }');
  if (sys.time) L.push('    if (c == sys_time) { if (n >= 4) { clockSet((uint32_t)b[0] | (b[1] << 8) | (b[2] << 16) | ((uint32_t)b[3] << 24)); Serial.printf("시각 맞춤 %lu\\n", (unsigned long)nowLocal()); } return; }');
  if (sys.schedule) L.push(sched && clock && lights.length ? '    if (c == sys_schedule) { if (n >= 8) { memcpy(schedCfg, b, 8); schedSave(); schedPhase = 255; } return; }' : '    if (c == sys_schedule) return;');
  L.push('    if (c == sys_calib) {',
    '      if (n >= 2 && b[0] == 0x01) {  // 원시값 요청',
    '        int i = b[1]; int32_t raw = 0, val = 0;',
    ...cals.map((c) => `        if (i == ${c.index}) { raw = ${rawCode(c)}; val = ${readCode(c)}; }`),
    '        uint8_t r[10] = {0x01, (uint8_t)i}; memcpy(r + 2, &raw, 4); memcpy(r + 6, &val, 4);', '        sys_calib->setValue(r, 10); sys_calib->notify();', '      } else if (n >= 6 && b[0] == 0x02) {  // 저장',
    `        int i = b[1]; if (i < 1 || i > ${chars.length}) return;`, '        calOff[i] = (int16_t)(b[2] | (b[3] << 8)); calGain[i] = (uint16_t)(b[4] | (b[5] << 8)); calSave(i);',
    '        uint8_t r[2] = {0x02, (uint8_t)i}; sys_calib->setValue(r, 2); sys_calib->notify();', '      } else if (n >= 1 && b[0] == 0x03) {  // 전부 지우기',
    '        prefs.begin("cal", false); prefs.clear(); prefs.end(); calLoad();', '        uint8_t r[1] = {0x03}; sys_calib->setValue(r, 1); sys_calib->notify();', '      }', '      return;', '    }');
  writable.forEach((c) => {
    L.push(`    if (c == ch${c.index}) {  // ${c.name}`);
    if (c.type === 'bytes') {
      L.push('      // 사용자 정의 명령: b[0] = 명령 번호, b[1..] = 인자. 받은 명령은 시리얼에 찍고 그대로 돌려 보내 확인한다', '      Serial.printf("명령 %u바이트:", (unsigned)n);', '      for (size_t i = 0; i < n; i++) Serial.printf(" %02x", b[i]);', '      Serial.println();', `      ch${c.index}->setValue((uint8_t*)b, n);`, `      ch${c.index}->notify();`);
    } else {
      const k = TYPE_BYTES[c.type];
      L.push(`      if (n < ${k}) return;`, `      lvl${c.index} = ${k === 1 ? 'b[0]' : '(uint16_t)(b[0] | (b[1] << 8))'};`);
      if (c.kind === 'light' && encoders.length) L.push(`      if (lvl${c.index}) lampBright = constrain((int)lvl${c.index}, 1, 100);`);
      L.push('      refreshOutputs();');
    }
    L.push('      return;', '    }');
  });
  L.push('  }', '};', '');

  // ── 시리얼 명령 (워크벤치의 굽기·시리얼 화면에서) ──
  L.push('// 시리얼 명령 (115200): "info" = 이름·버전, "time <초>" = 시각 맞추기, "read" = 입력값 한 줄', 'void serialCommands() {', '  if (!Serial.available()) return;', '  String line = Serial.readStringUntil(\'\\n\');', '  line.trim();',
    '  if (line == "info") Serial.printf("AEGIS %s %s\\n", DEVICE_NAME, FW_VERSION);');
  if (clock) L.push('  else if (line.startsWith("time ")) { clockSet((uint32_t)strtoul(line.c_str() + 5, nullptr, 10)); Serial.printf("시각 %lu\\n", (unsigned long)nowLocal()); }');
  L.push(`  else if (line == "read") { Serial.printf("${ins.map((c) => `${nm(c)}=%d`).join(' ') || 'no-input'}\\n"${ins.map((c) => `, (int)in${c.index}`).join('')}); }`, '}', '');

  L.push('void setup() {', '  Serial.begin(115200);', '  calLoad();');
  if (clock) L.push('  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);', '  if (!rtcRead()) Serial.println("RTC 시각 없음 — 앱이나 시리얼 time 명령으로 맞추세요");');
  if (sched && clock && lights.length) L.push('  schedLoad();');
  chars.forEach((c) => { const s = setupCode(c); if (s) L.push(s); });
  const nChars = chars.length + (g.sys || []).length + 1;
  L.push('', '  BLEDevice::init(DEVICE_NAME);', '  server = BLEDevice::createServer();', '  server->setCallbacks(new ServerCallbacks());', `  BLEService* svc = server->createService(BLEUUID(SERVICE_UUID), ${nChars * 4 + 2});`);
  L.push('  BLECharacteristic* info = svc->createCharacteristic(INFO_UUID, BLECharacteristic::PROPERTY_READ);', '  info->setValue(FW_VERSION);', '  WriteCallbacks* wcb = new WriteCallbacks();');
  const prop = (acc) => acc.map((a) => `BLECharacteristic::PROPERTY_${a.toUpperCase()}`).join(' | ');
  (g.sys || []).forEach((s) => {
    L.push(`  sys_${s.key} = svc->createCharacteristic(SYS_${s.key.toUpperCase()}_UUID, ${prop(s.access)});`);
    if (s.access.includes('notify')) L.push(`  sys_${s.key}->addDescriptor(new BLE2902());`);
    if (s.access.includes('write')) L.push(`  sys_${s.key}->setCallbacks(wcb);`);
  });
  chars.forEach((c) => {
    L.push(`  ch${c.index} = svc->createCharacteristic(UUID_${nm(c)}, ${prop(c.access)});`);
    if (c.access.includes('notify')) L.push(`  ch${c.index}->addDescriptor(new BLE2902());`);
    if (c.access.includes('write')) L.push(`  ch${c.index}->setCallbacks(wcb);`);
    if (c.type !== 'bytes') L.push(`  { ${cType[c.type]} z = ${c.kind === 'encoder' && lights.length ? 'lampBright' : '0'}; ch${c.index}->setValue((uint8_t*)&z, sizeof(z)); }`);
  });
  L.push('  svc->start();', '  BLEAdvertising* adv = BLEDevice::getAdvertising();', '  adv->addServiceUUID(SERVICE_UUID);', '  adv->setScanResponse(true);', '  BLEDevice::startAdvertising();');
  if (outs.length) L.push('  refreshOutputs();  // 부팅 직후 출력은 모두 꺼진 상태');
  L.push('  Serial.printf("AEGIS %s %s 광고 시작\\n", DEVICE_NAME, FW_VERSION);', '}', '');

  L.push('void loop() {', '  static uint32_t lastScan = 0;', '  serialCommands();');
  if (lights.length) L.push('  updateLights();');
  if (encoders.length && lights.length) L.push('  lampControls();');
  L.push('  if (millis() - lastScan >= 30) {  // 30 ms 마다 입력 읽기 (버튼 채터링 제거 겸용)', '    lastScan = millis();');
  ins.forEach((c) => {
    const thr = c.kind === 'analog' ? `abs((int)v - (int)in${c.index}) > 20` : c.kind === 'temp' ? `abs(v - in${c.index}) >= 2` : `v != in${c.index}`;
    L.push(`    { ${cType[c.type]} v = ${readCode(c)};  // ${c.name}`, `      if (${thr}) { in${c.index} = v; ch${c.index}->setValue((uint8_t*)&v, sizeof(v)); if (connected) ch${c.index}->notify(); } }`);
  });
  chars.filter((c) => c.kind === 'button').forEach((c) => L.push(`    if (in${c.index} && !prev${c.index}) onPress${c.index}();`, `    prev${c.index} = in${c.index};`));
  if (sched && clock && lights.length) L.push('    schedule();');
  if (outs.length) L.push('    refreshOutputs();');
  displays.forEach((c) => L.push(`    { static uint32_t t = 0; if (millis() - t >= 500) { t = millis(); dispRefresh${c.index}(); } }  // 콜론 깜빡임·분 바뀜`));
  L.push('  }', '  delay(1);', '}', '');
  return L.join('\n');
}

/** 시뮬레이터에만 있고 펌웨어에 없는 동작 (없으면 빈 목록) */
export function firmwareGaps(dev) {
  const f = (dev?.features || []);
  const gaps = [];
  if (f.some((x) => x.kind === 'encoder') && !f.some((x) => x.kind === 'light')) gaps.push('다이얼(엔코더)은 조명 제품에서만 밝기·면 바꾸기로 동작합니다. 다른 제품은 누름 스위치만 읽습니다.');
  if (f.some((x) => x.kind === 'display') && !needsClockFor(dev)) gaps.push('시간 표시는 시계(RTC)가 있을 때만 시각을 보여 줍니다.');
  return gaps;
}
const needsClockFor = (dev) => !!buildGatt(dev).sys?.some((s) => s.key === 'time');
