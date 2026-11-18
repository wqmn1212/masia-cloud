import React, { useRef, useState } from 'react';
import { Brush, Loader2, X, Undo2, History, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { runConcept } from '@/lib/conceptApi';
import { errorText } from '@/lib/prototypeApi';

const clamp = (v) => Math.max(0, Math.min(1, v));

/** 표시한 네모들을 원본 이미지 크기의 빨간 표시 그림(PNG base64)으로 만든다 */
function markImage(boxes, w, h) {
  const scale = Math.min(1, 1280 / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, cw, ch);
  boxes.forEach((b) => {
    g.fillStyle = 'rgba(255,0,0,0.35)'; g.fillRect(b.x * cw, b.y * ch, b.w * cw, b.h * ch);
    g.strokeStyle = '#ff0000'; g.lineWidth = Math.max(3, cw / 200); g.strokeRect(b.x * cw, b.y * ch, b.w * cw, b.h * ch);
  });
  return c.toDataURL('image/png');
}

/**
 * 렌더 이미지 고치기: 이미지 위에 끌어서 고칠 곳을 네모로 표시하고, 어떻게 바꿀지 적으면 그 부분 위주로 다시 그린다.
 * 지금 이미지 생성 기능은 정확한 마스크 편집이 없어 표시 밖도 조금 달라질 수 있다. 이미지만 바뀌고 3D 형상은 바뀌지 않는다.
 */
export function RenderEditor({ conceptId, url, onChanged, onClose }) {
  const imgRef = useRef(null);
  const [boxes, setBoxes] = useState([]);
  const [drag, setDrag] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pos = (e) => { const r = e.currentTarget.getBoundingClientRect(); return [clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height)]; };
  const down = (e) => { e.currentTarget.setPointerCapture?.(e.pointerId); const [x, y] = pos(e); setDrag({ x0: x, y0: y, x, y }); };
  const move = (e) => { if (!drag) return; const [x, y] = pos(e); setDrag({ ...drag, x, y }); };
  const up = () => {
    if (!drag) return;
    const b = { x: Math.min(drag.x0, drag.x), y: Math.min(drag.y0, drag.y), w: Math.abs(drag.x - drag.x0), h: Math.abs(drag.y - drag.y0) };
    if (b.w > 0.01 && b.h > 0.01) setBoxes((bs) => [...bs, b].slice(-6));
    setDrag(null);
  };
  const live = drag ? { x: Math.min(drag.x0, drag.x), y: Math.min(drag.y0, drag.y), w: Math.abs(drag.x - drag.x0), h: Math.abs(drag.y - drag.y0) } : null;
  const send = async () => {
    const img = imgRef.current;
    if (!img || !boxes.length || !text.trim()) return;
    setBusy(true); setError('');
    try {
      const res = await runConcept('render_edit', { concept_id: conceptId, instruction: text.trim(), regions: boxes, mark_image: markImage(boxes, img.naturalWidth || 1024, img.naturalHeight || 1024) });
      onChanged(res.concept);
      setBoxes([]); setText('');
    } catch (e) { setError(errorText(e)); }
    setBusy(false);
  };
  const Box = ({ b, dashed }) => <span className={`pointer-events-none absolute border-2 border-destructive bg-destructive/20 ${dashed ? 'border-dashed' : ''}`} style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }} />;

  return (
    <div className="absolute inset-0 flex flex-col bg-card/95 backdrop-blur">
      <div className="flex min-h-0 flex-1 items-center justify-center p-3">
        <div className="relative max-h-full cursor-crosshair touch-none select-none" onPointerDown={down} onPointerMove={move} onPointerUp={up}>
          <img ref={imgRef} src={url} alt="고칠 렌더 이미지" draggable={false} className="block max-h-[calc(100vh-24rem)] max-w-full rounded-lg object-contain lg:max-h-[520px]" />
          {boxes.map((b, i) => <Box key={i} b={b} />)}
          {live && <Box b={live} dashed />}
        </div>
      </div>
      <div className="space-y-2 border-t bg-card p-3">
        <p className="text-caption text-muted-foreground"><Brush className="mr-1 inline h-3.5 w-3.5" />이미지 위를 끌어 고칠 곳을 표시하세요 ({boxes.length}/6). 표시한 곳 위주로 다시 그리며, 3D 형상은 바뀌지 않습니다.</p>
        <div className="flex flex-wrap gap-2">
          <Input aria-label="어떻게 바꿀지" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !busy && send()} placeholder="예: 버튼을 무광 금색으로, 로고를 빼 줘" className="min-w-[220px] flex-1" disabled={busy} />
          <Button onClick={send} disabled={busy || !boxes.length || !text.trim()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}이 부분 다시 그리기</Button>
          <Button variant="outline" onClick={() => setBoxes((bs) => bs.slice(0, -1))} disabled={busy || !boxes.length}><Undo2 className="h-4 w-4" />표시 하나 지우기</Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}><X className="h-4 w-4" />닫기</Button>
        </div>
        {busy && <p className="text-micro text-muted-foreground">다시 그리는 중… (약 20~40초, 이미지 생성 크레딧이 듭니다)</p>}
        {error && <p className="text-caption text-destructive">{error}</p>}
      </div>
    </div>
  );
}

/** 예전 렌더 이미지: 눌러서 되돌리면 지금 이미지는 기록으로 옮겨진다 (지워지지 않는다) */
export function RenderHistory({ conceptId, history, onChanged }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  if (!history?.length) return null;
  const pick = async (h) => {
    setBusy(h.url); setError('');
    try { onChanged((await runConcept('render_pick', { concept_id: conceptId, url: h.url })).concept); } catch (e) { setError(errorText(e)); }
    setBusy('');
  };
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1 text-caption font-semibold text-muted-foreground"><History className="h-3.5 w-3.5" />예전 렌더 {history.length}</p>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {history.map((h) => (
          <button key={h.url} type="button" onClick={() => pick(h)} disabled={!!busy} title={`${h.note || '렌더'}${h.version ? ` · v${h.version}` : ''} — 눌러서 이 이미지로 되돌리기`}
            className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border hover:ring-2 hover:ring-primary disabled:opacity-50">
            <img src={h.url} alt={h.note || '예전 렌더'} className="h-full w-full object-cover" />
            {busy === h.url && <span className="absolute inset-0 flex items-center justify-center bg-card/70"><Loader2 className="h-4 w-4 animate-spin" /></span>}
          </button>
        ))}
      </div>
      {error && <p className="text-caption text-destructive">{error}</p>}
    </div>
  );
}
