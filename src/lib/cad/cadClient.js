// CAD 워커와 주고받기 (메인 스레드). 워커는 하나만 띄우고 명령을 차례로 보낸다.
let worker = null;
let seq = 0;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./cad.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (event) => {
    const { id, progress, done, result, error } = event.data || {};
    const job = pending.get(id);
    if (!job) return;
    if (progress) { job.onProgress?.(progress); return; }
    pending.delete(id);
    if (error) job.reject(new Error(error));
    else if (done) job.resolve(result);
  };
  worker.onerror = (err) => {
    for (const job of pending.values()) job.reject(new Error(`CAD 엔진을 불러오지 못했습니다: ${err?.message || '원인 불명'}`));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

export function cadCall(cmd, data = {}, onProgress) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    getWorker().postMessage({ id, cmd, ...data });
  });
}

/** 워커가 멈췄을 때(무한 연산 등) 새로 띄운다 */
export function resetCad() {
  worker?.terminate();
  worker = null;
  for (const job of pending.values()) job.reject(Object.assign(new Error('취소했습니다'), { cancelled: true }));
  pending.clear();
}
