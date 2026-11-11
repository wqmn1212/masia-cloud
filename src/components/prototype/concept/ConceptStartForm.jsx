import React, { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ConceptFilePicker from '@/components/prototype/concept/ConceptFilePicker';
import { runConcept } from '@/lib/conceptApi';
import { errorText } from '@/lib/prototypeApi';

// 아이디어 입력 → AI가 확인 질문과 가정을 정리 (projectId 가 없으면 시제품도 함께 만든다)
export default function ConceptStartForm({ projectId, defaultIdea = '', onCreated }) {
  const [form, setForm] = useState({ title: '', idea: defaultIdea, known_info: '' });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    if (form.idea.trim().length < 10) { setError('아이디어를 한두 문장 이상 적어 주세요'); return; }
    setBusy('AI가 아이디어를 정리하는 중… (최대 1분)'); setError('');
    try {
      onCreated(await runConcept('brief', { ...form, project_id: projectId, uploads: files }, () => setBusy('시간이 걸리고 있습니다. 결과를 확인하는 중…')));
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
        <ConceptFilePicker files={files} onChange={setFiles} disabled={!!busy} hint="스케치·참고 사진·도면(PDF)을 올리면 AI가 내용을 함께 읽고 만듭니다. (최대 5개, 10MB 이하, 비공개 저장)" />
      </div>
      {error && <p className="text-caption text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {busy && <p className="text-caption text-muted-foreground">{busy}</p>}
        <Button onClick={submit} disabled={!!busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}확인 질문 받기</Button>
      </div>
    </div>
  );
}