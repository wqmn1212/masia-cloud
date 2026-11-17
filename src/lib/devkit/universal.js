// 공용 펌웨어: 칩 종류마다 한 번만 빌드해 두고, 제품 설정(기능·핀·UUID·동작 규칙)은 시리얼로 써 넣는다.
// 맞춤 펌웨어(firmware.js)와 같은 동작 규칙을 실행 중에 해석한다. 설정은 비휘발 메모리(NVS)에 저장되고 다시 켜도 남는다.
//   universalSketch()      → 공용 펌웨어 소스 (칩과 무관, CI 가 칩 3종으로 컴파일)
//   universalConfig(dev)   → 장치에 써 넣을 설정 글 (줄 단위)
//   시리얼(115200): "cfg begin" → 설정 줄들 → "cfg end" 를 보내면 저장하고 다시 시작한다. "cfg show" · "cfg clear" · "info"
import { FEATURE_KINDS, MCUS, OUTPUT_LEVELS, ALL_TARGET_KINDS, lightSpec, pinPlan } from './features.js';
import { buildGatt } from './ble.js';
import { validRules, defaultRules, ALL, hhmm, SCHEDULE_DEFAULT } from './rules.js';

export const UNIVERSAL_VERSION = 'u0.1.0';
export const UNIVERSAL_MAX = { features: 16, rules: 24, lights: 4 };
const KINDS = Object.keys(FEATURE_KINDS);
const TYPES = ['u8', 'u16', 'i16', 'u32', 'bytes'];
const ACTIONS = ['toggle', 'on', 'off', 'cycle', 'pair'];
const CONDS = { above: 1, below: 2 };
const SYS_KEYS = ['time', 'schedule', 'calib', 'ping'];
const K = (k) => `K_${k.toUpperCase()}`;

/** 장치에 써 넣을 설정 (줄 단위 글). 한계를 넘으면 problems 에 적는다 */
export function universalConfig(dev) {
  const mcu = MCUS[dev?.mcu] ? dev.mcu : 'esp32c3';
  const plan = pinPlan((dev?.features || []).filter((f) => FEATURE_KINDS[f.kind]), mcu, dev?.rules);
  const g = buildGatt({ ...dev, features: plan.features });
  const byFeature = new Map(plan.features.map((f) => [f.id, f]));
  const idx = new Map(g.chars.map((c) => [c.feature_id, c.index]));
  const rules = validRules(dev?.rules ?? defaultRules(plan.features), plan.features);
  const n = (v) => (Number.isInteger(v) ? v : -1);
  const L = [`N ${g.device_name}`, `S ${g.service}`, `I ${g.info.uuid}`];
  (g.sys || []).forEach((s) => { const k = SYS_KEYS.indexOf(s.key); if (k >= 0) L.push(`Y ${k} ${s.uuid}`); });
  const problems = [];
  if (g.chars.length > UNIVERSAL_MAX.features) problems.push(`기능이 ${g.chars.length}개라 공용 펌웨어 한계(${UNIVERSAL_MAX.features}개)를 넘습니다. 맞춤 빌드를 쓰세요.`);
  g.chars.forEach((c) => {
    const f = byFeature.get(c.feature_id) || {};
    const acc = (c.access.includes('read') ? 1 : 0) | (c.access.includes('write') ? 2 : 0) | (c.access.includes('notify') ? 4 : 0);
    const p = c.kind === 'encoder' ? [n(f.pins?.a), n(f.pins?.b), -1] : c.kind === 'display' ? [n(f.pins?.sdi), n(f.pins?.clk), n(f.pins?.le)] : [-1, -1, -1];
    const x1 = c.kind === 'light' ? Math.round(lightSpec(f).fade_s * 10) : 0, x2 = c.kind === 'light' ? (f.face === 'rear' ? 0 : 1) : 0;
    if (!TYPES.includes(c.type)) problems.push(`${c.name}: 값 형식 ${c.type} 은 공용 펌웨어에 없습니다.`);
    L.push(`F ${c.index} ${KINDS.indexOf(c.kind)} ${Math.max(0, TYPES.indexOf(c.type))} ${acc} ${n(c.pin)} ${p.join(' ')} ${x1} ${x2} ${c.uuid}`);
  });
  const I = (id) => (id === ALL || !id ? 0 : idx.get(id) || 0);
  let nr = 0;
  for (const r of rules) {
    const z = '0 0 0 0 0 0 0 0';
    if (r.type === 'event') L.push(`R E ${I(r.src)} ${I(r.dst)} ${Math.max(0, ACTIONS.indexOf(r.action))} 0 0 ${z}`);
    else if (r.type === 'guard') { const src = byFeature.get(r.src); const v = src?.kind === 'temp' ? Math.round(Number(r.value) * 10) : Math.round(Number(r.value) || 0); L.push(`R G ${I(r.src)} ${I(r.dst)} ${CONDS[r.cond] || 0} ${v} 0 ${z}`); }
    else if (r.type === 'show') L.push(`R W ${I(r.src)} ${I(r.dst)} 0 0 0 ${z}`);
    else if (r.type === 'schedule') {
      const s = { ...SCHEDULE_DEFAULT, ...r };
      const cfg = [1, Math.floor(hhmm(s.bed) / 60), hhmm(s.bed) % 60, Number(s.dim_min) || 0, Math.floor(hhmm(s.wake) / 60), hhmm(s.wake) % 60, Number(s.rise_min) || 0, Number(s.wake_level) || 100];
      L.push(`R C ${I(r.src)} ${I(r.dst)} 0 0 ${I(r.wake_dst)} ${cfg.join(' ')}`);
    } else continue;
    nr++;
  }
  if (nr > UNIVERSAL_MAX.rules) problems.push(`동작 규칙이 ${nr}개라 공용 펌웨어 한계(${UNIVERSAL_MAX.rules}개)를 넘습니다.`);
  if (g.chars.filter((c) => c.kind === 'light').length > UNIVERSAL_MAX.lights) problems.push(`조명이 ${UNIVERSAL_MAX.lights}개를 넘습니다.`);
  if (plan.i2c) L.push(`C ${plan.i2c.sda} ${plan.i2c.scl}`);
  return { text: `${L.join('\n')}\n`, lines: L, mcu, fqbn: MCUS[mcu].fqbn, problems, device_name: g.device_name };
}

/** 시리얼로 보낼 줄 목록 (cfg begin … cfg end) */
export const universalSerialLines = (cfg) => ['cfg begin', ...cfg.lines, 'cfg end'];

const arr = (a) => `{${a.join(', ')}}`;

export function universalSketch() {
  const lv = (k) => OUTPUT_LEVELS[k];
  const steps = KINDS.map((k) => { const s = lv(k)?.steps || [0]; return arr([...s, 0, 0, 0, 0].slice(0, 4)); });
  return `// AEGIS 공용 펌웨어 ${UNIVERSAL_VERSION} — 제품 설정을 시리얼로 써 넣어 쓴다 (워크벤치 "공용 펌웨어로 바로 굽기")
// Arduino-ESP32 코어 3.x. 동작 규칙·조명 감광·다이얼·수면 일정·시계·센서 보정은 맞춤 펌웨어와 같다.
#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLE2902.h>
#include <Preferences.h>
#include <Wire.h>
#include <time.h>

#define FW_VERSION "${UNIVERSAL_VERSION}"
#define MAXF ${UNIVERSAL_MAX.features}
#define MAXR ${UNIVERSAL_MAX.rules}
#define MAXL ${UNIVERSAL_MAX.lights}
#define LIGHT_BITS 11
#define LIGHT_MAX 2047
#define RTC_ADDR 0x51
enum { ${KINDS.map((k, i) => `${K(k)} = ${i}`).join(', ')}, K_COUNT = ${KINDS.length} };
enum { T_U8, T_U16, T_I16, T_U32, T_BYTES };
const uint8_t T_SIZE[5] = {1, 2, 2, 4, 0};
const uint16_t K_ON[K_COUNT] = ${arr(KINDS.map((k) => lv(k)?.on || 0))};
const uint8_t K_OUT[K_COUNT] = ${arr(KINDS.map((k) => (lv(k) ? 1 : 0)))};
const uint8_t K_ALLT[K_COUNT] = ${arr(KINDS.map((k) => (ALL_TARGET_KINDS.includes(k) ? 1 : 0)))};  // "모든 구동부" 대상
const uint16_t K_STEPS[K_COUNT][4] = ${arr(steps)};
const uint8_t K_NSTEP[K_COUNT] = ${arr(KINDS.map((k) => lv(k)?.steps.length || 0))};
const uint32_t K_FREQ[K_COUNT] = ${arr(KINDS.map((k) => FEATURE_KINDS[k].freq || 1000))};

struct Feat { uint8_t kind, type, acc; int8_t pin, p1, p2, p3; int16_t x1, x2; char uuid[37]; BLECharacteristic* ch; uint16_t lvl, out, e; int32_t in; uint8_t prev; int8_t li; bool block; };
struct Rule { char t; int8_t src, dst, wake; uint8_t a; int32_t v; uint8_t cfg[8]; };
Feat F[MAXF + 1];
Rule R[MAXR];
int NF = 0, NR = 0, NL = 0;
char devName[32] = "AEGIS-SETUP", svcUuid[37] = "", infoUuid[37] = "", sysUuid[4][37] = {"", "", "", ""};
int sdaPin = -1, sclPin = -1;
bool cfgOk = false, connected = false;
int encIdx = 0, dispIdx = 0, schedRule = -1;
BLEServer* server = nullptr;
BLECharacteristic* sysCh[4] = {nullptr, nullptr, nullptr, nullptr};  // 시각, 수면 일정, 센서 보정, 응답 확인
Preferences prefs;

// ── 설정 읽기 ──
bool parseLine(const char* s) {
  if (s[0] == 'N' && s[1] == ' ') { strncpy(devName, s + 2, sizeof(devName) - 1); return true; }
  if (s[0] == 'S' && s[1] == ' ') { strncpy(svcUuid, s + 2, 36); return true; }
  if (s[0] == 'I' && s[1] == ' ') { strncpy(infoUuid, s + 2, 36); return true; }
  if (s[0] == 'Y') { int k; char u[40]; if (sscanf(s, "Y %d %36s", &k, u) == 2 && k >= 0 && k < 4) { strncpy(sysUuid[k], u, 36); return true; } return false; }
  if (s[0] == 'C') { return sscanf(s, "C %d %d", &sdaPin, &sclPin) == 2; }
  if (s[0] == 'F') {
    int i, kind, type, acc, pin, p1, p2, p3, x1, x2; char u[40];
    if (sscanf(s, "F %d %d %d %d %d %d %d %d %d %d %36s", &i, &kind, &type, &acc, &pin, &p1, &p2, &p3, &x1, &x2, u) != 11) return false;
    if (i < 1 || i > MAXF || kind < 0 || kind >= K_COUNT || type < 0 || type > T_BYTES) return false;
    Feat& f = F[i];
    f.kind = kind; f.type = type; f.acc = acc; f.pin = pin; f.p1 = p1; f.p2 = p2; f.p3 = p3; f.x1 = x1; f.x2 = x2; strncpy(f.uuid, u, 36); f.uuid[36] = 0;
    f.ch = nullptr; f.lvl = 0; f.out = 0xFFFF; f.e = 0; f.in = 0; f.prev = 0; f.li = -1; f.block = false;
    if (i > NF) NF = i;
    return true;
  }
  if (s[0] == 'R') {
    char t; int src, dst, a, wake, c[8]; long v;
    if (sscanf(s, "R %c %d %d %d %ld %d %d %d %d %d %d %d %d %d", &t, &src, &dst, &a, &v, &wake, &c[0], &c[1], &c[2], &c[3], &c[4], &c[5], &c[6], &c[7]) != 14) return false;
    if (NR >= MAXR || src < 0 || src > MAXF || dst < 0 || dst > MAXF || wake < 0 || wake > MAXF) return false;
    Rule& r = R[NR++];
    r.t = t; r.src = src; r.dst = dst; r.a = a; r.v = v; r.wake = wake;
    for (int k = 0; k < 8; k++) r.cfg[k] = (uint8_t)c[k];
    return true;
  }
  return s[0] == 0 || s[0] == '#';
}
bool parseConfig(const String& text) {
  NF = 0; NR = 0; sdaPin = sclPin = -1; svcUuid[0] = 0;
  for (int i = 0; i <= MAXF; i++) { F[i].kind = 255; F[i].pin = -1; F[i].ch = nullptr; }
  int at = 0;
  while (at < (int)text.length()) {
    int nl = text.indexOf('\\n', at);
    if (nl < 0) nl = text.length();
    String line = text.substring(at, nl);
    line.trim();
    if (!parseLine(line.c_str())) { Serial.printf("cfg error: %s\\n", line.c_str()); return false; }
    at = nl + 1;
  }
  if (!svcUuid[0] || NF == 0) return false;
  for (int i = 1; i <= NF; i++) if (F[i].kind == 255) return false;  // 번호가 비면 안 된다
  return true;
}

// ── 센서 보정 (2점: 보정값 = 원시값 × 배율/1000 + 오프셋) ──
int16_t calOff[MAXF + 1];
uint16_t calGain[MAXF + 1];
int32_t calApply(int i, int32_t raw, int32_t invalid) { return raw == invalid ? raw : (int32_t)((int64_t)raw * calGain[i] / 1000) + calOff[i]; }
void calLoad() {
  prefs.begin("cal", true);
  for (int i = 1; i <= MAXF; i++) { char k[8]; snprintf(k, sizeof(k), "o%d", i); calOff[i] = prefs.getShort(k, 0); snprintf(k, sizeof(k), "g%d", i); calGain[i] = prefs.getUShort(k, 1000); }
  prefs.end();
}
void calSave(int i) {
  prefs.begin("cal", false);
  char k[8]; snprintf(k, sizeof(k), "o%d", i); prefs.putShort(k, calOff[i]); snprintf(k, sizeof(k), "g%d", i); prefs.putUShort(k, calGain[i]);
  prefs.end();
}

// ── 읽기 ──
int32_t readNtcTenths(int pin) {  // NTC 10k B3950 (아래쪽) + 10k (위쪽) → 온도 ×0.1 °C
  float mv = analogReadMilliVolts(pin);
  if (mv <= 1 || mv >= 3299) return INT16_MIN;
  float r = 10000.0f * mv / (3300.0f - mv);
  return (int32_t)lroundf((1.0f / (1.0f / 298.15f + logf(r / 10000.0f) / 3950.0f) - 273.15f) * 10);
}
int32_t batteryPercent(int pin) { int mv = analogReadMilliVolts(pin) * 2; return constrain((mv - 3300) * 100 / 900, 0, 100); }
int32_t rawVal(int i) {
  Feat& f = F[i];
  if (f.pin < 0) return 0;
  if (f.kind == K_TEMP) return readNtcTenths(f.pin);
  if (f.kind == K_ANALOG) return analogReadMilliVolts(f.pin);
  if (f.kind == K_BATTERY) return batteryPercent(f.pin);
  return 0;
}
int32_t readVal(int i) {
  Feat& f = F[i];
  if (f.pin < 0) return 0;
  switch (f.kind) {
    case K_BUTTON: case K_SWITCH: case K_ENCODER: return digitalRead(f.pin) == LOW;   // 누르면·켜면 0 V
    case K_LID: case K_TILT: case K_WATER: return digitalRead(f.pin) == HIGH;          // 열림·기울어짐·물 부족이면 접점이 열린다
    case K_TEMP: return calApply(i, readNtcTenths(f.pin), INT16_MIN);
    case K_ANALOG: return calApply(i, analogReadMilliVolts(f.pin), -1);
    case K_BATTERY: return constrain(calApply(i, batteryPercent(f.pin), -1), 0, 100);
    default: return 0;
  }
}
void setVal(int i, int32_t v) {
  Feat& f = F[i];
  if (!f.ch || f.type == T_BYTES) return;
  f.ch->setValue((uint8_t*)&v, T_SIZE[f.type]);  // 리틀 엔디언
  if (connected && (f.acc & 4)) f.ch->notify();
}

// ── 조명: 서서히 따라가기 + 감마 2.2 + 11비트 PWM + 시그마-델타 디더링 ──
int lightOf[MAXL];
uint16_t lightTarget[MAXL];
float lightNow[MAXL], lightErr[MAXL];
void updateLights() {
  static uint32_t last = 0;
  uint32_t now = micros();
  if (now - last < 1000) return;
  float dt = (now - last) / 1e6f;
  last = now;
  for (int k = 0; k < NL; k++) {
    Feat& f = F[lightOf[k]];
    if (f.pin < 0) continue;
    float tgt = lightTarget[k], step = 100.0f / max(0.1f, f.x1 / 10.0f) * dt;
    if (tgt == 0 && lightNow[k] < 0.5f) lightNow[k] = 0;
    else if (fabsf(tgt - lightNow[k]) <= step) lightNow[k] = tgt; else lightNow[k] += tgt > lightNow[k] ? step : -step;
    float want = powf(lightNow[k] / 100.0f, 2.2f) * LIGHT_MAX + lightErr[k];
    uint32_t duty = (uint32_t)constrain((int)floorf(want), 0, LIGHT_MAX);
    lightErr[k] = lightNow[k] > 0 ? want - duty : 0;
    ledcWrite(f.pin, duty);
  }
}

// ── 시계 (RTC PCF8563 + 소프트웨어 시계, 현지 시각 초) ──
uint32_t clockBase = 0, clockAtMs = 0;
bool clockValid = false;
bool hasClock() { return sdaPin >= 0 && sclPin >= 0; }
uint32_t nowLocal() { return clockBase + (millis() - clockAtMs) / 1000; }
static uint8_t bcd2(uint8_t v) { return (v >> 4) * 10 + (v & 0x0f); }
static uint8_t dec2(uint8_t v) { return ((v / 10) << 4) | (v % 10); }
bool rtcRead() {
  Wire.beginTransmission(RTC_ADDR); Wire.write(0x02);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom((uint16_t)RTC_ADDR, (size_t)7) != 7) return false;
  uint8_t s = Wire.read(), mi = Wire.read(), h = Wire.read(), d = Wire.read(); Wire.read(); uint8_t mo = Wire.read(), y = Wire.read();
  if (s & 0x80) return false;
  struct tm t = {}; t.tm_sec = bcd2(s & 0x7f); t.tm_min = bcd2(mi & 0x7f); t.tm_hour = bcd2(h & 0x3f); t.tm_mday = bcd2(d & 0x3f); t.tm_mon = bcd2(mo & 0x1f) - 1; t.tm_year = 100 + bcd2(y);
  setenv("TZ", "UTC0", 1); tzset();
  clockBase = (uint32_t)mktime(&t); clockAtMs = millis(); clockValid = true;
  return true;
}
void rtcWrite(uint32_t local) {
  time_t tt = local; struct tm t; gmtime_r(&tt, &t);
  Wire.beginTransmission(RTC_ADDR); Wire.write(0x02);
  Wire.write(dec2(t.tm_sec)); Wire.write(dec2(t.tm_min)); Wire.write(dec2(t.tm_hour)); Wire.write(dec2(t.tm_mday)); Wire.write(t.tm_wday); Wire.write(dec2(t.tm_mon + 1)); Wire.write(dec2(t.tm_year % 100));
  Wire.endTransmission();
}
void clockSet(uint32_t local) { clockBase = local; clockAtMs = millis(); clockValid = true; if (hasClock()) rtcWrite(local); }
int minuteOfDay() { return (int)((nowLocal() % 86400) / 60); }

// ── 시간 표시 (STP16CP05 ×2, 4자리 × 8 세그먼트 정적 구동) ──
const uint8_t SEG7[10] = {0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f};
bool dispOn = false;
void dispShift(uint32_t bits) {
  Feat& f = F[dispIdx];
  if (f.p1 < 0 || f.p2 < 0 || f.p3 < 0) return;
  digitalWrite(f.p3, LOW);
  for (int i = 31; i >= 0; i--) { digitalWrite(f.p1, (bits >> i) & 1); digitalWrite(f.p2, HIGH); delayMicroseconds(1); digitalWrite(f.p2, LOW); }
  digitalWrite(f.p3, HIGH); delayMicroseconds(1); digitalWrite(f.p3, LOW);
}
void dispRefresh() {
  if (!dispIdx || F[dispIdx].pin < 0) return;
  if (!dispOn || !clockValid) { ledcWrite(F[dispIdx].pin, 1023); return; }  // OE 높음 = 꺼짐
  int m = minuteOfDay(), hh = m / 60, mm = m % 60;
  bool colon = (millis() / 500) % 2;
  dispShift(((uint32_t)SEG7[hh / 10] << 24) | ((uint32_t)(SEG7[hh % 10] | (colon ? 0x80 : 0)) << 16) | ((uint32_t)SEG7[mm / 10] << 8) | SEG7[mm % 10]);
  ledcWrite(F[dispIdx].pin, 1023 - 600);
}

// ── 출력 ──
void servoWrite(int pin, int deg) { uint32_t us = 500 + (uint32_t)deg * 2000 / 180; ledcWrite(pin, us * 16383 / 20000); }
void drive(int i, uint16_t v) {
  Feat& f = F[i];
  if (f.pin >= 0) {
    switch (f.kind) {
      case K_RELAY: digitalWrite(f.pin, v ? HIGH : LOW); break;
      case K_DISPLAY: dispOn = v != 0; dispRefresh(); break;
      case K_LIGHT: lightTarget[f.li] = v > 100 ? 100 : v; break;
      case K_LED: case K_MOTOR: case K_HEATER: ledcWrite(f.pin, (uint32_t)(v > 100 ? 100 : v) * 1023 / 100); break;
      case K_BUZZER: ledcWriteTone(f.pin, v); break;
      case K_SERVO: servoWrite(f.pin, v > 180 ? 180 : v); break;
      default: break;
    }
  }
  setVal(i, v);
}
bool isTarget(int dst, int i) { return K_OUT[F[i].kind] && (dst == 0 ? K_ALLT[F[i].kind] : i == dst); }
// 안전 조건(막기) → 표시 규칙 → 실제 출력
void refreshOutputs() {
  for (int i = 1; i <= NF; i++) F[i].block = false;
  for (int k = 0; k < NR; k++) {
    Rule& r = R[k];
    if (r.t != 'G' || r.src < 1 || r.src > NF || F[r.src].kind == K_ENCODER) continue;
    Feat& s = F[r.src];
    bool fault = s.kind == K_TEMP && s.in == INT16_MIN;  // 온도 센서가 끊기면 막는 쪽으로 (fail-safe)
    bool hit = r.a == 1 ? (fault || s.in >= r.v) : r.a == 2 ? (fault || s.in <= r.v) : s.in != 0;
    if (hit) for (int i = 1; i <= NF; i++) if (isTarget(r.dst, i)) F[i].block = true;
  }
  for (int i = 1; i <= NF; i++) if (K_OUT[F[i].kind]) F[i].e = F[i].block ? 0 : F[i].lvl;
  for (int k = 0; k < NR; k++) {
    Rule& r = R[k];
    if (r.t != 'W' || r.dst < 1 || r.dst > NF || !K_OUT[F[r.dst].kind] || F[r.dst].block) continue;
    for (int i = 1; i <= NF; i++) if (i != r.dst && isTarget(r.src, i) && F[i].e > 0) { F[r.dst].e = K_ON[F[r.dst].kind]; break; }
  }
  for (int i = 1; i <= NF; i++) if (K_OUT[F[i].kind] && F[i].e != F[i].out) { F[i].out = F[i].e; drive(i, F[i].e); }
}

// ── 다이얼 (A·B상 4체배, 인터럽트) + 조명 조작 ──
volatile int16_t encCount = 0;
volatile uint8_t encState = 0;
void IRAM_ATTR encIsr() {
  static const int8_t T[16] = {0, -1, 1, 0, 1, 0, 0, -1, -1, 0, 0, 1, 0, 1, -1, 0};
  uint8_t s = (digitalRead(F[encIdx].p1) << 1) | digitalRead(F[encIdx].p2);
  encState = ((encState << 2) | s) & 0x0f;
  encCount += T[encState];
}
uint8_t lampFace = 0, lampBright = 60;  // 면: 0 = 뒤, 1 = 앞, 2 = 앞뒤
bool lampOn() { for (int k = 0; k < NL; k++) if (F[lightOf[k]].lvl > 0) return true; return false; }
void applyFace() {
  for (int k = 0; k < NL; k++) {
    Feat& f = F[lightOf[k]];
    bool on = NL == 1 || lampFace == 2 || (lampFace == 1 ? f.x2 != 0 : f.x2 == 0);
    f.lvl = on ? lampBright : 0;
  }
}
void lampControls() {
  static uint32_t downAt = 0; static bool longDone = false, wasDown = false;
  Feat& e = F[encIdx];
  bool down = e.pin >= 0 && digitalRead(e.pin) == LOW;
  if (down && !wasDown) { downAt = millis(); longDone = false; }
  if (down && !longDone && millis() - downAt >= 800) { longDone = true; lampFace = (lampFace + 1) % 3; if (lampOn()) applyFace(); refreshOutputs(); }
  if (!down && wasDown && !longDone && millis() - downAt >= 30) {
    if (lampOn()) { for (int k = 0; k < NL; k++) F[lightOf[k]].lvl = 0; } else applyFace();
    refreshOutputs();
  }
  wasDown = down;
  int16_t steps = 0;
  if (e.p1 >= 0 && e.p2 >= 0) { noInterrupts(); steps = encCount / 4; encCount -= steps * 4; interrupts(); }
  if (steps) {
    int b = lampBright;
    for (int k = 0; k < abs(steps); k++) b += (steps > 0 ? 1 : -1) * ((b < 10 || (b == 10 && steps < 0)) ? 1 : 5);
    lampBright = constrain(b, 1, 100);
    if (lampOn()) applyFace();
    setVal(encIdx, lampBright);
    refreshOutputs();
  }
}

// ── 수면 일정 ──
uint8_t schedCfg[8] = {1, 23, 0, 30, 8, 0, 30, 100};  // 켜짐, 취침 시·분, 감광 분, 기상 시·분, 증광 분, 기상 밝기
uint8_t schedPhase = 255;
uint16_t dimFrom[MAXL];
void schedLoad() { prefs.begin("sched", true); if (prefs.getBytesLength("cfg") == 8) prefs.getBytes("cfg", schedCfg, 8); prefs.end(); }
void schedSave() { prefs.begin("sched", false); prefs.putBytes("cfg", schedCfg, 8); prefs.end(); }
static bool within(int a, int b, int t) { return ((t - a + 1440) % 1440) < ((b - a + 1440) % 1440); }
void schedule() {
  Rule& r = R[schedRule];
  int wakeL = (r.wake >= 1 && r.wake <= NF && F[r.wake].kind == K_LIGHT) ? r.wake : lightOf[0];
  bool on = schedCfg[0] && clockValid && (r.src >= 1 && r.src <= NF ? F[r.src].in != 0 : true);
  int m = minuteOfDay();
  int bed = schedCfg[1] * 60 + schedCfg[2], wake = schedCfg[4] * 60 + schedCfg[5];
  int dimStart = (bed - schedCfg[3] + 1440) % 1440, riseStart = (wake - schedCfg[6] + 1440) % 1440;
  uint8_t ph = !on ? 0 : within(dimStart, bed, m) ? 2 : within(bed, riseStart, m) ? 3 : within(riseStart, wake, m) ? 4 : 1;
  if (ph != schedPhase) {
    if (ph == 2) for (int k = 0; k < NL; k++) dimFrom[k] = F[lightOf[k]].lvl;
    if (ph == 1 && schedPhase == 4) F[wakeL].lvl = schedCfg[7];
    schedPhase = ph;
  }
  if (ph == 2) {
    float left = (float)((bed - m + 1440) % 1440) / max(1, (int)schedCfg[3]);
    for (int k = 0; k < NL; k++) if (r.dst == 0 || r.dst == lightOf[k]) F[lightOf[k]].lvl = (uint16_t)(dimFrom[k] * constrain(left, 0.0f, 1.0f));
  }
  if (ph == 3) for (int k = 0; k < NL; k++) F[lightOf[k]].lvl = 0;
  if (ph == 4) {
    float done = 1.0f - (float)((wake - m + 1440) % 1440) / max(1, (int)schedCfg[6]);
    F[wakeL].lvl = (uint16_t)(schedCfg[7] * constrain(done, 0.0f, 1.0f));
  }
}

// ── 버튼 ──
void onPress(int b) {
  for (int k = 0; k < NR; k++) {
    Rule& r = R[k];
    if (r.t != 'E' || r.src != b) continue;
    if (r.a == 4) { BLEDevice::startAdvertising(); Serial.println("pairing"); continue; }
    for (int i = 1; i <= NF; i++) {
      if (!isTarget(r.dst, i)) continue;
      Feat& t = F[i];
      uint16_t on = K_ON[t.kind];
      if (r.a == 1) t.lvl = on;
      else if (r.a == 2) t.lvl = 0;
      else if (r.a == 3) {
        const uint16_t* s = K_STEPS[t.kind]; int n = K_NSTEP[t.kind]; uint16_t nx = s[0]; bool found = false;
        for (int q = 0; q < n && !found; q++) if (s[q] == t.lvl) { nx = s[(q + 1) % n]; found = true; }
        for (int q = 0; q < n && !found; q++) if (s[q] > t.lvl) { nx = s[q]; found = true; }
        t.lvl = nx;
      } else t.lvl = t.lvl ? 0 : on;
    }
  }
}

// ── 블루투스 ──
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer*) override { connected = true; }
  void onDisconnect(BLEServer*) override { connected = false; BLEDevice::startAdvertising(); }
};
class WriteCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* c) override {
    String d = c->getValue();
    const uint8_t* b = (const uint8_t*)d.c_str();
    size_t n = d.length();
    if (c == sysCh[3]) { c->setValue((uint8_t*)b, n); c->notify(); return; }
    if (c == sysCh[0]) { if (n >= 4) clockSet((uint32_t)b[0] | (b[1] << 8) | (b[2] << 16) | ((uint32_t)b[3] << 24)); return; }
    if (c == sysCh[1]) { if (n >= 8 && schedRule >= 0) { memcpy(schedCfg, b, 8); schedSave(); schedPhase = 255; } return; }
    if (c == sysCh[2]) {
      if (n >= 2 && b[0] == 0x01) {
        int i = b[1]; int32_t raw = 0, val = 0;
        if (i >= 1 && i <= NF) { raw = rawVal(i); val = readVal(i); }
        uint8_t r[10] = {0x01, (uint8_t)i}; memcpy(r + 2, &raw, 4); memcpy(r + 6, &val, 4);
        c->setValue(r, 10); c->notify();
      } else if (n >= 6 && b[0] == 0x02) {
        int i = b[1]; if (i < 1 || i > NF) return;
        calOff[i] = (int16_t)(b[2] | (b[3] << 8)); calGain[i] = (uint16_t)(b[4] | (b[5] << 8)); calSave(i);
        uint8_t r[2] = {0x02, (uint8_t)i}; c->setValue(r, 2); c->notify();
      } else if (n >= 1 && b[0] == 0x03) {
        prefs.begin("cal", false); prefs.clear(); prefs.end(); calLoad();
        uint8_t r[1] = {0x03}; c->setValue(r, 1); c->notify();
      }
      return;
    }
    for (int i = 1; i <= NF; i++) {
      Feat& f = F[i];
      if (c != f.ch) continue;
      if (f.type == T_BYTES) { c->setValue((uint8_t*)b, n); c->notify(); return; }  // 사용자 정의 명령: 그대로 돌려 보내 확인
      if (n < T_SIZE[f.type]) return;
      f.lvl = T_SIZE[f.type] == 1 ? b[0] : (uint16_t)(b[0] | (b[1] << 8));
      if (f.kind == K_LIGHT && encIdx && f.lvl) lampBright = constrain((int)f.lvl, 1, 100);
      refreshOutputs();
      return;
    }
  }
};

void setupFeature(int i) {
  Feat& f = F[i];
  if (f.pin < 0) return;
  switch (f.kind) {
    case K_BUTTON: case K_LID: case K_TILT: case K_WATER: case K_SWITCH: pinMode(f.pin, INPUT_PULLUP); break;
    case K_ENCODER:
      pinMode(f.pin, INPUT_PULLUP);
      if (f.p1 >= 0 && f.p2 >= 0 && i == encIdx) { pinMode(f.p1, INPUT_PULLUP); pinMode(f.p2, INPUT_PULLUP); attachInterrupt(digitalPinToInterrupt(f.p1), encIsr, CHANGE); attachInterrupt(digitalPinToInterrupt(f.p2), encIsr, CHANGE); }
      break;
    case K_RELAY: pinMode(f.pin, OUTPUT); digitalWrite(f.pin, LOW); break;
    case K_DISPLAY:
      if (i != dispIdx) break;
      if (f.p1 >= 0) pinMode(f.p1, OUTPUT);
      if (f.p2 >= 0) pinMode(f.p2, OUTPUT);
      if (f.p3 >= 0) pinMode(f.p3, OUTPUT);
      ledcAttach(f.pin, 1000, 10); ledcWrite(f.pin, 1023); dispShift(0);
      break;
    case K_LIGHT: ledcAttach(f.pin, K_FREQ[K_LIGHT], LIGHT_BITS); ledcWrite(f.pin, 0); break;
    case K_LED: case K_HEATER: case K_MOTOR: ledcAttach(f.pin, K_FREQ[f.kind], 10); ledcWrite(f.pin, 0); break;
    case K_BUZZER: ledcAttach(f.pin, 2000, 10); ledcWriteTone(f.pin, 0); break;
    case K_SERVO: ledcAttach(f.pin, 50, 14); servoWrite(f.pin, 0); break;
    case K_TEMP: case K_ANALOG: case K_BATTERY: analogSetPinAttenuation(f.pin, ADC_11db); break;
    default: break;
  }
}
uint32_t propsOf(uint8_t acc) { return ((acc & 1) ? BLECharacteristic::PROPERTY_READ : 0) | ((acc & 2) ? BLECharacteristic::PROPERTY_WRITE : 0) | ((acc & 4) ? BLECharacteristic::PROPERTY_NOTIFY : 0); }

void startDevice() {
  for (int i = 1; i <= NF; i++) {
    Feat& f = F[i];
    if (f.kind == K_LIGHT && NL < MAXL) { f.li = NL; lightOf[NL] = i; lightTarget[NL] = 0; lightNow[NL] = 0; lightErr[NL] = 0; NL++; }
    if (f.kind == K_ENCODER && !encIdx) encIdx = i;
    if (f.kind == K_DISPLAY && !dispIdx) dispIdx = i;
  }
  for (int k = 0; k < NR; k++) if (R[k].t == 'C' && schedRule < 0 && hasClock() && NL > 0) { schedRule = k; memcpy(schedCfg, R[k].cfg, 8); }
  if (hasClock()) { Wire.begin(sdaPin, sclPin); if (!rtcRead()) Serial.println("no rtc time"); }
  if (schedRule >= 0) schedLoad();
  for (int i = 1; i <= NF; i++) setupFeature(i);

  BLEDevice::init(devName);
  server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());
  BLEService* svc = server->createService(BLEUUID(svcUuid), (NF + 6) * 4 + 2);
  if (infoUuid[0]) { BLECharacteristic* info = svc->createCharacteristic(infoUuid, BLECharacteristic::PROPERTY_READ); info->setValue(FW_VERSION); }
  WriteCallbacks* wcb = new WriteCallbacks();
  const uint32_t SYS_PROPS[4] = {BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_NOTIFY, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_NOTIFY};
  for (int k = 0; k < 4; k++) {
    if (!sysUuid[k][0]) continue;
    sysCh[k] = svc->createCharacteristic(sysUuid[k], SYS_PROPS[k]);
    if (k >= 2) sysCh[k]->addDescriptor(new BLE2902());
    sysCh[k]->setCallbacks(wcb);
  }
  for (int i = 1; i <= NF; i++) {
    Feat& f = F[i];
    f.ch = svc->createCharacteristic(f.uuid, propsOf(f.acc));
    if (f.acc & 4) f.ch->addDescriptor(new BLE2902());
    if (f.acc & 2) f.ch->setCallbacks(wcb);
    if (f.type != T_BYTES) { int32_t z = (f.kind == K_ENCODER && NL) ? lampBright : 0; f.ch->setValue((uint8_t*)&z, T_SIZE[f.type]); }
  }
  svc->start();
  BLEAdvertising* adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(svcUuid);
  adv->setScanResponse(true);
  BLEDevice::startAdvertising();
  refreshOutputs();
}

// ── 시리얼: 설정 받기·정보 ──
String cfgBuf;
bool cfgReceiving = false;
void serialCommands() {
  if (!Serial.available()) return;
  String line = Serial.readStringUntil('\\n');
  line.trim();
  if (cfgReceiving) {
    if (line == "cfg end") {
      cfgReceiving = false;
      String keep = cfgBuf;
      if (!parseConfig(keep)) { Serial.println("cfg fail"); delay(200); ESP.restart(); return; }
      prefs.begin("ucfg", false); prefs.putBytes("txt", keep.c_str(), keep.length() + 1); prefs.end();
      Serial.printf("cfg ok %d features %d rules\\n", NF, NR);
      delay(300);
      ESP.restart();
    } else if (cfgBuf.length() + line.length() < 6000) { cfgBuf += line; cfgBuf += '\\n'; }
    return;
  }
  if (line == "cfg begin") { cfgReceiving = true; cfgBuf = ""; Serial.println("cfg ready"); }
  else if (line == "cfg clear") { prefs.begin("ucfg", false); prefs.clear(); prefs.end(); Serial.println("cfg cleared"); delay(200); ESP.restart(); }
  else if (line == "cfg show") {
    prefs.begin("ucfg", true); size_t n = prefs.getBytesLength("txt");
    if (n) { char* t = (char*)malloc(n); prefs.getBytes("txt", t, n); Serial.print(t); free(t); }
    prefs.end(); Serial.println("cfg shown");
  }
  else if (line == "info") Serial.printf("AEGIS-U %s %s %s %s\\n", devName, FW_VERSION, ESP.getChipModel(), cfgOk ? "configured" : "empty");
  else if (line.startsWith("time ")) { clockSet((uint32_t)strtoul(line.c_str() + 5, nullptr, 10)); Serial.printf("time %lu\\n", (unsigned long)nowLocal()); }
  else if (line == "read") { for (int i = 1; i <= NF; i++) if (!K_OUT[F[i].kind]) Serial.printf("F%d=%ld ", i, (long)F[i].in); Serial.println(); }
}

void setup() {
  Serial.begin(115200);
  calLoad();
  prefs.begin("ucfg", true);
  size_t n = prefs.getBytesLength("txt");
  String text;
  if (n) { char* t = (char*)malloc(n); prefs.getBytes("txt", t, n); text = String(t); free(t); }
  prefs.end();
  cfgOk = n > 0 && parseConfig(text);
  if (cfgOk) startDevice();
  Serial.printf("AEGIS-U %s %s %s\\n", devName, FW_VERSION, cfgOk ? "configured" : "empty (send cfg)");
}

void loop() {
  static uint32_t lastScan = 0, lastDisp = 0;
  serialCommands();
  if (!cfgOk) { delay(5); return; }
  if (NL) updateLights();
  if (encIdx && NL) lampControls();
  if (millis() - lastScan >= 30) {  // 30 ms 마다 입력 읽기 (버튼 채터링 제거 겸용)
    lastScan = millis();
    for (int i = 1; i <= NF; i++) {
      Feat& f = F[i];
      if (K_OUT[f.kind] || f.type == T_BYTES || (f.kind == K_ENCODER && NL)) continue;
      int32_t v = readVal(i);
      bool changed = f.kind == K_ANALOG ? abs(v - f.in) > 20 : f.kind == K_TEMP ? abs(v - f.in) >= 2 : v != f.in;
      if (changed) { f.in = v; setVal(i, v); }
      if (f.kind == K_BUTTON) { if (f.in && !f.prev) onPress(i); f.prev = f.in; }
    }
    if (schedRule >= 0) schedule();
    refreshOutputs();
    if (dispIdx && millis() - lastDisp >= 500) { lastDisp = millis(); dispRefresh(); }
  }
  delay(1);
}
`;
}
