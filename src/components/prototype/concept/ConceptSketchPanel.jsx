import React, { useState } from 'react';
import { AlertTriangle, Check, Loader2, PenLine, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { runConcept } from '@/lib/conceptApi';
import { errorText } from '@/lib/prototypeApi';

// 스케치 정리: 아이디어 스케치 → 정면 시안 3장 중 하나 고르기 → 같은 제품의 측면 → 이 두 장으로 3D
// 시안은 스케치의 형태를 따르도록 만들지만 AI 가 비율을 바꿀 수 있어, 스케치 대비 정면 비율 차이를 함께 보여 준다.
export default function ConceptSketchPanel({ concept, onChanged, disabled, onBusy }) {
  const sk = concept.sketch;
  const [pick, setPick] = useState(sk?.chosen ?? null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const recommend = concept.reference_kind === 'SKETCH';

  const run = async (params, msg) => {
    setBusy(msg); onBusy?.(true); setError('');
    try { const res = await runConcept('sketch', { concept_id: concept.id, ...params }, () => setBusy('시간이 걸리고 있습니다. 결과를 확인하는 중…')); onChanged(res.concept); }
    catch (e) { setError(errorText(e)); }
    setBusy(''); onBusy?.(false);
  };
  const makeFront = () => run({ step: 'front' }, '스케치를 읽고 정면 시안 3장을 만드는 중… (약 1분)');
  const makeSide = () => run({ step: 'side', variant: pick }, '고른 시안으로 측면 이미지를 만드는 중… (약 30초)');
  const lock = !!busy || disabled;

  return (
    <div className={`rounded-2xl border p-5 space-y-3 ${recommend ? 'border-primary/40 bg-primary/5' : 'bg-card'}`}>
      <div className="flex items-start gap-2">
        <PenLine className="w-4 h-4 mt-1 shrink-0 text-primary" />
        <div className="space-y-0.5">
          <p className="text-label font-semibold">스케치 정리 {recommend && <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-micro text-primary-foreground">추천</span>}</p>
          <p className="text-caption text-muted-foreground">
            손으로 그린 스케치는 원근과 비율이 대략적이라 바로 3D 로 만들면 틀어지기 쉽습니다. 스케치를 정면 시안 3장으로 정리해 하나를 고르면, 같은 제품의 측면까지 만들어 두 장을 기준으로 3D 를 만듭니다. (이미지 생성 크레딧이 듭니다)
          </p>
        </div>
      </div>

      {!sk && (
        <Button size="sm" variant={recommend ? 'default' : 'outline'} onClick={makeFront} disabled={lock}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />}스케치로 정면 시안 3장 만들기
        </Button>
      )}

      {sk?.status === 'CHOOSE' && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {sk.variants.map((v, i) => (
              <button key={v.url} type="button" onClick={() => setPick(i)} disabled={lock} className={`overflow-hidden rounded-xl border-2 bg-white text-left transition-colors ${pick === i ? 'border-primary' : 'border-transparent hover:border-primary/40'}`}>
                <img src={v.url} alt={`정면 시안 ${i + 1}`} className="aspect-square w-full object-cover" />
                <div className="space-y-0.5 px-2 py-1.5">
                  <p className="flex items-center gap-1 text-caption font-semibold">{pick === i && <Check className="w-3.5 h-3.5 text-primary" />}{v.label}</p>
                  {v.diff_pct != null
                    ? <p className={`text-micro ${v.warn ? 'text-warning-text' : 'text-muted-foreground'}`}>스케치 대비 폭/높이 {v.diff_pct}% 차이{v.warn ? ' · 확인 필요' : ''}</p>
                    : <p className="text-micro text-muted-foreground">비율 비교 없음</p>}
                </div>
              </button>
            ))}
          </div>
          {sk.sketch_note && <p className="flex items-start gap-1.5 text-caption text-warning-text"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{sk.sketch_note}</p>}
          {sk.sketch_ratio != null && <p className="text-micro text-muted-foreground">스케치 정면 비율(폭/높이) {sk.sketch_ratio} 기준으로 비교했습니다.</p>}
          {sk.notes?.length > 0 && <ul className="list-disc pl-4 text-caption text-muted-foreground">{sk.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={makeSide} disabled={lock || pick == null}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}이 시안으로 측면 만들기</Button>
            <Button size="sm" variant="ghost" onClick={makeFront} disabled={lock}><RotateCcw className="w-4 h-4" />시안 다시 만들기</Button>
          </div>
        </>
      )}

      {sk?.status === 'READY' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <figure className="overflow-hidden rounded-xl border bg-white"><img src={sk.variants?.[sk.chosen]?.url} alt="정리한 정면" className="aspect-square w-full object-cover" /><figcaption className="px-2 py-1 text-caption">정면 · {sk.variants?.[sk.chosen]?.label}</figcaption></figure>
            <figure className="overflow-hidden rounded-xl border bg-white"><img src={sk.side_url} alt="정리한 측면" className="aspect-square w-full object-cover" /><figcaption className="px-2 py-1 text-caption">측면</figcaption></figure>
          </div>
          {sk.side_note && <p className="flex items-start gap-1.5 text-caption text-warning-text"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{sk.side_note}</p>}
          <p className="text-caption text-success-text">이 정면·측면 두 장을 기준으로 3D 를 만들고, 렌더 참고 이미지로도 씁니다.</p>
          <Button size="sm" variant="ghost" onClick={() => onChanged({ ...concept, sketch: { ...sk, status: 'CHOOSE' } })} disabled={lock}><RotateCcw className="w-4 h-4" />다른 시안 고르기</Button>
        </>
      )}

      {busy && <p className="text-caption text-muted-foreground">{busy}</p>}
      {error && <p className="text-caption text-destructive">{error}</p>}
    </div>
  );
}
