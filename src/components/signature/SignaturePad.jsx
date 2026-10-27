import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { Eraser } from 'lucide-react';
import { Button } from '@/components/ui/button';

// 손가락·마우스로 그리는 서명 칸. toPng() 는 그린 게 없으면 null.
const W = 600, H = 200;
const SignaturePad = forwardRef(function SignaturePad({ onChange }, ref) {
  const canvas = useRef(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const ctx = canvas.current.getContext('2d');
    ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111827';
  }, []);

  const pos = (e) => {
    const r = canvas.current.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  };
  const down = (e) => {
    e.preventDefault();
    canvas.current.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    const ctx = canvas.current.getContext('2d');
    const [x, y] = pos(e);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.1, y + 0.1); ctx.stroke();
  };
  const move = (e) => {
    if (!drawing.current) return;
    const ctx = canvas.current.getContext('2d');
    const [x, y] = pos(e);
    ctx.lineTo(x, y); ctx.stroke();
    if (empty) { setEmpty(false); onChange?.(true); }
  };
  const up = () => { drawing.current = false; };
  const clear = () => {
    canvas.current.getContext('2d').clearRect(0, 0, W, H);
    setEmpty(true); onChange?.(false);
  };

  useImperativeHandle(ref, () => ({ toPng: () => (empty ? null : canvas.current.toDataURL('image/png')), clear }), [empty]);

  return (
    <div className="space-y-1">
      <div className="relative rounded-lg border-2 border-dashed bg-white">
        <canvas ref={canvas} width={W} height={H} className="h-36 w-full touch-none" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} aria-label="서명 그리는 칸" />
        {empty && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-body text-muted-foreground">여기에 서명해 주세요</span>}
      </div>
      <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-label" onClick={clear}><Eraser className="h-3 w-3" />지우기</Button>
    </div>
  );
});
export default SignaturePad;

// 입력한 이름을 서명 이미지로 (이름 입력 방식)
export function typedSignaturePng(name) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#111827';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let size = 72;
  do { ctx.font = `700 ${size}px Pretendard, 'Noto Sans KR', sans-serif`; size -= 4; } while (ctx.measureText(name).width > W - 40 && size > 24);
  ctx.fillText(name, W / 2, H / 2);
  return c.toDataURL('image/png');
}
