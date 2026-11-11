import React, { useRef, useState } from 'react';
import { FileText, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MAX_UPLOADS, MAX_UPLOAD_BYTES } from '@/lib/conceptApi';

// 컨셉 참고 자료(사진·PDF·도면) 고르기. 고른 파일은 요청을 보낼 때 서버가 비공개로 저장한다
export default function ConceptFilePicker({ files, onChange, disabled, hint }) {
  const [error, setError] = useState('');
  const input = useRef(null);

  const pick = (list) => {
    const big = list.filter((f) => f.size > MAX_UPLOAD_BYTES);
    const ok = list.filter((f) => f.size <= MAX_UPLOAD_BYTES && /\.(png|jpe?g|webp|pdf)$/i.test(f.name));
    if (big.length) setError(`10MB 넘는 파일은 올릴 수 없습니다: ${big.map((f) => f.name).join(', ')}`);
    else if (ok.length < list.length) setError('사진(PNG·JPG·WEBP)과 PDF만 올릴 수 있습니다');
    else if (files.length + ok.length > MAX_UPLOADS) setError(`참고 자료는 ${MAX_UPLOADS}개까지 올릴 수 있습니다`);
    else setError('');
    onChange([...files, ...ok].slice(0, MAX_UPLOADS));
    if (input.current) input.current.value = '';
  };

  return (
    <div className="space-y-1.5">
      <input ref={input} type="file" multiple accept="image/*,.pdf" className="hidden" onChange={(e) => pick(Array.from(e.target.files || []))} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()} disabled={disabled || files.length >= MAX_UPLOADS}>
          <Paperclip className="w-4 h-4" />사진 · 도면 올리기
        </Button>
        {hint && <span className="text-caption text-muted-foreground">{hint}</span>}
      </div>
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5">
              <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-label">{f.name}</span>
              <Button type="button" size="icon" variant="ghost" disabled={disabled} onClick={() => onChange(files.filter((x) => x !== f))} aria-label={`${f.name} 빼기`}><X className="w-3.5 h-3.5" /></Button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-caption text-destructive">{error}</p>}
    </div>
  );
}