import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { buildConceptGroup, disposeGroup } from '@/lib/conceptScene';

const r2 = (v) => Math.round(v * 100) / 100;
const deg = (r) => r2((r * 180) / Math.PI);

/**
 * 컨셉 3D 편집 캔버스: 부품을 눌러 고르고(Shift 로 여러 개), 손잡이를 끌어 이동·회전·크기를 바꾼다.
 * 부품 목록(parts)이 바뀌면 장면을 다시 만들되 카메라는 그대로 둔다.
 * onSelect(id|null, additive), onTransform(id, {position|rotation_deg|size}) — 끌기를 놓을 때 한 번
 */
export default function ConceptEditCanvas({ parts, selected, mode, onSelect, onTransform, xray = false }) {
  const hostRef = useRef(null);
  const ctx = useRef(null);
  const cb = useRef({});
  cb.current = { onSelect, onTransform, selected, mode, xray };

  // 렌더러·카메라·조작은 한 번만 만든다
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a93a6, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.8); key.position.set(1, 1.6, 1.2);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6); fill.position.set(-1.2, 0.4, -1);
    scene.add(key, fill);
    const grid = new THREE.GridHelper(400, 40, 0x94a3b8, 0xcbd5e1);
    grid.material.transparent = true; grid.material.opacity = 0.5;
    scene.add(grid);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 20000);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true; orbit.dampingFactor = 0.08;
    const tc = new TransformControls(camera, renderer.domElement);
    tc.setSize(0.8);
    scene.add(tc.getHelper());
    tc.addEventListener('dragging-changed', (e) => {
      orbit.enabled = !e.value;
      if (e.value) return;
      // 놓았을 때: 메시 상태를 부품 값으로 돌려준다 (크기는 배율을 size 에 곱하고 메시 배율은 되돌린다)
      const m = tc.object;
      const id = m?.userData.partId;
      if (!id) return;
      const p = m.userData.part;
      if (cb.current.mode === 'translate') cb.current.onTransform?.(id, { position: { x: r2(m.position.x), y: r2(m.position.y), z: r2(m.position.z) } });
      if (cb.current.mode === 'rotate') cb.current.onTransform?.(id, { rotation_deg: { x: deg(m.rotation.x), y: deg(m.rotation.y), z: deg(m.rotation.z) } });
      if (cb.current.mode === 'scale') {
        const s = m.scale;
        cb.current.onTransform?.(id, { size: { x: r2(Math.max(0.1, (Number(p.size?.x) || 1) * s.x)), y: r2(Math.max(0.1, (Number(p.size?.y) || 1) * s.y)), z: r2(Math.max(0.1, (Number(p.size?.z) || Number(p.size?.x) || 1) * s.z)) } });
      }
    });
    const resize = () => { const w = host.clientWidth, h = Math.max(host.clientHeight, 1); renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(host);

    // 누르기: 끌기가 아니라 짧게 누른 것만 고르기로 본다 (돌려 보기와 구분)
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let downAt = null;
    const down = (e) => { downAt = { x: e.clientX, y: e.clientY }; };
    const up = (e) => {
      if (!downAt || tc.dragging) { downAt = null; return; }
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
      downAt = null;
      if (moved > 5 || !ctx.current?.built) return;
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(ctx.current.built.items.map((it) => it.mesh), false)[0];
      cb.current.onSelect?.(hit ? hit.object.userData.partId : null, e.shiftKey || e.metaKey || e.ctrlKey);
    };
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointerup', up);

    let raf;
    const loop = () => {
      const c = ctx.current;
      if (c?.built) {
        const sel = new Set(cb.current.selected || []);
        c.built.items.forEach((it) => {
          const m = it.mesh.material;
          const on = sel.has(it.id);
          m.emissive.setHex(on ? 0x0a3d91 : 0x000000);
          const target = cb.current.xray && it.layer === 'SHELL' && !on ? 0.18 : sel.size && !on ? Math.min(it.baseOpacity, 0.55) : it.baseOpacity;
          m.opacity += (target - m.opacity) * 0.2;
          m.depthWrite = m.opacity > 0.9;
        });
      }
      orbit.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();
    ctx.current = { renderer, scene, camera, orbit, tc, built: null, framed: false };
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('pointerup', up);
      tc.detach(); tc.dispose(); orbit.dispose();
      if (ctx.current?.built) disposeGroup(ctx.current.built.group);
      grid.geometry.dispose(); grid.material.dispose();
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
      ctx.current = null;
    };
  }, []);

  // 부품이 바뀌면 장면만 다시 만든다 (카메라는 처음 한 번만 맞춘다)
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    c.tc.detach();
    if (c.built) { c.scene.remove(c.built.group); disposeGroup(c.built.group); }
    const built = buildConceptGroup(parts || []);
    built.items.forEach((it, i) => { it.mesh.userData.partId = it.id; it.mesh.userData.part = parts[i]; });
    c.scene.add(built.group);
    c.built = built;
    if (!c.framed && built.items.length) {
      c.framed = true;
      c.orbit.target.copy(built.center);
      c.camera.position.copy(built.center).add(new THREE.Vector3(1, 0.7, 1.25).normalize().multiplyScalar(built.radius * 4.6));
      c.camera.near = built.radius / 100; c.camera.far = built.radius * 60; c.camera.updateProjectionMatrix();
    }
  }, [parts]);

  // 손잡이: 고른 부품이 하나일 때 그 부품에 붙인다
  useEffect(() => {
    const c = ctx.current;
    if (!c?.built) return;
    const one = (selected || []).length === 1 ? c.built.items.find((it) => it.id === selected[0]) : null;
    if (one) { c.tc.attach(one.mesh); c.tc.setMode(mode || 'translate'); c.tc.setSpace(mode === 'scale' ? 'local' : 'world'); } else c.tc.detach();
  }, [selected, mode, parts]);

  return <div ref={hostRef} className="absolute inset-0 touch-none" />;
}
