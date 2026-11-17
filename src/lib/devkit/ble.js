// 블루투스(BLE GATT) 설계: 기능 목록 → 서비스·특성 UUID, 값 형식, ESP32 펌웨어 뼈대, 앱 개발팀용 프로토콜 문서.
import { FEATURE_KINDS, needsClock } from './features.js';

const hex = (n, len) => n.toString(16).padStart(len, '0');

/** 무작위 128비트 기준 UUID. 앞 8자리 중 3~8번째 자리(16비트)를 항목 번호로 바꿔 쓴다 */
export function randomBase(rand = Math.random) {
  const r = (len) => Array.from({ length: len }, () => hex(Math.floor(rand() * 16), 1)).join('');
  return `${r(4)}0000-${r(4)}-4${r(3)}-${'89ab'[Math.floor(rand() * 4)]}${r(3)}-${r(12)}`;
}

/** 기준 UUID 의 16비트 자리를 n 으로 바꾼다 (서비스 = 0x0001, 장치 정보 = 0x00ff, 기능 = 0x1001 부터) */
export const uuidAt = (base, n) => `${base.slice(0, 4)}${hex(n, 4)}${base.slice(8)}`.toLowerCase();
export const isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ''));

export const TYPE_BYTES = { u8: 1, u16: 2, i16: 2, u32: 4 };
export const TYPE_LABEL = { u8: '부호 없는 1바이트', u16: '부호 없는 2바이트 (리틀 엔디언)', i16: '부호 있는 2바이트 (리틀 엔디언)', u32: '부호 없는 4바이트 (리틀 엔디언)', bytes: '바이트 열' };

/** 기능 목록 → GATT 표. 기능에 저장된 uuid 를 우선 써서 이름·순서를 바꿔도 UUID 가 그대로다 */
export function buildGatt(dev) {
  const base = isUuid(dev?.uuid_base) ? dev.uuid_base.toLowerCase() : '00000000-0000-4000-8000-000000000000';
  const used = new Set((dev?.features || []).map((f) => f.uuid).filter(isUuid));
  let next = 0x1001;
  const fresh = () => { let u; do { u = uuidAt(base, next++); } while (used.has(u)); used.add(u); return u; };
  const chars = (dev?.features || []).filter((f) => FEATURE_KINDS[f.kind]).map((f, i) => {
    const k = FEATURE_KINDS[f.kind];
    return { feature_id: f.id, index: i + 1, name: f.name, kind: f.kind, pin: f.pin, uuid: isUuid(f.uuid) ? f.uuid.toLowerCase() : fresh(), ...k.ble, scale: k.ble.scale || 1 };
  });
  // 시스템 항목: 시각 맞추기·수면 일정(시계가 있을 때), 센서 보정·응답 시간 확인(항상)
  const feats = (dev?.features || []).filter((f) => FEATURE_KINDS[f.kind]);
  const clock = needsClock(feats, dev?.rules);
  const schedule = (dev?.rules || []).some((r) => r.type === 'schedule') || (!Array.isArray(dev?.rules) && clock && feats.some((f) => f.kind === 'switch'));
  const sys = [
    ...(clock ? [{ key: 'time', uuid: uuidAt(base, 0x00f0), name: '장치 시각', access: ['read', 'write'], type: 'u32', unit: '초', min: 0, max: 4294967295, scale: 1, desc: '현지 시각, 1970-01-01 00:00 부터 초 (앱이 연결할 때 써서 시계를 맞춘다)' }] : []),
    ...(schedule ? [{ key: 'schedule', uuid: uuidAt(base, 0x00f1), name: '수면 일정', access: ['read', 'write'], type: 'bytes', scale: 1, desc: '8바이트: 켜짐(0/1), 취침 시, 분, 감광 분, 기상 시, 분, 증광 분, 기상 밝기 % (장치에 저장)' }] : []),
    { key: 'calib', uuid: uuidAt(base, 0x00f2), name: '센서 보정', access: ['write', 'notify'], type: 'bytes', scale: 1, desc: '01 n = 항목 n 원시값 요청 → 알림 01 n 원시값(i32) 보정값(i32) · 02 n 오프셋(i16) 배율(u16, ×1000) = 저장 · 03 = 전부 지우기' },
    { key: 'ota', uuid: uuidAt(base, 0x00f4), name: '무선 펌웨어 업데이트', access: ['write', 'notify'], type: 'bytes', scale: 1, desc: '01 크기(u32) = 시작 → 알림 01 · 02 데이터… = 조각(쓰기 응답으로 흐름 제어, 4 KB 마다 알림 02 받은 바이트(u32)) · 03 = 끝(검증 후 다시 시작, 알림 03) · 04 = 취소. 오류 알림 E1 시작 실패 · E2 쓰기 실패 · E3 크기·검증 실패' },
    { key: 'ping', uuid: uuidAt(base, 0x00f3), name: '응답 시간 확인', access: ['write', 'notify'], type: 'bytes', scale: 1, desc: '받은 바이트를 그대로 알림으로 돌려보냄 (왕복 시간 측정)' },
  ];
  return {
    device_name: String(dev?.device_name || 'AEGIS-PROTO').slice(0, 20),
    service: uuidAt(base, 0x0001),
    info: { uuid: uuidAt(base, 0x00ff), name: '펌웨어 버전', access: ['read'], type: 'string' },
    chars,
    sys,
  };
}

/** 기능에 UUID 를 붙여 둔다 (저장 전에 호출: 한 번 정한 UUID 를 고정) */
export function pinUuids(dev) {
  const g = buildGatt(dev);
  const byId = new Map(g.chars.map((c) => [c.feature_id, c.uuid]));
  return { ...dev, features: (dev.features || []).map((f) => ({ ...f, uuid: byId.get(f.id) || f.uuid || null })) };
}

// ── 값 ↔ 바이트 ──
export function encodeValue(c, value) {
  if (c.type === 'bytes') {
    const s = String(value ?? '').trim();
    if (!s) return new Uint8Array(0);
    // "01 0a ff" 같은 16진수, 아니면 글자 그대로(UTF-8)
    if (/^([0-9a-f]{2}\s*)+$/i.test(s)) return new Uint8Array(s.split(/\s+/).join('').match(/../g).map((h) => parseInt(h, 16))).slice(0, 20);
    return new TextEncoder().encode(s).slice(0, 20);
  }
  const raw = Math.round(Number(value) / (c.scale || 1));
  const v = Math.max(c.min ?? -Infinity, Math.min(c.max ?? Infinity, Number.isFinite(raw) ? raw : 0));
  const n = TYPE_BYTES[c.type] || 1;
  const buf = new DataView(new ArrayBuffer(n));
  if (c.type === 'u8') buf.setUint8(0, v);
  else if (c.type === 'u16') buf.setUint16(0, v, true);
  else if (c.type === 'u32') buf.setUint32(0, v >>> 0, true);
  else buf.setInt16(0, v, true);
  return new Uint8Array(buf.buffer);
}

export function decodeValue(c, bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes?.buffer || bytes || []);
  if (c.type === 'string') return new TextDecoder().decode(u);
  if (c.type === 'bytes') return Array.from(u).map((b) => hex(b, 2)).join(' ');
  const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
  if (u.byteLength < (TYPE_BYTES[c.type] || 1)) return null;
  const raw = c.type === 'u8' ? dv.getUint8(0) : c.type === 'u16' ? dv.getUint16(0, true) : c.type === 'u32' ? dv.getUint32(0, true) : dv.getInt16(0, true);
  return Number((raw * (c.scale || 1)).toFixed(3));
}

export const bytesHex = (u) => Array.from(u || []).map((b) => hex(b, 2)).join(' ');

/** 표시용 값 문자열 */
export const showValue = (c, v) => (v == null ? '—' : c.type === 'bytes' || c.type === 'string' ? String(v) : `${v}${c.unit ? ` ${c.unit}` : ''}`);

// ESP32 펌웨어 생성은 firmware.js (동작 규칙 포함)
export { firmwareSketch } from './firmware.js';

// ── 앱 개발팀용 프로토콜 문서 (마크다운) ──
const accessKo = { read: '읽기', write: '쓰기', notify: '알림' };
export function protocolDoc(dev, { title = '' } = {}) {
  const g = buildGatt(dev);
  const L = [];
  L.push(`# ${title ? `${title} — ` : ''}블루투스 통신 규격`, '');
  L.push(`- 장치 이름(광고): \`${g.device_name}\``, `- 서비스 UUID: \`${g.service}\``, `- 펌웨어 버전(읽기, UTF-8 글자): \`${g.info.uuid}\``, '- 숫자는 모두 리틀 엔디언입니다. 실제 값 = 정수 × 배율.', '');
  L.push('## 연결 순서', '', '1. 서비스 UUID 로 걸러 스캔하고 장치 이름을 확인합니다.', '2. 연결 후 서비스를 찾고, 아래 특성마다 읽기·쓰기·알림 구독을 합니다.', '3. 알림(notify) 항목은 연결할 때마다 다시 구독해야 합니다 (CCCD 0x2902 에 01 00).', '4. 연결이 끊기면 장치가 다시 광고합니다. 앱은 다시 스캔해서 붙습니다.', '');
  L.push('## 특성 목록', '', '| # | 기능 | UUID | 동작 | 형식 | 범위·단위 | 배율 | 예 (값 → 바이트) |', '|---|---|---|---|---|---|---|---|');
  g.chars.forEach((c) => {
    const range = c.type === 'bytes' ? '최대 20바이트' : `${c.min}~${c.max}${c.unit ? ` (${c.unit})` : ''}`;
    const exVal = c.type === 'bytes' ? '01 05' : c.kind === 'temp' ? 25.3 : Math.min(c.max, c.max > 1 ? 50 : 1);
    const exBytes = c.type === 'bytes' ? '01 05' : bytesHex(encodeValue(c, exVal));
    L.push(`| ${c.index} | ${c.name} | \`${c.uuid}\` | ${c.access.map((a) => accessKo[a]).join('·')} | ${c.type} | ${range} | ${c.scale} | ${exVal} → \`${exBytes}\` |`);
  });
  if (g.sys?.length) {
    L.push('', '## 시스템 항목', '', '| 항목 | UUID | 동작 | 형식 | 설명 |', '|---|---|---|---|---|');
    g.sys.forEach((c) => L.push(`| ${c.name} | \`${c.uuid}\` | ${c.access.map((a) => accessKo[a]).join('·')} | ${c.type} | ${c.desc} |`));
  }
  L.push('', '## 항목 설명', '');
  g.chars.forEach((c) => L.push(`- **${c.name}** (${FEATURE_KINDS[c.kind].label}): ${c.desc}${Number.isInteger(c.pin) ? ` · 장치 핀 GPIO${c.pin}` : ''}`));
  L.push('', '## 웹·앱 예시 코드', '', '### Web Bluetooth (크롬·안드로이드)', '', '```js');
  L.push(`const SERVICE = '${g.service}';`, 'const device = await navigator.bluetooth.requestDevice({ filters: [{ services: [SERVICE] }] });', 'const svc = await (await device.gatt.connect()).getPrimaryService(SERVICE);');
  const w = g.chars.find((c) => c.access.includes('write') && c.type !== 'bytes');
  const n = g.chars.find((c) => c.access.includes('notify') && c.type !== 'bytes');
  if (w) L.push(`// ${w.name} 쓰기`, `await (await svc.getCharacteristic('${w.uuid}')).writeValue(new Uint8Array([${Array.from(encodeValue(w, Math.min(w.max, 50))).join(', ')}]));`);
  if (n) L.push(`// ${n.name} 알림 받기`, `const ch = await svc.getCharacteristic('${n.uuid}');`, "ch.addEventListener('characteristicvaluechanged', (e) => {", `  const v = e.target.value.${n.type === 'u8' ? 'getUint8(0)' : n.type === 'u16' ? 'getUint16(0, true)' : 'getInt16(0, true)'}${n.scale !== 1 ? ` * ${n.scale}` : ''};`, '  console.log(v);', '});', 'await ch.startNotifications();');
  L.push('```', '', '### Flutter (flutter_blue_plus)', '', '```dart');
  L.push(`final service = Guid('${g.service}');`, 'await FlutterBluePlus.startScan(withServices: [service], timeout: const Duration(seconds: 5));', '// 결과에서 장치를 골라 connect() → discoverServices() → 아래 UUID 로 특성을 찾습니다.');
  if (w) L.push(`await ch(Guid('${w.uuid}')).write([${Array.from(encodeValue(w, Math.min(w.max, 50))).join(', ')}]);  // ${w.name}`);
  if (n) L.push(`await ch(Guid('${n.uuid}')).setNotifyValue(true);  // ${n.name}`, `ch(Guid('${n.uuid}')).onValueReceived.listen((b) => print(ByteData.sublistView(Uint8List.fromList(b)).${n.type === 'u8' ? 'getUint8(0)' : n.type === 'u16' ? 'getUint16(0, Endian.little)' : 'getInt16(0, Endian.little)'}${n.scale !== 1 ? ` * ${n.scale}` : ''}));`);
  L.push('```', '');
  return L.join('\n');
}
