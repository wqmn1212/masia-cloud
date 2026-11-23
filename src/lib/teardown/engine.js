// 작동 원리 3D 엔진 — 이 파일은 아무것도 import 하지 않는다. three 와 부가 기능은 인자로 받는다.
// 그래서 앱 화면과 '오프라인 HTML 내보내기'가 같은 파일을 그대로 쓴다 (내보내기는 이 원본을 HTML 안에 넣는다).
//
// createTeardown(host, { THREE, OrbitControls, RoundedBoxGeometry }, { parts, tour, title, loop, onChange, onProgress, onEnd })
//  → { play, pause, toggle, goto, next, prev, show, setView, setExplode, setLabels, setSpin, getState, capture, record, destroy }
//  opts.idleSpin: 재생하지 않을 때도 천천히 돈다
// 단계 모양은 tour.js 참고: { title, caption, focus, explode, view, camera, flows, actions, dur }

const FLOW_COLOR = { power: '#f59e0b', signal: '#0ea5e9', light: '#facc15', air: '#22d3ee', heat: '#ef4444', sound: '#a78bfa', water: '#3b82f6' };
const FINISH = {
  matte: { roughness: 0.8, metalness: 0 },
  gloss: { roughness: 0.22, metalness: 0.05 },
  metal: { roughness: 0.35, metalness: 0.9 },
  glass: { roughness: 0.05, metalness: 0, opacity: 0.4 },
  rubber: { roughness: 0.95, metalness: 0 },
};
const HEX = /^#[0-9a-fA-F]{6}$/;
const rad = (d) => ((Number(d) || 0) * Math.PI) / 180;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const PARTICLES = 16;

export function createTeardown(host, lib, opts = {}) {
  const { THREE, OrbitControls, RoundedBoxGeometry } = lib;
  const parts = (opts.parts || []).filter((p) => p && p.id);
  let tour = { steps: [], ...(opts.tour || {}) };
  const loop = opts.loop !== false;

  // ── 렌더러·장면
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.localClippingEnabled = true;
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none';
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  host.appendChild(renderer.domElement);
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;font-family:system-ui,-apple-system,"Segoe UI","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
  host.appendChild(overlay);

  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a93a6, 1.2);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(1, 1.6, 1.2);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6);
  fill.position.set(-1.2, 0.4, -1);
  scene.add(key, fill);
  const root = new THREE.Group();
  scene.add(root);

  // ── 부품 → 메시 (컨셉 3D 와 같은 도형 규칙)
  const geometry = (p) => {
    const x = Math.max(0.1, Number(p.size?.x) || 1);
    const y = Math.max(0.1, Number(p.size?.y) || 1);
    const z = Math.max(0.1, Number(p.size?.z) || x);
    if (p.shape === 'cylinder') return new THREE.CylinderGeometry(0.5, 0.5, 1, 48).scale(x, y, z);
    if (p.shape === 'cone') return new THREE.ConeGeometry(0.5, 1, 48).scale(x, y, z);
    if (p.shape === 'sphere') return new THREE.SphereGeometry(0.5, 32, 24).scale(x, y, z);
    if (p.shape === 'sphere_cut') {
      const c = Math.max(-0.95, Math.min(0.95, Number(p.cut) || 0));
      const t0 = Math.acos(c);
      return new THREE.SphereGeometry(0.5, 64, 32, 0, Math.PI * 2, t0, Math.PI - t0).scale(x, y, z);
    }
    if (p.shape === 'capsule') {
      const r = Math.min(x, z, y) / 2;
      return new THREE.CapsuleGeometry(r, Math.max(0.01, y - 2 * r), 8, 24).scale(x / (2 * r), 1, z / (2 * r));
    }
    if (p.shape === 'torus') {
      const tube = Math.min(y, x / 2 - 0.01) / 2;
      return new THREE.TorusGeometry(x / 2 - tube, tube, 16, 48).rotateX(Math.PI / 2);
    }
    if (p.shape === 'rounded_box' && RoundedBoxGeometry) return new RoundedBoxGeometry(x, y, z, 4, Math.min(x, y, z) * 0.14);
    return new THREE.BoxGeometry(x, y, z);
  };

  const box = new THREE.Box3();
  const items = parts.map((p) => {
    const fin = FINISH[p.finish] || FINISH.matte;
    const baseOpacity = fin.opacity ?? 1;
    const color = new THREE.Color(HEX.test(p.color || '') ? p.color : '#b9c2d0');
    const material = new THREE.MeshStandardMaterial({ color, roughness: fin.roughness, metalness: fin.metalness, transparent: true, opacity: baseOpacity });
    if (p.shape === 'sphere_cut') material.side = THREE.DoubleSide;
    const geo = geometry(p);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(Number(p.position?.x) || 0, Number(p.position?.y) || 0, Number(p.position?.z) || 0);
    mesh.rotation.set(rad(p.rotation_deg?.x), rad(p.rotation_deg?.y), rad(p.rotation_deg?.z));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 28), new THREE.LineBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0, depthWrite: false }));
    mesh.add(edges);
    root.add(mesh);
    mesh.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(mesh);
    box.union(b);
    const size = b.getSize(new THREE.Vector3());
    return {
      id: p.id, name: String(p.name || ''), layer: p.layer, mesh, edges, material, baseOpacity, color: color.clone(), side: material.side,
      home: mesh.position.clone(), quat: mesh.quaternion.clone(), offset: b.getCenter(new THREE.Vector3()).sub(mesh.position), r: Math.max(size.length() / 2, 0.5),
      explode: new THREE.Vector3(), out: new THREE.Vector3(), glowColor: color.clone().lerp(new THREE.Color(1, 0.9, 0.7), 0.6), opacity: baseOpacity, glow: 0, heat: 0, spin: 0, phase: Math.random() * 6,
    };
  });
  const byId = new Map(items.map((it) => [it.id, it]));
  if (!items.length) box.set(new THREE.Vector3(-50, 0, -50), new THREE.Vector3(50, 100, 50));
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 1);
  items.forEach((it) => {
    const c = it.home.clone().add(it.offset);
    const dir = c.clone().sub(center);
    if (dir.length() < radius * 0.05) dir.set(0, it.layer === 'SHELL' ? radius * 0.5 : 0, 0);
    it.explode.copy(dir).multiplyScalar(it.layer === 'SHELL' ? 1.4 : 0.8);
    if (it.explode.length() > radius * 0.9) it.explode.setLength(radius * 0.9);
    // 바깥 방향: 빛·바람·소리가 나가는 쪽. 얇은 판(발광면·스피커)은 판의 면 방향, 그 밖은 제품 중심에서 먼 쪽 (가운데 부품은 앞쪽)
    const o = c.clone().sub(center);
    const dims = (() => { const g = it.mesh.geometry; g.computeBoundingBox(); const s3 = g.boundingBox.getSize(new THREE.Vector3()); return [s3.x, s3.y, s3.z]; })();
    const minI = dims.indexOf(Math.min(...dims));
    if (dims[minI] < Math.max(...dims) * 0.2) {
      const n = new THREE.Vector3(minI === 0 ? 1 : 0, minI === 1 ? 1 : 0, minI === 2 ? 1 : 0).applyQuaternion(it.quat);
      const side = n.dot(o) > radius * 0.02 ? 1 : n.dot(o) < -radius * 0.02 ? -1 : (n.z + n.y >= 0 ? 1 : -1);
      it.thinN = n.clone();
      it.out.copy(n.multiplyScalar(side));
    } else it.out.copy(o.length() < radius * 0.15 ? new THREE.Vector3(0, 0, 1) : o.normalize());

  });
  // 겹겹이 쌓인 얇은 판(발광면·확산판·LED 판·방열판)은 판에 수직으로 같은 간격씩 벌린다 (중심이 같아 그냥 밀면 안 벌어진다)
  const thin = items.filter((it) => it.thinN);
  const groups = [];
  thin.forEach((it) => { const g = groups.find((x) => Math.abs(x.n.dot(it.thinN)) > 0.95); if (g) g.list.push(it); else groups.push({ n: it.thinN.clone(), list: [it] }); });
  groups.filter((g) => g.list.length >= 2).forEach((g) => {
    const proj = (it) => g.n.dot(it.home.clone().add(it.offset));
    g.list.sort((a, b) => proj(a) - proj(b));
    const k = g.list.length;
    const gap = radius * Math.min(0.28, 1.1 / k);
    g.list.forEach((it, i) => {
      const along = (i - (k - 1) / 2) * gap;
      const perp = it.explode.clone().addScaledVector(g.n, -it.explode.dot(g.n)).multiplyScalar(0.3);
      it.explode.copy(g.n).multiplyScalar(along).add(perp);
    });
  });
  const exploded = new THREE.Box3();
  items.forEach((it) => { const b = new THREE.Box3().setFromObject(it.mesh); exploded.union(b.translate(it.explode)); });
  const explodedCenter = items.length ? exploded.getCenter(new THREE.Vector3()) : center.clone();
  const explodedRadius = items.length ? Math.max(exploded.getSize(new THREE.Vector3()).length() / 2, radius) : radius;

  // 바닥 그림자 (은은한 원)
  const shadowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, 'rgba(15,23,42,0.22)'); gr.addColorStop(1, 'rgba(15,23,42,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(center.x, box.min.y - radius * 0.002, center.z);
  ground.scale.setScalar(radius * 2.4);
  scene.add(ground);

  // 작업대 무대 (lib.stage 가 있을 때): 스튜디오 반사·커팅 매트·실제 그림자. 없으면 예전처럼 은은한 원 그림자
  let stage = null;
  if (lib.stage) {
    try {
      stage = lib.stage(THREE, { scene, renderer, center, radius, minY: box.min.y, RoomEnvironment: lib.RoomEnvironment });
      stage.shadowCasters(items.map((it) => it.mesh));
      hemi.intensity = 0.5; key.intensity = 0.9; fill.intensity = 0.35;
      ground.material.opacity = 0.55;
    } catch { stage = null; }
  }

  // 흐름 입자 텍스처 (둥근 빛)
  const dotTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();

  // ── 카메라·조작
  const camera = new THREE.PerspectiveCamera(32, 1, radius / 100, radius * 80);
  const DEFAULT_DIR = new THREE.Vector3(1, 0.55, 1.25).normalize();
  camera.position.copy(center).addScaledVector(DEFAULT_DIR, radius * 3.8);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(center);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotateSpeed = 0.7;
  controls.minDistance = radius * 0.5;
  controls.maxDistance = radius * 14;

  // ── 상태
  const st = { index: -1, step: null, playing: false, elapsed: 0, view: 'solid', explode: 0, labels: 'focus', adhoc: false, ended: false };
  let explodeNow = 0;
  let build = null; let buildK = 0; // 조립 순서 (setBuild)
  let spin = !!opts.idleSpin; // 멈춰 있을 때도 천천히 돌기 (쇼룸)
  let tween = null;
  let flows = [];
  let glows = [];
  let gizmos = [];
  let section = null; // { plane }
  const sectionPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), center.x);
  let disposed = false;

  const emit = () => opts.onChange?.(getState());
  const focusSet = () => new Set(st.step?.focus?.length ? st.step.focus : []);

  // 단계의 카메라: 초점 부품을 감싸는 범위 + 방향(지정 또는 초점 쪽)
  const cameraFor = (step) => {
    const ex = Number(step?.explode) || 0;
    const ids = step?.frame !== 'all' && step?.focus?.length ? step.focus : null;
    let c; let r;
    if (ids && ids.length < items.length) {
      const b = new THREE.Box3();
      ids.forEach((id) => { const it = byId.get(id); if (it) b.union(new THREE.Box3().setFromObject(it.mesh).translate(it.home.clone().addScaledVector(it.explode, ex).sub(it.mesh.position))); });
      c = b.isEmpty() ? center.clone() : b.getCenter(new THREE.Vector3());
      r = b.isEmpty() ? radius : Math.max(b.getSize(new THREE.Vector3()).length() / 2, radius * 0.35);
      // 너무 가까이 들어가지 않게: 제품 전체 중심 쪽으로 조금 당긴다
      c.lerp(center.clone().lerp(explodedCenter, ex), 0.25);
    } else {
      c = center.clone().lerp(explodedCenter, ex);
      r = radius + (explodedRadius - radius) * ex;
    }
    let dir;
    if (step?.camera?.dir) dir = new THREE.Vector3(...step.camera.dir).normalize();
    else if (ids && ids.length < items.length) {
      const v = c.clone().sub(center); v.y = 0;
      const cur = camera.position.clone().sub(controls.target).normalize();
      dir = v.length() > radius * 0.08 ? v.normalize().multiplyScalar(0.8).add(cur.multiplyScalar(0.6)) : cur;
      dir.y = Math.max(dir.y, 0.35); dir.normalize();
    } else dir = camera.position.clone().sub(controls.target).normalize();
    const zoom = Number(step?.camera?.zoom) || 1;
    return { target: c, dir, dist: Math.max(r * 3.6, radius * 2.3) / zoom };
  };
  const flyTo = (step, sec = 1.4) => {
    const to = cameraFor(step);
    const fromDir = camera.position.clone().sub(controls.target);
    tween = { t: 0, dur: sec, fromT: controls.target.clone(), toT: to.target, fromDir: fromDir.clone().normalize(), toDir: to.dir, fromD: fromDir.length(), toD: to.dist };
    controls.maxDistance = Math.max(controls.maxDistance, to.dist * 2);
  };

  // 흐름: 부품 A → B (곡선) 또는 A → 바깥 (퍼지는 입자)
  const clearFlows = () => { flows.forEach((f) => { scene.remove(f.points); f.points.geometry.dispose(); f.points.material.dispose(); if (f.line) { scene.remove(f.line); f.line.geometry.dispose(); f.line.material.dispose(); } }); flows = []; };
  const makeFlows = (list) => {
    clearFlows();
    (list || []).forEach((fl, k) => {
      const a = byId.get(fl.from); if (!a) return;
      const b = fl.to === 'out' ? null : byId.get(fl.to);
      if (fl.to !== 'out' && !b) return;
      const color = new THREE.Color(FLOW_COLOR[fl.kind] || '#0ea5e9');
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PARTICLES * 3), 3));
      const mat = new THREE.PointsMaterial({ color, size: radius * (b ? 0.05 : 0.06), map: dotTex, transparent: true, depthTest: false, depthWrite: false, opacity: 0.95 });
      const points = new THREE.Points(geo, mat);
      points.renderOrder = 20;
      scene.add(points);
      let line = null;
      if (b) {
        const lg = new THREE.BufferGeometry();
        lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(25 * 3), 3));
        line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35, depthTest: false, depthWrite: false }));
        line.renderOrder = 19;
        scene.add(line);
      }
      // 바깥으로 퍼지는 흐름: 입자마다 방향을 조금씩 다르게
      const spread = [];
      for (let i = 0; i < PARTICLES; i++) {
        const s = new THREE.Vector3(Math.sin(i * 12.9898 + k) * 43758.5453 % 1, Math.sin(i * 78.233 + k) * 12345.678 % 1, Math.sin(i * 39.425 + k) * 24680.135 % 1);
        spread.push(s);
      }
      flows.push({ a, b, kind: fl.kind, points, line, spread, speed: fl.kind === 'power' ? 0.45 : fl.kind === 'signal' ? 0.7 : 0.5, offset: k * 0.17 });
    });
  };
  const posOf = (it, out = new THREE.Vector3()) => out.copy(it.mesh.position).add(it.offset);
  const pa = new THREE.Vector3(); const pb = new THREE.Vector3(); const pc = new THREE.Vector3(); const tmp = new THREE.Vector3(); const tmp2 = new THREE.Vector3();
  const bez = (t, out) => out.set(0, 0, 0).addScaledVector(pa, (1 - t) * (1 - t)).addScaledVector(pc, 2 * (1 - t) * t).addScaledVector(pb, t * t);
  const stepFlows = (time) => {
    flows.forEach((f) => {
      const arr = f.points.geometry.attributes.position.array;
      posOf(f.a, pa);
      if (f.b) {
        posOf(f.b, pb);
        const d = pa.distanceTo(pb);
        pc.copy(pa).add(pb).multiplyScalar(0.5).addScaledVector(camera.up, d * 0.25 + radius * 0.04);
        for (let i = 0; i < PARTICLES; i++) { bez(((time * f.speed + i / PARTICLES + f.offset) % 1), tmp); arr[i * 3] = tmp.x; arr[i * 3 + 1] = tmp.y; arr[i * 3 + 2] = tmp.z; }
        const la = f.line.geometry.attributes.position.array;
        for (let i = 0; i <= 24; i++) { bez(i / 24, tmp); la[i * 3] = tmp.x; la[i * 3 + 1] = tmp.y; la[i * 3 + 2] = tmp.z; }
        f.line.geometry.attributes.position.needsUpdate = true;
      } else {
        // 부품 겉면 여러 곳에서 바깥 방향으로 나간다 (멀어질수록 흐려지는 대신 작아진다)
        const len = radius * (f.kind === 'light' ? 0.7 : 0.55);
        for (let i = 0; i < PARTICLES; i++) {
          const t = (time * f.speed + i / PARTICLES + f.offset) % 1;
          const s = f.spread[i];
          tmp.set(s.x, s.y, s.z);
          tmp.addScaledVector(f.a.out, -tmp.dot(f.a.out)); // 면 위의 점
          tmp2.copy(f.a.out).addScaledVector(tmp, 0.25).normalize();
          const start = pc.copy(pa).addScaledVector(tmp, f.a.r * 0.55);
          tmp.copy(start).addScaledVector(tmp2, len * t);
          arr[i * 3] = tmp.x; arr[i * 3 + 1] = tmp.y; arr[i * 3 + 2] = tmp.z;
        }
      }
      f.points.geometry.attributes.position.needsUpdate = true;
    });
  };

  // 동작: 빛(빛남 + 점광원), 깜빡임, 회전 표시, 열, 진동, 흔들림, 누름
  const clearActions = () => {
    glows.forEach((g) => { scene.remove(g); g.dispose?.(); }); glows = [];
    gizmos.forEach((g) => { g.parent?.remove(g); g.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); }); }); gizmos = [];
  };
  const makeActions = (list) => {
    clearActions();
    (list || []).forEach((a) => {
      const it = byId.get(a.part); if (!it) return;
      if (a.kind === 'glow' && glows.length < 3) {
        const l = new THREE.PointLight(0xffd9a0, 0, radius * 2.5, 0);
        l.userData.item = it;
        scene.add(l); glows.push(l);
      }
      if (a.kind === 'spin' || a.kind === 'turn') {
        // 둥근 부품은 돌아도 안 보이므로 도는 방향 화살표를 함께 돌린다
        const g = new THREE.Group();
        const rr = it.r * 0.85;
        const mat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.9, depthTest: false });
        const arc = new THREE.Mesh(new THREE.TorusGeometry(rr, rr * 0.045, 8, 48, Math.PI * 1.5), mat);
        arc.rotation.x = Math.PI / 2;
        const head = new THREE.Mesh(new THREE.ConeGeometry(rr * 0.12, rr * 0.28, 16), mat.clone());
        head.position.set(0, 0, rr); head.rotation.z = Math.PI / 2; head.rotation.y = Math.PI;
        g.add(arc, head);
        g.renderOrder = 25; arc.renderOrder = 25; head.renderOrder = 25;
        g.userData = { item: it, kind: a.kind };
        scene.add(g); gizmos.push(g);
      }
    });
  };
  const actionOf = (it) => (st.step?.actions || []).find((a) => a.part === it.id)?.kind || null;

  // ── 이름표 (HTML 위에 겹친다)
  let labels = [];
  const clearLabels = () => { labels.forEach((l) => l.el.remove()); labels = []; };
  const makeLabels = () => {
    clearLabels();
    if (st.labels === 'off') return;
    const fs = focusSet();
    const pick = st.labels === 'all' || !fs.size ? (st.labels === 'all' ? items : []) : items.filter((it) => fs.has(it.id));
    pick.filter((it) => it.mesh.visible).slice(0, 14).forEach((it) => {
      const el = document.createElement('div');
      el.style.cssText = 'position:absolute;left:0;top:0;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;gap:3px;transition:opacity .25s;opacity:0;will-change:transform';
      const pill = document.createElement('span');
      pill.textContent = it.name;
      pill.style.cssText = 'white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis;font-size:12px;font-weight:600;line-height:1;color:#0f172a;background:rgba(255,255,255,.94);border:1px solid rgba(15,23,42,.12);border-radius:999px;padding:5px 9px;box-shadow:0 2px 8px rgba(15,23,42,.12)';
      const dot = document.createElement('span');
      dot.style.cssText = 'width:7px;height:7px;border-radius:50%;background:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.25)';
      el.append(pill, dot);
      overlay.appendChild(el);
      labels.push({ it, el, x: 0, y: 0, show: false });
    });
  };
  const placeLabels = (w, h) => {
    const placed = [];
    labels.forEach((l) => {
      posOf(l.it, tmp).project(camera);
      l.show = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1;
      l.x = (tmp.x * 0.5 + 0.5) * w; l.y = (-tmp.y * 0.5 + 0.5) * h;
    });
    // 겹치면 위로 밀어 올린다
    [...labels].sort((a, b) => a.y - b.y).forEach((l) => {
      let y = l.y;
      for (let k = 0; k < 6; k++) { const hit = placed.find((p) => Math.abs(p.x - l.x) < 110 && Math.abs(p.y - y) < 26); if (!hit) break; y = hit.y - 27; }
      l.ly = y; placed.push({ x: l.x, y });
      l.el.style.transform = `translate(${l.x}px, ${y}px) translate(-50%, -100%)`;
      l.el.style.opacity = l.show ? '1' : '0';
    });
  };

  // ── 단계 적용
  const applyStep = (step, { fly = true } = {}) => {
    st.step = step || null;
    st.view = step?.view || 'solid';
    st.explode = Number(step?.explode) || 0;
    st.elapsed = 0;
    // 단면: 지금 보는 쪽 절반을 잘라 낸다 (가까운 축으로 맞춘다)
    if (st.view === 'section') {
      const d = (step?.camera?.dir ? new THREE.Vector3(...step.camera.dir) : camera.position.clone().sub(controls.target)); d.y = 0;
      const axis = Math.abs(d.x) > Math.abs(d.z) ? new THREE.Vector3(Math.sign(d.x) || 1, 0, 0) : new THREE.Vector3(0, 0, Math.sign(d.z) || 1);
      sectionPlane.normal.copy(axis).negate();
      sectionPlane.constant = axis.dot(center);
      section = true;
    } else section = null;
    items.forEach((it) => {
      const cut = section && (it.layer === 'SHELL' || it.layer === 'OTHER');
      it.material.clippingPlanes = cut ? [sectionPlane] : null;
      it.edges.material.clippingPlanes = cut ? [sectionPlane] : null;
      it.material.side = cut ? THREE.DoubleSide : it.side;
      it.material.needsUpdate = true; it.edges.material.needsUpdate = true;
    });
    makeFlows(step?.flows);
    makeActions(step?.actions);
    makeLabels();
    if (fly) flyTo(step);
  };

  // ── 매 프레임
  const clock = new THREE.Clock();
  const col = new THREE.Color();
  const HEAT = new THREE.Color(1, 0.25, 0.08);
  const HILITE = new THREE.Color(0.04, 0.24, 0.57);
  let time = 0;
  let raf = 0;
  let recorder = null;
  let lastProgress = -1;
  const frame = () => {
    if (disposed) return;
    const dt = Math.min(clock.getDelta(), 0.1);
    time += dt;
    // 재생
    if (st.playing && st.step && st.index >= 0) {
      st.elapsed += dt;
      const dur = Number(st.step.dur) || 5;
      const p = Math.min(1, st.elapsed / dur);
      if (Math.abs(p - lastProgress) > 0.02) { lastProgress = p; opts.onProgress?.(p); }
      if (st.elapsed >= dur) {
        if (st.index < tour.steps.length - 1) goto(st.index + 1, { play: true });
        else if (loop && !recorder) goto(0, { play: true });
        else { st.playing = false; st.ended = true; emit(); opts.onEnd?.(); recorder?.finish(); }
      }
    }
    // 카메라 이동
    if (tween) {
      tween.t = Math.min(1, tween.t + dt / tween.dur);
      const e = ease(tween.t);
      controls.target.lerpVectors(tween.fromT, tween.toT, e);
      const d = tmp.copy(tween.fromDir).lerp(tween.toDir, e).normalize().multiplyScalar(tween.fromD + (tween.toD - tween.fromD) * e);
      camera.position.copy(controls.target).add(d);
      if (tween.t >= 1) tween = null;
    }
    controls.autoRotate = !tween && (st.playing || spin);
    // 분해·투명·강조
    explodeNow += (st.explode - explodeNow) * Math.min(1, dt * 4);
    // 조립 순서: 이번 단계 부품이 떨어진 곳에서 제자리로 들어간다 (잠깐 멈춤 → 들어감 → 끼운 채로 잠깐, 반복)
    if (build) {
      build.t += dt;
      const ph = build.t % 3.4;
      buildK = ph < 0.6 ? 1 : ph < 1.8 ? 1 - ease((ph - 0.6) / 1.2) : 0;
    } else buildK = 0;
    const fs = focusSet();
    const view = st.view;
    items.forEach((it) => {
      const act = actionOf(it);
      const focused = !fs.size || fs.has(it.id);
      it.mesh.position.copy(it.home).addScaledVector(it.explode, explodeNow);
      if (build && buildK > 0.001 && build.enter.has(it.id)) it.mesh.position.addScaledVector(build.from, buildK);
      it.mesh.quaternion.copy(it.quat);
      // 동작별 움직임
      const t = time + it.phase;
      if (act === 'buzz') it.mesh.position.addScaledVector(tmp.set(Math.sin(t * 90), Math.cos(t * 70), Math.sin(t * 80)), it.r * 0.012);
      if (act === 'press') { const k = Math.max(0, Math.sin(time * 4)); it.mesh.position.addScaledVector(it.out, -it.r * 0.18 * k * k); }
      if (act === 'swing') it.mesh.rotateZ(Math.sin(time * 2) * 0.35);
      if (act === 'turn') it.mesh.rotateY(Math.sin(time * 1.6) * 0.8);
      if (act === 'spin') it.mesh.rotateY((time * 6) % (Math.PI * 2));
      let target = it.baseOpacity;
      if (view === 'glass') target = it.layer === 'SHELL' ? (fs.has(it.id) ? 0.35 : 0.07) : focused ? it.baseOpacity : 0.12;
      else if (view === 'section') target = focused ? it.baseOpacity : 0.4;
      else if (!focused) target = Math.min(it.baseOpacity, build ? 0.55 : 0.18); // 조립 순서: 이미 끼운 부품은 반쯤 보이게
      it.opacity += (target - it.opacity) * Math.min(1, dt * 5);
      it.material.opacity = it.opacity;
      it.material.depthWrite = it.opacity > 0.9;
      it.mesh.renderOrder = it.layer === 'SHELL' ? 2 : 1;
      const edgeT = view === 'glass' && it.layer === 'SHELL' ? 0.2 : focused && fs.size ? 0.3 : 0;
      it.edges.material.opacity += (edgeT - it.edges.material.opacity) * Math.min(1, dt * 5);
      it.edges.visible = it.edges.material.opacity > 0.01;
      // 빛·열·깜빡임·강조
      const glowT = act === 'glow' ? 1 : act === 'blink' ? (Math.sin(time * 5) > 0 ? 1 : 0.1) : 0;
      it.glow += (glowT - it.glow) * Math.min(1, dt * (act === 'blink' ? 20 : 3));
      const heatT = act === 'heat' ? 0.6 + 0.4 * Math.sin(time * 3) : 0;
      it.heat += (heatT - it.heat) * Math.min(1, dt * 3);
      const hi = fs.size && fs.has(it.id) && !act ? 0.12 + 0.06 * Math.sin(time * 3) : 0;
      const em = it.material.emissive.setRGB(0, 0, 0);
      if (it.glow > 0.003) em.add(col.copy(it.glowColor).multiplyScalar(it.glow * 0.5));
      if (it.heat > 0.003) em.add(col.copy(HEAT).multiplyScalar(it.heat * 0.8));
      if (hi) em.add(col.copy(HILITE).multiplyScalar(hi));
    });
    glows.forEach((l) => { const it = l.userData.item; posOf(it, l.position); l.intensity = 2.2 * it.glow; });
    gizmos.forEach((g) => {
      const it = g.userData.item;
      posOf(it, g.position);
      g.quaternion.copy(it.quat);
      g.rotateY(g.userData.kind === 'spin' ? -(time * 3) % (Math.PI * 2) : Math.sin(time * 1.6) * 0.8);
    });
    stepFlows(time);
    // 분해로 아래로 벌어진 부품이 매트에 묻히지 않게 바닥을 같이 내린다
    if (stage && items.length) stage.setFloorY(box.min.y + Math.min(0, exploded.min.y - box.min.y) * explodeNow);
    controls.update();
    renderer.render(scene, camera);
    const w = host.clientWidth; const h = host.clientHeight;
    placeLabels(w, h);
    recorder?.draw();
    raf = requestAnimationFrame(frame);
  };

  // insets: 화면 위·아래를 덮는 패널 높이(px). 제품을 가려지지 않는 가운데 띠에 맞춘다 (쇼룸)
  let insets = { top: 0, bottom: 0 };
  const resize = () => {
    const w = Math.max(host.clientWidth, 1); const h = Math.max(host.clientHeight, 1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const visH = Math.max(h - insets.top - insets.bottom, h * 0.35);
    const a = w / visH;
    // 세로로 좁은 띠(휴대폰)에서는 가로 시야가 좁아지지 않게 세로 시야를 넓힌다 (전체가 보이게)
    const fovVis = a < 1 ? Math.min(66, 2 * Math.atan(0.29 / a)) : (32 * Math.PI) / 180;
    camera.fov = Math.min(100, (2 * Math.atan(Math.tan(fovVis / 2) * (h / visH)) * 180) / Math.PI);
    const shift = (insets.bottom - insets.top) / 2;
    if (shift) camera.setViewOffset(w, h, 0, shift, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  };
  const setInsets = (v) => { insets = { top: Math.max(0, Number(v?.top) || 0), bottom: Math.max(0, Number(v?.bottom) || 0) }; resize(); };
  resize();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  ro?.observe(host);
  // 직접 돌려 보면 자동 재생을 멈추고 넘겨준다
  const onStart = () => { tween = null; if (st.playing) { st.playing = false; emit(); } };
  controls.addEventListener('start', onStart);

  // ── 공개 API
  function goto(i, { play = st.playing } = {}) {
    if (!tour.steps.length) return;
    const n = ((i % tour.steps.length) + tour.steps.length) % tour.steps.length;
    st.index = n; st.adhoc = false; st.ended = false; st.playing = play; lastProgress = -1;
    applyStep(tour.steps[n]);
    opts.onProgress?.(0);
    emit();
  }
  const play = () => { if (!tour.steps.length) return; if (st.index < 0 || st.adhoc || st.ended) goto(st.ended ? 0 : Math.max(0, st.index), { play: true }); else { st.playing = true; emit(); } };
  const pause = () => { st.playing = false; emit(); };
  const show = (step) => { st.playing = false; st.adhoc = true; st.index = -1; applyStep(step); emit(); };
  // 카메라는 그대로 두고 동작·흐름만 바꾼다 (직접 작동해 보기)
  const live = (step) => { st.playing = false; st.adhoc = true; st.index = -1; applyStep(step, { fly: false }); emit(); };
  // 뺀 부품은 보이지 않게 (부품 빼 보기)
  let hidden = new Set();
  const applyVisible = () => { items.forEach((it) => { it.mesh.visible = !hidden.has(it.id) && (!build || build.shown.has(it.id)); }); makeLabels(); };
  const setHidden = (ids) => { hidden = new Set(ids || []); applyVisible(); };
  // 조립 순서: shown = 지금까지 조립된 부품(이번 단계 포함), enter = 이번 단계 부품, from = 들어오는 쪽 ('up'·'down'·'front'·'back'·'left'·'right')
  const FROM = { up: [0, 1, 0], down: [0, -1, 0], front: [0, 0, 1], back: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0] };
  const setBuild = (b) => {
    build = b ? { shown: new Set(b.shown || []), enter: new Set(b.enter || []), from: new THREE.Vector3(...(FROM[b.from] || FROM.up)).multiplyScalar(radius * 0.55), t: 0 } : null;
    applyVisible();
  };
  // 보기 방식 바꾸기: 지금 단계는 그대로 두고 보기만 바꾼다 (단면은 조립 상태에서 자른다)
  const setView = (v) => {
    const keep = st.explode;
    const elapsed = st.elapsed;
    const base = st.step || { title: '', caption: '', focus: [], flows: [], actions: [] };
    // 단면은 옆에서 본다: 옆으로 돌아가 세로로 자른다 (앞뒤로 쌓인 부품이 한눈에 보인다)
    if (v === 'section') {
      const side = camera.position.x - controls.target.x >= 0 ? 1 : -1;
      applyStep({ ...base, view: v, explode: 0, camera: { dir: [side, 0.28, 0.3], zoom: 1.05 } }, { fly: true });
    } else applyStep({ ...base, view: v, explode: keep }, { fly: false });
    st.elapsed = elapsed; st.playing = false; emit();
  };
  const setExplode = (v) => { st.explode = Math.max(0, Math.min(1, Number(v) || 0)); st.playing = false; emit(); };
  const setLabels = (m) => { st.labels = ['all', 'focus', 'off'].includes(m) ? m : 'focus'; makeLabels(); emit(); };
  const setTour = (t) => { tour = { steps: [], ...(t || {}) }; st.index = -1; st.playing = false; emit(); };
  function getState() {
    return { index: st.index, count: tour.steps.length, playing: st.playing, step: st.step, view: st.view, explode: st.explode, labels: st.labels, adhoc: st.adhoc, ended: st.ended };
  }
  const capture = () => {
    renderer.render(scene, camera);
    const src = renderer.domElement;
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const g = c.getContext('2d');
    paintBg(g, c.width, c.height); g.drawImage(src, 0, 0);
    return c.toDataURL('image/png');
  };
  const paintBg = (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f4f6f9'); gr.addColorStop(1, '#e3e8ef'); g.fillStyle = gr; g.fillRect(0, 0, w, h); };

  // 영상 녹화: 3D + 이름표 + 설명을 한 캔버스에 그려 webm 으로 (처음부터 끝까지 한 번 재생)
  const record = ({ fps = 30, title = opts.title || '' } = {}) => {
    if (recorder) return recorder.promise;
    const src = renderer.domElement;
    const comp = document.createElement('canvas');
    comp.width = src.width - (src.width % 2); comp.height = src.height - (src.height % 2);
    const g = comp.getContext('2d');
    const stream = comp.captureStream(fps);
    const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(t));
    if (!type) return Promise.reject(new Error('이 브라우저는 화면 녹화를 지원하지 않습니다'));
    const mr = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 6_000_000 });
    const chunks = [];
    mr.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
    let resolve; let reject;
    const promise = new Promise((a, b) => { resolve = a; reject = b; });
    mr.onstop = () => { recorder = null; resolve(new Blob(chunks, { type: type.split(';')[0] })); };
    mr.onerror = (e) => { recorder = null; reject(e.error || new Error('녹화 실패')); };
    const pr = renderer.getPixelRatio();
    const wrap = (text, maxW) => {
      const out = []; let line = '';
      for (const ch of String(text || '')) { const t = line + ch; if (g.measureText(t).width > maxW && line) { out.push(line); line = ch.trim() ? ch : ''; } else line = t; }
      if (line) out.push(line);
      return out;
    };
    const round = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    const font = '"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",system-ui,sans-serif';
    recorder = {
      promise,
      finish: () => { if (mr.state !== 'inactive') setTimeout(() => mr.state !== 'inactive' && mr.stop(), 400); },
      stop: () => { st.playing = false; if (mr.state !== 'inactive') mr.stop(); emit(); },
      draw: () => {
        const W = comp.width; const H = comp.height;
        paintBg(g, W, H);
        g.drawImage(src, 0, 0, W, H);
        // 이름표
        g.font = `600 ${12 * pr}px ${font}`;
        labels.forEach((l) => {
          if (!l.show) return;
          const x = l.x * pr; const y = (l.ly ?? l.y) * pr;
          const tw = g.measureText(l.it.name).width + 18 * pr; const th = 22 * pr;
          g.fillStyle = 'rgba(37,99,235,1)'; g.beginPath(); g.arc(x, y - 4 * pr, 3.5 * pr, 0, Math.PI * 2); g.fill();
          round(x - tw / 2, y - 10 * pr - th, tw, th, th / 2); g.fillStyle = 'rgba(255,255,255,.94)'; g.fill();
          g.strokeStyle = 'rgba(15,23,42,.12)'; g.lineWidth = pr; g.stroke();
          g.fillStyle = '#0f172a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(l.it.name, x, y - 10 * pr - th / 2);
        });
        // 제목
        if (title) { g.textAlign = 'left'; g.textBaseline = 'top'; g.font = `700 ${15 * pr}px ${font}`; g.fillStyle = 'rgba(15,23,42,.75)'; g.fillText(title, 18 * pr, 16 * pr); }
        // 설명 띠
        const s = st.step;
        if (s && (s.title || s.caption)) {
          const pad = 16 * pr; const bw = Math.min(W - 32 * pr, 760 * pr); const bx = (W - bw) / 2;
          g.font = `400 ${14 * pr}px ${font}`;
          const lines = wrap(s.caption, bw - pad * 2).slice(0, 3);
          const bh = pad * 2 + 20 * pr + lines.length * 21 * pr;
          const by = H - bh - 18 * pr;
          round(bx, by, bw, bh, 14 * pr); g.fillStyle = 'rgba(255,255,255,.93)'; g.fill();
          g.textAlign = 'left'; g.textBaseline = 'top';
          g.font = `700 ${15 * pr}px ${font}`; g.fillStyle = '#0f172a';
          g.fillText(`${st.index >= 0 ? `${st.index + 1}/${tour.steps.length}  ` : ''}${s.title}`, bx + pad, by + pad);
          g.font = `400 ${14 * pr}px ${font}`; g.fillStyle = '#334155';
          lines.forEach((ln, i) => g.fillText(ln, bx + pad, by + pad + 24 * pr + i * 21 * pr));
          // 진행 막대
          const p = Math.min(1, st.elapsed / (Number(s.dur) || 5));
          g.fillStyle = 'rgba(37,99,235,.15)'; g.fillRect(bx + pad, by + bh - 6 * pr, bw - pad * 2, 2 * pr);
          g.fillStyle = 'rgba(37,99,235,1)'; g.fillRect(bx + pad, by + bh - 6 * pr, (bw - pad * 2) * p, 2 * pr);
        }
      },
    };
    mr.start(500);
    goto(0, { play: true });
    return promise;
  };

  const destroy = () => {
    disposed = true;
    cancelAnimationFrame(raf);
    recorder?.stop();
    ro?.disconnect();
    controls.removeEventListener('start', onStart);
    controls.dispose();
    clearFlows(); clearActions(); clearLabels();
    scene.traverse((o) => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } });
    dotTex.dispose(); shadowTex.dispose();
    stage?.dispose();
    renderer.dispose();
    renderer.forceContextLoss?.();
    renderer.domElement.remove();
    overlay.remove();
  };

  if (opts.autoplay !== false && tour.steps.length) goto(0, { play: true });
  else applyStep(null, { fly: false });
  frame();

  return { play, pause, toggle: () => (st.playing ? pause() : play()), goto, next: () => goto(st.index + 1), prev: () => goto(st.index - 1), show, setView, setExplode, setLabels, setTour, setSpin: (v) => { spin = !!v; }, setInsets, live, setHidden, setBuild, getState, capture, record, stopRecording: () => recorder?.stop(), canvas: renderer.domElement, destroy };
}
