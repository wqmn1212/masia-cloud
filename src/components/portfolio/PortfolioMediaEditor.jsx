import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Trash2, Upload, Loader2 } from 'lucide-react';

export default function PortfolioMediaEditor({ form, setForm }) {
  const [busy, setBusy] = useState('');

  const upload = async (file) => {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    return file_url;
  };

  const addImages = async (files) => {
    setBusy('images');
    const urls = [];
    for (const file of Array.from(files)) urls.push(await upload(file));
    setForm((f) => ({
      ...f,
      images: [...(f.images || []), ...urls.map((url, i) => ({ url, order: (f.images?.length || 0) + i }))],
    }));
    setBusy('');
  };

  const addSpec = async (file) => {
    setBusy('spec');
    const url = await upload(file);
    setForm((f) => ({
      ...f,
      spec_files: [...(f.spec_files || []), { url, label_ko: file.name, lang: 'multi', size_kb: Math.round(file.size / 1024), require_lead: false }],
    }));
    setBusy('');
  };

  const removeAt = (key, index) =>
    setForm((f) => ({ ...f, [key]: (f[key] || []).filter((_, i) => i !== index) }));

  const patchAt = (key, index, patch) =>
    setForm((f) => ({ ...f, [key]: (f[key] || []).map((v, i) => (i === index ? { ...v, ...patch } : v)) }));

  return (
    <div className="space-y-5">
      <div>
        <Label>상세 이미지</Label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
          {(form.images || []).map((im, i) => (
            <div key={i} className="relative group border border-border rounded-md overflow-hidden">
              <img src={im.url} alt="" className="w-full h-20 object-cover" />
              <button type="button" onClick={() => removeAt('images', i)} className="absolute top-1 right-1 bg-background/90 rounded p-1">
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </button>
            </div>
          ))}
          <label className="h-20 border border-dashed border-border rounded-md flex items-center justify-center cursor-pointer text-muted-foreground">
            {busy === 'images' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files?.length && addImages(e.target.files)} />
          </label>
        </div>
      </div>

      <div>
        <Label>영상 링크 (YouTube / 업로드 URL)</Label>
        <div className="space-y-2 mt-2">
          {(form.videos || []).map((v, i) => (
            <div key={i} className="flex gap-2">
              <Input value={v.url || ''} onChange={(e) => patchAt('videos', i, { url: e.target.value })} placeholder="https://youtu.be/..." />
              <Input value={v.title_ko || ''} onChange={(e) => patchAt('videos', i, { title_ko: e.target.value })} placeholder="영상 제목" className="max-w-[200px]" />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeAt('videos', i)}><Trash2 className="text-destructive" /></Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, videos: [...(f.videos || []), { type: 'YOUTUBE', url: '', title_ko: '' }] }))}>
            영상 추가
          </Button>
        </div>
      </div>

      <div>
        <Label>스펙 자료 (PDF 등)</Label>
        <div className="space-y-2 mt-2">
          {(form.spec_files || []).map((f, i) => (
            <div key={i} className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <Input value={f.label_ko || ''} onChange={(e) => patchAt('spec_files', i, { label_ko: e.target.value })} placeholder="자료명" />
              <label className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
                문의 후 제공
                <Switch checked={!!f.require_lead} onCheckedChange={(v) => patchAt('spec_files', i, { require_lead: v })} />
              </label>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeAt('spec_files', i)}><Trash2 className="text-destructive" /></Button>
            </div>
          ))}
          <label className="inline-flex items-center gap-2 text-sm border border-dashed border-border rounded-md px-3 py-2 cursor-pointer text-muted-foreground">
            {busy === 'spec' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} 자료 업로드
            <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && addSpec(e.target.files[0])} />
          </label>
        </div>
      </div>
    </div>
  );
}