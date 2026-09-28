import React from 'react';
import { Factory, Warehouse, Truck, Ship, ArrowRight } from 'lucide-react';
import SectionHeading from '@/components/landing/SectionHeading';
import { fastShipping, tx } from '@/lib/landingContent';

const icons = [Factory, Warehouse, Truck, Ship];
export default function FastShippingSection({ lang }) {
  return (
    <section id="shipping" aria-labelledby="shipping-label">
      <div>
        <div id="shipping-label"><SectionHeading eyebrow="LOGISTICS · CHINA TO KOREA" title={tx(fastShipping.title, lang)} /></div>
        <p className="mt-4">{tx(fastShipping.body, lang)}</p>
        <div className="mt-7 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-landing-tint-border bg-landing-tint-soft p-6 md:p-8">
          <div>
            <p className="text-sm font-semibold text-landing-brand">{tx(fastShipping.seaLabel, lang)}</p>
            <p className="mt-2 text-xl md:text-2xl font-bold text-landing-ink">{tx(fastShipping.seaRoute, lang)}</p>
          </div>
          <p className="text-4xl md:text-5xl font-extrabold tracking-tight text-landing-brand">{tx(fastShipping.duration, lang)}</p>
        </div>
        <ol className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {fastShipping.steps.map((step, i) => {
            const Icon = icons[i];
            return (
              <li key={i} className="min-w-0 rounded-xl border border-landing-line p-5 bg-landing-page">
                <div className="flex items-center justify-between text-landing-brand"><Icon className="h-6 w-6" aria-hidden="true" /><span className="text-xs font-bold">0{i + 1}</span></div>
                <h3 className="mt-5 text-lg font-bold text-landing-ink">{tx(step.title, lang)}</h3>
                <p className="mt-2 text-sm text-landing-ink3 leading-relaxed">{tx(step.body, lang)}</p>
                {i < 3 && <ArrowRight className="mt-4 h-4 w-4 text-landing-muted rotate-90 sm:rotate-0" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
        <div className="mt-5 text-sm leading-relaxed text-landing-muted">{tx(fastShipping.note, lang)}</div>
      </div>
    </section>
  );
}