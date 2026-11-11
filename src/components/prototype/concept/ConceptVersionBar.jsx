import React, { useState } from 'react';
import { Loader2, PencilLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { runConcept } from '@/lib/conceptApi';
import { errorText } from '@/lib/prototypeApi';
import { fmtDate } from '@/lib/prototype';

// 컨셉 버전 선택 + 변경 요청으로 새 버전 만들기
export default function ConceptVersionBar({ concepts, concept, onSelect, onChanged }) {
  const [change, setChange] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const canRevise = concept?.preview?.parts?.length > 0;

  const revise = async () => {
    if (!change.trim()) return;
    setBusy('변경을 반영한 새 버전을 만드는 중… (1~3분, 렌더 이미지는 따로 만듭니다)'); setError('');
    try {
      const res = await runConcept('revise', { concept_id: concept.id, change_request: change }, () => setBusy('시간이 걸리고 있습니다. 결과를 확인하는 중…'));
      setChange('');
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
            <Button variant="outline" onClick={revise} disabled={!!busy || !change.trim()} className="shrink-0">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PencilLine className="w-4 h-4" />}새 버전</Button>
          </div>
        )}
      </div>
      {concept?.change_request && <p className="px-1 text-caption text-muted-foreground">v{concept.version_no} 변경 요청: {concept.change_request}{concept.preview?.change_summary ? ` → ${concept.preview.change_summary}` : ''}</p>}
      {busy && <p className="px-1 text-caption text-muted-foreground">{busy}</p>}
      {error && <p className="px-1 text-caption text-destructive">{error}</p>}
    </div>
  );
}