// 브라우저에서 ESP32 굽기(WebSerial + esptool-js)와 시리얼 모니터. 크롬·엣지(데스크톱)에서만 된다.
// 빌드는 서버 함수 firmwareBuild → GitHub Actions(.github/workflows/firmware.yml) → 합친 바이너리(0x0 에 굽는다).
import { base44 } from '@/api/base44Client';

export const serialSupported = () => typeof navigator !== 'undefined' && 'serial' in navigator;
export const CHIP_NAME = { esp32c3: 'ESP32-C3', esp32s3: 'ESP32-S3', esp32: 'ESP32' };

const toBinaryString = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return s; };
export const b64ToBytes = (b64) => { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };

// ── 빌드 서버 ──
export const buildStatus = async () => (await base44.functions.invoke('firmwareBuild', { action: 'status' })).data;
export const requestBuild = async (sketch, fqbn) => (await base44.functions.invoke('firmwareBuild', { action: 'build', sketch, fqbn })).data;
export const pollBuild = async (requestId) => (await base44.functions.invoke('firmwareBuild', { action: 'poll', request_id: requestId })).data;

/** 빌드 요청 → 끝날 때까지 기다림 (onState: queued | building). 돌려줌: { bin: Uint8Array, name, run_url } */
export async function buildAndWait(sketch, fqbn, { onState, signal, timeoutMs = 15 * 60 * 1000, everyMs = 8000 } = {}) {
  const { request_id: id } = await requestBuild(sketch, fqbn);
  const t0 = Date.now();
  for (;;) {
    if (signal?.aborted) throw new Error('빌드 기다리기를 멈췄습니다');
    if (Date.now() - t0 > timeoutMs) throw new Error('빌드가 15분 안에 끝나지 않았습니다');
    await new Promise((r) => setTimeout(r, everyMs));
    const r = await pollBuild(id);
    if (r.state === 'done') return { bin: b64ToBytes(r.bin_b64), name: r.name, run_url: r.run_url, id };
    if (r.state === 'failed') { const e = new Error(`컴파일 실패${r.log ? `\n${r.log}` : ''}`); e.run_url = r.run_url; throw e; }
    onState?.(r.state, Math.round((Date.now() - t0) / 1000), r.run_url);
  }
}

// ── 굽기 ──
/**
 * 합친 바이너리를 0x0 에 굽는다. 칩이 설정(mcu)과 다르면 굽지 않는다.
 * onLog(줄), onProgress(0~1). 돌려줌: { chip }
 */
export async function flashBinary(bin, { mcu, onLog, onProgress, port } = {}) {
  if (!serialSupported()) throw new Error('이 브라우저는 USB 시리얼(WebSerial)을 지원하지 않습니다. 데스크톱 크롬·엣지를 쓰세요.');
  const { ESPLoader, Transport } = await import('esptool-js');
  const device = port || await navigator.serial.requestPort();
  const transport = new Transport(device, false);
  const log = (s) => onLog?.(String(s).trimEnd());
  const terminal = { clean() {}, writeLine: log, write: log };
  const loader = new ESPLoader({ transport, baudrate: 921600, romBaudrate: 115200, terminal });
  let chip = '';
  try {
    await loader.main();
    chip = loader.chip?.CHIP_NAME || '';
    if (CHIP_NAME[mcu] && chip && chip !== CHIP_NAME[mcu]) throw new Error(`연결한 보드는 ${chip} 인데 설정한 MCU 는 ${CHIP_NAME[mcu]} 입니다. 기능 정의 단계의 MCU 를 바꾸거나 맞는 보드를 연결하세요.`);
    await loader.writeFlash({ fileArray: [{ data: toBinaryString(bin), address: 0 }], flashSize: 'keep', flashMode: 'keep', flashFreq: 'keep', eraseAll: false, compress: true, reportProgress: (_i, written, total) => onProgress?.(total ? written / total : 0) });
    log('굽기 완료, 다시 시작합니다');
    await loader.after('hard_reset');
  } finally {
    await transport.disconnect().catch(() => {});
  }
  return { chip, port: device };
}

// ── 시리얼 모니터 (115200) ──
export class SerialMonitor {
  constructor(onLine) { this.onLine = onLine; this.port = null; this.reader = null; this.writer = null; this.alive = false; }
  async open(port) {
    this.port = port || await navigator.serial.requestPort();
    if (!this.port.readable) await this.port.open({ baudRate: 115200 });
    this.alive = true;
    const enc = new TextEncoderStream();
    this.writerDone = enc.readable.pipeTo(this.port.writable).catch(() => {});
    this.writer = enc.writable.getWriter();
    this.readLoop();
  }
  async readLoop() {
    const dec = new TextDecoderStream();
    this.readerDone = this.port.readable.pipeTo(dec.writable).catch(() => {});
    this.reader = dec.readable.getReader();
    let buf = '';
    try {
      while (this.alive) {
        const { value, done } = await this.reader.read();
        if (done) break;
        buf += value;
        const lines = buf.split(/\r?\n/);
        buf = lines.pop();
        lines.forEach((l) => this.onLine?.(l));
      }
    } catch { /* 닫힘 */ }
  }
  async send(line) { if (this.writer) await this.writer.write(`${line}\n`); }
  async close() {
    this.alive = false;
    try { await this.reader?.cancel(); } catch { /* 이미 닫힘 */ }
    try { await this.writer?.close(); } catch { /* 이미 닫힘 */ }
    await Promise.allSettled([this.readerDone, this.writerDone]);
    try { await this.port?.close(); } catch { /* 이미 닫힘 */ }
  }
}

/** 현지 시각(1970 기준 초) — 장치 시계 맞추기용 */
export const localEpoch = (d = new Date()) => Math.floor(d.getTime() / 1000) - d.getTimezoneOffset() * 60;
