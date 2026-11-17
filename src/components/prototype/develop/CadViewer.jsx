import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// 금형용 설계 3D 보기 (CAD 좌표: Z 위, 앞 = −Y). 부품 색, 단면, 분해, 회전 묶음 기울기, 간섭 표시, 클릭 선택
export default function CadViewer({ parts, motion, tilt = 0, explode = 0, section = 'none', selected, onSelect, markers = [], focus, className = '' }) {
  const hostRef = useRef(null);
  const ctx = useRef(null);

  // 장면 한 번 만들기
  useEffect(() => {
    const host = hostRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.localClippingEnabled = true;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 1, 20000);
    camera.up.set(0, 0, 1);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(0.6, -1, 1.2);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.6);
    rim.position.set(-1, 1, 0.5);
    scene.add(rim);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    const root = new THREE.Group();
    scene.add(root);
    const markerGroup = new THREE.Group();
    scene.add(markerGroup);
    const grid = new THREE.GridHelper(400, 40, 0xcfd3da, 0xe6e8ec);
    grid.rotation.x = Math.PI / 2;
    scene.add(grid);
    const resize = () => {
      const w = host.clientWidth, h = Math.max(host.clientHeight, 1);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();
    let raf = 0;
    const loop = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); };
    loop();
    // 클릭(끌기 아님)으로 부품 선택
    let down = null;
    const onDown = (e) => { down = [e.clientX, e.clientY]; };
    const onUp = (e) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
      const hits = ray.intersectObjects(root.children, true).filter((h) => {
        const planes = h.object.material.clippingPlanes || [];
        return planes.every((p) => p.distanceToPoint(h.point) >= 0);
      });
      ctx.current?.onSelect?.(hits[0]?.object.userData.id || null);
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    ctx.current = { renderer, scene, camera, controls, root, markerGroup, grid, meshes: new Map(), fitted: false };
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      root.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
      renderer.dispose();
      renderer.domElement.remove();
      ctx.current = null;
    };
  }, []);

  useEffect(() => { if (ctx.current) ctx.current.onSelect = onSelect; }, [onSelect]);

  // 부품 메시
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    c.root.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    c.root.clear();
    c.meshes.clear();
    const box = new THREE.Box3();
    for (const p of parts || []) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(p.mesh.V, 3));
      if (p.mesh.N?.length === p.mesh.V.length) g.setAttribute('normal', new THREE.BufferAttribute(p.mesh.N, 3));
      g.setIndex(new THREE.BufferAttribute(p.mesh.F, 1));
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      g.computeBoundingBox();
      const mat = new THREE.MeshStandardMaterial({ color: p.color, roughness: p.mold ? 0.75 : 0.5, metalness: /강|스테인|알루미늄|아연/.test(p.material) ? 0.55 : 0.05, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(g, mat);
      mesh.userData = { id: p.id, group: p.group, center: g.boundingBox.getCenter(new THREE.Vector3()) };
      c.root.add(mesh);
      c.meshes.set(p.id, mesh);
      box.union(g.boundingBox);
    }
    c.box = box;
    if (!box.isEmpty()) {
      const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
      c.grid.position.set(center.x, center.y, box.min.z - 0.01);
      c.grid.scale.setScalar(Math.max(size.x, size.y, 100) / 200);
      if (!c.fitted) {
        const r = size.length();
        c.camera.position.set(center.x + r * 0.75, center.y - r * 1.35, center.z + r * 0.7);
        c.controls.target.copy(center);
        c.camera.near = r / 200; c.camera.far = r * 40; c.camera.updateProjectionMatrix();
        c.fitted = true;
      }
    }
  }, [parts]);

  // 기울기·분해·단면·선택
  useEffect(() => {
    const c = ctx.current;
    if (!c || !c.box || c.box.isEmpty()) return;
    const center = c.box.getCenter(new THREE.Vector3());
    const size = c.box.getSize(new THREE.Vector3()).length();
    const planes = section === 'y' ? [new THREE.Plane(new THREE.Vector3(0, 1, 0), -center.y)]
      : section === 'x' ? [new THREE.Plane(new THREE.Vector3(-1, 0, 0), center.x)] : []; // 카메라(+X, −Y) 쪽 절반을 걷어 단면이 보이게
    const rot = new THREE.Matrix4();
    if (motion && tilt) {
      const o = new THREE.Vector3(...motion.origin), ax = new THREE.Vector3(...motion.axis).normalize();
      rot.makeTranslation(o.x, o.y, o.z).multiply(new THREE.Matrix4().makeRotationAxis(ax, (tilt * Math.PI) / 180)).multiply(new THREE.Matrix4().makeTranslation(-o.x, -o.y, -o.z));
    }
    for (const mesh of c.meshes.values()) {
      const m = new THREE.Matrix4();
      if (motion && mesh.userData.group === motion.group) m.copy(rot);
      if (explode > 0) {
        const dir = mesh.userData.center.clone().sub(center);
        const len = dir.length();
        if (len > 1e-3) dir.multiplyScalar((explode * size * 0.35) / Math.max(len, size * 0.15));
        m.premultiply(new THREE.Matrix4().makeTranslation(dir.x, dir.y, dir.z));
      }
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(m);
      mesh.matrixWorldNeedsUpdate = true;
      mesh.material.clippingPlanes = planes;
      const on = selected && mesh.userData.id === selected;
      mesh.material.emissive = new THREE.Color(on ? '#2f6fe4' : '#000000');
      mesh.material.emissiveIntensity = on ? 0.35 : 0;
      mesh.material.transparent = !!selected && !on;
      mesh.material.opacity = selected && !on ? 0.35 : 1;
      mesh.material.needsUpdate = true;
    }
  }, [parts, motion, tilt, explode, section, selected]);

  // 간섭 표시
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    c.markerGroup.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    c.markerGroup.clear();
    const size = c.box && !c.box.isEmpty() ? c.box.getSize(new THREE.Vector3()).length() : 100;
    for (const m of markers) {
      if (!m.at) continue;
      const s = new THREE.Mesh(new THREE.SphereGeometry(Math.max(1.2, size / 120), 16, 12), new THREE.MeshBasicMaterial({ color: m.kind === 'overlap' ? '#e5484d' : '#f08a24', depthTest: false, transparent: true, opacity: 0.9 }));
      s.position.set(...m.at);
      s.renderOrder = 10;
      c.markerGroup.add(s);
    }
  }, [markers, parts]);

  // 특정 점으로 카메라 옮기기
  useEffect(() => {
    const c = ctx.current;
    if (!c || !focus?.at) return;
    const t = new THREE.Vector3(...focus.at);
    const off = c.camera.position.clone().sub(c.controls.target);
    const d = Math.max(60, (c.box ? c.box.getSize(new THREE.Vector3()).length() : 200) * 0.35);
    off.setLength(d);
    c.controls.target.copy(t);
    c.camera.position.copy(t.clone().add(off));
  }, [focus]);

  return <div ref={hostRef} className={`relative overflow-hidden rounded-xl border bg-gradient-to-b from-secondary to-card ${className}`} />;
}
