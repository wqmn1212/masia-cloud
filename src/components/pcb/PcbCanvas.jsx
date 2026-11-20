import React, { useEffect, useRef } from 'react';
import { padShape } from '@/lib/pcbArt/board';
import { pointSeg, dist, closestOnSeg } from '@/lib/pcbArt/geom';
import { itemsAt } from '@/lib/pcbArt/connectivity';

// 기판 그림 색 (KiCad 기본 색에 가깝게 — 기판 그림은 테마와 상관없이 같은 색)
export const LAYER_COLOR = { 'F.Cu': '#c8423b', 'B.Cu': '#3e74d6', 'In1.Cu': '#c9a227', 'In2.Cu': '#3fae6b', 'F.SilkS': '#ececec', 'B.SilkS': '#b49be6' };
const C = { bg: '#0f1318', board: '#16382a', edge: '#e6d97a', pad: '#d4a72c', via: '#cfcfcf', hole: '#0f1318', rats: '#f4f19a', drc: '#ff3b30', sel: '#ffffff', route: '#ffffff' };
const GRID = 0.1;
const snap = (v, g = GRID) => Math.round(v / g) * g;

/** 꺾은 배선: 대각선 한 번 + 곧은 길 (45°) */
function route45(a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  if (Math.abs(dx) < 1e-9 || Math.abs(dy) < 1e-9 || Math.abs(Math.abs(dx) - Math.abs(dy)) < 1e-9) return [b];
  const m = Math.abs(dx) > Math.abs(dy) ? [a[0] + Math.sign(dx) * (Math.abs(dx) - Math.abs(dy)), a[1]] : [a[0], a[1] + Math.sign(dy) * (Math.abs(dy) - Math.abs(dx))];
  return [m, b];
}

/**
 * PCB 아트웍 캔버스: 층·패드·트랙·비아·동박면·실크·미연결선·검사 표시·시뮬레이션 색을 그리고,
 * 고르기(부품·트랙·비아)·부품 끌어 옮기기·배선(45°, V 로 비아 놓고 층 바꾸기)·비아 놓기를 한다.
 */
export default function PcbCanvas({ board, conn, drc = [], visible, activeLayer, tool, routeWidth, selected, highlightNet, simOverlay, focus, onSelect, onMoveFootprint, onRoute, onAddVia, onLayer, onCursor }) {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const view = useRef({ scale: 8, ox: 0, oy: 0, fitted: null });
  const st = useRef({});
  const props = useRef({});
  props.current = { board, conn, drc, visible, activeLayer, tool, routeWidth, selected, highlightNet, simOverlay, onSelect, onMoveFootprint, onRoute, onAddVia, onLayer, onCursor };
  const drawRef = useRef(() => {});

  // 기판이 바뀌면(새 파일) 화면에 맞춘다
  const fit = () => {
    const b = props.current.board, host = hostRef.current;
    if (!b || !host) return;
    const pts = b.outline[0] || b.footprints.flatMap((f) => f.pads.map((p) => p.at));
    if (!pts.length) return;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const w = host.clientWidth, h = host.clientHeight;
    const s = Math.min(w / (x1 - x0 + 6), h / (y1 - y0 + 6));
    view.current = { ...view.current, scale: s, ox: (x0 + x1) / 2 - w / (2 * s), oy: (y0 + y1) / 2 - h / (2 * s) };
  };

  useEffect(() => {
    const host = hostRef.current, cv = canvasRef.current;
    const ctx = cv.getContext('2d');
    const toW = (sx, sy) => [sx / view.current.scale + view.current.ox, sy / view.current.scale + view.current.oy];
    const toS = (p) => [(p[0] - view.current.ox) * view.current.scale, (p[1] - view.current.oy) * view.current.scale];

    const draw = () => {
      const P = props.current, b = P.board;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = host.clientWidth, h = host.clientHeight;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = `${w}px`; cv.style.height = `${h}px`; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
      if (!b) return;
      const s = view.current.scale;
      ctx.setTransform(dpr * s, 0, 0, dpr * s, -view.current.ox * s * dpr, -view.current.oy * s * dpr);
      const px = 1 / s; // 화면 1 픽셀
      const V = P.visible || {};
      const dimNet = (net) => P.highlightNet && net !== P.highlightNet;
      const poly = (pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); };
      // 기판 바탕 (바깥 외곽, 안쪽 구멍은 비움)
      if (b.outline.length) {
        ctx.beginPath();
        b.outline.forEach((loop) => loop.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))));
        ctx.fillStyle = C.board; ctx.fill('evenodd');
        ctx.strokeStyle = C.edge; ctx.lineWidth = 2 * px; b.outline.forEach((loop) => { poly(loop); ctx.stroke(); });
      }
      const order = [...b.copper].reverse().filter((l) => l !== P.activeLayer).concat(b.copper.includes(P.activeLayer) ? [P.activeLayer] : []);
      const sim = P.simOverlay;
      for (const L of order) {
        if (V[L] === false) continue;
        const col = LAYER_COLOR[L] || '#999';
        const faded = L !== P.activeLayer;
        // 동박면
        if (V.zones !== false) for (const a of P.conn?.areas || []) if (a.layer === L) { ctx.globalAlpha = (dimNet(a.net) ? 0.08 : a.approx ? 0.14 : 0.3) * (faded ? 0.7 : 1); ctx.fillStyle = col; poly(a.pts); ctx.fill(); if (a.approx) { ctx.globalAlpha = 0.6; ctx.setLineDash([4 * px, 3 * px]); ctx.strokeStyle = col; ctx.lineWidth = px; ctx.stroke(); ctx.setLineDash([]); } }
        // 트랙
        ctx.lineCap = 'round';
        for (const t of b.tracks) {
          if (t.layer !== L) continue;
          ctx.globalAlpha = (dimNet(t.net) ? 0.18 : 1) * (faded ? 0.6 : 1);
          ctx.strokeStyle = sim?.trackColor?.(t.id) || col; ctx.lineWidth = t.w;
          ctx.beginPath(); ctx.moveTo(t.a[0], t.a[1]); ctx.lineTo(t.b[0], t.b[1]); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      // 패드
      for (const f of b.footprints) for (const p of f.pads) {
        if (!p.layers.length) { // 무도금 구멍
          if (p.drill) { ctx.fillStyle = C.hole; ctx.beginPath(); ctx.arc(p.at[0], p.at[1], p.drill.w / 2, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#555'; ctx.lineWidth = px; ctx.stroke(); }
          continue;
        }
        if (!p.layers.some((l) => V[l] !== false)) continue;
        const onActive = p.layers.includes(P.activeLayer);
        ctx.globalAlpha = (dimNet(p.net) ? 0.2 : 1) * (onActive ? 1 : 0.55);
        ctx.fillStyle = p.layers.length > 1 ? C.pad : (LAYER_COLOR[p.layers[0]] && p.layers[0] === 'B.Cu' ? '#6d93d8' : C.pad);
        const sh = padShape(p);
        if (sh.kind === 'cap') { ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = sh.r * 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sh.a[0], sh.a[1]); ctx.lineTo(sh.b[0] + 1e-4, sh.b[1]); ctx.stroke(); } else { poly(sh.pts); ctx.fill(); }
        if (p.drill) { ctx.globalAlpha = 1; ctx.fillStyle = C.hole; ctx.beginPath(); ctx.arc(p.at[0], p.at[1], Math.min(p.drill.w, p.drill.h) / 2, 0, Math.PI * 2); ctx.fill(); }
      }
      // 비아
      for (const v of b.vias) {
        ctx.globalAlpha = dimNet(v.net) ? 0.2 : 1;
        ctx.fillStyle = C.via; ctx.beginPath(); ctx.arc(v.at[0], v.at[1], v.size / 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.hole; ctx.beginPath(); ctx.arc(v.at[0], v.at[1], v.drill / 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // 실크·부품 테두리
      for (const SL of ['B.SilkS', 'F.SilkS']) {
        if (V[SL] === false) continue;
        ctx.strokeStyle = LAYER_COLOR[SL]; ctx.globalAlpha = SL === 'B.SilkS' ? 0.5 : 0.85;
        for (const f of b.footprints) for (const g of f.graphics) {
          if (g.layer !== SL) continue;
          ctx.lineWidth = Math.max(g.width, px);
          if (g.kind === 'circle') { ctx.beginPath(); ctx.arc(g.c[0], g.c[1], g.r, 0, Math.PI * 2); ctx.stroke(); } else { ctx.beginPath(); g.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); if (g.closed) ctx.closePath(); ctx.stroke(); }
        }
      }
      ctx.globalAlpha = 1;
      // 부품 이름 (충분히 확대했을 때)
      if (V.refs !== false && s > 6) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `${11 * px}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const f of b.footprints) ctx.fillText(f.ref, f.x, f.y);
      }
      // 시뮬레이션: 서멀 스포크 온도 점
      for (const m of sim?.markers || []) { ctx.globalAlpha = 0.9; ctx.fillStyle = m.color; ctx.beginPath(); ctx.arc(m.at[0], m.at[1], 6 * px, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
      // 미연결선
      if (V.ratsnest !== false) {
        ctx.strokeStyle = C.rats; ctx.lineWidth = px; ctx.globalAlpha = 0.85;
        for (const u of P.conn?.unrouted || []) { if (dimNet(u.net)) continue; ctx.beginPath(); ctx.moveTo(u.a[0], u.a[1]); ctx.lineTo(u.b[0], u.b[1]); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
      // 검사 표시
      if (V.drc !== false) for (const d of P.drc) {
        if (!d.at || d.code === 'unrouted') continue;
        ctx.strokeStyle = d.sev === 'error' ? C.drc : d.sev === 'warn' ? '#ff9f0a' : '#64d2ff'; ctx.lineWidth = 2 * px;
        ctx.beginPath(); ctx.arc(d.at[0], d.at[1], 7 * px, 0, Math.PI * 2); ctx.stroke();
      }
      // 고른 것
      const sel = P.selected;
      ctx.strokeStyle = C.sel; ctx.lineWidth = 2 * px; ctx.setLineDash([5 * px, 3 * px]);
      if (sel?.type === 'fp') { const f = b.footprints[sel.index]; if (f) { const bx = fpBox(f, st.current.drag?.index === sel.index ? st.current.drag.d : [0, 0]); ctx.strokeRect(bx[0], bx[1], bx[2] - bx[0], bx[3] - bx[1]); } }
      if (sel?.type === 'track') { const t = b.tracks.find((x) => x.id === sel.id); if (t) { ctx.lineWidth = t.w + 4 * px; ctx.globalAlpha = 0.35; ctx.strokeStyle = C.sel; ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(t.a[0], t.a[1]); ctx.lineTo(t.b[0], t.b[1]); ctx.stroke(); ctx.globalAlpha = 1; } }
      if (sel?.type === 'via') { const v = b.vias.find((x) => x.id === sel.id); if (v) { ctx.beginPath(); ctx.arc(v.at[0], v.at[1], v.size / 2 + 3 * px, 0, Math.PI * 2); ctx.stroke(); } }
      ctx.setLineDash([]);
      // 끌어 옮기는 부품 미리보기
      const dg = st.current.drag;
      if (dg && b.footprints[dg.index]) {
        ctx.globalAlpha = 0.6; ctx.fillStyle = C.sel;
        for (const p of b.footprints[dg.index].pads) { ctx.beginPath(); ctx.arc(p.at[0] + dg.d[0], p.at[1] + dg.d[1], Math.max(p.size.w, p.size.h) / 2, 0, Math.PI * 2); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
      // 배선 중
      const r = st.current.route;
      if (r) {
        ctx.strokeStyle = LAYER_COLOR[r.layer] || C.route; ctx.lineWidth = P.routeWidth; ctx.lineCap = 'round'; ctx.globalAlpha = 0.9;
        const pts = [...r.points, ...(r.cursor ? route45(r.points[r.points.length - 1], r.cursor) : [])];
        ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
        for (const v of r.vias) { ctx.fillStyle = C.via; ctx.beginPath(); ctx.arc(v[0], v[1], 0.3, 0, Math.PI * 2); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    };
    drawRef.current = draw;

    const ro = new ResizeObserver(() => { if (!view.current.fitted) { fit(); view.current.fitted = true; } draw(); });
    ro.observe(host);

    // 고르기
    const pick = (p) => {
      const P = props.current, b = P.board;
      if (!b) return null;
      const tol = 4 / view.current.scale;
      const L = P.activeLayer;
      const via = b.vias.find((v) => dist(v.at, p) <= v.size / 2 + tol);
      if (via) return { type: 'via', id: via.id, net: via.net };
      const tr = [...b.tracks].sort((a2, c) => (c.layer === L) - (a2.layer === L)).find((t) => P.visible?.[t.layer] !== false && pointSeg(p, t.a, t.b) <= t.w / 2 + tol);
      if (tr) return { type: 'track', id: tr.id, net: tr.net };
      const fps = b.footprints.map((f) => ({ f, box: fpBox(f) })).filter(({ box }) => p[0] >= box[0] && p[0] <= box[2] && p[1] >= box[1] && p[1] <= box[3]);
      fps.sort((a2, c) => (a2.box[2] - a2.box[0]) * (a2.box[3] - a2.box[1]) - (c.box[2] - c.box[0]) * (c.box[3] - c.box[1]));
      if (fps[0]) { const pad = fps[0].f.pads.find((q) => dist(q.at, p) <= Math.max(q.size.w, q.size.h) / 2 + tol); return { type: 'fp', index: fps[0].f.index, net: pad?.net || 0, pad: pad ? `${pad.num}` : null }; }
      return null;
    };
    // 배선 시작·끝에 붙일 점: 패드 중심·비아 중심·트랙 위 가장 가까운 점
    const anchorAt = (p, layer, net = null) => {
      const P = props.current;
      const tol = 4 / view.current.scale;
      const hits = itemsAt(P.conn?.items || [], p, layer, tol).filter((it) => net == null || it.net === net);
      const it = hits.find((x) => x.kind === 'pad') || hits.find((x) => x.kind === 'via') || hits[0];
      if (!it) return null;
      if (it.kind === 'pad') return { at: it.pad.at, net: it.net };
      if (it.kind === 'via') return { at: it.via.at, net: it.net };
      return { at: closestOnSeg(p, it.track.a, it.track.b), net: it.net };
    };
    const finishRoute = () => {
      const r = st.current.route;
      st.current.route = null;
      if (!r || r.points.length < 2) { draw(); return; }
      const segs = [];
      for (let i = 1; i < r.points.length; i++) if (dist(r.points[i - 1], r.points[i]) > 1e-6) segs.push({ a: r.points[i - 1], b: r.points[i], layer: r.layers[i] || r.layer, net: r.net });
      props.current.onRoute?.({ segments: segs, vias: r.vias.map((at) => ({ at, net: r.net })) });
      draw();
    };

    let down = null;
    const pos = (e) => { const rc = cv.getBoundingClientRect(); return toW(e.clientX - rc.left, e.clientY - rc.top); };
    const onDown = (e) => {
      cv.focus();
      const P = props.current;
      const p = pos(e);
      down = { sx: e.clientX, sy: e.clientY, ox: view.current.ox, oy: view.current.oy, p, button: e.button };
      if (e.button === 1 || e.button === 2 || e.shiftKey) { down.pan = true; return; }
      if (P.tool === 'route') {
        const r = st.current.route;
        if (!r) {
          const an = anchorAt(p, P.activeLayer);
          if (!an) { down.pan = true; return; } // 빈 곳에서 시작하면 화면 이동
          st.current.route = { net: an.net, layer: P.activeLayer, points: [an.at], layers: [P.activeLayer], vias: [], cursor: an.at };
        } else {
          const end = anchorAt(p, r.layer, r.net);
          const target = end ? end.at : [snap(p[0]), snap(p[1])];
          for (const q of route45(r.points[r.points.length - 1], target)) { r.points.push(q); r.layers.push(r.layer); }
          if (end) finishRoute();
        }
        draw(); return;
      }
      if (P.tool === 'via') {
        const an = anchorAt(p, null);
        if (an) P.onAddVia?.({ at: an.at, net: an.net }); else P.onSelect?.(null);
        return;
      }
      const hit = pick(p);
      P.onSelect?.(hit);
      if (hit?.type === 'fp') { st.current.drag = { index: hit.index, start: p, d: [0, 0], moved: false }; }
      else down.pan = !hit;
    };
    const onMove = (e) => {
      const P = props.current;
      const p = pos(e);
      P.onCursor?.(p);
      if (down?.pan) {
        view.current.ox = down.ox - (e.clientX - down.sx) / view.current.scale;
        view.current.oy = down.oy - (e.clientY - down.sy) / view.current.scale;
        draw(); return;
      }
      const dg = st.current.drag;
      if (dg && down) { dg.d = [snap(p[0] - dg.start[0]), snap(p[1] - dg.start[1])]; dg.moved = dg.moved || Math.hypot(e.clientX - down.sx, e.clientY - down.sy) > 3; draw(); return; }
      if (st.current.route) { st.current.route.cursor = [snap(p[0]), snap(p[1])]; draw(); }
    };
    const onUp = () => {
      const dg = st.current.drag;
      if (dg) {
        st.current.drag = null;
        const f = props.current.board?.footprints[dg.index];
        if (dg.moved && f && (dg.d[0] || dg.d[1])) props.current.onMoveFootprint?.(dg.index, Math.round((f.x + dg.d[0]) * 1000) / 1000, Math.round((f.y + dg.d[1]) * 1000) / 1000);
        draw();
      }
      down = null;
    };
    const onWheel = (e) => {
      e.preventDefault();
      const rc = cv.getBoundingClientRect();
      const sx = e.clientX - rc.left, sy = e.clientY - rc.top;
      const before = toW(sx, sy);
      const k = Math.exp(-e.deltaY * 0.0015);
      view.current.scale = Math.max(1, Math.min(400, view.current.scale * k));
      view.current.ox = before[0] - sx / view.current.scale;
      view.current.oy = before[1] - sy / view.current.scale;
      draw();
    };
    const onKey = (e) => {
      const r = st.current.route;
      if (!r) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') { st.current.route = null; draw(); }
      else if (k === 'enter') { e.preventDefault(); if (r.cursor) for (const q of route45(r.points[r.points.length - 1], r.cursor)) { r.points.push(q); r.layers.push(r.layer); } finishRoute(); }
      else if (k === 'backspace') { e.preventDefault(); if (r.points.length > 1) { r.points.pop(); r.layers.pop(); } else st.current.route = null; draw(); }
      else if (k === 'v') {
        // 지금 끝점에 비아를 놓고 다른 층으로
        e.preventDefault();
        if (r.cursor) for (const q of route45(r.points[r.points.length - 1], r.cursor)) { r.points.push(q); r.layers.push(r.layer); }
        const at = r.points[r.points.length - 1];
        r.vias.push(at);
        const B = props.current.board;
        const next = B.copper.find((l) => l !== r.layer) || r.layer;
        r.layer = next;
        props.current.onLayer?.(next);
        draw();
      }
    };
    const onDbl = () => { if (st.current.route) finishRoute(); };
    cv.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    cv.addEventListener('wheel', onWheel, { passive: false });
    cv.addEventListener('keydown', onKey);
    cv.addEventListener('dblclick', onDbl);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    return () => {
      ro.disconnect();
      cv.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
      cv.removeEventListener('wheel', onWheel); cv.removeEventListener('keydown', onKey); cv.removeEventListener('dblclick', onDbl);
    };
  }, []);

  // 새 기판이면 화면 맞추기
  useEffect(() => { view.current.fitted = null; if (hostRef.current?.clientWidth) { fit(); view.current.fitted = true; } drawRef.current(); }, [board?.doc]);
  // 다시 그리기
  useEffect(() => { drawRef.current(); }, [board, conn, drc, visible, activeLayer, selected, highlightNet, simOverlay, routeWidth]);
  // 도구를 바꾸면 하던 배선을 접는다
  useEffect(() => { st.current.route = null; drawRef.current(); }, [tool]);
  // 검사 결과 등을 눌렀을 때 그 자리로
  useEffect(() => {
    if (!focus?.at || !hostRef.current) return;
    const w = hostRef.current.clientWidth, h = hostRef.current.clientHeight;
    const s = Math.max(view.current.scale, focus.scale || 20);
    view.current = { ...view.current, scale: s, ox: focus.at[0] - w / (2 * s), oy: focus.at[1] - h / (2 * s) };
    drawRef.current();
  }, [focus]);

  return (
    <div ref={hostRef} className="absolute inset-0">
      <canvas ref={canvasRef} tabIndex={0} aria-label="기판 아트웍" className={`block outline-none ${tool === 'route' || tool === 'via' ? 'cursor-crosshair' : 'cursor-default'}`} />
    </div>
  );
}

/** 부품 범위 상자 (패드 + 실크·외형 그림) */
export function fpBox(f, d = [0, 0]) {
  const xs = [], ys = [];
  for (const p of f.pads) { const r = Math.max(p.size.w, p.size.h) / 2; xs.push(p.at[0] - r, p.at[0] + r); ys.push(p.at[1] - r, p.at[1] + r); }
  for (const g of f.graphics) if (/CrtYd|Fab/.test(g.layer)) { if (g.kind === 'circle') { xs.push(g.c[0] - g.r, g.c[0] + g.r); ys.push(g.c[1] - g.r, g.c[1] + g.r); } else g.pts.forEach((p) => { xs.push(p[0]); ys.push(p[1]); }); }
  if (!xs.length) return [f.x - 1 + d[0], f.y - 1 + d[1], f.x + 1 + d[0], f.y + 1 + d[1]];
  return [Math.min(...xs) + d[0], Math.min(...ys) + d[1], Math.max(...xs) + d[0], Math.max(...ys) + d[1]];
}
