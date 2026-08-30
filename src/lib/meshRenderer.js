// 공용 three.js 렌더러
// 부품마다 WebGL 컨텍스트를 만들면 브라우저 상한(~16개)을 넘겨 탭이 죽는다.
// 하나의 렌더러를 재사용해 썸네일은 PNG 로 굽고, 뷰어는 같은 렌더러로 프레임을 그린다.

import * as THREE from 'three';

let renderer = null;

function getRenderer(size) {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  }
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  return renderer;
}

/** 메시 데이터로 three.js Scene 과 카메라 반경을 만든다. */
export function buildScene(mesh, { color = 0x93a5c4 } = {}) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.positions, 3));
  geometry.setIndex(Array.from(mesh.indices));
  geometry.computeVertexNormals();
  geometry.center();
  geometry.computeBoundingSphere();

  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.12 });
  const scene = new THREE.Scene();
  const object = new THREE.Mesh(geometry, material);
  scene.add(object);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x556677, 1.6));
  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(2, 3, 4);
  scene.add(dir);

  return { scene, object, geometry, material, radius: geometry.boundingSphere?.radius || 1 };
}

export function disposeScene(built) {
  built?.geometry?.dispose();
  built?.material?.dispose();
}

/** 메시를 한 번 렌더링해 PNG dataURL 로 반환한다 (썸네일용). */
export function renderMeshToDataURL(mesh, size = 56) {
  const built = buildScene(mesh);
  const r = getRenderer(size);
  const camera = new THREE.PerspectiveCamera(38, 1, built.radius / 100, built.radius * 20);
  camera.position.set(built.radius * 1.9, built.radius * 1.6, built.radius * 2.4);
  camera.lookAt(0, 0, 0);
  r.render(built.scene, camera);
  const url = r.domElement.toDataURL('image/png');
  disposeScene(built);
  return url;
}

/** (뷰어) 이미 만들어 둔 scene 을 회전·줌 값으로 한 프레임 렌더링한다 (뷰어용). */
export function renderBuiltFrame(built, { size = 420, rotX = 0.5, rotY = 0.8, zoom = 1 } = {}) {
  built.object.rotation.set(rotX, rotY, 0);
  const r = getRenderer(size);
  const camera = new THREE.PerspectiveCamera(38, 1, built.radius / 100, built.radius * 30);
  const d = (built.radius * 3) / Math.max(zoom, 0.2);
  camera.position.set(0, 0, d);
  camera.lookAt(0, 0, 0);
  r.render(built.scene, camera);
  return r.domElement.toDataURL('image/png');
}