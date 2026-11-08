// 프로젝트 3D 모델(STEP·STL) 불러오기 → 부품별 메시
import { parseStepFile } from '@/lib/stepParser';
import { parseStl } from '@/lib/moldReview/stl';

export const isModelFile = (name = '') => /\.(stp|step|stl)$/i.test(name);

export async function loadModelParts(url, name) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('3D 파일을 내려받지 못했습니다');
  const buffer = await res.arrayBuffer();
  if (/\.stl$/i.test(name)) return [{ part_name: name.replace(/\.stl$/i, ''), mesh: parseStl(buffer, 1) }];
  const { parts } = await parseStepFile(buffer);
  return parts.map((p) => ({ part_name: p.part_name, mesh: p.mesh, bbox: [p.bbox_x_mm, p.bbox_y_mm, p.bbox_z_mm] }));
}

// 여러 부품 메시를 하나로 합쳐 전체 조립 형상을 만든다
export function mergeMeshes(parts) {
  const total = parts.reduce((s, p) => s + p.mesh.positions.length, 0);
  const idxTotal = parts.reduce((s, p) => s + p.mesh.indices.length, 0);
  const positions = new Float32Array(total);
  const indices = new Uint32Array(idxTotal);
  let pOff = 0; let iOff = 0;
  for (const p of parts) {
    positions.set(p.mesh.positions, pOff);
    const base = pOff / 3;
    for (let i = 0; i < p.mesh.indices.length; i++) indices[iOff + i] = p.mesh.indices[i] + base;
    pOff += p.mesh.positions.length; iOff += p.mesh.indices.length;
  }
  return { positions, indices };
}