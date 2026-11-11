import * as THREE from 'three';
import { buildConceptGroup, disposeGroup } from '@/lib/conceptScene';

// 컨셉 3D 형상을 화면 밖에서 한 장 그려 JPEG 로 돌려준다 (PDF 용). 끝나면 WebGL 컨텍스트를 바로 반납한다
export function conceptSnapshot(parts, w = 1200, h = 900) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(w, h, false);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4f6f9);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a93a6, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(1, 1.6, 1.2);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6);
  fill.position.set(-1.2, 0.4, -1);
  scene.add(key, fill);
  const built = buildConceptGroup(parts);
  scene.add(built.group);
  const camera = new THREE.PerspectiveCamera(32, w / h, built.radius / 100, built.radius * 60);
  camera.position.copy(built.center).add(new THREE.Vector3(1, 0.7, 1.25).normalize().multiplyScalar(built.radius * 3.8));
  camera.lookAt(built.center);
  renderer.render(scene, camera);
  const data = renderer.domElement.toDataURL('image/jpeg', 0.85);
  disposeGroup(built.group);
  renderer.dispose();
  renderer.forceContextLoss();
  return { data, w, h };
}