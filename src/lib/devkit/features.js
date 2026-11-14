// 시제품 개발 파이프라인: "원하는 기능" 목록이 회로 블록·부품·블루투스 항목·외장 구멍으로 이어진다.
// 한 기능 = MCU 핀 하나 + 그 핀에 붙는 작은 회로 + 앱에서 읽고 쓰는 블루투스 값 하나.

/**
 * ble.access: read(앱이 읽기) · write(앱이 쓰기) · notify(장치가 바뀔 때 알림)
 * ble.type: u8 · u16 · i16 · bytes (모두 리틀 엔디언), scale: 실제 값 = 정수 × scale
 * pin: gpio(디지털) · pwm · adc · none
 */
export const FEATURE_KINDS = {
  button: {
    label: '버튼 입력', group: 'in', pin: 'gpio',
    block: '내부 풀업 + 택트 스위치(누르면 0 V). 채터링은 펌웨어에서 30 ms 로 거릅니다.',
    ble: { access: ['read', 'notify'], type: 'u8', unit: '', min: 0, max: 1, desc: '1 = 눌림, 0 = 뗌' },
    bom: [['택트 스위치 6×6', 1], ['저항 10 kΩ (풀업, 선택)', 1]],
    housing: { kind: 'hole', d: 12, note: '버튼 구멍' },
  },
  led: {
    label: '표시 LED (밝기)', group: 'out', pin: 'pwm', freq: 1000,
    block: 'GPIO → 330 Ω → LED → GND. PWM 듀티로 밝기를 바꿉니다 (3.3 V 핀에서 약 4 mA).',
    ble: { access: ['read', 'write'], type: 'u8', unit: '%', min: 0, max: 100, desc: '밝기 0~100 %' },
    bom: [['LED 0603', 1], ['저항 330 Ω', 1]],
    housing: { kind: 'hole', d: 3.2, note: '빛 구멍(라이트 파이프)' },
  },
  motor: {
    label: 'DC 모터 (속도)', group: 'out', pin: 'pwm', freq: 20000,
    block: '로직 레벨 N-MOSFET 로우사이드 스위치 + 환류 다이오드. 20 kHz PWM 으로 속도를 바꿉니다.',
    ble: { access: ['read', 'write'], type: 'u8', unit: '%', min: 0, max: 100, desc: '속도 0~100 %' },
    bom: [['N-MOSFET AO3400 (SOT-23)', 1], ['쇼트키 다이오드 1N5819', 1], ['저항 100 Ω (게이트)', 1], ['저항 100 kΩ (풀다운)', 1], ['DC 모터', 1]],
    housing: { kind: 'mount', note: '모터 고정 보스·리브' },
  },
  heater: {
    label: '히터 (세기)', group: 'out', pin: 'pwm', freq: 1000, power_w: 20,
    block: 'N-MOSFET 로우사이드 스위치. 온도 센서와 함께 펌웨어에서 과열을 끊고, 온도 퓨즈를 직렬로 넣으세요.',
    ble: { access: ['read', 'write'], type: 'u8', unit: '%', min: 0, max: 100, desc: '세기 0~100 %' },
    bom: [['N-MOSFET IRLZ44N 또는 AO3400', 1], ['저항 100 Ω (게이트)', 1], ['저항 100 kΩ (풀다운)', 1], ['온도 퓨즈', 1]],
    housing: { kind: 'vent', note: '방열 통풍구' },
  },
  buzzer: {
    label: '부저 (소리)', group: 'out', pin: 'pwm', freq: 2000,
    block: 'NPN 트랜지스터로 부저를 구동합니다. 앱이 보낸 주파수로 소리를 냅니다 (0 = 끔).',
    ble: { access: ['read', 'write'], type: 'u16', unit: 'Hz', min: 0, max: 8000, desc: '주파수, 0 = 끔' },
    bom: [['패시브 부저 12 mm', 1], ['NPN S8050', 1], ['저항 1 kΩ (베이스)', 1]],
    housing: { kind: 'grille', d: 12, note: '소리 구멍' },
  },
  servo: {
    label: '서보 (각도)', group: 'out', pin: 'pwm', freq: 50,
    block: '50 Hz 신호선만 MCU 에 연결합니다. 서보 전원은 5 V 에서 따로 받습니다.',
    ble: { access: ['read', 'write'], type: 'u8', unit: '°', min: 0, max: 180, desc: '각도 0~180°' },
    bom: [['마이크로 서보 SG90', 1], ['전해 콘덴서 100 µF (서보 전원)', 1]],
    housing: { kind: 'mount', note: '서보 고정부' },
  },
  relay: {
    label: '릴레이 (켜고 끄기)', group: 'out', pin: 'gpio',
    block: 'NPN 트랜지스터로 릴레이 코일을 구동하고 코일 양단에 환류 다이오드를 둡니다.',
    ble: { access: ['read', 'write'], type: 'u8', unit: '', min: 0, max: 1, desc: '1 = 켬, 0 = 끔' },
    bom: [['릴레이 5 V', 1], ['NPN S8050', 1], ['저항 1 kΩ (베이스)', 1], ['다이오드 1N4148', 1]],
    housing: { kind: 'none' },
  },
  tilt: {
    label: '기울기 감지', group: 'in', pin: 'gpio',
    block: '볼 타입 기울기 스위치(SW-520D) + 내부 풀업. 바로 서 있으면 닫힘(0 V), 약 45° 넘게 기울면 열림(3.3 V).',
    ble: { access: ['read', 'notify'], type: 'u8', unit: '', min: 0, max: 1, desc: '1 = 기울어짐·넘어짐, 0 = 바로 섬' },
    bom: [['기울기 스위치 SW-520D', 1]],
    housing: { kind: 'none' },
  },
  lid: {
    label: '뚜껑 열림 감지', group: 'in', pin: 'gpio',
    block: '리드 스위치 + 뚜껑 쪽 자석 + 내부 풀업. 닫히면 0 V, 열면 3.3 V.',
    ble: { access: ['read', 'notify'], type: 'u8', unit: '', min: 0, max: 1, desc: '1 = 열림, 0 = 닫힘' },
    bom: [['리드 스위치 (또는 홀 센서)', 1], ['네오디뮴 자석 Ø5×2', 1]],
    housing: { kind: 'mount', note: '리드 스위치·자석 고정 리브' },
  },
  water: {
    label: '수위 감지 (물 부족)', group: 'in', pin: 'gpio',
    block: '자석 플로트 + 리드 스위치 + 내부 풀업. 물이 있으면 플로트가 떠서 닫힘(0 V), 물이 부족하면 열림(3.3 V).',
    ble: { access: ['read', 'notify'], type: 'u8', unit: '', min: 0, max: 1, desc: '1 = 물 부족, 0 = 물 있음' },
    bom: [['플로트 스위치 (리드 스위치 + 자석 플로트)', 1]],
    housing: { kind: 'mount', note: '플로트 가이드·리드 스위치 고정 리브' },
  },
  temp: {
    label: '온도 센서 (NTC)', group: 'in', pin: 'adc',
    block: '3.3 V → 10 kΩ → (측정점) → NTC 10 kΩ → GND. 측정점 전압으로 온도를 계산합니다.',
    ble: { access: ['read', 'notify'], type: 'i16', unit: '°C', min: -400, max: 1250, scale: 0.1, desc: '온도 ×0.1 °C (예: 253 = 25.3 °C)' },
    bom: [['NTC 10 kΩ B3950', 1], ['저항 10 kΩ 1 %', 1], ['콘덴서 100 nF', 1]],
    housing: { kind: 'vent', note: '센서 통기 구멍' },
  },
  analog: {
    label: '다이얼·아날로그 센서', group: 'in', pin: 'adc',
    block: '가변저항(또는 아날로그 센서) 출력 전압을 ADC 로 읽습니다 (0~3.3 V).',
    ble: { access: ['read', 'notify'], type: 'u16', unit: 'mV', min: 0, max: 3300, desc: '전압 mV' },
    bom: [['가변저항 10 kΩ', 1], ['콘덴서 100 nF', 1]],
    housing: { kind: 'hole', d: 7, note: '다이얼 축 구멍' },
  },
  battery: {
    label: '배터리 잔량', group: 'in', pin: 'adc',
    block: '배터리(최대 4.2 V)를 100 kΩ/100 kΩ 로 반으로 나눠 ADC 로 읽습니다.',
    ble: { access: ['read', 'notify'], type: 'u8', unit: '%', min: 0, max: 100, desc: '잔량 % (3.3~4.2 V 직선 근사)' },
    bom: [['저항 100 kΩ', 2], ['콘덴서 100 nF', 1], ['리튬 배터리 1S', 1], ['충전 IC TP4056 또는 동급', 1]],
    housing: { kind: 'compartment', note: '배터리 자리·커버' },
  },
  custom: {
    label: '사용자 정의 명령', group: 'cmd', pin: 'none',
    block: '앱 ↔ 장치 사이의 자유 형식 바이트 명령입니다. 펌웨어의 TODO 에 동작을 넣으세요.',
    ble: { access: ['write', 'notify'], type: 'bytes', unit: '', desc: '자유 형식 바이트 (최대 20바이트)' },
    bom: [],
    housing: { kind: 'none' },
  },
};

export const FEATURE_GROUPS = { in: '입력·센서', out: '출력·구동', cmd: '명령' };

// MCU 모듈별로 쓸 수 있는 핀 (부팅 설정 핀·플래시 핀은 뒤로 미루거나 뺐다)
export const MCUS = {
  esp32c3: { label: 'ESP32-C3 (RISC-V, BLE 5)', module: 'ESP32-C3-MINI-1', board: 'ESP32C3 Dev Module', adc: [0, 1, 3, 4], io: [5, 6, 7, 10, 20, 21, 3, 4, 2] },
  esp32s3: { label: 'ESP32-S3 (BLE 5, 여유 핀 많음)', module: 'ESP32-S3-WROOM-1', board: 'ESP32S3 Dev Module', adc: [1, 2, 4, 5, 6, 7, 8, 9, 10], io: [11, 12, 13, 14, 15, 16, 17, 18, 38, 39, 40, 41, 42] },
  esp32: { label: 'ESP32 (클래식)', module: 'ESP32-WROOM-32E', board: 'ESP32 Dev Module', adc: [32, 33, 34, 35, 36, 39], io: [16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 13, 14] },
};

// 구동 전원이 6 V 를 넘으면 LDO 대신 벅 컨버터 (LDO 는 입력 최대 6.5 V 이고 (입력 − 3.3 V) × 전류가 다 열이 된다)
export const BASE_BOM = (mcu, supplyV = 5) => [
  [`MCU 모듈 ${MCUS[mcu]?.module || 'ESP32-C3-MINI-1'}`, 1],
  Number(supplyV) > 6 ? [`벅 컨버터 ${Number(supplyV)} V → 3.3 V (MP1584 · TPS62933 등)`, 1] : ['LDO 3.3 V 600 mA (ME6211 · AP2112K)', 1],
  ['USB-C 커넥터 (전원·프로그래밍)', 1],
  ['콘덴서 10 µF ×2, 100 nF ×4', 1],
  ['리셋·부트 버튼', 2],
];

const ID = () => Math.random().toString(36).slice(2, 10);
export const makeFeature = (kind, name) => ({ id: ID(), kind, name: name || FEATURE_KINDS[kind]?.label || kind, pin: null, note: '', ...(kind === 'heater' ? { power_w: FEATURE_KINDS.heater.power_w } : {}) });
/** 히터 정격 전력 (W). 기능에 적은 값, 없으면 기본값 */
export const heaterWatts = (f) => (Number(f?.power_w) > 0 ? Number(f.power_w) : FEATURE_KINDS.heater.power_w);

/** 핀을 정한다. 사용자가 고른 핀(pin 숫자)은 그대로 두고 비어 있는 것만 채운다 */
export function assignPins(features, mcu = 'esp32c3') {
  const m = MCUS[mcu] || MCUS.esp32c3;
  const used = new Set(features.map((f) => f.pin).filter((p) => Number.isInteger(p)));
  const take = (list) => { const p = list.find((x) => !used.has(x)); if (p != null) used.add(p); return p ?? null; };
  return features.map((f) => {
    const k = FEATURE_KINDS[f.kind];
    if (!k || k.pin === 'none') return { ...f, pin: null };
    if (Number.isInteger(f.pin)) return f;
    // ADC 핀이 남으면 ADC 에, 아니면 일반 핀에
    const pin = k.pin === 'adc' ? take(m.adc) : take(m.io.filter((p) => !m.adc.includes(p))) ?? take(m.io);
    return { ...f, pin };
  });
}

/** 핀 충돌·부족 점검 */
export function pinProblems(features, mcu = 'esp32c3') {
  const m = MCUS[mcu] || MCUS.esp32c3;
  const out = [];
  const seen = new Map();
  features.forEach((f) => {
    const k = FEATURE_KINDS[f.kind];
    if (!k || k.pin === 'none') return;
    if (!Number.isInteger(f.pin)) { out.push(`${f.name}: 남은 핀이 없습니다. 더 큰 MCU(ESP32-S3)를 고르세요.`); return; }
    if (seen.has(f.pin)) out.push(`GPIO${f.pin} 을 ${seen.get(f.pin)} 와 ${f.name} 이 함께 씁니다.`);
    seen.set(f.pin, f.name);
    if (k.pin === 'adc' && !m.adc.includes(f.pin)) out.push(`${f.name}: GPIO${f.pin} 은 ADC 핀이 아닙니다 (ADC: ${m.adc.join(', ')}).`);
  });
  return out;
}

/** 부품 목록 (MCU 기본 + 기능별), 같은 이름은 합친다 */
export function featureBom(features, mcu = 'esp32c3', supplyV = 5) {
  const map = new Map();
  const add = (name, qty, from) => {
    const cur = map.get(name) || { name, qty: 0, used_by: [] };
    cur.qty += qty;
    if (from && !cur.used_by.includes(from)) cur.used_by.push(from);
    map.set(name, cur);
  };
  BASE_BOM(mcu, supplyV).forEach(([n, q]) => add(n, q, '공통'));
  features.forEach((f) => (FEATURE_KINDS[f.kind]?.bom || []).forEach(([n, q]) => add(n, q, f.name)));
  return [...map.values()];
}

// 컨셉 부품 이름 → 기능 추정 (미팅에서 만든 컨셉으로 기능 목록을 빨리 시작하려고)
// 구체적인 것부터 (센서 이름에 '히터'가 들어가도 온도 센서로), 수동 부품·구조물은 건너뛴다
const HINTS = [
  [/수위|물\s*부족|플로트|float|water\s*level/i, 'water'],
  [/기울|전도|tilt/i, 'tilt'],
  [/뚜껑\s*(감지|센서)|분리\s*감지|리드|reed|lid\s*sensor/i, 'lid'],
  [/온도\s*센서|서미스터|NTC|temp(erature)?\s*sensor/i, 'temp'],
  [/버튼|스위치|button|switch|key/i, 'button'],
  [/LED|표시등|라이트|조명|light|indicator/i, 'led'],
  [/모터|팬|펌프|motor|fan|pump/i, 'motor'],
  [/히터|열선|heater|heating/i, 'heater'],
  [/부저|스피커|buzzer|speaker/i, 'buzzer'],
  [/서보|servo/i, 'servo'],
  [/릴레이|relay/i, 'relay'],
  [/온도|temp/i, 'temp'],
  [/다이얼|노브|볼륨|가변|knob|dial/i, 'analog'],
  [/배터리|전지|battery|cell/i, 'battery'],
];
// 회로 기능이 아닌 부품: 퓨즈·챔버·기판·커넥터·노즐 등 (이름에 감지·센서·스위치가 없을 때)
const PASSIVE = /퓨즈|fuse|챔버|chamber|기판|pcb|잭|jack|커넥터|connector|노즐|nozzle|탱크|tank|발$|foot/i;
const SENSORISH = /감지|센서|스위치|sensor|switch/i;
export function suggestFeatures(parts, existing = []) {
  const have = new Set(existing.map((f) => `${f.kind}:${f.name}`));
  const out = [];
  (parts || []).forEach((p) => {
    // 이름으로 먼저 찾고, 이름에 단서가 없으면 조작·내부 부품만 설명(role)으로 찾는다 (기판·외장 설명의 '버튼' 언급 등은 무시)
    if (PASSIVE.test(p.name || '') && !SENSORISH.test(p.name || '')) return;
    const hit = HINTS.find(([re]) => re.test(p.name || ''))
      || (['UI', 'INTERNAL'].includes(p.layer) ? HINTS.find(([re]) => re.test(p.role || '')) : null);
    if (!hit) return;
    const name = String(p.name || FEATURE_KINDS[hit[1]].label).slice(0, 40);
    if (have.has(`${hit[1]}:${name}`)) return;
    have.add(`${hit[1]}:${name}`);
    const f = { ...makeFeature(hit[1], name), part_id: p.id || null };
    // 이름에 적힌 전력 (예: '후막 히터 48 W')
    const w = hit[1] === 'heater' && String(p.name || '').match(/(\d+(?:\.\d+)?)\s*W\b/i);
    if (w) f.power_w = Number(w[1]);
    out.push(f);
  });
  return out;
}

// 출력(구동부) 종류별 값: 켰을 때 값, 단계 바꾸기 순서
export const OUTPUT_LEVELS = {
  led: { on: 100, steps: [0, 30, 100] },
  motor: { on: 100, steps: [0, 40, 70, 100] },
  heater: { on: 100, steps: [0, 50, 100] },
  buzzer: { on: 2000, steps: [0, 1000, 2000] },
  servo: { on: 180, steps: [0, 90, 180] },
  relay: { on: 1, steps: [0, 1] },
};
export const isOutput = (kind) => !!OUTPUT_LEVELS[kind];
// 넘어짐·뚜껑 열림 같은 안전 조건에서 "모든 구동부"로 함께 끄는 대상 (표시등·부저는 알림으로 남긴다)
export const DRIVE_KINDS = ['motor', 'heater', 'relay'];

/** 컨셉 부품 중 뚜껑으로 보이는 것 (외장, 이름에 뚜껑·커버·상부·lid) */
export function findLidPart(parts) {
  return (parts || []).find((p) => p.layer === 'SHELL' && /뚜껑|커버|상부|상단|lid|cover|cap/i.test(p.name || '')) || null;
}
