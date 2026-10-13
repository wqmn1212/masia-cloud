import React from 'react';
import { cloud } from '@/lib/cloudContent';
import { tx } from '@/lib/landingContent';

export default function CloudBeforeAfter({ lang }) {
  return (
    <section className="bg-landing-page border-y border-landing-line px-5 lg:px-8 py-16 lg:py-20">
      <div className="max-w-[1200px] mx-auto">
        <h2 className="text-[26px] lg:text-[32px] font-extrabold tracking-[-0.8px] text-landing-ink">{tx(cloud.beforeAfterTitle, lang)}</h2>
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          {cloud.pairs.map((p, i) => (
            <div key={i} className="rounded-[13px] bg-white border border-landing-line p-5 space-y-4">
              <div><div className="text-[11px] font-extrabold text-landing-muted2">{tx(cloud.beforeLabel, lang)}</div><p className="mt-1 text-sm text-landing-muted leading-[1.6]">{tx(p.b, lang)}</p></div>
              <div className="border-t border-landing-line pt-4"><div className="text-[11px] font-extrabold text-landing-brand">{tx(cloud.afterLabel, lang)}</div><p className="mt-1 text-[15px] font-semibold text-landing-ink leading-[1.6]">{tx(p.a, lang)}</p></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}