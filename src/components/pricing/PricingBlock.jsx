import React from 'react';
import { tx } from '@/lib/landingContent';

export default function PricingBlock({ title, notes, lang, children, className }) {
  return (
    <section className={className || 'mt-14'}>
      <h2 className="text-[22px] md:text-[26px] font-extrabold tracking-[-.5px] text-landing-ink">{tx(title, lang)}</h2>
      <div className="mt-5">{children}</div>
      {notes && (
        <ul className="mt-4 space-y-1.5 text-[13.5px] leading-[1.7] text-landing-muted list-disc pl-5">
          {notes.map((n, i) => <li key={i}>{tx(n, lang)}</li>)}
        </ul>
      )}
    </section>
  );
}