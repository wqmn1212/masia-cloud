import { Check } from 'lucide-react';
import { form, tx } from '@/lib/landingContent';

export default function InquirySuccess({ lang, onReset }) {
  return (
    <div className="text-center py-6">
      <div className="mx-auto w-14 h-14 rounded-full bg-landing-tint text-landing-brand flex items-center justify-center">
        <Check className="w-7 h-7" />
      </div>
      <h3 className="mt-5 text-xl font-extrabold tracking-[-0.5px] text-landing-ink">{tx(form.doneTitle, lang)}</h3>
      <p className="mt-2.5 text-[14.5px] leading-[1.66] text-landing-ink3 max-w-[380px] mx-auto">{tx(form.doneBody, lang)}</p>
      <button
        type="button"
        onClick={onReset}
        className="mt-6 bg-white text-landing-ink border border-landing-line3 hover:border-landing-brand hover:text-landing-brand text-sm font-bold px-5 py-2.5 rounded-[9px] transition-colors"
      >
        {tx(form.again, lang)}
      </button>
    </div>
  );
}