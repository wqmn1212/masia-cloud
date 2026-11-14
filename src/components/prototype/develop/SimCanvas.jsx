import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildConceptGroup, disposeGroup } from '@/lib/conceptScene';

const rad = (d) => (d * Math.PI) / 180;

/**
 * 동작 시뮬레이션 3D: 시뮬레이터 상태(simRef.current)를 매 프레임 읽어 부품을 움직인다.
 * - 버튼 부품을 누르고 있으면 버튼이 눌린다 (떼면 놓임) · 뚜껑 부품을 누르면 열리고 닫힌다
 * - 기울기는 바닥 중심을 축으로 제품 전체를 기울인다
 * - LED 는 밝기만큼 빛나고, 모터 부품은 돌고, 히터 부품은 온도만큼 붉어지고, 서보 부품은 각도만큼 돈다
 * links: { [part_id]: { feature_id, kind } }, lidPartId: 뚜껑 부품
 */
export default function SimCanvas({ parts, links, lidPartId, simRef, onPress, onLid }) {
  const hostRef = useRef(null);
  const cb = useRef({});
  cb.current = { links, lidPartId, onPress, onLid };

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !parts?.length) return undefined;
    const built = buildConceptGroup(parts);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a93a6, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.8); key.position.set(1, 1.6, 1.2);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6); fill.position.set(-1.2, 0.4, -1);
    scene.add(key, fill);

    // 바닥 중심을 기울기 축으로
    const box = new THREE.Box3().setFromObject(built.group);
    const size = box.getSize(new THREE.Vector3());
    const pivot = new THREE.Group();
    built.group.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    pivot.add(built.group);
    scene.add(pivot);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(Math.max(size.x, size.z) * 1.4, 64), new THREE.MeshStandardMaterial({ color: 0xdfe3ea, roughness: 1, transparent: true, opacity: 0.6 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.2;
    scene.add(floor);

    const radius = Math.max(size.length() / 2, 1);
    const camera = new THREE.PerspectiveCamera(32, 1, radius / 100, radius * 60);
    const target = new THREE.Vector3(0, size.y * 0.45, 0);
    camera.position.copy(target).add(new THREE.Vector3(1, 0.65, 1.3).normalize().multiplyScalar(radius * 4.2));
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(target);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.minDistance = radius * 0.8; controls.maxDistance = radius * 12;

    const items = new Map(built.items.map((it) => [it.id, it]));
    const center = built.center.clone();
    const meshToId = new Map(built.items.map((it) => [it.mesh, it.id]));
    built.items.forEach((it) => { it.baseColor = it.mesh.material.color.clone(); it.mesh.material.depthWrite = true; });

    const resize = () => { const w = host.clientWidth, h = Math.max(host.clientHeight, 1); renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(host);

    // 부품 고르기
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const pick = (e) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(built.items.map((it) => it.mesh), false)[0];
      const id = hit ? meshToId.get(hit.object) : null;
      if (!id) return null;
      const link = cb.current.links?.[id];
      if (link?.kind === 'button') return { type: 'button', id: link.feature_id };
      if (id === cb.current.lidPartId) return { type: 'lid' };
      return null;
    };
    let holding = null;
    const down = (e) => {
      const p = pick(e);
      if (!p) return;
      controls.enabled = false;
      if (p.type === 'button') { holding = p.id; cb.current.onPress?.(p.id, true); }
      if (p.type === 'lid') cb.current.onLid?.();
    };
    const up = () => { if (holding) cb.current.onPress?.(holding, false); holding = null; controls.enabled = true; };
    const move = (e) => { if (!holding) renderer.domElement.style.cursor = pick(e) ? 'pointer' : 'grab'; };
    renderer.domElement.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    renderer.domElement.addEventListener('pointermove', move);

    let raf; let last = performance.now();
    const tmp = new THREE.Vector3();
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const s = simRef.current;
      if (s) {
        pivot.rotation.x += (rad(s.input.tilt.pitch) - pivot.rotation.x) * 0.2;
        pivot.rotation.z += (rad(-s.input.tilt.roll) - pivot.rotation.z) * 0.2;
        const lid = items.get(cb.current.lidPartId);
        if (lid) {
          const h = lid.mesh.geometry.boundingBox || (lid.mesh.geometry.computeBoundingBox(), lid.mesh.geometry.boundingBox);
          const lift = (h.max.y - h.min.y) * 0.45 + size.y * 0.08;
          lid.mesh.position.y += (lid.home.y + s.input.lid * lift - lid.mesh.position.y) * 0.25;
          lid.mesh.position.z += (lid.home.z - s.input.lid * size.z * 0.12 - lid.mesh.position.z) * 0.25;
          lid.mesh.rotation.x += (-s.input.lid * 0.35 - lid.mesh.rotation.x) * 0.25;
        }
        Object.entries(cb.current.links || {}).forEach(([pid, l]) => {
          const it = items.get(pid);
          if (!it || pid === cb.current.lidPartId) return;
          const m = it.mesh.material;
          const v = s.out[l.feature_id] || 0;
          m.emissive.setHex(0x000000);
          if (l.kind === 'button') {
            const pressed = !!s.input.pressed[l.feature_id];
            tmp.copy(it.home).sub(center).normalize().multiplyScalar(pressed ? -Math.min(2, radius * 0.02) : 0).add(it.home);
            it.mesh.position.lerp(tmp, 0.5);
            if (pressed) m.emissive.setHex(0x0a3d91);
          }
          if (l.kind === 'led' && v > 0) { m.emissive.copy(it.baseColor.clone().lerp(new THREE.Color(0x7cff9a), 0.5)); m.emissiveIntensity = 0.4 + (v / 100) * 2.2; }
          if (l.kind === 'motor') it.mesh.rotation.y += (s.phys.motor[l.feature_id] || 0) * dt * 25;
          if (l.kind === 'heater') { const k = Math.max(0, Math.min(1, (s.phys.heaterT - 30) / 70)); m.emissive.setRGB(k * 0.9, k * 0.2, 0); m.emissiveIntensity = 1; }
          if (l.kind === 'servo') it.mesh.rotation.y = rad(s.phys.servo[l.feature_id] || 0);
          if (l.kind === 'buzzer') { const k = v > 0 ? 1 + Math.sin(now / 30) * 0.04 : 1; it.mesh.scale.setScalar(k); }
          if (l.kind === 'relay' && v > 0) m.emissive.setHex(0x3b2a00);
        });
      }
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('pointermove', move);
      disposeGroup(built.group); floor.geometry.dispose(); floor.material.dispose();
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, [parts, simRef]);

  return <div ref={hostRef} className="absolute inset-0 touch-none cursor-grab" />;
}

/** 컨셉이 없을 때 기능 목록으로 만든 간단한 상자 모형 (부품 id = 기능 id, 뚜껑 = 'lid-plate') */
export function fallbackParts(features) {
  const W = 96, D = 66, H = 44;
  const parts = [
    { id: 'body', name: '몸체', layer: 'SHELL', shape: 'rounded_box', size: { x: W, y: H, z: D }, position: { x: 0, y: H / 2, z: 0 }, color: '#e5e7eb', finish: 'matte' },
    { id: 'lid-plate', name: '뚜껑', layer: 'SHELL', shape: 'rounded_box', size: { x: W * 0.42, y: 5, z: D * 0.42 }, position: { x: -W * 0.24, y: H + 2.5, z: -D * 0.2 }, color: '#94a3b8', finish: 'gloss' },
  ];
  const front = features.filter((f) => ['button', 'led', 'analog'].includes(f.kind));
  const step = front.length > 1 ? Math.min(18, (W - 28) / (front.length - 1)) : 0;
  front.forEach((f, i) => {
    const x = -W / 2 + 14 + i * step, z = D / 2 - 11;
    if (f.kind === 'button') parts.push({ id: f.id, name: f.name, layer: 'UI', shape: 'cylinder', size: { x: 11, y: 4, z: 11 }, position: { x, y: H + 1.5, z }, color: '#2563eb', finish: 'gloss' });
    if (f.kind === 'led') parts.push({ id: f.id, name: f.name, layer: 'UI', shape: 'cylinder', size: { x: 5, y: 2, z: 5 }, position: { x, y: H + 0.8, z }, color: '#94a3b8', finish: 'glass' });
    if (f.kind === 'analog') parts.push({ id: f.id, name: f.name, layer: 'UI', shape: 'cylinder', size: { x: 14, y: 8, z: 14 }, position: { x, y: H + 3.5, z }, color: '#475569', finish: 'matte' });
  });
  // 움직이는 부품은 윗면 오른쪽 뒤에 보이게 둔다 (팬 날개·서보 팔·히터 판)
  features.filter((f) => ['motor', 'servo'].includes(f.kind)).forEach((f, i) => parts.push({ id: f.id, name: f.name, layer: 'INTERNAL', shape: 'box', size: { x: 28, y: 2.5, z: 5 }, position: { x: W * 0.22, y: H + 3 + i * 5, z: -D * 0.2 }, color: '#475569', finish: 'metal' }));
  features.filter((f) => f.kind === 'heater').forEach((f) => parts.push({ id: f.id, name: f.name, layer: 'INTERNAL', shape: 'box', size: { x: 30, y: 1.5, z: 14 }, position: { x: W * 0.22, y: H + 0.8, z: D * 0.05 }, color: '#78716c', finish: 'metal' }));
  return parts;
}
