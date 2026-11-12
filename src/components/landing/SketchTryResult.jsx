import React, { useState } from 'react';
import { Check, CheckCircle2, Loader2 } from 'lucide-react';
import { sketchTry as T } from '@/lib/landingSketch';
import { tx } from '@/lib/landingContent';
import { cn } from '@/lib/utils';
import InquiryField from './InquiryField';

// 시안 3장 → 하나 고르기 → 그 디자인으로 견적 문의
export default function SketchTryResult({ trial, lang, onInquire, onRetry, busy, error }) {
  const [pick, setPick] = useState(trial.chosen ?? null);
  const [quantity, setQuantity] = useState('');
  const [detail, setDetail] = useState('');

  if (trial.inquired) {
    return (
      <div className="text-center py-6">
        <div className="w-14 h-14 mx-auto rounded-full bg-landing-tint flex items-center justify-center"><CheckCircle2 className="w-7 h-7 text-landing-brand" /></div>
        <h3 className="mt-5 text-xl font-extrabold tracking-[-0.5px] text-landing-ink">{tx(T.doneTitle, lang)}</h3>
        <p className="mt-2.5 text-[14.5px] leading-[1.66] text-landing-ink3">{tx(T.doneBody, lang)}</p>
        {trial.variants[trial.chosen] && <img src={trial.variants[trial.chosen].url} alt={trial.variants[trial.chosen].label} className="mx-auto mt-5 w-40 rounded-xl border border-landing-line" />}
        <button type="button" onClick={onRetry} className="mt-6 bg-white text-landing-ink border border-landing-line3 hover:border-landing-brand hover:text-landing-brand text-sm font-bold px-5 py-2.5 rounded-[9px] transition-colors">{tx(T.retry, lang)}</button>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-[19px] font-extrabold tracking-[-0.5px] text-landing-ink">{tx(T.resultTitle, lang)}</h3>
      <p className="mt-1 text-[13.5px] text-landing-ink3">{tx(T.resultSub, lang)}</p>
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {trial.variants.map((v, i) => (
          <button key={v.url} type="button" onClick={() => setPick(i)} disabled={busy} aria-pressed={pick === i}
            className={cn('overflow-hidden rounded-xl border-2 bg-white text-left transition-colors', pick === i ? 'border-landing-brand' : 'border-landing-line hover:border-landing-tint-border')}>
            <img src={v.url} alt={v.label} className="block aspect-square w-full object-cover" />
            <span className="flex items-center gap-1 px-2.5 py-2 text-[12.5px] font-bold text-landing-ink">
              {pick === i && <Check className="h-3.5 w-3.5 flex-none text-landing-brand" />}<span className="truncate">{v.label}</span>
            </span>
          </button>
        ))}
      </div>
      {trial.notes?.length > 0 && <ul className="mt-3 list-disc pl-4 text-[12.5px] leading-[1.6] text-landing-muted2">{trial.notes.slice(0, 2).map((n) => <li key={n}>{n}</li>)}</ul>}

      <div className="mt-4 grid gap-3.5">
        <InquiryField label={tx(T.quantity, lang)} placeholder={tx(T.quantityPh, lang)} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <InquiryField label={tx(T.more, lang)} placeholder={tx(T.morePh, lang)} value={detail} onChange={(e) => setDetail(e.target.value)} />
      </div>
      <button type="button" disabled={busy || pick == null} onClick={() => onInquire(pick, { quantity, detail })}
        className="mt-5 flex w-full items-center justify-center gap-2 bg-landing-brand hover:bg-landing-brand-hover disabled:opacity-50 text-white text-[15px] font-bold py-[15px] rounded-[11px] transition-colors">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}{tx(T.inquire, lang)}
      </button>
      {error && <p className="mt-3 text-[13px] text-landing-danger bg-landing-danger-bg rounded-lg px-3 py-2">{error}</p>}
      <button type="button" onClick={onRetry} disabled={busy} className="mt-3 w-full text-[13px] font-semibold text-landing-ink3 hover:text-landing-brand">{tx(T.retry, lang)}</button>
      <p className="mt-3 text-xs leading-[1.55] text-landing-muted2">{tx(T.disclaimer, lang)}</p>
    </div>
  );
}
