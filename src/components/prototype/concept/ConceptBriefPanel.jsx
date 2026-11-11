import React, { useState } from 'react';
import { Box, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ConceptNotes from '@/components/prototype/concept/ConceptNotes';
import { runConcept } from '@/lib/conceptApi';
import { errorText } from '@/lib/prototypeApi';

// 프리뷰를 만들기 전: AI 질문에 답하고 가정을 확인한다. 답이 없는 질문은 가정으로 진행된다.
export default function ConceptBriefPanel({ concept, onChanged }) {
  const [answers, setAnswers] = useState(() => Object.fromEntries((concept.questions || []).map((q) => [q.id, q.answer || ''])));
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const generate = async () => {
    setBusy('3D 프리뷰와 렌더 이미지를 만드는 중… (1~2분)'); setError('');
    try {
      const res = await runConcept('generate', { concept_id: concept.id, answers: Object.entries(answers).map(([id, answer]) => ({ id, answer })) }, () => setBusy('시간이 걸리고 있습니다. 결과를 확인하는 중…'));
      onChanged(res.concept);
    } catch (e) { setError(errorText(e)); }
    setBusy('');
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <div className="rounded-2xl border bg-card p-6 space-y-5">
        <div>
          <p className="text-title font-semibold">확인이 필요한 조건</p>
          <p className="text-caption text-muted-foreground">답한 내용은 ‘확인’으로, 비워 둔 질문은 아래 기본 가정으로 진행합니다.</p>
        </div>
        {(concept.questions || []).length === 0 && <p className="text-body text-muted-foreground">추가로 확인할 조건이 없습니다. 바로 프리뷰를 만들 수 있습니다.</p>}
        {(concept.questions || []).map((q, i) => (
          <div key={q.id} className="space-y-1.5">
            <p className="text-body font-medium">{i + 1}. {q.question}</p>
            {q.why && <p className="text-caption text-muted-foreground">{q.why}</p>}
            <Input value={answers[q.id] || ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} placeholder={q.default_assumption ? `비우면 가정: ${q.default_assumption}` : '답을 입력하세요'} />
          </div>
        ))}
        {error && <p className="text-caption text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {busy && <p className="text-caption text-muted-foreground">{busy}</p>}
          <Button onClick={generate} disabled={!!busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Box className="w-4 h-4" />}확인하고 3D 프리뷰 만들기</Button>
        </div>
      </div>
      <div className="space-y-3">
        <div className="rounded-2xl border bg-card p-5 space-y-2">
          <p className="text-label font-semibold text-muted-foreground">입력한 아이디어</p>
          <p className="text-body whitespace-pre-wrap">{concept.idea}</p>
          {concept.known_info && <p className="text-caption text-muted-foreground whitespace-pre-wrap">{concept.known_info}</p>}
          {concept.brief_summary && <p className="border-t pt-2 text-caption text-muted-foreground">AI 이해: {concept.brief_summary}</p>}
        </div>
        <ConceptNotes groups={[{ title: 'AI가 둔 전제 — 확정된 요구사항이 아닙니다', kind: 'assume', items: concept.assumptions }]} />
      </div>
    </div>
  );
}