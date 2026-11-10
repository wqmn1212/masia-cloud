// 시뮬레이션 재생용 조립 장면: 부품마다 자기 중심을 축으로 회전·이동할 수 있게 피벗을 둔다
import * as THREE from 'three';

const BASE = 0xa8bad6;
const MOVING = 0x5b8def;
const PICKED = 0xf59e0b;

export function buildAssembly(parts) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x556677, 1.6));
  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(2, 3, 4);
  scene.add(dir);
  const object = new THREE.Group();
  scene.add(object);

  const all = new THREE.Box3();
  const geos = parts.map((p) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p.mesh.positions, 3));
    g.setIndex(Array.from(p.mesh.indices));
    g.computeVertexNormals();
    g.computeBoundingBox();
    all.union(g.boundingBox);
    return g;
  });
  const center = all.getCenter(new THREE.Vector3());
  const nodes = geos.map((g) => {
    const c = g.boundingBox.getCenter(new THREE.Vector3());
    g.translate(-c.x, -c.y, -c.z);
    const material = new THREE.MeshStandardMaterial({ color: BASE, roughness: 0.5, metalness: 0.12 });
    const pivot = new THREE.Group();
    pivot.position.copy(c.sub(center));
    pivot.add(new THREE.Mesh(g, material));
    object.add(pivot);
    return { pivot, base: pivot.position.clone(), material, geometry: g };
  });
  const radius = all.getBoundingSphere(new THREE.Sphere()).radius || 1;
  return { scene, object, nodes, radius };
}

export function disposeAssembly(asm) {
  asm?.nodes.forEach((n) => { n.geometry.dispose(); n.material.dispose(); });
}

/** poses: [{part_index, motion, axis, value, actuator_id}] — 회전은 °, 이동은 mm */
export function applyPoses(asm, poses, highlightId) {
  asm.nodes.forEach((n) => { n.pivot.position.copy(n.base); n.pivot.rotation.set(0, 0, 0); n.material.color.setHex(BASE); });
  (poses || []).forEach((p) => {
    const n = asm.nodes[p.part_index];
    if (!n) return;
    const ax = p.axis.toLowerCase();
    if (p.motion === 'ROTATE') n.pivot.rotation[ax] = (p.value * Math.PI) / 180;
    else n.pivot.position[ax] = n.base[ax] + p.value;
    n.material.color.setHex(p.actuator_id === highlightId ? PICKED : MOVING);
  });
}