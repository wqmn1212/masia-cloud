import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { textureDraftDeg } from '@/lib/moldReview/materials';

const C = (hex) => new THREE.Color(hex);
const COL = {
  base: C('#c9ced6'), ok: C('#3bb273'), low: C('#f2a33a'), none: C('#e5484d'), neg: C('#8e4ec6'), flat: C('#d5d9e0'),
  under: C('#e5484d'), cav: C('#9dbef7'), core: C('#a5dcb9'), thick: C('#f08a24'), thin: C('#2f6fe4'),
};
const THICK_STOPS = [[0.45, C('#2f6fe4')], [0.8, C('#36a3c9')], [1.0, C('#3bb273')], [1.12, C('#d9c23a')], [1.25, C('#f08a24')], [1.6, C('#e5484d')]];
const FLOW_STOPS = [C('#2f6fe4'), C('#36a3c9'), C('#3bb273'), C('#d9c23a'), C('#f08a24'), C('#e5484d')];

function thickColor(ratio, out) {
  if (ratio <= THICK_STOPS[0][0]) return out.copy(THICK_STOPS[0][1]);
  for (let i = 1; i < THICK_STOPS.length; i++) {
    if (ratio <= THICK_STOPS[i][0]) {
      const [a, ca] = THICK_STOPS[i - 1], [b, cb] = THICK_STOPS[i];
      return out.copy(ca).lerp(cb, (ratio - a) / (b - a));
    }
  }
  return out.copy(THICK_STOPS[THICK_STOPS.length - 1][1]);
}

function flowColor(t, out) {
  const x = Math.max(0, Math.min(0.9999, t)) * (FLOW_STOPS.length - 1);
  const i = Math.floor(x);
  return out.copy(FLOW_STOPS[i]).lerp(FLOW_STOPS[i + 1], x - i);
}

const SIDE_LABEL = { 1: '고정측', '-1': '가동측', 0: '언더컷' };

/** 빼기 방향을 위로 두는 화면 기준 축 */
function basis(dir) {
  const up = new THREE.Vector3(...dir);
  const front = Math.abs(up.z) > 0.5 ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(0, 0, 1);
  front.sub(up.clone().multiplyScalar(front.dot(up))).normalize();
  const right = new THREE.Vector3().crossVectors(up, front).normalize();
  return { up, front, right };
}

function makeLabel(text, bg, height) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const fs = 44;
  const font = `800 ${fs}px 'Noto Sans KR', sans-serif`;
  ctx.font = font;
  canvas.width = Math.ceil(ctx.measureText(text).width) + 36;
  canvas.height = fs + 26;
  ctx.font = font;
  ctx.fillStyle = bg;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(0, 0, canvas.width, canvas.height, 18);
  else ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 18, canvas.height / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sprite.scale.set((height * canvas.width) / canvas.height, height, 1);
  sprite.renderOrder = 5;
  return sprite;
}

function disposeObject(obj) {
  obj.traverse?.((o) => {
    o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      m?.map?.dispose?.();
      m?.dispose?.();
    }
  });
}

/**
 * 금형 검토 3D 뷰어. 하나의 WebGL 컨텍스트만 쓰고, 화면을 떠나면 정리한다.
 * mode: 'all' | 'draft' | 'under' | 'thick' | 'flow'
 */
const MoldViewer = forwardRef(function MoldViewer({ result, report, mode, focus, className = '' }, ref) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const [tip, setTip] = useState(null);

  // 렌더러 · 장면 준비 (한 번)
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 5000);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a93a3, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(1, 2, 3);
    camera.add(key);
    scene.add(camera);
    const group = new THREE.Group();
    const overlay = new THREE.Group();
    scene.add(group, overlay);
    const ctx = { renderer, scene, camera, controls, group, overlay, mesh: null, lineMats: [], raf: 0, center: new THREE.Vector3(), diag: 1, dir: [0, 0, 1] };
    ctxRef.current = ctx;
    const resize = () => {
      const w = wrap.clientWidth, h = wrap.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
      for (const m of ctx.lineMats) m.resolution.set(w, h);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    const loop = () => {
      ctx.raf = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();
    return () => {
      cancelAnimationFrame(ctx.raf);
      ro.disconnect();
      controls.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      ctxRef.current = null;
    };
  }, []);

  // 결과가 바뀌면 메시를 다시 만든다
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (ctx.mesh) {
      ctx.group.remove(ctx.mesh);
      disposeObject(ctx.mesh);
      ctx.mesh = null;
    }
    if (!result) return;
    const { V, F } = result.mesh;
    const nt = F.length / 3, nv = V.length / 3;
    // 30° 넘게 꺾인 모서리는 날카롭게, 나머지는 부드러운 법선
    const fn = new Float32Array(nt * 3), fa = new Float32Array(nt);
    const incStart = new Int32Array(nv + 1);
    for (let t = 0; t < nt * 3; t++) incStart[F[t] + 1]++;
    for (let v = 0; v < nv; v++) incStart[v + 1] += incStart[v];
    const fill = incStart.slice(0, nv), inc = new Int32Array(nt * 3);
    for (let t = 0; t < nt; t++) {
      const a = F[t * 3] * 3, b = F[t * 3 + 1] * 3, c = F[t * 3 + 2] * 3;
      const e1x = V[b] - V[a], e1y = V[b + 1] - V[a + 1], e1z = V[b + 2] - V[a + 2];
      const e2x = V[c] - V[a], e2y = V[c + 1] - V[a + 1], e2z = V[c + 2] - V[a + 2];
      const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      const l = Math.hypot(nx, ny, nz) || 1;
      fn[t * 3] = nx / l; fn[t * 3 + 1] = ny / l; fn[t * 3 + 2] = nz / l;
      fa[t] = l / 2;
      for (let k = 0; k < 3; k++) inc[fill[F[t * 3 + k]]++] = t;
    }
    const pos = new Float32Array(nt * 9), nor = new Float32Array(nt * 9), col = new Float32Array(nt * 9);
    const cos30 = Math.cos(Math.PI / 6);
    for (let t = 0; t < nt; t++) {
      for (let k = 0; k < 3; k++) {
        const v = F[t * 3 + k];
        pos[t * 9 + k * 3] = V[v * 3];
        pos[t * 9 + k * 3 + 1] = V[v * 3 + 1];
        pos[t * 9 + k * 3 + 2] = V[v * 3 + 2];
        let x = 0, y = 0, z = 0;
        for (let i = incStart[v]; i < incStart[v + 1]; i++) {
          const u = inc[i];
          if (fn[u * 3] * fn[t * 3] + fn[u * 3 + 1] * fn[t * 3 + 1] + fn[u * 3 + 2] * fn[t * 3 + 2] > cos30) {
            x += fn[u * 3] * fa[u];
            y += fn[u * 3 + 1] * fa[u];
            z += fn[u * 3 + 2] * fa[u];
          }
        }
        const l = Math.hypot(x, y, z) || 1;
        nor[t * 9 + k * 3] = x / l;
        nor[t * 9 + k * 3 + 1] = y / l;
        nor[t * 9 + k * 3 + 2] = z / l;
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.62, metalness: 0.04, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    });
    ctx.mesh = new THREE.Mesh(geometry, material);
    ctx.group.add(ctx.mesh);
    const [x0, y0, z0, x1, y1, z1] = result.summary.bbox;
    ctx.center.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    ctx.diag = Math.hypot(x1 - x0, y1 - y0, z1 - z0) || 1;
    ctx.dir = result.pull.dir;
    ctx.camera.near = ctx.diag / 200;
    ctx.camera.far = ctx.diag * 20;
    ctx.camera.updateProjectionMatrix();
    viewFrom(ctx, 'top');
  }, [result]);

  // 보기 방식 · 판정 조건이 바뀌면 색과 표시물을 다시 칠한다
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx || !ctx.mesh || !result || !report) return;
    paint(ctx, result, report, mode, wrapRef.current);
  }, [result, report, mode]);

  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx || !result || !focus) return;
    if (focus.view) viewFrom(ctx, focus.view);
    else if (focus.position) focusOn(ctx, focus.position);
  }, [focus, result]);

  useImperativeHandle(ref, () => ({
    view: (name) => ctxRef.current && viewFrom(ctxRef.current, name),
    /** 현재 화면을 PNG Blob 으로 (저장용) */
    snapshot: () => new Promise((resolve) => {
      const ctx = ctxRef.current;
      if (!ctx) return resolve(null);
      ctx.renderer.render(ctx.scene, ctx.camera);
      ctx.renderer.domElement.toBlob((blob) => resolve(blob), 'image/png');
    }),
  }), []);

  // 마우스를 올린 면의 정보
  useEffect(() => {
    const canvas = canvasRef.current;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let last = 0, dragging = false;
    const down = () => { dragging = true; };
    const up = () => { dragging = false; };
    const leave = () => setTip(null);
    const move = (e) => {
      const ctx = ctxRef.current;
      if (!ctx?.mesh || !result || dragging) {
        setTip(null);
        return;
      }
      const now = performance.now();
      if (now - last < 90) return;
      last = now;
      const rect = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, ctx.camera);
      const hit = ray.intersectObject(ctx.mesh, false)[0];
      if (!hit) {
        setTip(null);
        return;
      }
      const t = hit.faceIndex;
      const d = result.face.draft[t], sd = result.face.side[t];
      setTip({
        x: Math.min(e.clientX - rect.left + 14, rect.width - 250),
        y: e.clientY - rect.top + 14,
        text: `${SIDE_LABEL[sd] || ''} · 구배 ${Math.abs(d) >= 45 ? '–' : `${d.toFixed(1)}°`} · 살 두께 ${result.face.thick[t].toFixed(2)}mm`,
      });
    };
    canvas.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    canvas.addEventListener('pointerleave', leave);
    canvas.addEventListener('pointermove', move);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('pointermove', move);
    };
  }, [result]);

  return (
    <>
      <div ref={wrapRef} className={`relative overflow-hidden rounded-xl border bg-muted ${className}`}>
        <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full touch-none" aria-label="3D 부품 뷰어" />
        {result && report && (
          <div className="absolute left-3 top-3 z-10 hidden max-w-[calc(100%-1.5rem)] rounded-lg border bg-card/95 px-3 py-2 shadow-sm md:block">
            <Legend mode={mode} result={result} report={report} />
          </div>
        )}
        {result && (
          <div className="absolute bottom-3 right-3 z-10 flex gap-1 rounded-lg border bg-card p-1 shadow-sm">
            {[['top', '위'], ['bottom', '아래 (코어)'], ['front', '앞'], ['back', '뒤'], ['side', '옆']].map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => ctxRef.current && viewFrom(ctxRef.current, v)}
                className="rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {tip && (
          <div className="pointer-events-none absolute z-20 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background tabular-nums" style={{ left: tip.x, top: tip.y }}>
            {tip.text}
          </div>
        )}
      </div>
      {result && report && (
        <div className="mt-2 rounded-lg border bg-card px-3 py-2 md:hidden">
          <Legend mode={mode} result={result} report={report} inline />
        </div>
      )}
    </>
  );
});

export default MoldViewer;

function viewFrom(ctx, name) {
  const { up, front, right } = basis(ctx.dir);
  const v = {
    top: front.clone().multiplyScalar(0.9).add(right.clone().multiplyScalar(0.6)).add(up.clone().multiplyScalar(1.1)),
    bottom: front.clone().multiplyScalar(0.9).add(right.clone().multiplyScalar(0.6)).add(up.clone().multiplyScalar(-1.1)),
    front: front.clone().add(up.clone().multiplyScalar(0.35)),
    back: front.clone().negate().add(up.clone().multiplyScalar(0.35)),
    side: right.clone().add(up.clone().multiplyScalar(0.35)),
  }[name] || front.clone();
  ctx.controls.target.copy(ctx.center);
  ctx.camera.up.copy(up);
  ctx.camera.position.copy(ctx.center).add(v.normalize().multiplyScalar(ctx.diag * 1.7));
}

/** 부품 중심에서 그 위치 쪽(빼기 방향에 수직) 바깥에서 바라본다 */
function focusOn(ctx, p) {
  const target = new THREE.Vector3(...p);
  const { up, front } = basis(ctx.dir);
  let n = target.clone().sub(ctx.center).projectOnPlane(up);
  if (n.length() < ctx.diag * 0.02) n = front.clone();
  n.normalize();
  ctx.controls.target.copy(target);
  ctx.camera.up.copy(up);
  ctx.camera.position.copy(target).add(n.multiplyScalar(ctx.diag * 1.05)).add(up.clone().multiplyScalar(ctx.diag * 0.3));
}

function clearOverlay(ctx) {
  for (const child of [...ctx.overlay.children]) {
    ctx.overlay.remove(child);
    disposeObject(child);
  }
  ctx.lineMats = [];
}

function addLines(ctx, wrap, segments, colors, width) {
  if (!segments.length) return;
  const geo = new LineSegmentsGeometry();
  geo.setPositions(segments);
  geo.setColors(colors);
  const mat = new LineMaterial({ linewidth: width, vertexColors: true });
  mat.resolution.set(wrap.clientWidth, wrap.clientHeight);
  ctx.lineMats.push(mat);
  const line = new LineSegments2(geo, mat);
  line.renderOrder = 2;
  ctx.overlay.add(line);
}

function addBall(ctx, p, hex, r) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), new THREE.MeshStandardMaterial({ color: hex, roughness: 0.4 }));
  m.position.set(...p);
  ctx.overlay.add(m);
}

function addLabel(ctx, text, p, bg, scale = 1) {
  const sprite = makeLabel(text, bg, ctx.diag * 0.03 * scale);
  sprite.position.set(...p);
  ctx.overlay.add(sprite);
}

function paint(ctx, result, report, mode, wrap) {
  clearOverlay(ctx);
  const { side, draft, thick, wall, S } = result.face;
  const { F } = result.mesh;
  const nt = F.length / 3;
  const s = result.summary;
  const material = report.material;
  const settings = report.settings;
  const cosmetic = result.options.cosmetic;
  const cosmeticSide = cosmetic === 'core' ? -1 : 1;
  const gateSide = -cosmeticSide;
  const extra = textureDraftDeg(settings.textureDepth);
  const ribLimit = Math.max(0.5, s.nominal * 0.35);
  const plan = report.plan;
  const maxTime = plan?.maxTime || 1;
  const col = ctx.mesh.geometry.attributes.color.array;
  const tmp = new THREE.Color();
  const vThick = result.vertex.thick;
  const setTri = (t, c) => {
    for (let k = 0; k < 3; k++) {
      col[t * 9 + k * 3] = c.r;
      col[t * 9 + k * 3 + 1] = c.g;
      col[t * 9 + k * 3 + 2] = c.b;
    }
  };
  for (let t = 0; t < nt; t++) {
    const d = draft[t];
    const onCosmetic = cosmetic === 'both' || side[t] === cosmeticSide;
    const need = settings.draftMin + (onCosmetic ? extra : 0);
    const ribLike = side[t] === gateSide && Math.abs(S[t]) < 0.25;
    const thin = wall[t] < material.minWall && (!ribLike || wall[t] < ribLimit);
    const isWall = side[t] !== 0 && Math.abs(d) < 45;
    if (mode === 'thick') {
      if (thin) setTri(t, COL.thin);
      else {
        for (let k = 0; k < 3; k++) {
          thickColor(vThick[F[t * 3 + k]] / s.nominal, tmp);
          col[t * 9 + k * 3] = tmp.r;
          col[t * 9 + k * 3 + 1] = tmp.g;
          col[t * 9 + k * 3 + 2] = tmp.b;
        }
      }
      continue;
    }
    if (mode === 'flow') {
      for (let k = 0; k < 3; k++) {
        const f = plan ? plan.fill[F[t * 3 + k]] : -1;
        if (f < 0) tmp.copy(COL.base);
        else flowColor(f / maxTime, tmp);
        col[t * 9 + k * 3] = tmp.r;
        col[t * 9 + k * 3 + 1] = tmp.g;
        col[t * 9 + k * 3 + 2] = tmp.b;
      }
      continue;
    }
    let c = COL.base;
    if (mode === 'all') {
      if (side[t] === 0) c = COL.under;
      else if (thick[t] > s.thickLimit) c = COL.thick;
      else if (thin) c = COL.thin;
      else if (isWall && (d < -0.25 || d < need * 0.5)) c = COL.neg;
    } else if (mode === 'draft') {
      c = side[t] === 0 ? COL.under : !isWall ? COL.flat : d < -0.25 ? COL.neg : d < need * 0.5 ? COL.none : d < need ? COL.low : COL.ok;
    } else if (mode === 'under') {
      c = side[t] === 0 ? COL.under : side[t] > 0 ? COL.cav : COL.core;
    }
    setTri(t, c);
  }
  ctx.mesh.geometry.attributes.color.needsUpdate = true;

  const R = ctx.diag;
  // 파팅라인
  if (mode === 'all' || mode === 'under') {
    const segs = result.parting.segments, kinds = result.parting.kinds;
    const colors = [];
    const mainColor = C(document.documentElement.classList.contains('dark') ? '#f2f4f8' : '#16181d');
    for (let i = 0; i < kinds.length; i++) {
      const c = kinds[i] === 1 ? C('#e5484d') : kinds[i] === 2 ? C('#8e4ec6') : mainColor;
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    addLines(ctx, wrap, Array.from(segs), colors, 3);
    result.undercuts.forEach((u, i) => addLabel(ctx, `${u.type === 'slide' ? '슬라이드' : '리프터'} ${i + 1}`, u.center, '#d93a3f'));
  }
  // 빼기 방향 화살표
  const { up, front, right } = basis(result.pull.dir);
  const [bx0, by0, bz0, bx1, by1, bz1] = s.bbox;
  const half = new THREE.Vector3((bx1 - bx0) / 2, (by1 - by0) / 2, (bz1 - bz0) / 2);
  const along = (v) => Math.abs(v.x) * half.x + Math.abs(v.y) * half.y + Math.abs(v.z) * half.z;
  const base = ctx.center.clone()
    .add(right.clone().multiplyScalar(along(right) + R * 0.08))
    .add(front.clone().multiplyScalar(along(front)))
    .add(up.clone().multiplyScalar(-along(up)));
  ctx.overlay.add(new THREE.ArrowHelper(up, base, R * 0.3, 0x0066ff, R * 0.05, R * 0.03));
  addLabel(ctx, '↑ 고정측 · 빼기 방향', base.clone().add(up.clone().multiplyScalar(R * 0.36)).toArray(), '#0066FF', 0.8);
  // 게이트
  const gates = mode === 'flow' && plan ? plan.gates : result.gates;
  if (mode !== 'draft') {
    gates.forEach((g, i) => {
      const main = i === 0 || (mode === 'flow' && plan?.id === 'double');
      addBall(ctx, g.position, main ? 0x0066ff : 0x6d8fd8, R * (main ? 0.012 : 0.009));
      const labelPos = g.position.map((v, k) => v - result.pull.dir[k] * R * 0.05);
      addLabel(ctx, `G${i + 1}`, labelPos, main ? '#0066FF' : '#6d8fd8');
    });
  }
  // 웰드라인 · 에어트랩
  if (mode === 'flow' && plan) {
    const colors = [];
    for (let i = 0; i < plan.weld.length / 3; i++) colors.push(0.56, 0.31, 0.78);
    addLines(ctx, wrap, Array.from(plan.weld), colors, 4);
    plan.air.forEach((a) => addBall(ctx, a.position, a.atParting ? 0xf0a54a : 0xd94a00, R * 0.007));
  }
}

function Legend({ mode, result, report, inline = false }) {
  const s = result.summary;
  const m = report.material;
  const dm = report.settings.draftMin;
  const extra = textureDraftDeg(report.settings.textureDepth);
  const sw = (bg, text, kind = '') => (
    <div key={text} className="flex items-center gap-2 text-muted-foreground">
      <span className={`flex-none ${kind === 'line' ? 'h-[3px] w-3.5 rounded' : kind === 'dot' ? 'h-2.5 w-2.5 rounded-full' : 'h-2.5 w-3.5 rounded-sm'}`} style={{ background: bg }} />
      {text}
    </div>
  );
  const L = {
    all: ['종합', [sw('#e5484d', '언더컷'), sw('#f08a24', '두꺼움 · 수축 위험'), sw('#2f6fe4', '얇음 · 미성형 위험'), sw('#8e4ec6', '구배 부족 · 역구배'), sw('hsl(var(--foreground))', '파팅라인', 'line'), sw('#0066FF', '게이트 1순위', 'dot')]],
    draft: [`구배 (기준 ${dm}°${extra ? ` · 부식면 ${dm + extra}°` : ''})`, [sw('#3bb273', '기준 이상'), sw('#f2a33a', '기준 미만'), sw('#e5484d', '기준의 절반 미만'), sw('#8e4ec6', '역구배'), sw('#d5d9e0', '빼기 방향을 보는 면')]],
    under: ['언더컷 · 파팅라인', [sw('#9dbef7', '고정측 (캐비티)'), sw('#a5dcb9', '가동측 (코어)'), sw('#e5484d', '언더컷'), sw('hsl(var(--foreground))', '주 파팅라인', 'line'), sw('#e5484d', '곡면 위 파팅 (보일 위험)', 'line'), sw('#8e4ec6', '관통부 막음면', 'line')]],
    thick: [`살 두께 (기본 ${s.nominal.toFixed(2)}mm)`, [sw('#2f6fe4', `${m.minWall}mm 미만 · 미성형 위험`), sw('#3bb273', '기본 두께 근처'), sw('#d9c23a', '조금 두꺼움'), sw('#f08a24', `${s.thickLimit.toFixed(2)}mm 이상 · 수축 위험`), sw('#e5484d', '매우 두꺼움')]],
    flow: ['충전 순서 (근사)', [sw('linear-gradient(90deg,#2f6fe4,#3bb273,#d9c23a,#e5484d)', '먼저 → 나중에 채워짐'), sw('#8e4ec6', '웰드라인 예상', 'line'), sw('#d94a00', '가스 빼기 (벤트 필요)', 'dot'), sw('#f0a54a', '가스 빼기 (파팅면)', 'dot'), sw('#0066FF', '게이트', 'dot')]],
  }[mode];
  if (!L) return null;
  return (
    <div className={inline ? 'flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]' : 'grid gap-1 text-xs'}>
      <b className="text-foreground">{L[0]}</b>
      {L[1]}
    </div>
  );
}
