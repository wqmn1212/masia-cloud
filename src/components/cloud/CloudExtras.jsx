import React from 'react';
import { cloud } from '@/lib/cloudContent';
import { tx } from '@/lib/landingContent';

export default function CloudExtras({ lang }) {
  return (
    <section className="bg-landing-page border-y border-landing-line px-5 lg:px-8 py-16">
      <div className="max-w-[1200px] mx-auto grid md:grid-cols-3 gap-4">
        {cloud.extras.map((e, i) => (
          <div key={i} className="rounded-[13px] bg-white border border-landing-line p-5">
            <h3 className="text-[16px] font-bold text-landing-ink">{tx(e.t, lang)}</h3>
            <p className="mt-2 text-sm text-landing-muted leading-[1.6]">{tx(e.d, lang)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}