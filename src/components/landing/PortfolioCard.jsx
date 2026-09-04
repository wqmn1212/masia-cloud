import React from 'react';
import { tx } from '@/lib/landingContent';

export default function PortfolioCard({ item, lang }) {
  const Wrapper = item.slug ? 'a' : 'article';
  return (
    <Wrapper
      {...(item.slug ? { href: `/portfolio/${item.slug}` } : {})}
      className="block border border-landing-line rounded-[13px] overflow-hidden bg-white transition-colors hover:border-landing-brand"
    >
      {item.image ? (
        <img src={item.image} alt={tx(item.t, lang)} className="h-[150px] w-full object-cover" />
      ) : (
        <div className="h-[150px] flex items-center justify-center bg-[repeating-linear-gradient(135deg,#F1F4FA_0_8px,#E2E9F5_8px_16px)]">
          <span className="font-mono font-semibold text-[11px] text-[#8E9CB3] tracking-[.4px]">PRODUCT SHOT</span>
        </div>
      )}
      <div className="p-[18px]">
        <div className="text-[11px] font-bold text-landing-brand font-mono">{tx(item.tag, lang)}</div>
        <h3 className="mt-2 text-[15.5px] font-bold tracking-[-0.3px] text-landing-ink">{tx(item.t, lang)}</h3>
        <p className="mt-[7px] text-[13.5px] leading-[1.6] text-landing-muted">{tx(item.d, lang)}</p>
      </div>
    </Wrapper>
  );
}