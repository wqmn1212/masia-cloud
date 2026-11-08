import React, { useEffect, useRef, useState } from 'react';
import { buildScene, disposeScene, renderBuiltFrame } from '@/lib/meshRenderer';

// 드래그 회전 · 휠 줌 3D 뷰 (공용 렌더러 한 개를 재사용)
export default function ModelCanvas({ mesh, color = 0xa8bad6 }) {
  const built = useRef(null);
  const drag = useRef(null);
  const [frame, setFrame] = useState(null);
  const [view, setView] = useState({ rotX: 0.5, rotY: 0.8, zoom: 1 });
  const [ready, setReady] = useState(0);

  useEffect(() => {
    if (!mesh?.positions?.length) return undefined;
    built.current = buildScene(mesh, { color });
    setReady((v) => v + 1);
    return () => { disposeScene(built.current); built.current = null; };
  }, [mesh, color]);

  useEffect(() => {
    if (!built.current) return undefined;
    const id = requestAnimationFrame(() => built.current && setFrame(renderBuiltFrame(built.current, { size: 900, ...view })));
    return () => cancelAnimationFrame(id);
  }, [view, ready]);

  return (
    <div
      className="aspect-square w-full rounded-xl bg-secondary flex items-center justify-center select-none touch-none cursor-grab active:cursor-grabbing overflow-hidden"
      onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, ...view }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => { const d = drag.current; if (d) setView({ rotX: d.rotX + (e.clientY - d.y) * 0.01, rotY: d.rotY + (e.clientX - d.x) * 0.01, zoom: d.zoom }); }}
      onPointerUp={() => { drag.current = null; }}
      onWheel={(e) => setView((v) => ({ ...v, zoom: Math.min(6, Math.max(0.3, v.zoom * (e.deltaY < 0 ? 1.1 : 0.9))) }))}
    >
      {frame ? <img src={frame} alt="3D 모델" className="w-full h-full object-contain pointer-events-none" draggable={false} /> : <p className="text-caption text-muted-foreground">그리는 중…</p>}
    </div>
  );
}