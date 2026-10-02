import React from 'react';
import { tx } from '@/lib/landingContent';
import { enterprise, startEnterpriseInquiry } from '@/lib/pricingContent';

export default function EnterpriseCard({ lang }) {
  return (
    <div className="rounded-[13px] p-[22px] bg-landing-ink text-white flex flex-col">
      <div className="text-[12px] font-extrabold text-landing-dark-accent">{tx(enterprise.name, lang)}</div>
      <div className="mt-3 text-[26px] font-extrabold tracking-[-1px]">{tx(enterprise.price, lang)}</div>
      <div className="mt-0.5 text-[13px] font-semibold text-landing-dark-accent">{tx(enterprise.priceSub, lang)}</div>
      <p className="mt-2 text-sm leading-[1.62] text-landing-dark-body">{tx(enterprise.ex, lang)}</p>
      <dl className="mt-4 pt-3 border-t border-landing-dark-line space-y-1.5">
        {enterprise.lines.map(([k, v], j) => (
          <div key={j} className="flex gap-3 text-[13px]">
            <dt className="w-24 shrink-0 text-landing-dark-body">{tx(k, lang)}</dt>
            <dd className="font-semibold">{tx(v, lang)}</dd>
          </div>
        ))}
      </dl>
      <div className="flex-1" />
      <a
        href="#contact"
        onClick={startEnterpriseInquiry}
        className="mt-5 w-full inline-flex items-center justify-center bg-white text-landing-ink hover:bg-landing-brand hover:text-white text-sm font-bold px-5 py-3 rounded-[9px] transition-colors"
      >
        {tx(enterprise.cta, lang)}
      </a>
    </div>
  );
}