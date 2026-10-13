// 금형 사전 검토 실행 (메인 스레드 쪽). 워커를 띄우고 진행률·결과를 받는다.

/** 삼각형이 이보다 많으면 브라우저에서 검토하기 어렵다 (STEP 변환 정밀도를 낮추도록 안내) */
export const MAX_REVIEW_TRIANGLES = 700000;

/**
 * @param {{ positions?: Float32Array, indices?: Uint32Array, sample?: boolean }} input
 * @param {object} options analyzeCore DEFAULT_ANALYSIS_OPTIONS
 * @param {(p: { label: string, percent: number }) => void} [onProgress]
 * @returns {{ promise: Promise<object>, cancel: () => void }}
 */
export function runMoldReview(input, options, onProgress) {
  let worker = null;
  let settle = null;
  const promise = new Promise((resolve, reject) => {
    settle = { resolve, reject };
    if (!input.sample && input.indices && input.indices.length / 3 > MAX_REVIEW_TRIANGLES) {
      reject(new Error(`삼각형이 ${Math.round(MAX_REVIEW_TRIANGLES / 10000)}만 개를 넘어 검토할 수 없습니다. 부품을 나눠 올려 주세요.`));
      return;
    }
    worker = new Worker(new URL('./moldReview.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (event) => {
      const msg = event.data || {};
      if (msg.type === 'progress') {
        onProgress?.({ label: msg.label, percent: msg.percent });
        return;
      }
      worker.terminate();
      worker = null;
      if (msg.type === 'done') resolve(msg.result);
      else reject(new Error(msg.message || '검토 중 오류가 났습니다'));
    };
    worker.onerror = (err) => {
      worker?.terminate();
      worker = null;
      reject(new Error(`검토 엔진을 불러오지 못했습니다: ${err?.message || '원인 불명'}`));
    };
    // 원본 메시는 화면에서 계속 쓰므로 복사해서 보낸다
    worker.postMessage(input.sample
      ? { sample: true, options }
      : { positions: input.positions.slice(), indices: input.indices.slice(), options });
  });
  const cancel = () => {
    if (!worker) return;
    worker.terminate();
    worker = null;
    settle?.reject(Object.assign(new Error('취소했습니다'), { cancelled: true }));
  };
  return { promise, cancel };
}
