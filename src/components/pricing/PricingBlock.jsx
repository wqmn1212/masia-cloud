import React from 'react';

export default function PricingBlock({ title, notes, children }) {
  return (
    <section className="mt-14">
      <h2 className="text-[22px] md:text-[26px] font-extrabold tracking-[-.5px] text-landing-ink">{title}</h2>
      <div className="mt-5">{children}</div>
      {notes && (
        <ul className="mt-4 space-y-1.5 text-[13.5px] leading-[1.7] text-landing-muted list-disc pl-5">
          {notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}
    </section>
  );
}