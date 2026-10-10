import React from 'react';
import { cloud } from '@/lib/cloudContent';
import { tx } from '@/lib/landingContent';
import CloudMock from './CloudMock';

export default function CloudScenes({ lang }) {
  return (
    <section className="px-5 lg:px-8 py-16 lg:py-24">
      <div className="max-w-[1200px] mx-auto space-y-16 lg:space-y-24">
        {cloud.scenes.map((s, i) => (
          <div key={i} className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center">
            <div className={`min-w-0 ${i % 2 ? 'lg:order-2' : ''}`}>
              <p className="text-[12px] font-bold text-landing-brand">{String(i + 1).padStart(2, '0')} · {tx(cloud.eyebrow, lang)}</p>
              <h3 className="mt-2 text-[22px] lg:text-[28px] font-extrabold tracking-[-0.6px] leading-[1.35] text-landing-ink">{tx(s.t, lang)}</h3>
              <p className="mt-4 text-[15px] text-landing-ink3 leading-[1.7]">{tx(s.d, lang)}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {tx(s.tags, lang).split(' · ').map((t) => <span key={t} className="text-[12px] font-semibold px-2 py-1 rounded-md bg-landing-tint text-landing-brand-deep">{t}</span>)}
              </div>
            </div>
            <div className={`min-w-0 ${i % 2 ? 'lg:order-1' : ''}`}><CloudMock name={s.mock} lang={lang} /></div>
          </div>
        ))}
      </div>
    </section>
  );
}