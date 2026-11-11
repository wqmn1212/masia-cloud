import React, { useState } from 'react';
import { Loader2, PencilLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ConceptFilePicker from '@/components/prototype/concept/ConceptFilePicker';
import { runConcept } from '@/lib/conceptApi';
import { errorText } from '@/lib/prototypeApi';
import { fmtDate } from '@/lib/prototype';

// 컨셉 버전 선택 + 변경 요청으로 새 버전 만들기
export default function ConceptVersionBar({ concepts, concept, onSelect, onChanged }) {
  const [change, setChange] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const canRevise = concept?.preview?.parts?.length > 0;

  const revise = async () => {
    if (!change.trim() && !files.length) return;
    const withPhoto = files.some((f) => /\.(png|jpe?g|webp)$/i.test(f.name));
    setBusy(`변경을 반영한 새 버전을 만드는 중… (1~3분, ${withPhoto ? '첨부한 사진대로 렌더 이미지도 다시 만듭니다' : '렌더 이미지는 따로 만듭니다'})`); setError('');
    try {
      const res = await runConcept('revise', { concept_id: concept.id, change_request: change, uploads: files }, () => setBusy('시간이 걸리고 있습니다. 결과를 확인하는 중…'));
      setChange(''); setFiles([]);
      onChanged(res.concept);
    } catch (e) { setError(errorText(e)); }
    setBusy('');
  };

  return (
    <div className="rounded-xl border bg-card p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {concepts.map((c) => (
          <button key={c.id} type="button" onClick={() => onSelect(c.id)} title={c.change_request || c.idea} className={`rounded-full px-3 py-1.5 text-label font-medium transition-colors ${c.id === concept?.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
            v{c.version_no}<span className="ml-1.5 text-micro opacity-80">{c.status === 'BRIEF' ? '확인 전' : fmtDate(c.created_date)}</span>
          </button>
        ))}
        {canRevise && (
          <div className="flex flex-1 min-w-[260px] items-center gap-2 sm:ml-auto sm:max-w-xl">
            <Input value={change} onChange={(e) => setChange(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !busy && revise()} placeholder="변경 요청 — 예: 높이를 20mm 줄이고 버튼을 앞면으로" disabled={!!busy} />
            <Button variant="outline" onClick={revise} disabled={!!busy || (!change.trim() && !files.length)} className="shrink-0">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PencilLine className="w-4 h-4" />}새 버전</Button>
          </div>
        )}
      </div>
      {canRevise && <ConceptFilePicker files={files} onChange={setFiles} disabled={!!busy} hint="사진·PDF·도면을 첨부하면 그 자료대로 3D 형상을 수정한 새 버전을 만듭니다. 사진을 첨부하면 렌더 이미지도 그 사진대로 자동으로 다시 만듭니다. (최대 5개, 10MB 이하, 비공개 저장)" />}
      {concept?.change_request && <p className="px-1 text-caption text-muted-foreground">v{concept.version_no} 변경 요청: {concept.change_request}{concept.preview?.change_summary ? ` → ${concept.preview.change_summary}` : ''}</p>}
      {busy && <p className="px-1 text-caption text-muted-foreground">{busy}</p>}
      {error && <p className="px-1 text-caption text-destructive">{error}</p>}
    </div>
  );
}