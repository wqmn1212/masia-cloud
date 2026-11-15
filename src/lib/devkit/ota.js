// 무선 펌웨어 업데이트 (BLE): 앱 영역 이미지를 조각으로 보낸다. 장치 쪽 규약은 ble.js 의 'ota' 항목 설명과 같다.
// 합친 바이너리(merged.bin: 부트로더 + 파티션 표 + 앱)를 고르면 앱 부분(0x10000 부터)만 잘라 보낸다.

/** ESP 앱 이미지의 정확한 길이 (머리 24 + 조각들 + 체크섬 맞춤 + 해시 32). 형식이 아니면 0 */
export function espImageSize(u8, at = 0) {
  if (!u8 || u8.length < at + 24 || u8[at] !== 0xe9) return 0;
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const segs = u8[at + 1];
  if (segs < 1 || segs > 16) return 0;
  let p = at + 24;
  for (let i = 0; i < segs; i++) {
    if (p + 8 > u8.length) return 0;
    p += 8 + dv.getUint32(p + 4, true);
  }
  p = at + (Math.floor((p - at) / 16) + 1) * 16; // 체크섬 바이트까지 16의 배수로
  if (u8[at + 23] === 1) p += 32; // SHA-256 붙음
  return p > u8.length ? 0 : p - at;
}

/** 고른 파일에서 무선으로 보낼 앱 이미지를 꺼낸다 → { image, from: 'app' | 'merged' } */
export function appImage(u8) {
  const APP = 0x10000;
  if (u8.length > APP + 24 && u8[APP] === 0xe9 && (u8[0] === 0xe9 || u8[0] === 0xff)) {
    const n = espImageSize(u8, APP);
    if (n) return { image: u8.subarray(APP, APP + n), from: 'merged' };
  }
  const n = espImageSize(u8, 0);
  if (!n) throw new Error('ESP32 펌웨어 파일이 아닙니다 (*.ino.bin 또는 *.merged.bin 을 고르세요)');
  return { image: u8.subarray(0, n), from: 'app' };
}

const ERR = { 0xe1: '장치가 업데이트를 시작하지 못했습니다 (펌웨어가 너무 크거나 빈 영역이 없음)', 0xe2: '장치가 조각을 쓰지 못했습니다', 0xe3: '받은 크기나 검증값이 맞지 않습니다 (지금 펌웨어 그대로 유지)' };

/**
 * api: BleTester 의 시스템 항목 통로 ({ write, request }). 끝나면 장치가 새 펌웨어로 다시 시작한다 (연결이 끊긴다).
 * onProgress(0~1). 돌려줌: { bytes, seconds }
 */
export async function otaSend(api, image, { onProgress, chunk = 180, signal } = {}) {
  const t0 = Date.now();
  const head = new Uint8Array(5);
  head[0] = 0x01;
  new DataView(head.buffer).setUint32(1, image.length, true);
  const ok = await api.request('ota', head, (r) => r[0] === 0x01 || r[0] >= 0xe0, 8000);
  if (ok[0] !== 0x01) throw new Error(ERR[ok[0]] || '업데이트를 시작하지 못했습니다');
  try {
    for (let at = 0; at < image.length; at += chunk) {
      if (signal?.aborted) throw new Error('업데이트를 멈췄습니다');
      const part = image.subarray(at, Math.min(image.length, at + chunk));
      const b = new Uint8Array(part.length + 1);
      b[0] = 0x02;
      b.set(part, 1);
      await api.write('ota', b);
      onProgress?.(Math.min(1, (at + part.length) / image.length));
    }
  } catch (e) {
    await api.write('ota', new Uint8Array([0x04])).catch(() => {});
    throw e;
  }
  const end = await api.request('ota', new Uint8Array([0x03]), (r) => r[0] === 0x03 || r[0] >= 0xe0, 20000);
  if (end[0] !== 0x03) throw new Error(ERR[end[0]] || '업데이트를 끝내지 못했습니다');
  return { bytes: image.length, seconds: Math.round((Date.now() - t0) / 100) / 10 };
}
