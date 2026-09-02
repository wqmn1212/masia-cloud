import React from 'react';
import { trust, tx } from '@/lib/landingContent';
import SectionHeading from './SectionHeading';

export default function TrustSection({ lang }) {
  return (
    <section id="trust" className="border-t border-landing-line bg-landing-ink text-white px-5 lg:px-8 py-16 lg:py-[88px]">
      <div className="max-w-[1200px] mx-auto">
        <SectionHeading eyebrow={trust.eyebrow} title={tx(trust.h2, lang)} dark maxWidth="max-w-[640px]" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-[18px] mt-10">
          {trust.cards.map((c, i) => (
            <div key={i} className="border border-landing-dark-line rounded-[14px] p-[26px] bg-landing-dark-card">
              <h3 className="text-lg font-bold tracking-[-0.5px] text-white">{tx(c.t, lang)}</h3>
              <p className="mt-2.5 text-[14.5px] leading-[1.66] text-landing-dark-body">{tx(c.d, lang)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}