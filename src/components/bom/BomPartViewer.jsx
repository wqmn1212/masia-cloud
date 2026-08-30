import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { buildScene, disposeScene, renderBuiltFrame } from '@/lib/meshRenderer';

const SIZE = 460;

/** 드래그 회전 · 휠 줌이 되는 단일 부품 3D 뷰어 */
export default function BomPartViewer({ open, onOpenChange, part, mesh }) {
  const builtRef = useRef(null);
  const dragRef = useRef(null);
  const [frame, setFrame] = useState(null);
  const [ready, setReady] = useState(0);
  const [view, setView] = useState({ rotX: 0.5, rotY: 0.8, zoom: 1 });

  useEffect(() => {
    if (!open || !mesh?.positions?.length) return;
    builtRef.current = buildScene(mesh, { color: 0xa8bad6 });
    setView({ rotX: 0.5, rotY: 0.8, zoom: 1 });
    setReady((v) => v + 1);
    return () => {
      disposeScene(builtRef.current);
      builtRef.current = null;
      setFrame(null);
    };
  }, [open, mesh]);

  useEffect(() => {
    if (!builtRef.current) return;
    setFrame(renderBuiltFrame(builtRef.current, { size: SIZE * 2, ...view }));
  }, [view, ready]);

  const onPointerDown = (e) => {
    dragRef.current = { x: e.clientX, y: e.clientY, ...view };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    setView({
      rotX: d.rotX + (e.clientY - d.y) * 0.01,
      rotY: d.rotY + (e.clientX - d.x) * 0.01,
      zoom: d.zoom,
    });
  };
  const onPointerUp = () => { dragRef.current = null; };

  const num = (v, digits = 2) => (v == null ? '-' : Number(v).toFixed(digits));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] w-[95vw]">
        <DialogHeader>
          <DialogTitle className="text-base">{part?.display_name || part?.part_name}</DialogTitle>
        </DialogHeader>

        <div
          className="rounded-xl bg-secondary flex items-center justify-center select-none touch-none cursor-grab active:cursor-grabbing"
          style={{ height: SIZE }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={(e) => {
            e.preventDefault();
            setView((v) => ({ ...v, zoom: Math.min(4, Math.max(0.3, v.zoom * (e.deltaY < 0 ? 1.12 : 0.89))) }));
          }}
        >
          {frame
            ? <img src={frame} alt="" draggable={false} className="max-h-full max-w-full object-contain" />
            : <span className="text-xs text-muted-foreground">3D 형상 준비 중...</span>}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
          <div className="flex justify-between"><span className="text-muted-foreground">부피</span><span className="tabular-nums">{num(part?.volume_cm3, 3)} cm³</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">중량</span><span className="tabular-nums">{num(part?.weight_g)} g</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">외곽 치수</span><span className="tabular-nums">{num(part?.bbox_x_mm, 1)} × {num(part?.bbox_y_mm, 1)} × {num(part?.bbox_z_mm, 1)} mm</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">투영면적</span><span className="tabular-nums">{num(part?.projected_area_cm2)} cm²</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">재질</span><span>{part?.material || '-'}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">삼각형</span><span className="tabular-nums">{part?.triangle_count ?? '-'}</span></div>
        </div>
        <p className="text-[11px] text-muted-foreground">드래그로 회전 · 휠로 확대/축소</p>
      </DialogContent>
    </Dialog>
  );
}