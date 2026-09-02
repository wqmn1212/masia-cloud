import React from 'react';
import { process, tx } from '@/lib/landingContent';
import SectionHeading from './SectionHeading';
import { cn } from '@/lib/utils';

export default function ProcessSection({ lang }) {
  return (
    <section id="process" className="border-t border-landing-line px-5 lg:px-8 py-16 lg:py-[88px]">
      <div className="max-w-[1200px] mx-auto">
        <SectionHeading eyebrow={process.eyebrow} title={tx(process.h2, lang)} maxWidth="max-w-[620px]" />
        <p className="mt-3.5 text-base text-landing-ink3 max-w-[560px] leading-[1.6]">{tx(process.sub, lang)}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-11">
          {process.steps.map((s, i) => (
            <div
              key={i}
              className={cn(
                'rounded-[13px] p-[22px]',
                s.highlight ? 'bg-landing-tint-soft border-[1.5px] border-landing-brand' : 'bg-white border border-landing-line'
              )}
            >
              <div className={cn('text-[11px] font-extrabold font-mono', s.highlight ? 'text-landing-brand' : 'text-landing-muted3')}>
                STEP {String(i + 1).padStart(2, '0')}
              </div>
              <h3 className={cn('mt-3 text-[16.5px] font-bold tracking-[-0.4px]', s.highlight ? 'text-landing-brand-deep' : 'text-landing-ink')}>{tx(s.t, lang)}</h3>
              <p className={cn('mt-2 text-sm leading-[1.62]', s.highlight ? 'text-landing-ink3' : 'text-landing-muted')}>{tx(s.d, lang)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}