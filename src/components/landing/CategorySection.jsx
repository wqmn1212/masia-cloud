import React from 'react';
import { categories, portfolio, tx } from '@/lib/landingContent';
import SectionHeading from './SectionHeading';
import PortfolioCard from './PortfolioCard';
import { cn } from '@/lib/utils';

export default function CategorySection({ lang, cat, setCat, source }) {
  const all = source?.length ? source : portfolio;
  const items = cat === 'all' ? all : all.filter((p) => p.cat === cat);
  return (
    <section id="category" className="border-t border-landing-line bg-white px-5 lg:px-8 py-16 lg:py-[88px]">
      <div className="max-w-[1200px] mx-auto">
        <div className="text-xs font-bold tracking-[1px] text-landing-brand font-mono">{categories.eyebrow}</div>
        <div className="flex flex-col lg:flex-row lg:items-end gap-4 lg:gap-8 mt-3.5">
          <SectionHeading eyebrow="" title={tx(categories.h2, lang)} maxWidth="max-w-[560px]" className="[&>div:first-child]:hidden [&>h2]:mt-0" />
          <p className="text-[15px] text-landing-muted leading-[1.6] max-w-[420px] lg:mb-1.5">{tx(categories.sub, lang)}</p>
        </div>

        <div className="flex flex-wrap gap-2 mt-8">
          {categories.tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setCat(t.id)}
              className={cn(
                'flex-none whitespace-nowrap text-[13.5px] font-bold px-[15px] py-[9px] rounded-full border transition-colors',
                cat === t.id
                  ? 'bg-landing-brand border-landing-brand text-white'
                  : 'bg-white border-landing-line2 text-landing-ink2 hover:border-landing-brand hover:text-landing-brand'
              )}
            >
              {tx(t.label, lang)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[18px] mt-7">
          {items.map((p, i) => <PortfolioCard key={`${p.cat}-${i}`} item={p} lang={lang} />)}
        </div>
        <p className="mt-[22px] text-[13.5px] text-landing-muted2">{tx(categories.footnote, lang)}</p>
      </div>
    </section>
  );
}