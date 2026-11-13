// 정밀 해석을 화면 밖(웹 워커)에서 돌린다. 긴 과도 해석·몬테카를로 중에도 화면이 멈추지 않게.
import { runAnalysis } from './analysis.js';

self.onmessage = (e) => {
  const { id, circuit, settings } = e.data || {};
  let last = 0;
  try {
    const out = runAnalysis(circuit, settings, (p) => {
      const now = Date.now();
      if (now - last > 120) { last = now; self.postMessage({ id, progress: p }); }
    });
    self.postMessage({ id, done: true, out });
  } catch (err) {
    self.postMessage({ id, done: true, out: { runs: [], error: `해석 중 오류: ${err?.message || err}` } });
  }
};
