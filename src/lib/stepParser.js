// STEP(.stp/.step) 파싱 래퍼
// 브라우저 Web Worker 에서 occt-import-js(OpenCascade WASM)로 파싱한다.
// Base44 함수(Deno)에서는 처리하지 않는다.

export const MAX_FILE_SIZE_MB = 50;
export const MAX_PART_COUNT = 200;
export const DEFAULT_DEFLECTION_MM = 0.1;

/**
 * STEP 파일을 파싱해 부품별 형상 지표를 반환한다.
 *
 * @param {ArrayBuffer} buffer - STEP 파일 내용
 * @param {object} [options]
 * @param {(progress: {phase: string, percent: number}) => void} [options.onProgress]
 * @param {number} [options.deflection] - 테셀레이션 정밀도(mm). 기본 0.1
 * @returns {Promise<{parts: Array, elapsed_ms: number}>}
 *   parts[i] = { part_name, volume_cm3, bbox_x_mm, bbox_y_mm, bbox_z_mm,
 *                projected_area_cm2, triangle_count, mesh }
 */
export function parseStepFile(buffer, options = {}) {
  const { onProgress, deflection = DEFAULT_DEFLECTION_MM } = options;

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./stepWorker.js', import.meta.url), { type: 'module' });

    worker.onmessage = (event) => {
      const msg = event.data || {};
      if (msg.type === 'progress') {
        onProgress?.({ phase: msg.phase, percent: msg.percent });
        return;
      }
      if (msg.type === 'done') {
        worker.terminate();
        resolve({ parts: msg.parts, elapsed_ms: msg.elapsed_ms });
        return;
      }
      if (msg.type === 'error') {
        worker.terminate();
        reject(new Error(msg.message));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      const where = err?.filename ? ` (${err.filename}:${err.lineno})` : '';
      reject(new Error(`STEP 파싱 워커 로드 실패: ${err?.message || '원인 불명'}${where}`));
    };

    worker.postMessage(
      { buffer, deflection, maxParts: MAX_PART_COUNT },
      [buffer]
    );
  });
}

/** File 객체를 검증하고 파싱한다. */
export async function parseStepFileFromFile(file, options = {}) {
  const name = (file?.name || '').toLowerCase();
  if (!name.endsWith('.stp') && !name.endsWith('.step')) {
    throw new Error('STEP(.stp/.step) 파일만 지원합니다');
  }
  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > MAX_FILE_SIZE_MB) {
    throw new Error(`파일 크기 상한(${MAX_FILE_SIZE_MB}MB)을 초과했습니다: ${sizeMb.toFixed(1)}MB`);
  }
  const buffer = await file.arrayBuffer();
  return parseStepFile(buffer, options);
}