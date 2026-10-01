import React from 'react';
import { MapPin } from 'lucide-react';
import SectionHeading from '@/components/landing/SectionHeading';
import { guangdong, regionCities, tx } from '@/lib/landingContent';

export default function GuangdongSection({ lang }) {
  return (
    <section id="guangdong" aria-labelledby="guangdong-label">
      <div>
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-12 items-start">
          <div id="guangdong-label"><SectionHeading eyebrow="GUANGDONG · CHINA" title={tx(guangdong.title, lang)} /></div>
          <p className="text-base leading-relaxed text-landing-ink3">{tx(guangdong.body, lang)}</p>
        </div>
        <figure className="mt-8">
          <img src="https://media.base44.com/images/public/6a0c1b56a385588fbd4454f5/413094a79_hf_20261001_024313_01086000-79f4-4283-a8eb-357f6e1ace76.png" alt={tx(guangdong.alt, lang)} loading="lazy" width="1024" height="768" className="w-full max-h-[560px] aspect-[4/3] lg:aspect-[16/7] object-contain bg-white rounded-xl border border-landing-line" />
          
        </figure>
        <div className="mt-5 flex items-start gap-3 border-t border-landing-line pt-5">
          <MapPin className="h-5 w-5 shrink-0 text-landing-brand mt-0.5" aria-hidden="true" />
          <p className="text-sm md:text-base font-semibold text-landing-ink leading-relaxed">{tx(regionCities, lang)}</p>
        </div>
      </div>
    </section>);

}