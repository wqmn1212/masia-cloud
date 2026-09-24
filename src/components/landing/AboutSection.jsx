import React from 'react';
import { about, tx } from '@/lib/landingContent';
import SectionHeading from './SectionHeading';

export default function AboutSection({ lang }) {
  return (
    <section id="about" className="border-t border-landing-line bg-white px-5 lg:px-8 py-16 lg:py-[88px]">
      <div className="max-w-[1200px] mx-auto">
        <SectionHeading eyebrow={about.eyebrow} title={tx(about.h2, lang)} />
        <div className="lm-about-list">
          {about.cards.map((c, i) => (
            <div key={i} className="border border-landing-line rounded-[14px] p-[26px] bg-landing-page">
              <span className="lm-list-dot" aria-hidden="true" />
              <h3 className="mt-[18px] text-lg font-bold tracking-[-0.5px] text-landing-ink">{tx(c.t, lang)}</h3>
              <p className="mt-2.5 text-[14.5px] leading-[1.66] text-landing-ink3">{tx(c.d, lang)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}