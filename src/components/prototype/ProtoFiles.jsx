import React, { useRef, useState } from 'react';
import { FileText, Upload, Loader2, Trash2, ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { FILE_CATEGORIES, fileCategoryLabel, fmtDate } from '@/lib/prototype';
import { uploadProtoFile, openProtoFile, errorText } from '@/lib/prototypeApi';

// 프로젝트 파일 (입력 자료 또는 산출물). categories 로 보이는 분류를 정한다.
export default function ProtoFiles({ project, user, categories, versionNo, onChanged, title }) {
  const [category, setCategory] = useState(categories[0]);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const files = (project.files || []).filter((f) => categories.includes(f.category));

  const upload = async (list) => {
    if (!list?.length) return;
    setBusy(true);
    try {
      const added = [];
      for (const file of list) added.push(await uploadProtoFile(file, user, { category, version_no: versionNo || null }));
      await base44.entities.ProtoProject.update(project.id, { files: [...(project.files || []), ...added] });
      onChanged();
    } catch (e) { toast({ title: '업로드하지 못했습니다', description: errorText(e), variant: 'destructive' }); }
    setBusy(false);
    if (input.current) input.current.value = '';
  };

  const remove = async (f) => {
    if (!window.confirm(`${f.name} 파일 연결을 지울까요?`)) return;
    await base44.entities.ProtoProject.update(project.id, { files: (project.files || []).filter((x) => x.id !== f.id) });
    onChanged();
  };

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-title font-semibold">{title}</p>
        <div className="flex items-center gap-2">
          <select className="h-9 rounded-md border bg-transparent px-2 text-label" value={category} onChange={(e) => setCategory(e.target.value)}>
            {FILE_CATEGORIES.filter((c) => categories.includes(c.key)).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <input ref={input} type="file" multiple className="hidden" onChange={(e) => upload(Array.from(e.target.files || []))} />
          <Button size="sm" onClick={() => input.current?.click()} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}올리기</Button>
        </div>
      </div>
      {files.length === 0 ? (
        <p className="text-caption text-muted-foreground">아직 파일이 없습니다. 이미지·PDF 도면은 AI 검토에 함께 쓰입니다.</p>
      ) : (
        <ul className="divide-y">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 py-2.5">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-body truncate">{f.name}</p>
                <p className="text-micro text-muted-foreground">{fileCategoryLabel(f.category)}{f.version_no ? ` · v${f.version_no}` : ''} · {f.uploaded_by_name} · {fmtDate(f.uploaded_at)}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => openProtoFile(project.id, f.id).catch((e) => toast({ title: errorText(e), variant: 'destructive' }))}><ExternalLink className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove(f)}><Trash2 className="w-4 h-4" /></Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}