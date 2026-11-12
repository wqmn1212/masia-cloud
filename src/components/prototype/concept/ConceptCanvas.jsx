import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildConceptGroup, disposeGroup, stepView } from '@/lib/conceptScene';
import { measureHull, buildHullScene } from '@/lib/conceptHullScene';

// 컨셉 3D 프리뷰 캔버스 — 화면에 하나만 띄우고, 떠날 때 WebGL 컨텍스트를 반납한다
// hull(시안 정면·측면 주소)이 있으면 시안 윤곽으로 만든 외형을 보여 주고, 없거나 실패하면 부품 3D 를 보여 준다.
export default function ConceptCanvas({ parts, xray, explode, autoRotate, highlightId, hull, overall, onHull }) {
  const hostRef = useRef(null);
  const state = useRef({});
  state.current = { xray, explode, autoRotate, highlightId };
  const onHullRef = useRef(onHull);
  onHullRef.current = onHull;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !parts?.length) return undefined;
    let cancelled = false;
    let stop = () => {};
    const start = (built) => { if (!cancelled) stop = mount(host, built, state); else built.dispose?.(); };
    if (hull) {
      measureHull(hull, overall)
        .then((m) => { if (cancelled) return; const b = buildHullScene(m, parts, overall); onHullRef.current?.({ size: b.size, warning: m.sideWarn }); start(b); })
        .catch((e) => { if (!cancelled) onHullRef.current?.({ error: e.message || '외형을 만들지 못했습니다.' }); });
    } else start(buildConceptGroup(parts));
    return () => { cancelled = true; stop(); };
  }, [parts, hull?.front, hull?.side]);

  return <div ref={hostRef} className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing" />;
}

/** 장면을 캔버스에 올리고 돌려 보게 한다. 정리 함수를 돌려준다 */
function mount(host, built, state) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a93a6, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(1, 1.6, 1.2);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6);
  fill.position.set(-1.2, 0.4, -1);
  scene.add(key, fill);

  scene.add(built.group);
  const camera = new THREE.PerspectiveCamera(32, 1, built.radius / 100, built.radius * 60);
  camera.position.copy(built.center).add(new THREE.Vector3(1, 0.7, 1.25).normalize().multiplyScalar(built.radius * 3.8));
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(built.center);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotateSpeed = 1.2;
  controls.minDistance = built.radius * 0.8;
  controls.maxDistance = built.radius * 12;

  const resize = () => {
    const w = host.clientWidth; const h = Math.max(host.clientHeight, 1);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  let raf;
  // 분해 보기를 켜고 끌 때 카메라가 그 범위에 맞게 부드럽게 따라간다 (보는 방향은 유지)
  let lastExplode = false;
  let fitFrames = 0;
  const dir = new THREE.Vector3();
  const loop = () => {
    const ex = !!state.current.explode;
    if (ex !== lastExplode) { lastExplode = ex; fitFrames = 50; }
    if (fitFrames > 0) {
      fitFrames -= 1;
      const r = ex ? built.explodedRadius : built.radius;
      controls.target.lerp(ex ? built.explodedCenter : built.center, 0.12);
      dir.copy(camera.position).sub(controls.target);
      const len = dir.length();
      dir.setLength(len + (r * 3.8 - len) * 0.12);
      camera.position.copy(controls.target).add(dir);
      controls.maxDistance = Math.max(controls.maxDistance, r * 12);
    }
    controls.autoRotate = !!state.current.autoRotate;
    stepView(built.items, state.current);
    built.step?.(state.current);
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  loop();

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    controls.dispose();
    disposeGroup(built.group);
    built.dispose?.();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
}
