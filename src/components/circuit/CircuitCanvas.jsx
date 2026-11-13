import React, { useEffect, useRef } from 'react';
import { makePart, PARTS, terminals } from '@/lib/circuit/parts';
import { GRID, toScreen, drawPart, themeOf, voltColor, currentPaths, drawDots, dotSpeed, outline } from './draw';

const snap = (v) => Math.round(v);
const isDark = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

function distToSeg(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / l2)) : 0;
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

/** 부품을 그릴 끝점: 부품은 가로·세로로만, 가변저항은 짝수 길이 */
function placeEnd(type, start, end) {
  let dx = end.x - start.x, dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    if (type === 'ground') return { x: start.x, y: start.y + 1 };
    if (type === 'probe') return { x: start.x + 2, y: start.y - 2 };
    if (type === 'opamp') return { x: start.x + 6, y: start.y };
    return { x: start.x + 4, y: start.y };
  }
  if (type === 'probe') return end;
  if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0;
  if (type === 'pot' || ['npn', 'pnp', 'nmos', 'pmos'].includes(type)) {
    const len = Math.max(2, Math.abs(dx + dy));
    const even = type === 'pot' ? len + (len % 2) : len;
    if (dx) dx = Math.sign(dx) * even; else dy = Math.sign(dy) * even;
  }
  if (type === 'ground') { const l = Math.max(1, Math.abs(dx + dy)); if (dx) dx = Math.sign(dx) * Math.min(l, 2); else dy = Math.sign(dy) * Math.min(l, 2); }
  return { x: start.x + dx, y: start.y + dy };
}

/** 전선: 가로·세로가 아니면 ㄱ자 두 개 */
function wiresFor(start, end) {
  if (start.x === end.x && start.y === end.y) return [];
  if (start.x === end.x || start.y === end.y) return [makePart('wire', start.x, start.y, end.x, end.y)];
  return [makePart('wire', start.x, start.y, end.x, start.y), makePart('wire', end.x, start.y, end.x, end.y)];
}

export function hitTest(parts, gx, gy) {
  let best = null, bestD = 0.45;
  for (const p of parts) {
    const segs = outline(p);
    let d = Math.min(...segs.map(([a, b]) => distToSeg(gx, gy, a, b)));
    if (p.type === 'wire') d += 0.12; // 부품을 먼저 고르게
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

/**
 * 회로도 캔버스. 그리기와 마우스 조작을 맡는다.
 * 시뮬레이션은 simRef.current, 실행 여부·속도는 live ref 로 받아 매 프레임 진행한다.
 */
export default function CircuitCanvas({ circuit, onChange, selectedId, onSelect, tool, setTool, simRef, live, recorder, viewRef, onFrame, marks = [], showLive = true }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const props = useRef({});
  props.current = { circuit, onChange, selectedId, onSelect, tool, setTool, marks, showLive };
  const drag = useRef(null);
  const hover = useRef(null);
  const phases = useRef(new Map());

  // 크기 맞추기
  useEffect(() => {
    const wrap = wrapRef.current, cv = canvasRef.current;
    const fit = () => {
      const r = wrap.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
      cv.style.width = `${r.width}px`; cv.style.height = `${r.height}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // 그리기·진행 루프
  useEffect(() => {
    let raf, last = performance.now();
    const frame = (now) => {
      const dtFrame = Math.min(0.1, (now - last) / 1000);
      last = now;
      const sim = simRef.current;
      const L = live.current;
      if (sim && L.running && !sim.error) {
        for (let i = 0; i < L.steps; i++) {
          if (!sim.step()) break;
          recorder.sample(sim);
        }
        if (sim.error) L.onError?.(sim.error);
      }
      draw(dtFrame, L.running && !sim?.error);
      onFrame?.();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);  

  function draw(dtFrame, moving) {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const view = viewRef.current;
    const theme = themeOf(isDark());
    const { circuit: c, selectedId: sel, tool: tl, showLive: live2 } = props.current;
    // 정밀 해석 중에는 실시간 계산 값(멈춘 상태)을 섞어 보이지 않는다
    const sim = live2 === false ? null : simRef.current;
    const W = cv.width / dpr, H = cv.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, W, H);

    // 격자 점
    const sc = view.scale;
    if (sc >= 8) {
      ctx.fillStyle = theme.grid;
      const step = sc >= 14 ? 1 : 2;
      const gx0 = Math.floor(-view.ox / sc), gx1 = Math.ceil((W - view.ox) / sc), gy0 = Math.floor(-view.oy / sc), gy1 = Math.ceil((H - view.oy) / sc);
      for (let gx = gx0; gx <= gx1; gx++) {
        if (gx % step) continue;
        for (let gy = gy0; gy <= gy1; gy++) {
          if (gy % step) continue;
          ctx.fillRect(gx * sc + view.ox - 1, gy * sc + view.oy - 1, 2, 2);
        }
      }
    }

    // 전압 색 기준
    let vmax = 1;
    if (sim && !sim.error) for (let i = 0; i < sim.nNodes; i++) vmax = Math.max(vmax, Math.abs(sim.x[i]));
    const voltageAt = (t) => (sim ? sim.voltageAt(t.x, t.y) : null);
    const s = sc / GRID;
    const d = drag.current;
    const ghostId = d?.ghost ? d.id : null;

    const parts = c.parts || [];
    const wires = parts.filter((p) => p.type === 'wire');
    const others = parts.filter((p) => p.type !== 'wire');
    const hoverId = hover.current;
    const opts = (p) => ({ info: sim?.info(p.id), vmax, theme, selected: p.id === sel, hover: p.id === hoverId && p.id !== sel, voltageAt });
    // 전선은 노드 전압 색으로
    for (const w of wires) {
      if (w.id === ghostId) continue;
      const v = sim ? sim.voltageAt(w.x1, w.y1) : null;
      drawPart(ctx, w, view, { ...opts(w), info: { volts: [v, v] } });
    }
    for (const p of others) if (p.id !== ghostId) drawPart(ctx, p, view, opts(p));

    // 전선 연결점(셋 이상 만나는 곳) 표시
    if (sim) {
      const deg = new Map();
      sim.topo.segments.forEach((g) => { deg.set(g.a, (deg.get(g.a) || 0) + 1); deg.set(g.b, (deg.get(g.b) || 0) + 1); });
      others.forEach((p) => terminals(p).forEach((t) => { const k = `${t.x},${t.y}`; if (deg.has(k)) deg.set(k, deg.get(k) + 1); }));
      deg.forEach((n, k) => {
        if (n < 3) return;
        const [x, y] = k.split(',').map(Number), pt = toScreen(view, x, y);
        ctx.fillStyle = voltColor(sim.voltageAt(x, y), vmax, theme);
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 3.6 * s, 0, Math.PI * 2); ctx.fill();
      });
    }

    // 전류 점
    if (sim && !sim.error) {
      const ph = phases.current;
      const adv = (k, i) => { const v = (ph.get(k) || 0) + (moving ? dotSpeed(i) * dtFrame * s : 0); ph.set(k, v); return v; };
      sim.topo.segments.forEach((g, idx) => {
        const i = sim.wireI.get(idx) || 0;
        if (Math.abs(i) < 1e-6) return;
        drawDots(ctx, toScreen(view, g.ax, g.ay), toScreen(view, g.bx, g.by), adv(`w${g.wireId}:${g.ax},${g.ay}`, i), theme.dot, s);
      });
      for (const p of others) {
        if (p.id === ghostId) continue;
        currentPaths(p, sim.info(p.id)).forEach((path, k) => {
          if (Math.abs(path.i) < 1e-6) return;
          drawDots(ctx, toScreen(view, path.a.x, path.a.y), toScreen(view, path.b.x, path.b.y), adv(`${p.id}:${k}`, path.i), theme.dot, s);
        });
      }
    }

    // 정밀 해석 그래프에 올린 것 표시: 전류는 부품 테두리, 전압은 깃발
    const mk = props.current.marks || [];
    mk.filter((m) => m.partId).forEach((m) => {
      const part = parts.find((p) => p.id === m.partId);
      if (!part) return;
      ctx.save(); ctx.strokeStyle = m.color; ctx.globalAlpha = 0.45; ctx.lineWidth = 10 * s; ctx.lineCap = 'round';
      outline(part).forEach(([u, w]) => { const A = toScreen(view, u.x, u.y), B = toScreen(view, w.x, w.y); ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); });
      ctx.restore();
    });
    mk.filter((m) => m.at).forEach((m) => {
      const pt = toScreen(view, m.at.x, m.at.y);
      ctx.save();
      ctx.font = `600 ${Math.round(11 * s)}px ui-monospace, monospace`;
      const w = ctx.measureText(m.label).width + 10 * s, h = 17 * s;
      const x = pt.x + 6 * s, y = pt.y - h - 6 * s;
      ctx.fillStyle = m.color; ctx.globalAlpha = 0.95;
      ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(x, y + h); ctx.lineTo(x + 6 * s, y + h); ctx.closePath(); ctx.fill();
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.fillText(m.label, x + 5 * s, y + h / 2);
      ctx.restore();
    });

    // 끌고 있는 부품·새로 놓을 부품 미리보기
    ctx.save(); ctx.globalAlpha = 0.65;
    if (d?.ghost) d.ghost.forEach((g) => drawPart(ctx, g, view, { theme, vmax, selected: true }));
    ctx.restore();

    // 선택한 부품의 끝점 손잡이
    const selPart = parts.find((p) => p.id === sel);
    if (selPart && !ghostId && tl === 'select') {
      [[selPart.x1, selPart.y1], [selPart.x2, selPart.y2]].forEach(([x, y]) => {
        const pt = toScreen(view, x, y);
        ctx.fillStyle = theme.bg; ctx.strokeStyle = theme.sel; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
    }

    // 놓을 위치 표시
    if (tl !== 'select' && hover.cursor && !d) {
      const pt = toScreen(view, hover.cursor.x, hover.cursor.y);
      ctx.strokeStyle = theme.sel; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // ── 마우스 ──
  const toGrid = (e) => {
    const r = canvasRef.current.getBoundingClientRect(), view = viewRef.current;
    return { x: (e.clientX - r.left - view.ox) / view.scale, y: (e.clientY - r.top - view.oy) / view.scale, sx: e.clientX - r.left, sy: e.clientY - r.top };
  };

  const onPointerDown = (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    canvasRef.current.setPointerCapture(e.pointerId);
    const g = toGrid(e), sg = { x: snap(g.x), y: snap(g.y) };
    const { tool: tl, circuit: c, selectedId: sel } = props.current;
    const view = viewRef.current;
    if (e.button === 1) { drag.current = { kind: 'pan', sx: g.sx, sy: g.sy, ox: view.ox, oy: view.oy, moved: true }; return; }
    if (tl !== 'select') { drag.current = { kind: 'create', type: tl, start: sg, end: sg, ghost: [] }; updateCreateGhost(); return; }
    const selPart = (c.parts || []).find((p) => p.id === sel);
    if (selPart) {
      const near = [[selPart.x1, selPart.y1, 1], [selPart.x2, selPart.y2, 2]].find(([x, y]) => Math.hypot(g.x - x, g.y - y) < 0.4);
      if (near) { drag.current = { kind: 'end', id: sel, which: near[2], orig: selPart, moved: false }; return; }
    }
    const hit = hitTest(c.parts || [], g.x, g.y);
    if (hit) {
      props.current.onSelect(hit.id);
      drag.current = { kind: 'move', id: hit.id, start: sg, orig: hit, moved: false };
      return;
    }
    drag.current = { kind: 'pan', sx: g.sx, sy: g.sy, ox: view.ox, oy: view.oy, moved: false };
  };

  function updateCreateGhost() {
    const d = drag.current;
    if (d.type === 'wire') d.ghost = wiresFor(d.start, d.end);
    else { const e2 = placeEnd(d.type, d.start, d.end); d.ghost = [makePart(d.type, d.start.x, d.start.y, e2.x, e2.y)]; }
    d.id = '__new__';
  }

  const onPointerMove = (e) => {
    const g = toGrid(e), sg = { x: snap(g.x), y: snap(g.y) };
    const d = drag.current;
    hover.cursor = sg;
    if (!d) {
      const hit = props.current.tool === 'select' ? hitTest(props.current.circuit.parts || [], g.x, g.y) : null;
      hover.current = hit?.id || null;
      canvasRef.current.style.cursor = props.current.tool !== 'select' ? 'crosshair' : hit ? (hit.type === 'switch' ? 'pointer' : 'move') : 'grab';
      return;
    }
    if (d.kind === 'pan') {
      const view = viewRef.current;
      if (Math.hypot(g.sx - d.sx, g.sy - d.sy) > 3) d.moved = true;
      view.ox = d.ox + (g.sx - d.sx); view.oy = d.oy + (g.sy - d.sy);
      canvasRef.current.style.cursor = 'grabbing';
    } else if (d.kind === 'create') {
      d.end = sg; updateCreateGhost();
    } else if (d.kind === 'move') {
      const dx = sg.x - d.start.x, dy = sg.y - d.start.y;
      if (dx || dy) d.moved = true;
      if (d.moved) d.ghost = [{ ...d.orig, x1: d.orig.x1 + dx, y1: d.orig.y1 + dy, x2: d.orig.x2 + dx, y2: d.orig.y2 + dy }];
    } else if (d.kind === 'end') {
      const o = d.orig;
      let np;
      if (o.type === 'wire') np = d.which === 1 ? { ...o, x1: sg.x, y1: sg.y } : { ...o, x2: sg.x, y2: sg.y };
      else if (d.which === 2) { const e2 = placeEnd(o.type, { x: o.x1, y: o.y1 }, sg); np = { ...o, x2: e2.x, y2: e2.y }; }
      else { const e1 = placeEnd(o.type, { x: o.x2, y: o.y2 }, sg); np = { ...o, x1: e1.x, y1: e1.y }; }
      if (np.x1 === np.x2 && np.y1 === np.y2) return;
      d.moved = true;
      d.ghost = [np];
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const { circuit: c, onChange, onSelect } = props.current;
    const parts = c.parts || [];
    if (d.kind === 'pan') { if (!d.moved) onSelect(null); return; }
    if (d.kind === 'create') {
      const add = d.ghost || [];
      if (!add.length) return;
      onChange({ ...c, parts: [...parts, ...add] });
      onSelect(add[add.length - 1].id);
      return;
    }
    if ((d.kind === 'move' || d.kind === 'end') && d.moved && d.ghost) {
      const np = d.ghost[0];
      onChange({ ...c, parts: parts.map((p) => (p.id === d.id ? np : p)) });
      return;
    }
    if (d.kind === 'move' && !d.moved && d.orig.type === 'switch') {
      onChange({ ...c, parts: parts.map((p) => (p.id === d.id ? { ...p, props: { ...p.props, closed: !p.props?.closed } } : p)) });
    }
  };

  const onWheel = (e) => {
    e.preventDefault();
    const view = viewRef.current;
    const r = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const k = Math.exp(-e.deltaY * 0.0015);
    const ns = Math.max(6, Math.min(60, view.scale * k));
    view.ox = mx - ((mx - view.ox) * ns) / view.scale;
    view.oy = my - ((my - view.oy) * ns) / view.scale;
    view.scale = ns;
  };

  // 휠은 passive 가 아니어야 화면 스크롤을 막을 수 있다
  useEffect(() => {
    const cv = canvasRef.current;
    cv.addEventListener('wheel', onWheel, { passive: false });
    return () => cv.removeEventListener('wheel', onWheel);
  }, []);  

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden rounded-xl border bg-card">
      <canvas
        ref={canvasRef}
        className="block touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => { hover.current = null; hover.cursor = null; }}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="회로도 편집 화면"
      />
      {tool !== 'select' && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-primary/10 px-2.5 py-1 text-caption font-medium text-primary">
          {PARTS[tool]?.label} 놓기 · 끌어서 길이·방향 정하기 · Esc 로 끝내기
        </div>
      )}
    </div>
  );
}

/** 회로가 화면 가운데 오도록 보기 맞추기 */
export function fitView(view, parts, width, height) {
  if (!parts?.length) { view.scale = GRID; view.ox = width / 2; view.oy = height / 2; return; }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  parts.forEach((p) => terminals(p).concat([{ x: p.x1, y: p.y1 }, { x: p.x2, y: p.y2 }]).forEach((t) => {
    x0 = Math.min(x0, t.x); y0 = Math.min(y0, t.y); x1 = Math.max(x1, t.x); y1 = Math.max(y1, t.y);
  }));
  const pad = 3;
  const sc = Math.max(8, Math.min(32, Math.min(width / (x1 - x0 + pad * 2), height / (y1 - y0 + pad * 2))));
  view.scale = sc;
  view.ox = width / 2 - ((x0 + x1) / 2) * sc;
  view.oy = height / 2 - ((y0 + y1) / 2) * sc;
}
