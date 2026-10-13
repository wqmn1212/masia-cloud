// 금형 사전 검토 Web Worker — 큰 부품은 수십 초 걸리므로 메인 스레드에서 돌리지 않는다.
import { analyzeMold } from './analyzeCore.js';
import { makeSampleHousing } from './sampleHousing.js';

function transferables(result) {
  const list = [
    result.mesh.V, result.mesh.F,
    result.face.side, result.face.draft, result.face.thick, result.face.wall, result.face.S, result.face.area, result.face.flexible,
    result.vertex.thick, result.parting.segments, result.parting.kinds,
  ];
  for (const plan of result.plans) list.push(plan.fill, plan.weld);
  return [...new Set(list.map((a) => a.buffer))];
}

self.onmessage = (event) => {
  const { positions, indices, options, sample } = event.data || {};
  try {
    let pos = positions, idx = indices;
    if (sample) {
      self.postMessage({ type: 'progress', label: '샘플 형상 만드는 중', percent: 1 });
      const s = makeSampleHousing();
      pos = s.positions;
      idx = s.indices;
    }
    const result = analyzeMold(pos, idx, options, (label, percent) => {
      self.postMessage({ type: 'progress', label, percent });
    });
    self.postMessage({ type: 'done', result }, transferables(result));
  } catch (error) {
    self.postMessage({ type: 'error', message: error?.message || '검토 중 오류가 났습니다' });
  }
};
