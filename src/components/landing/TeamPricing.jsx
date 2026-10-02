import React from 'react';
import { team } from '@/lib/landingTeamContent';
import { tx } from '@/lib/landingContent';
import { planCards, recommendedLabel, terms, termsNote, page } from '@/lib/pricingContent';
import { PLAN_THEME } from '@/lib/planTheme';
import { cn } from '@/lib/utils';
import EnterpriseCard from '@/components/landing/EnterpriseCard';

export default function TeamPricing({ lang }) {
  return (
    <div className="mt-12">
      <h3 className="text-lg font-bold tracking-[-0.5px] text-landing-ink">{tx(team.priceTitle, lang)}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        {planCards.map((p, i) => { const t = PLAN_THEME[p.theme]; return (
          <div key={i} className={cn('relative overflow-hidden rounded-[13px] p-[22px] bg-white border', t.line)}>
            <div className={cn('absolute inset-x-0 top-0 h-1', t.bar)} aria-hidden="true" />
            <div className={cn('flex flex-wrap items-center gap-2 text-[12px] font-extrabold', t.text)}>
              {tx(p.name, lang)}
              {p.recommended && <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-extrabold text-white', t.bar)}>{tx(recommendedLabel, lang)}</span>}
            </div>
            <div className={cn('mt-3 text-[26px] font-extrabold tracking-[-1px]', t.text)}>
              {tx(p.price, lang)} <span className="text-sm font-semibold text-landing-muted">{tx(team.perMonth, lang)}</span>
            </div>
            <p className="mt-2 text-sm leading-[1.62] text-landing-muted">{tx(p.ex, lang)}</p>
            <dl className="mt-4 pt-3 border-t border-landing-line space-y-1.5">
              {p.lines.map(([k, v], j) => (
                <div key={j} className="flex gap-3 text-[13px]">
                  <dt className="w-24 shrink-0 text-landing-muted">{tx(k, lang)}</dt>
                  <dd className="text-landing-ink font-semibold">{tx(v, lang)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ); })}
        <EnterpriseCard lang={lang} />
      </div>
      <dl className="mt-4 bg-white border border-landing-line rounded-[13px] divide-y divide-landing-line">
        {terms.map(([k, v], i) => (
          <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6 px-[22px] py-3.5">
            <dt className="sm:w-40 shrink-0 text-[13px] font-bold text-landing-muted">{tx(k, lang)}</dt>
            <dd className="text-[14.5px] text-landing-ink">{tx(v, lang)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[12.5px] text-landing-muted2">{tx(termsNote, lang)}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <a
          href="#contact"
          onClick={() => window.dispatchEvent(new CustomEvent('aegis:inquiry-type', { detail: 'monthly' }))}
          className="inline-flex items-center justify-center bg-landing-ink hover:bg-landing-brand-hover text-white text-sm font-bold px-5 py-3 rounded-[9px] transition-colors"
        >
          {tx(team.cta, lang)}
        </a>
        <a href="/pricing" className="inline-flex items-center justify-center border-[1.5px] border-landing-brand text-landing-brand hover:bg-landing-brand hover:text-white text-sm font-bold px-5 py-3 rounded-[9px] transition-colors">
          {tx(page.detailBtn, lang)}
        </a>
      </div>
    </div>
  );
}