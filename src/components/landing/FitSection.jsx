import React from 'react';
import { fit } from '@/lib/landingTeamContent';
import { tx } from '@/lib/landingContent';
import SectionHeading from './SectionHeading';
import { cn } from '@/lib/utils';

export default function FitSection({ lang }) {
  return (
    <section id="fit" className="border-t border-landing-line bg-white px-5 lg:px-8 py-16 lg:py-[88px]">
      <div className="max-w-[1200px] mx-auto">
        <SectionHeading eyebrow={fit.eyebrow} title={tx(fit.h2, lang)} maxWidth="max-w-[620px]" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10">
          {fit.targets.map((c, i) => (
            <div key={i} className="border border-landing-line rounded-[13px] p-[22px] bg-landing-page">
              <div className="text-[11px] font-extrabold font-mono text-landing-muted3">{String(i + 1).padStart(2, '0')}</div>
              <h3 className="mt-3 text-[16.5px] font-bold tracking-[-0.4px] text-landing-ink">{tx(c.t, lang)}</h3>
              <p className="mt-2 text-sm leading-[1.62] text-landing-muted">{tx(c.d, lang)}</p>
            </div>
          ))}
        </div>
        <h3 className="mt-12 text-lg font-bold tracking-[-0.5px] text-landing-ink">{tx(fit.modelTitle, lang)}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {fit.models.map((m, i) => (
            <div key={i} className={cn('rounded-[13px] p-[22px]', m.highlight ? 'bg-landing-tint-soft border-[1.5px] border-landing-brand' : 'bg-white border border-landing-line')}>
              <div className="text-sm text-landing-muted">{tx(m.k, lang)}</div>
              <div className={cn('mt-1.5 text-[18px] font-bold tracking-[-0.5px]', m.highlight ? 'text-landing-brand-deep' : 'text-landing-ink')}>→ {tx(m.v, lang)}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}