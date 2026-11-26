// 3D 검토: 부품 장면 만들기 · 화면에서 찍은 지점 찾기 · 측정값 계산
// 화면에 그리는 프레임과 클릭 지점 계산이 같은 시점(카메라)을 쓰도록 viewCamera 하나를 함께 쓴다.
import * as THREE from 'three';

/** 뷰어와 같은 시점의 카메라 — 프레임을 굽는 쪽(meshRenderer)과 클릭 지점을 계산하는 쪽이 같은 값을 쓴다. */
export function viewCamera(radius, zoom = 1) {
  const r = Math.max(radius, 1e-3);
  const camera = new THREE.PerspectiveCamera(38, 1, r / 100, r * 30);
  camera.position.set(0, 0, (r * 3) / Math.max(zoom, 0.2));
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}

const PALETTE = [0x9fb2cc, 0xbfc9d8, 0x8fa3bf, 0xc9d1dd, 0xa9b8cd, 0xb6c2d4];
const SELECTED_COLOR = 0x5b8def;

/** 부품별 크기와 전체 크기(mm) — 치수 확인용 */
export function partsBounds(parts = []) {
  if (!parts.length) return null;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const boxes = parts.map((p) => {
    const pos = p.mesh.positions;
    const mn = [Infinity, Infinity, Infinity];
    const mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < pos.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        const v = pos[i + k];
        if (v < mn[k]) mn[k] = v;
        if (v > mx[k]) mx[k] = v;
      }
    }
    for (let k = 0; k < 3; k++) {
      if (mn[k] < min[k]) min[k] = mn[k];
      if (mx[k] > max[k]) max[k] = mx[k];
    }
    return [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
  });
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  return {
    boxes,
    size,
    center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
    radius: Math.max(1e-3, Math.hypot(size[0], size[1], size[2]) / 2),
  };
}

/**
 * 부품마다 메시를 따로 두고 한 그룹으로 묶는다 (보이기·숨기기, 부품 강조).
 * 모든 부품의 중심을 빼서 원래 상호 위치를 유지한다 — 숨김을 바꿔도 좌표가 흔들리지 않는다.
 */
export function buildPartsScene(parts, visible = [], selected = -1, bounds = null) {
  const box = bounds || partsBounds(parts);
  const center = box.center;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x556677, 1.6));
  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(2, 3, 4);
  scene.add(dir);

  const root = new THREE.Group();
  const meshes = parts.map((p, i) => {
    const pos = p.mesh.positions;
    const shifted = new Float32Array(pos.length);
    for (let k = 0; k < pos.length; k += 3) {
      shifted[k] = pos[k] - center[0];
      shifted[k + 1] = pos[k + 1] - center[1];
      shifted[k + 2] = pos[k + 2] - center[2];
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(shifted, 3));
    geometry.setIndex(Array.from(p.mesh.indices));
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      color: i === selected ? SELECTED_COLOR : PALETTE[i % PALETTE.length],
      roughness: 0.5,
      metalness: 0.12,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = visible[i] !== false;
    root.add(mesh);
    return mesh;
  });
  scene.add(root);
  return { scene, root, meshes, radius: box.radius, size: box.size };
}

export function disposePartsScene(built) {
  (built?.meshes || []).forEach((m) => {
    m.geometry.dispose();
    m.material.dispose();
  });
}

/** 화면 좌표(0~1)에서 보이는 부품을 찍어 모델 좌표(mm)를 돌려준다 */
export function pickLocalPoint({ root, radius, view, nx, ny }) {
  const camera = viewCamera(radius, view.zoom);
  root.rotation.set(view.rotX, view.rotY, 0);
  root.updateMatrixWorld(true);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(nx * 2 - 1, -(ny * 2 - 1)), camera);
  const targets = root.children.filter((m) => m.visible);
  const hit = raycaster.intersectObjects(targets, false)[0];
  if (!hit) return null;
  const local = root.worldToLocal(hit.point.clone());
  return { x: local.x, y: local.y, z: local.z, part: root.children.indexOf(hit.object) };
}

/** 모델 좌표를 화면 좌표(0~1)로 — 마커·측정선을 프레임 위에 겹쳐 그린다 */
export function projectLocal({ root, radius, view, point }) {
  const camera = viewCamera(radius, view.zoom);
  root.rotation.set(view.rotX, view.rotY, 0);
  root.updateMatrixWorld(true);
  const world = root.localToWorld(new THREE.Vector3(point.x, point.y, point.z));
  const depth = world.clone().applyMatrix4(camera.matrixWorldInverse).z;
  world.project(camera);
  return { x: (world.x + 1) / 2, y: (1 - world.y) / 2, visible: depth < 0 };
}

export function distanceMm(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** b 를 꼭짓점으로 하는 세 점의 각도(도) */
export function angleDeg(a, b, c) {
  const u = [a.x - b.x, a.y - b.y, a.z - b.z];
  const v = [c.x - b.x, c.y - b.y, c.z - b.z];
  const lu = Math.hypot(...u);
  const lv = Math.hypot(...v);
  if (lu < 1e-6 || lv < 1e-6) return 0;
  const cos = Math.min(1, Math.max(-1, (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (lu * lv)));
  return (Math.acos(cos) * 180) / Math.PI;
}

export const fmtMeasure = (value, unit) => `${Number(value || 0).toFixed(1)}${unit === 'deg' ? '°' : ' mm'}`;

export const fmtMm = (value) => `${(Math.round(Number(value || 0) * 10) / 10).toLocaleString()} mm`;