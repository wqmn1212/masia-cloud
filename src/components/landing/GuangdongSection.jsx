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
          <img src="https://media.base44.com/images/public/6a0c1b56a385588fbd4454f5/7c5faed1e_generated_image.png" alt={tx(guangdong.alt, lang)} loading="lazy" width="1536" height="864" className="w-full aspect-video lg:aspect-[21/9] object-cover rounded-xl border border-landing-line" />
          <figcaption className="mt-2 text-xs text-landing-muted">{tx(guangdong.caption, lang)}</figcaption>
        </figure>
        <div className="mt-5 flex items-start gap-3 border-t border-landing-line pt-5">
          <MapPin className="h-5 w-5 shrink-0 text-landing-brand mt-0.5" aria-hidden="true" />
          <p className="text-sm md:text-base font-semibold text-landing-ink leading-relaxed">{tx(regionCities, lang)}</p>
        </div>
      </div>
    </section>
  );
}