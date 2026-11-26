import React, { useEffect, useRef, useState } from 'react';
import { buildPartsScene, disposePartsScene, pickLocalPoint, projectLocal, applyView, viewSpan } from '@/lib/measure3d';
import { renderSceneFrame } from '@/lib/meshRenderer';

// 3D 검토 무대: 회전·확대 + 클릭한 지점을 모델 좌표로 돌려주고, 찍은 점·측정선을 프레임 위에 겹쳐 그린다.
export default function MeasureCanvas({ parts, bounds, visible, selectedPart, view, setView, picks = [], overlays = [], picking = false, onPick }) {
  const builtRef = useRef(null);
  const dragRef = useRef(null);
  const [frame, setFrame] = useState('');
  const [tick, setTick] = useState(0);
  const [miss, setMiss] = useState('');
  const boxRef = useRef(null);

  // 휠 확대·축소 — 페이지가 같이 스크롤되지 않게 passive 가 아닌 리스너로 막는다
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      setView((v) => ({ ...v, zoom: Math.min(12, Math.max(0.3, v.zoom * (e.deltaY < 0 ? 1.1 : 0.9))) }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setView]);

  useEffect(() => {
    if (!parts?.length) return undefined;
    const built = buildPartsScene(parts, visible, selectedPart, bounds);
    builtRef.current = built;
    setTick((v) => v + 1);
    return () => { disposePartsScene(built); builtRef.current = null; };
  }, [parts, bounds, visible, selectedPart]);

  useEffect(() => {
    const built = builtRef.current;
    if (!built) return undefined;
    const id = requestAnimationFrame(() => {
      const camera = applyView(built.root, view);
      setFrame(renderSceneFrame(built.scene, built.radius, { size: 900, camera }));
    });
    return () => cancelAnimationFrame(id);
  }, [view, tick]);

  const built = builtRef.current;
  const screenOf = (p) => (built ? projectLocal({ root: built.root, radius: built.radius, view, point: p }) : null);
  const pickPoints = picks.map(screenOf).filter((s) => s && s.visible);
  const overlayLines = overlays.map((pts) => pts.map(screenOf).filter((s) => s && s.visible));

  const pointerDown = (e) => {
    // 왼쪽 드래그 = 회전, 오른쪽(또는 가운데) 드래그 = 카메라 이동, 왼쪽 클릭(움직임 없음) = 점 찍기
    const pan = e.button === 2 || e.button === 1;
    dragRef.current = {
      x: e.clientX, y: e.clientY, moved: 0, pan,
      width: e.currentTarget.getBoundingClientRect().width || 1,
      rotX: view.rotX, rotY: view.rotY, panX: view.panX || 0, panY: view.panY || 0,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const pointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.moved = Math.max(d.moved, Math.hypot(dx, dy));
    if (d.pan) {
      const span = viewSpan(builtRef.current?.radius || 1, view.zoom) / d.width;
      setView((v) => ({ ...v, panX: d.panX - dx * span, panY: d.panY + dy * span }));
    } else {
      setView((v) => ({ ...v, rotX: d.rotX + dy * 0.01, rotY: d.rotY + dx * 0.01 }));
    }
  };

  const pointerUp = (e) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || d.pan || d.moved > 6 || !picking) return;
    const scene = builtRef.current;
    if (!scene) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const hit = pickLocalPoint({
      root: scene.root,
      radius: scene.radius,
      view,
      nx: (e.clientX - rect.left) / rect.width,
      ny: (e.clientY - rect.top) / rect.height,
    });
    if (hit) onPick(hit);
    else {
      setMiss('모델 위를 찍어 주세요');
      window.setTimeout(() => setMiss(''), 1600);
    }
  };

  return (
    <div
      className={`relative aspect-square w-full select-none touch-none overflow-hidden rounded-xl bg-secondary ${picking ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={() => { dragRef.current = null; }}
      onContextMenu={(e) => e.preventDefault()}
      ref={boxRef}
    >
      {frame
        ? <img src={frame} alt="3D 모델" className="pointer-events-none h-full w-full object-contain" draggable={false} />
        : <div className="flex h-full items-center justify-center text-caption text-muted-foreground">그리는 중…</div>}
      <svg viewBox="0 0 1000 1000" className="pointer-events-none absolute inset-0 h-full w-full">
        {overlayLines.map((pts, i) => (pts.length > 1 ? (
          <polyline
            key={`overlay-${i}`}
            points={pts.map((s) => `${s.x * 1000},${s.y * 1000}`).join(' ')}
            fill="none"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth="2.5"
            strokeDasharray="7 7"
          />
        ) : null))}
        {pickPoints.length > 1 && (
          <polyline
            points={pickPoints.map((s) => `${s.x * 1000},${s.y * 1000}`).join(' ')}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="3"
          />
        )}
        {pickPoints.map((s, i) => (
          <g key={`pick-${i}`}>
            <circle cx={s.x * 1000} cy={s.y * 1000} r="13" fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth="4" />
            <text x={s.x * 1000} y={s.y * 1000 + 8} textAnchor="middle" fontSize="20" fontWeight="700" fill="hsl(var(--primary))">{i + 1}</text>
          </g>
        ))}
      </svg>
      {miss && (
        <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-foreground/85 px-3 py-1 text-micro text-background">{miss}</p>
      )}
    </div>
  );
}