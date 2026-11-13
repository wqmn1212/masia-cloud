// 컨셉 3D(기본 도형 조립)를 CAD 로 넘길 파일로 내보낸다. STL 은 CAD 좌표(Z 위), GLB 는 glTF 표준(Y 위)·부품별 이름.
import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildConceptGroup } from '@/lib/conceptScene';
import { conceptBounds } from './solidcraft.js';

function placedGroup(parts, zUp) {
  const { group, items } = buildConceptGroup(parts);
  items.forEach((it, i) => { it.mesh.name = String(parts[i]?.name || `part-${i + 1}`).slice(0, 60); });
  // 윗면 중심을 원점으로 (solidcraft.js 의 좌표와 같게)
  const b = conceptBounds(parts);
  if (b) group.position.set(-b.cx, -b.maxY, -b.cz);
  const root = new THREE.Group();
  root.add(group);
  if (zUp) root.rotation.x = Math.PI / 2; // (x, y, z) → (x, −z, y)
  root.updateMatrixWorld(true);
  return root;
}

export function conceptStl(parts) {
  const data = new STLExporter().parse(placedGroup(parts, true), { binary: true });
  return new Blob([data], { type: 'model/stl' });
}

export async function conceptGlb(parts) {
  const data = await new GLTFExporter().parseAsync(placedGroup(parts, false), { binary: true });
  return new Blob([data], { type: 'model/gltf-binary' });
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const downloadText = (text, name, type = 'text/plain') => downloadBlob(new Blob([text], { type: `${type};charset=utf-8` }), name);
