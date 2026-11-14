// ESP32 펌웨어 뼈대 (Arduino-ESP32 코어 3.x, 내장 BLE 라이브러리)
// 동작 시뮬레이터와 같은 동작 규칙(rules.js)을 C++ 로 옮긴다: 버튼 → 출력 요청값(lvl), 안전 조건 → 막기, 표시등 → 실제 출력(out)
import { FEATURE_KINDS, MCUS, OUTPUT_LEVELS, DRIVE_KINDS, isOutput } from './features.js';
import { buildGatt, TYPE_BYTES } from './ble.js';
import { validRules, defaultRules, ALL } from './rules.js';

const cType = { u8: 'uint8_t', u16: 'uint16_t', i16: 'int16_t' };
const nm = (c) => `F${c.index}_${c.kind.toUpperCase()}`;
const PIN = (c) => `PIN_${nm(c)}`;
const hasPin = (c) => Number.isInteger(c.pin);

function setupCode(c) {
  if (!hasPin(c)) return `  // ${c.name}: 핀이 없습니다 (MCU 를 바꾸거나 핀을 정하세요)`;
  const P = PIN(c);
  switch (c.kind) {
    case 'button': case 'lid': case 'tilt': case 'water': return `  pinMode(${P}, INPUT_PULLUP);`;
    case 'relay': return `  pinMode(${P}, OUTPUT);\n  digitalWrite(${P}, LOW);`;
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
    case 'button': return `(uint8_t)(digitalRead(${P}) == LOW)`;   // 누르면 0 V
    case 'lid': case 'tilt': case 'water': return `(uint8_t)(digitalRead(${P}) == HIGH)`; // 열림·기울어짐·물 부족이면 접점이 열려 3.3 V
    case 'temp': return `readNtcTenths(${P})`;
    case 'analog': return `(uint16_t)analogReadMilliVolts(${P})`;
    case 'battery': return `batteryPercent(${P})`;
    default: return '0';
  }
}

// 조건값을 펌웨어 단위로 (온도는 ×10)
const condValue = (c, v) => (c.kind === 'temp' ? Math.round(Number(v) * 10) : Math.round(Number(v)));

export function firmwareSketch(dev, { version = '0.1.0' } = {}) {
  const g = buildGatt(dev);
  const mcu = MCUS[dev?.mcu] ? dev.mcu : 'esp32c3';
  const chars = g.chars;
  const byId = new Map(chars.map((c) => [c.feature_id, c]));
  const features = (dev?.features || []).filter((f) => FEATURE_KINDS[f.kind]);
  const rules = validRules(dev?.rules ?? defaultRules(features), features); // 규칙을 아직 저장하지 않았으면 기본 규칙
  const outs = chars.filter((c) => isOutput(c.kind));
  const ins = chars.filter((c) => !isOutput(c.kind) && c.type !== 'bytes');
  const targets = (dst) => (dst === ALL ? outs.filter((c) => DRIVE_KINDS.includes(c.kind)) : outs.filter((c) => c.feature_id === dst));
  const L = [];

  L.push(`// ${g.device_name} 펌웨어 뼈대 — AEGIS 시제품 개발 워크벤치에서 만듦`);
  L.push(`// 보드: ${MCUS[mcu].board} · Arduino-ESP32 코어 3.x (내장 BLE 라이브러리)`);
  L.push('// 동작 규칙은 워크벤치의 동작 시뮬레이션과 같습니다. 값은 모두 리틀 엔디언.');
  L.push('#include <BLEDevice.h>', '#include <BLEServer.h>', '#include <BLE2902.h>', '');
  L.push(`#define DEVICE_NAME   "${g.device_name}"`, `#define FW_VERSION    "${version}"`, `#define SERVICE_UUID  "${g.service}"`, `#define INFO_UUID     "${g.info.uuid}"`);
  chars.forEach((c) => {
    L.push(`#define UUID_${nm(c)} "${c.uuid}"  // ${c.name}`);
    if (hasPin(c)) L.push(`#define ${PIN(c)}  ${c.pin}`);
  });
  L.push('', 'BLEServer* server = nullptr;', 'bool connected = false;');
  chars.forEach((c) => L.push(`BLECharacteristic* ch${c.index} = nullptr;  // ${c.name}`));
  L.push('', '// 입력 (센서·버튼)');
  ins.forEach((c) => L.push(`${cType[c.type]} in${c.index} = 0;  // ${c.name}`));
  chars.filter((c) => c.kind === 'button').forEach((c) => L.push(`uint8_t prev${c.index} = 0;`));
  if (outs.length) {
    L.push('// 출력: lvl = 버튼·앱이 요청한 값, out = 안전 조건을 거쳐 실제로 내보내는 값');
    outs.forEach((c) => L.push(`uint16_t lvl${c.index} = 0, out${c.index} = 0xFFFF;  // ${c.name}`));
  }
  L.push('');
  if (chars.some((c) => c.kind === 'servo')) L.push('// 서보: 0~180° → 500~2500 µs 펄스 (50 Hz, 14비트)', 'void servoWrite(int pin, int deg) {', '  uint32_t us = 500 + (uint32_t)deg * 2000 / 180;', '  ledcWrite(pin, us * 16383 / 20000);', '}', '');
  if (chars.some((c) => c.kind === 'temp')) L.push('// NTC 10k B3950 (아래쪽) + 10k (위쪽) 분압 → 온도 ×0.1 °C', 'int16_t readNtcTenths(int pin) {', '  float mv = analogReadMilliVolts(pin);', '  if (mv <= 1 || mv >= 3299) return INT16_MIN;', '  float r = 10000.0f * mv / (3300.0f - mv);', '  float t = 1.0f / (1.0f / 298.15f + logf(r / 10000.0f) / 3950.0f) - 273.15f;', '  return (int16_t)lroundf(t * 10);', '}', '');
  if (chars.some((c) => c.kind === 'battery')) L.push('// 100k/100k 분압 → 배터리 전압 → 잔량 % (3.3~4.2 V 직선 근사)', 'uint8_t batteryPercent(int pin) {', '  int mv = analogReadMilliVolts(pin) * 2;', '  return (uint8_t)constrain((mv - 3300) * 100 / 900, 0, 100);', '}', '');
  if (rules.some((r) => r.type === 'event' && r.action === 'cycle')) L.push('// 단계 바꾸기: 지금 값 다음 단계로 (마지막이면 처음으로)', 'uint16_t nextStep(const uint16_t* s, int n, uint16_t cur) {', '  for (int i = 0; i < n; i++) if (s[i] == cur) return s[(i + 1) % n];', '  for (int i = 0; i < n; i++) if (s[i] > cur) return s[i];', '  return s[0];', '}', '');

  // 출력 구동 + 알림
  outs.forEach((c) => {
    const d = driveCode(c);
    L.push(`void drive${c.index}(uint16_t v) {  // ${c.name}`, d ? `  ${d}` : '  // 핀 없음', `  ${cType[c.type]} b = (${cType[c.type]})v;`, `  ch${c.index}->setValue((uint8_t*)&b, sizeof(b));`, `  if (connected) ch${c.index}->notify();`, '}');
  });
  if (outs.length) L.push('');

  // 안전 조건·표시 규칙
  L.push('// 안전 조건을 적용해 실제 출력을 정한다 (동작 규칙: 안전 조건 → 끄기, 표시등)', 'void refreshOutputs() {');
  outs.forEach((c) => L.push(`  bool block${c.index} = false;`));
  rules.filter((r) => r.type === 'guard').forEach((r) => {
    const src = byId.get(r.src);
    const ts = targets(r.dst);
    if (!src || !ts.length) return;
    // 온도 센서가 끊기거나 합선되면(INT16_MIN) 막는 쪽으로 — 히터가 보호 없이 켜지지 않게 (fail-safe)
    const fault = src.kind === 'temp' ? `in${src.index} == INT16_MIN || ` : '';
    const fixed = r.cond === 'above' ? `${fault}in${src.index} >= ${condValue(src, r.value)}` : r.cond === 'below' ? `${fault}in${src.index} <= ${condValue(src, r.value)}` : `in${src.index}`;
    L.push(`  if (${fixed}) { ${ts.map((t) => `block${t.index} = true;`).join(' ')} }  // ${src.name} → ${r.dst === ALL ? '모든 구동부' : ts[0].name} 끄기`);
  });
  outs.forEach((c) => L.push(`  uint16_t e${c.index} = block${c.index} ? 0 : lvl${c.index};`));
  rules.filter((r) => r.type === 'show').forEach((r) => {
    const led = outs.find((c) => c.feature_id === r.dst);
    const srcs = targets(r.src);
    if (!led || !srcs.length) return;
    L.push(`  if ((${srcs.map((c) => `e${c.index} > 0`).join(' || ')}) && !block${led.index}) e${led.index} = ${OUTPUT_LEVELS[led.kind].on};  // 동작 중 표시`);
  });
  outs.forEach((c) => L.push(`  if (e${c.index} != out${c.index}) { out${c.index} = e${c.index}; drive${c.index}(e${c.index}); }`));
  L.push('}', '');

  // 버튼 이벤트
  chars.filter((c) => c.kind === 'button').forEach((b) => {
    const evs = rules.filter((r) => r.type === 'event' && r.src === b.feature_id);
    L.push(`void onPress${b.index}() {  // ${b.name} 누름`);
    if (!evs.length) L.push('  // TODO: 이 버튼에 연결한 동작이 없습니다');
    evs.forEach((r) => targets(r.dst).forEach((t) => {
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
  if (writable.length) {
    L.push('// 앱이 쓴 값: 출력은 요청값(lvl)으로 받고 안전 조건을 거쳐 내보낸다', 'class WriteCallbacks : public BLECharacteristicCallbacks {', '  void onWrite(BLECharacteristic* c) override {', '    String d = c->getValue();', '    const uint8_t* b = (const uint8_t*)d.c_str();', '    size_t n = d.length();');
    writable.forEach((c, i) => {
      L.push(`    ${i ? 'else ' : ''}if (c == ch${c.index}) {  // ${c.name}`);
      if (c.type === 'bytes') {
        L.push('      // TODO: 명령 처리 (예: b[0] = 명령 번호, b[1..] = 인자)', '      Serial.printf("명령 %u바이트:", (unsigned)n);', '      for (size_t i = 0; i < n; i++) Serial.printf(" %02x", b[i]);', '      Serial.println();', `      ch${c.index}->setValue((uint8_t*)b, n);  // 받은 명령을 그대로 돌려 보내 확인`, `      ch${c.index}->notify();`);
      } else {
        const k = TYPE_BYTES[c.type];
        L.push(`      if (n < ${k}) return;`, `      lvl${c.index} = ${k === 1 ? 'b[0]' : '(uint16_t)(b[0] | (b[1] << 8))'};`, '      refreshOutputs();');
      }
      L.push('    }');
    });
    L.push('  }', '};', '');
  }

  L.push('void setup() {', '  Serial.begin(115200);');
  chars.forEach((c) => { const s = setupCode(c); if (s) L.push(s); });
  L.push('', '  BLEDevice::init(DEVICE_NAME);', '  server = BLEDevice::createServer();', '  server->setCallbacks(new ServerCallbacks());', `  BLEService* svc = server->createService(BLEUUID(SERVICE_UUID), ${(chars.length + 1) * 4 + 2});`);
  L.push('  BLECharacteristic* info = svc->createCharacteristic(INFO_UUID, BLECharacteristic::PROPERTY_READ);', '  info->setValue(FW_VERSION);');
  if (writable.length) L.push('  WriteCallbacks* wcb = new WriteCallbacks();');
  chars.forEach((c) => {
    L.push(`  ch${c.index} = svc->createCharacteristic(UUID_${nm(c)}, ${c.access.map((a) => `BLECharacteristic::PROPERTY_${a.toUpperCase()}`).join(' | ')});`);
    if (c.access.includes('notify')) L.push(`  ch${c.index}->addDescriptor(new BLE2902());`);
    if (c.access.includes('write')) L.push(`  ch${c.index}->setCallbacks(wcb);`);
    if (c.type !== 'bytes') L.push(`  { ${cType[c.type]} z = 0; ch${c.index}->setValue((uint8_t*)&z, sizeof(z)); }`);
  });
  L.push('  svc->start();', '  BLEAdvertising* adv = BLEDevice::getAdvertising();', '  adv->addServiceUUID(SERVICE_UUID);', '  adv->setScanResponse(true);', '  BLEDevice::startAdvertising();');
  if (outs.length) L.push('  refreshOutputs();  // 부팅 직후 출력은 모두 꺼진 상태');
  L.push('  Serial.println("광고 시작: " DEVICE_NAME);', '}', '');

  L.push('void loop() {', '  static uint32_t lastScan = 0;', '  if (millis() - lastScan >= 30) {  // 30 ms 마다 입력 읽기 (버튼 채터링 제거 겸용)', '    lastScan = millis();');
  ins.forEach((c) => {
    const thr = c.kind === 'analog' ? `abs((int)v - (int)in${c.index}) > 20` : c.kind === 'temp' ? `abs(v - in${c.index}) >= 2` : `v != in${c.index}`;
    L.push(`    { ${cType[c.type]} v = ${readCode(c)};  // ${c.name}`, `      if (${thr}) { in${c.index} = v; ch${c.index}->setValue((uint8_t*)&v, sizeof(v)); if (connected) ch${c.index}->notify(); } }`);
  });
  chars.filter((c) => c.kind === 'button').forEach((c) => L.push(`    if (in${c.index} && !prev${c.index}) onPress${c.index}();`, `    prev${c.index} = in${c.index};`));
  if (outs.length) L.push('    refreshOutputs();');
  L.push('  }', '  delay(2);', '}', '');
  return L.join('\n');
}
