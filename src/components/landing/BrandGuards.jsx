import React from 'react';
import { tx } from '@/lib/landingContent';
import { brand } from '@/lib/brandContent';

export default function BrandGuards({ lang }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {brand.guards.map((g) => (
        <div key={g.t[0]} className="border border-landing-line rounded-[13px] bg-white p-5">
          <h3 className="text-[16px] font-bold text-landing-ink">{tx(g.t, lang)}</h3>
          <p className="mt-2 text-[14px] leading-[1.75] text-landing-muted">{tx(g.d, lang)}</p>
        </div>
      ))}
    </div>
  );
}