import React from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X } from 'lucide-react';

export default function QCEvidenceUploader({ files, onChange, disabled }) {
  const pick = event => {
    const incoming = Array.from(event.target.files || []);
    const images = [...files, ...incoming].filter(file => file.type.startsWith('image/'));
    const videos = [...files, ...incoming].filter(file => file.type.startsWith('video/'));
    if (images.length > 10 || videos.length > 1) return;
    onChange([...images, ...videos]);
  };
  return <div className="space-y-2">
    <label className="inline-flex cursor-pointer">
      <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={pick} disabled={disabled} />
      <span className="inline-flex h-8 items-center gap-2 rounded-md border px-3 text-xs hover:bg-muted"><Upload className="w-3.5 h-3.5" />사진·영상 업로드</span>
    </label>
    <p className="text-[10px] text-muted-foreground">사진 최대 10장, 영상 1개</p>
    <div className="flex flex-wrap gap-1.5">{files.map((file, index) => <span key={`${file.name}-${index}`} className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-[10px]">{file.name}<Button type="button" variant="ghost" size="icon" className="h-4 w-4" onClick={() => onChange(files.filter((_, i) => i !== index))}><X className="w-3 h-3" /></Button></span>)}</div>
  </div>;
}