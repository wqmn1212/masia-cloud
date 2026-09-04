import React from 'react';
import { categories, tx } from '@/lib/landingContent';
import { cn } from '@/lib/utils';

export default function PortfolioCard({ item, lang }) {
  const priceLabel = categories.priceLegend[item.priceType];
  return (
    <article className="border border-landing-line rounded-[13px] overflow-hidden bg-white">
      {item.image ? (
        <img src={item.image} alt={tx(item.t, lang)} className="h-[150px] w-full object-cover" />
      ) : (
        <div className="h-[150px] flex items-center justify-center bg-[repeating-linear-gradient(135deg,#F1F4FA_0_8px,#E2E9F5_8px_16px)]">
          <span className="font-mono font-semibold text-[11px] text-[#8E9CB3] tracking-[.4px]">PRODUCT SHOT</span>
        </div>
      )}
      <div className="p-[18px]">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-bold text-landing-brand font-mono">{tx(item.tag, lang)}</div>
          {priceLabel && (
            <span
              className={cn(
                'flex-none text-[10px] font-bold px-2 py-[3px] rounded-full',
                item.priceType === 'catalog' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              )}
            >
              {tx(priceLabel, lang)}
            </span>
          )}
        </div>
        <h3 className="mt-2 text-[15.5px] font-bold tracking-[-0.3px] text-landing-ink">{tx(item.t, lang)}</h3>
        <p className="mt-[7px] text-[13.5px] leading-[1.6] text-landing-muted">{tx(item.d, lang)}</p>
      </div>
    </article>
  );
}