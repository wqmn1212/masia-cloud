import React, { useEffect, useRef, useState } from 'react';
import { renderBuiltFrame } from '@/lib/meshRenderer';
import { applyPoses, buildAssembly, disposeAssembly } from '@/lib/simScene';

// 부품별 회전·이동을 적용해 공용 렌더러로 프레임을 그린다 (드래그 회전·휠 확대)
export default function SimPlayer({ parts, poses, highlightId }) {
  const asm = useRef(null);
  const drag = useRef(null);
  const [frame, setFrame] = useState(null);
  const [view, setView] = useState({ rotX: 0.5, rotY: 0.8, zoom: 1 });
  const [ready, setReady] = useState(0);

  useEffect(() => {
    if (!parts?.length) return undefined;
    asm.current = buildAssembly(parts);
    setReady((v) => v + 1);
    return () => { disposeAssembly(asm.current); asm.current = null; };
  }, [parts]);

  useEffect(() => {
    if (!asm.current) return undefined;
    const id = requestAnimationFrame(() => {
      if (!asm.current) return;
      applyPoses(asm.current, poses, highlightId);
      setFrame(renderBuiltFrame(asm.current, { size: 640, ...view }));
    });
    return () => cancelAnimationFrame(id);
  }, [poses, highlightId, view, ready]);

  if (!parts?.length) {
    return <div className="aspect-square w-full rounded-xl bg-secondary flex items-center justify-center p-6 text-center text-caption text-muted-foreground">위 3D 검토에서 이 시나리오의 STEP·STL 모델을 불러오면 움직임을 재생합니다.</div>;
  }
  return (
    <div
      className="aspect-square w-full rounded-xl bg-secondary flex items-center justify-center select-none touch-none cursor-grab active:cursor-grabbing overflow-hidden"
      onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, ...view }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => { const d = drag.current; if (d) setView({ rotX: d.rotX + (e.clientY - d.y) * 0.01, rotY: d.rotY + (e.clientX - d.x) * 0.01, zoom: d.zoom }); }}
      onPointerUp={() => { drag.current = null; }}
      onWheel={(e) => setView((v) => ({ ...v, zoom: Math.min(6, Math.max(0.3, v.zoom * (e.deltaY < 0 ? 1.1 : 0.9))) }))}
    >
      {frame ? <img src={frame} alt="동작 재생" className="w-full h-full object-contain pointer-events-none" draggable={false} /> : <p className="text-caption text-muted-foreground">그리는 중…</p>}
    </div>
  );
}