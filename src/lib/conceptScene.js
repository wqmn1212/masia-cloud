// 컨셉 3D 프리뷰: AI가 정리한 부품(기본 도형·치수·위치)을 three.js 장면으로 만든다. CAD 형상이 아니라 미팅용 개념 시각화다.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const FINISH = {
  matte: { roughness: 0.8, metalness: 0 },
  gloss: { roughness: 0.22, metalness: 0.05 },
  metal: { roughness: 0.35, metalness: 0.9 },
  glass: { roughness: 0.05, metalness: 0, opacity: 0.4 },
  rubber: { roughness: 0.95, metalness: 0 },
};
const HEX = /^#[0-9a-fA-F]{6}$/;
const vec = (o) => new THREE.Vector3(Number(o?.x) || 0, Number(o?.y) || 0, Number(o?.z) || 0);
const rad = (d) => ((Number(d) || 0) * Math.PI) / 180;

function geometry(p) {
  const x = Math.max(0.1, Number(p.size?.x) || 1);
  const y = Math.max(0.1, Number(p.size?.y) || 1);
  const z = Math.max(0.1, Number(p.size?.z) || x);
  if (p.shape === 'cylinder') return new THREE.CylinderGeometry(0.5, 0.5, 1, 48).scale(x, y, z);
  if (p.shape === 'cone') return new THREE.ConeGeometry(0.5, 1, 48).scale(x, y, z);
  if (p.shape === 'sphere') return new THREE.SphereGeometry(0.5, 32, 24).scale(x, y, z);
  if (p.shape === 'capsule') {
    const r = Math.min(x, z, y) / 2;
    return new THREE.CapsuleGeometry(r, Math.max(0.01, y - 2 * r), 8, 24).scale(x / (2 * r), 1, z / (2 * r));
  }
  if (p.shape === 'torus') {
    const tube = Math.min(y, x / 2 - 0.01) / 2;
    return new THREE.TorusGeometry(x / 2 - tube, tube, 16, 48).rotateX(Math.PI / 2);
  }
  if (p.shape === 'rounded_box') return new RoundedBoxGeometry(x, y, z, 4, Math.min(x, y, z) * 0.14);
  return new THREE.BoxGeometry(x, y, z);
}

export function buildConceptGroup(parts) {
  const group = new THREE.Group();
  const box = new THREE.Box3();
  const items = (parts || []).map((p) => {
    const fin = FINISH[p.finish] || FINISH.matte;
    const baseOpacity = fin.opacity ?? 1;
    const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(HEX.test(p.color || '') ? p.color : '#b9c2d0'), roughness: fin.roughness, metalness: fin.metalness, transparent: true, opacity: baseOpacity });
    const mesh = new THREE.Mesh(geometry(p), material);
    mesh.position.copy(vec(p.position));
    mesh.rotation.set(rad(p.rotation_deg?.x), rad(p.rotation_deg?.y), rad(p.rotation_deg?.z));
    group.add(mesh);
    box.expandByObject(mesh);
    return { id: p.id, layer: p.layer, mesh, home: mesh.position.clone(), baseOpacity, explode: null };
  });
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 1);
  // 분해 보기: 제품 중심에서 바깥으로 밀어낸다 (외장은 더 멀리)
  items.forEach((it) => {
    const dir = it.home.clone().sub(center);
    if (dir.length() < radius * 0.05) dir.set(0, it.layer === 'SHELL' ? radius * 0.5 : 0, 0);
    it.explode = dir.multiplyScalar(it.layer === 'SHELL' ? 1.4 : 0.8);
  });
  return { group, items, center, radius };
}

const tmp = new THREE.Vector3();
/** 매 프레임: 분해·내부 보기·강조 상태로 부드럽게 옮긴다 */
export function stepView(items, state, k = 0.14) {
  items.forEach((it) => {
    it.mesh.position.lerp(tmp.copy(it.home).addScaledVector(it.explode, state.explode ? 1 : 0), k);
    const m = it.mesh.material;
    const dim = state.highlightId && state.highlightId !== it.id;
    const target = state.xray && it.layer === 'SHELL' ? 0.14 : dim ? Math.min(it.baseOpacity, 0.28) : it.baseOpacity;
    m.opacity += (target - m.opacity) * k;
    m.depthWrite = m.opacity > 0.9;
    m.emissive.setHex(state.highlightId === it.id ? 0x0a3d91 : 0x000000);
  });
}

export function disposeGroup(group) {
  group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
}