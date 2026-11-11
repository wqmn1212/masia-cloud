import React, { useRef, useState } from 'react';
import { FileText, Loader2, Paperclip, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { runConcept } from '@/lib/conceptApi';
import { errorText, uploadProtoFile } from '@/lib/prototypeApi';

// 아이디어 입력 → AI가 확인 질문과 가정을 정리 (projectId 가 없으면 시제품도 함께 만든다)
export default function ConceptStartForm({ projectId, defaultIdea = '', onCreated }) {
  const [form, setForm] = useState({ title: '', idea: defaultIdea, known_info: '' });
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const input = useRef(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const upload = async (list) => {
    if (!list?.length) return;
    setUploading(true); setError('');
    try {
      for (const file of list) setFiles((prev) => [...prev, { pending: true, name: file.name }]);
      const me = await base44.auth.me().catch(() => null);
      const added = [];
      for (const file of list) added.push(await uploadProtoFile(file, me, { category: 'REFERENCE' }));
      setFiles((prev) => [...prev.filter((f) => !f.pending), ...added]);
    } catch (e) { setError(errorText(e)); setFiles((prev) => prev.filter((f) => !f.pending)); }
    setUploading(false);
    if (input.current) input.current.value = '';
  };

  const submit = async () => {
    if (form.idea.trim().length < 10) { setError('아이디어를 한두 문장 이상 적어 주세요'); return; }
    setBusy('AI가 아이디어를 정리하는 중… (최대 1분)'); setError('');
    try {
      onCreated(await runConcept('brief', { ...form, project_id: projectId, files: files.filter((f) => f.uri) }, () => setBusy('시간이 걸리고 있습니다. 결과를 확인하는 중…')));
    } catch (e) { setError(errorText(e)); }
    setBusy('');
  };

  return (
    <div className="space-y-4">
      {!projectId && (
        <div className="space-y-1.5">
          <Label>시제품 이름 (선택)</Label>
          <Input value={form.title} onChange={set('title')} placeholder="비워 두면 AI가 이름을 붙입니다" />
        </div>
      )}
      <div className="space-y-1.5">
        <Label>제품 아이디어</Label>
        <Textarea rows={5} value={form.idea} onChange={set('idea')} placeholder="예: 책상 위에 두는 원통형 미니 공기청정기. 아래에서 공기를 빨아들여 위로 내보내고, 터치 버튼 하나로 3단 풍량을 조절한다." />
      </div>
      <div className="space-y-1.5">
        <Label>알고 있는 조건 (선택)</Label>
        <Textarea rows={3} value={form.known_info} onChange={set('known_info')} placeholder="크기, 재료, 색상, 전원, 사용 환경 등 정해진 것만 적어 주세요. 모르는 것은 AI가 질문합니다." />
      </div>
      <div className="space-y-1.5">
        <Label>참고 자료 (선택)</Label>
        <input ref={input} type="file" multiple accept="image/*,.pdf" className="hidden" onChange={(e) => upload(Array.from(e.target.files || []))} />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()} disabled={uploading || !!busy}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}사진 · 도면 올리기
          </Button>
          <span className="text-caption text-muted-foreground">스케치·참고 사진·도면(PDF)을 올리면 AI가 내용을 함께 읽고 만듭니다. (비공개 저장)</span>
        </div>
        {files.length > 0 && (
          <ul className="space-y-1">
            {files.map((f, i) => (
              <li key={f.id || `${f.name}-${i}`} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5">
                <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-label">{f.name}</span>
                {f.pending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  : <Button type="button" size="icon" variant="ghost" onClick={() => setFiles(files.filter((x) => x !== f))}><X className="w-3.5 h-3.5" /></Button>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <p className="text-caption text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {busy && <p className="text-caption text-muted-foreground">{busy}</p>}
        <Button onClick={submit} disabled={!!busy || uploading}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}확인 질문 받기</Button>
      </div>
    </div>
  );
}