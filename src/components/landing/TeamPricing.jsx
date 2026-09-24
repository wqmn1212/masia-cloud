import React from 'react';
import { team } from '@/lib/landingTeamContent';
import { tx } from '@/lib/landingContent';
import { cn } from '@/lib/utils';

export default function TeamPricing({ lang }) {
  return (
    <div className="mt-12">
      <h3 className="text-lg font-bold tracking-[-0.5px] text-landing-ink">{tx(team.priceTitle, lang)}</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        {team.tiers.map((t, i) => (
          <div
            key={i}
            className={cn(
              'rounded-[13px] p-[22px] transition-transform duration-300 hover:-translate-y-0.5',
              t.highlight ? 'bg-landing-tint-soft border-[1.5px] border-landing-brand' : 'bg-white border border-landing-line'
            )}
          >
            <div className={cn('text-[11px] font-extrabold font-mono', t.highlight ? 'text-landing-brand' : 'text-landing-muted3')}>{tx(t.t, lang)}</div>
            <div className={cn('mt-3 text-[26px] font-extrabold tracking-[-1px]', t.highlight ? 'text-landing-brand-deep' : 'text-landing-ink')}>
              {tx(t.price, lang)} <span className="text-sm font-semibold text-landing-muted">{tx(team.perMonth, lang)}</span>
            </div>
            <p className="mt-2 text-sm leading-[1.62] text-landing-muted">{tx(t.ex, lang)}</p>
          </div>
        ))}
      </div>
      <dl className="mt-4 bg-white border border-landing-line rounded-[13px] divide-y divide-landing-line">
        {team.terms.map((r, i) => (
          <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6 px-[22px] py-3.5">
            <dt className="sm:w-40 shrink-0 text-[13px] font-bold text-landing-muted">{tx(r.k, lang)}</dt>
            <dd className="text-[14.5px] text-landing-ink">{tx(r.v, lang)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[12.5px] text-landing-muted2">{tx(team.priceNote, lang)}</p>
    </div>
  );
}