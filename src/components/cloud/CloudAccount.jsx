import React from 'react';
import { cloud } from '@/lib/cloudContent';
import { tx } from '@/lib/landingContent';

export default function CloudAccount({ lang }) {
  return (
    <section className="px-5 lg:px-8 py-16 lg:py-20">
      <div className="max-w-[1200px] mx-auto">
        <h2 className="text-[26px] lg:text-[32px] font-extrabold tracking-[-0.8px] text-landing-ink">{tx(cloud.accountTitle, lang)}</h2>
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          {cloud.steps.map((s, i) => (
            <div key={i} className="rounded-[13px] border border-landing-line p-5">
              <div className="text-[11px] font-extrabold font-mono text-landing-brand">STEP {String(i + 1).padStart(2, '0')}</div>
              <h3 className="mt-2 text-[16px] font-bold text-landing-ink">{tx(s.t, lang)}</h3>
              <p className="mt-2 text-sm text-landing-muted leading-[1.6]">{tx(s.d, lang)}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm font-semibold text-landing-ink3">{tx(cloud.accountNote, lang)}</p>
      </div>
    </section>
  );
}