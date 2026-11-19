import React, { useState } from 'react';
import { MessageCircleQuestion, Loader2, CornerDownLeft, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { errorText } from '@/lib/prototypeApi';

// 질문하면 3D 로 답하기 (직원 화면): AI 가 컨셉 부품·기능·설계 메모만 근거로 답하고, 답을 보여 줄 장면(강조 부품·보기·흐름)을 고른다.
// 답은 저장하지 않는다 — 미팅 중 바로 보여 주는 용도. 지난 답을 누르면 그 장면을 다시 보여 준다.
const EXAMPLES = ['빛은 어떻게 부드럽게 바뀌나요?', '전원은 어디로 들어가나요?', '열은 어떻게 빠지나요?'];

export default function TeardownAsk({ conceptId, current, onShow }) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState([]);
  const ask = async (text = q) => {
    const question = text.trim();
    if (!question || busy) return;
    setBusy(true); setError('');
    try {
      const res = (await base44.functions.invoke('prototypeConcept', { action: 'explain', concept_id: conceptId, question, current: current || '' })).data;
      const item = { id: Date.now(), question, ...res };
      setAnswers((a) => [item, ...a].slice(0, 8));
      if (item.step) onShow?.(item.step);
      setQ('');
    } catch (e) { setError(errorText(e)); }
    setBusy(false);
  };
  return (
    <div className="space-y-2 rounded-2xl border bg-card p-3">
      <p className="flex items-center gap-1.5 px-1 text-caption font-semibold text-muted-foreground"><MessageCircleQuestion className="h-3.5 w-3.5" />이거 어떻게 돌아가요?</p>
      <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="flex gap-1.5">
        <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={500} placeholder="고객 질문을 적으면 3D 로 답합니다" aria-label="질문"
          className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-label placeholder:text-muted-foreground" />
        <Button type="submit" size="sm" disabled={busy || !q.trim()} aria-label="질문하기">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CornerDownLeft className="h-4 w-4" />}</Button>
      </form>
      {!answers.length && !busy && (
        <div className="flex flex-wrap gap-1">
          {EXAMPLES.map((x) => <button key={x} type="button" onClick={() => ask(x)} className="rounded-full bg-secondary px-2.5 py-1 text-caption text-muted-foreground hover:text-foreground">{x}</button>)}
        </div>
      )}
      {busy && <p className="px-1 text-caption text-muted-foreground">부품·기능 자료를 읽고 답을 만드는 중… (10~30초)</p>}
      {error && <p className="px-1 text-caption text-destructive">{error}</p>}
      <div className="max-h-[260px] space-y-1.5 overflow-y-auto">
        {answers.map((a) => (
          <button key={a.id} type="button" onClick={() => a.step && onShow?.(a.step)} className="w-full rounded-lg border px-3 py-2 text-left transition-colors hover:border-primary/50">
            <span className="block text-caption font-medium">{a.question}</span>
            <span className="mt-0.5 block text-caption text-muted-foreground">{a.answer}</span>
            {a.unknown && <span className="mt-1 inline-flex items-center gap-1 text-micro text-warning-text"><HelpCircle className="h-3 w-3" />자료에 없는 부분이 있습니다 — 확인 후 답하세요</span>}
            {a.sources?.length > 0 && <span className="mt-1 block text-micro text-muted-foreground">근거: {a.sources.join(' · ')}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
