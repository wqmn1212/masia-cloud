import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowUp, ArrowDown, X, Upload, Loader2 } from 'lucide-react';

// 자동 게시 대비: PNG 등 이미지는 JPEG 로 변환해 업로드
const toJpeg = (file) => new Promise((resolve) => {
  if (!file.type.startsWith('image/') || file.type === 'image/jpeg') return resolve(file);
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0);
    c.toBlob((b) => resolve(new File([b], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })), 'image/jpeg', 0.92);
  };
  img.src = URL.createObjectURL(file);
});

export default function MediaManager({ media, onChange }) {
  const [busy, setBusy] = useState(false);
  const upload = async (files) => {
    setBusy(true);
    const added = [];
    for (const f of files) {
      const file = await toJpeg(f);
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      added.push({ url: file_url, name: file.name, type: file.type.startsWith('video') ? 'video' : 'image' });
    }
    onChange([...media, ...added].map((m, i) => ({ ...m, order: i })));
    setBusy(false);
  };
  const move = (i, d) => {
    const next = [...media];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next.map((m, k) => ({ ...m, order: k })));
  };

  return (
    <div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {media.map((m, i) => (
          <div key={m.url} className="relative w-28 h-28 shrink-0 rounded-xl overflow-hidden bg-muted group">
            {m.type === 'video' ? <video src={m.url} className="w-full h-full object-cover" /> : <img src={m.url} alt={m.name} className="w-full h-full object-cover" />}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="w-4 h-4 -rotate-90" /></button>
              <button type="button" onClick={() => onChange(media.filter((_, k) => k !== i))}><X className="w-4 h-4" /></button>
              <button type="button" disabled={i === media.length - 1} onClick={() => move(i, 1)}><ArrowDown className="w-4 h-4 -rotate-90" /></button>
            </div>
            <span className="absolute top-1 left-1 text-[10px] bg-black/60 text-white rounded px-1">{i + 1}</span>
          </div>
        ))}
        <label className="w-28 h-28 shrink-0 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-xs text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors">
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5 mb-1" />}
          {busy ? '업로드 중' : '미디어 추가'}
          <input type="file" multiple accept="image/*,video/*" className="hidden" disabled={busy} onChange={(e) => upload([...e.target.files])} />
        </label>
      </div>
    </div>
  );
}