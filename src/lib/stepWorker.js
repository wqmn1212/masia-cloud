// STEP 파싱 Web Worker
// 42부품 파싱에 수 초가 걸리므로 메인 스레드에서 실행하지 않는다.
import occtimportjs from 'occt-import-js';
import occtWasmUrl from 'occt-import-js/dist/occt-import-js.wasm?url';
import { analyzeMesh } from '@/lib/meshVolume';

let occtPromise = null;

function loadOcct() {
  if (!occtPromise) {
    if (typeof occtimportjs !== 'function') {
      throw new Error('occt-import-js 모듈을 불러오지 못했습니다 (WASM 로더 초기화 실패)');
    }
    occtPromise = occtimportjs({
      locateFile: () => occtWasmUrl,
    });
  }
  return occtPromise;
}

self.onmessage = async (event) => {
  const { buffer, deflection = 0.1, maxParts = 200 } = event.data || {};

  try {
    const startedAt = performance.now();
    const occt = await loadOcct();

    self.postMessage({ type: 'progress', phase: 'parsing', percent: 10 });

    const result = occt.ReadStepFile(new Uint8Array(buffer), {
      linearUnit: 'millimeter',
      linearDeflectionType: 'absolute_value',
      linearDeflection: deflection,
      angularDeflection: 0.25,
    });

    if (!result || !result.success) {
      throw new Error('STEP 파일을 읽을 수 없습니다');
    }

    const meshes = result.meshes || [];
    if (meshes.length > maxParts) {
      throw new Error(`부품 수가 상한(${maxParts}개)을 초과했습니다: ${meshes.length}개`);
    }

    const parts = [];
    // 메시는 TypedArray 로 담아 buffer 를 transfer 한다 —
    // 일반 배열로 복사하면 42부품 규모에서 메모리가 폭증해 탭이 죽는다.
    const transfers = [];

    for (let i = 0; i < meshes.length; i++) {
      const mesh = meshes[i];
      const rawPositions = mesh.attributes?.position?.array || [];
      const rawIndices = mesh.index?.array || [];

      if (rawPositions.length === 0 || rawIndices.length === 0) continue;

      const positions = rawPositions instanceof Float32Array ? rawPositions : new Float32Array(rawPositions);
      const indices = rawIndices instanceof Uint32Array ? rawIndices : new Uint32Array(rawIndices);

      const metrics = analyzeMesh(positions, indices);

      parts.push({
        part_name: mesh.name || `PART_${i + 1}`,
        ...metrics,
        mesh: { positions, indices },
      });
      transfers.push(positions.buffer, indices.buffer);

      self.postMessage({
        type: 'progress',
        phase: 'analyzing',
        percent: 10 + Math.round(((i + 1) / meshes.length) * 85),
      });
    }

    self.postMessage({
      type: 'done',
      parts,
      elapsed_ms: Math.round(performance.now() - startedAt),
    }, transfers);
  } catch (error) {
    self.postMessage({ type: 'error', message: error?.message || 'STEP 파싱 실패' });
  }
};