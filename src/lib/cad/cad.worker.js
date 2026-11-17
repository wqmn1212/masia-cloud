// CAD 워커: OpenCascade(replicad)로 템플릿 솔리드를 만들고, 화면용 메시·금형 점검용 메시·STEP·간섭 검사를 돌려준다.
// WASM 이 크고(약 23 MB, 전송 7 MB) 솔리드 연산이 수 초 걸리므로 메인 스레드에서 돌리지 않는다.
import opencascade from 'replicad-opencascadejs';
import wasmUrl from 'replicad-opencascadejs/wasm?url';
import * as R from 'replicad';
import { buildAssembly } from './builders.js';
import { checkInterference } from './interference.js';
import { skipPcbPair } from './pcbParts.js';
import { MATERIALS, stepName } from './catalog.js';

let ready = null;
let current = null; // 마지막으로 만든 조립 { parts: [{... shape}], motion, view: [{id, V, F}] }

function init() {
  if (!ready) {
    ready = opencascade({ locateFile: () => wasmUrl }).then((oc) => { R.setOC(oc); });
    ready.catch(() => { ready = null; });
  }
  return ready;
}

const DENSITY = { ...Object.fromEntries(Object.entries(MATERIALS).map(([k, m]) => [m.label, m.density])), 'PC 확산': 1.2, 'PC 유백': 1.2, '아연 다이캐스트': 6.6, 강판: 7.85, 스테인리스: 7.9, '알루미늄 1.5T×2': 2.7, MCPCB: 2.2, 'FR-4 1.6T': 1.85 };

function meshOf(shape, tolerance, angular) { // angular: 라디안
  const m = shape.mesh({ tolerance, angularTolerance: angular });
  return { V: Float32Array.from(m.vertices), F: Uint32Array.from(m.triangles), N: Float32Array.from(m.normals) };
}

function free(asm) {
  for (const p of asm?.parts || []) { try { p.shape?.delete?.(); } catch { /* 이미 해제 */ } }
}

const post = (msg, transfer) => self.postMessage(msg, transfer || []);

self.onmessage = async (event) => {
  const { id, cmd, ...data } = event.data || {};
  try {
    if (cmd === 'build') {
      post({ id, progress: 'CAD 엔진 불러오는 중' });
      await init();
      post({ id, progress: '솔리드 만드는 중' });
      const t0 = Date.now();
      const asm = buildAssembly(R, data.template, data.params);
      free(current);
      const view = [];
      const parts = asm.parts.map((p) => {
        const m = meshOf(p.shape, 0.08, 0.2);
        view.push({ id: p.id, name: p.name, group: p.group, V: m.V, F: m.F });
        const bb = p.shape.boundingBox.bounds;
        let volume = 0;
        try { volume = R.measureVolume(p.shape); } catch { volume = 0; }
        const density = DENSITY[p.material] || 1.1;
        return { id: p.id, name: p.name, role: p.role, material: p.material, color: p.color, mold: p.mold, pull: p.pull || null, group: p.group, mesh: m, bbox: [...bb[0], ...bb[1]], volume, weight: (volume / 1000) * density };
      });
      current = { ...asm, view };
      const transfer = parts.flatMap((p) => [p.mesh.V.buffer, p.mesh.F.buffer, p.mesh.N.buffer]);
      // 화면에 넘긴 메시는 옮겨져 사라지므로 간섭 검사용 사본을 먼저 둔다
      current.view = view.map((v) => ({ ...v, V: v.V.slice(), F: v.F.slice() }));
      post({ id, done: true, result: { template: asm.template, params: asm.params, parts, motion: asm.motion, overall: asm.overall, notes: asm.notes, ms: Date.now() - t0 } }, transfer);
      return;
    }
    if (!current) throw new Error('먼저 형상을 만들어 주세요');
    if (cmd === 'interference') {
      post({ id, progress: '간섭 검사 중' });
      // extra: 기판 부품 상자 (회로 단계 배치 결과). 기판이 속한 묶음을 따라 움직이게 group 을 맞춘다
      const pcbGroup = current.view.find((v) => v.id === 'pcb')?.group;
      const extra = (data.extra || []).map((e) => ({ ...e, group: pcbGroup }));
      const r = checkInterference([...current.view, ...extra], { motion: current.motion, skip: skipPcbPair });
      post({ id, done: true, result: r });
      return;
    }
    if (cmd === 'moldMesh') {
      const p = current.parts.find((x) => x.id === data.partId);
      if (!p) throw new Error('부품을 찾을 수 없습니다');
      const m = meshOf(p.shape, data.tolerance || 0.05, 0.1);
      post({ id, done: true, result: { positions: m.V, indices: m.F } }, [m.V.buffer, m.F.buffer]);
      return;
    }
    if (cmd === 'step') {
      post({ id, progress: 'STEP 만드는 중' });
      const ids = data.ids ? new Set(data.ids) : null;
      const list = current.parts.filter((p) => !ids || ids.has(p.id)).map((p) => ({ shape: p.shape, name: stepName(p), color: p.color }));
      if (!list.length) throw new Error('내보낼 부품이 없습니다');
      const blob = R.exportSTEP(list, { unit: 'MM' });
      const buf = await blob.arrayBuffer();
      post({ id, done: true, result: buf }, [buf]);
      return;
    }
    throw new Error(`알 수 없는 명령: ${cmd}`);
  } catch (error) {
    const msg = typeof error === 'number' || !error?.message ? '솔리드 연산이 실패했습니다 (치수를 조금 바꿔 다시 해 보세요)' : error.message;
    post({ id, error: msg });
  }
};
