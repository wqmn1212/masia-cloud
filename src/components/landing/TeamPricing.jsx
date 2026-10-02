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
              'rounded-[13px] p-[22px]',
              t.highlight ? 'bg-landing-tint-soft border-[1.5px] border-landing-brand' : 'bg-white border border-landing-line'
            )}
          >
            <div className={cn('text-[11px] font-extrabold font-mono', t.highlight ? 'text-landing-brand' : 'text-landing-muted3')}>{tx(t.t, lang)}</div>
            <div className={cn('mt-3 text-[26px] font-extrabold tracking-[-1px]', t.highlight ? 'text-landing-brand-deep' : 'text-landing-ink')}>
              {tx(t.price, lang)} <span className="text-sm font-semibold text-landing-muted">{tx(team.perMonth, lang)}</span>
            </div>
            <p className="mt-2 text-sm leading-[1.62] text-landing-muted">{tx(t.ex, lang)}</p>
            {t.points && (
              <ul className="mt-4 pt-4 border-t border-landing-line space-y-2">
                {t.points.map((p, j) => (
                  <li key={j} className="flex gap-2 text-[13.5px] leading-[1.55] text-landing-ink2">
                    <span className={cn('mt-[7px] h-1.5 w-1.5 flex-none rounded-full', t.highlight ? 'bg-landing-brand' : 'bg-landing-muted3')} aria-hidden="true" />
                    {tx(p, lang)}
                  </li>
                ))}
              </ul>
            )}
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
      <a href="/pricing" className="mt-5 inline-flex items-center justify-center border-[1.5px] border-landing-brand text-landing-brand hover:bg-landing-brand hover:text-white text-sm font-bold px-5 py-3 rounded-[9px] transition-colors">
        {tx(['상세 요금 비교하기 →', 'Compare plans in detail →', '查看详细价格对比 →'], lang)}
      </a>
    </div>
  );
}