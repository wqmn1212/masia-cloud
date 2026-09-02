import React from 'react';
import { hero, tx } from '@/lib/landingContent';
import SupplyStructureCard from './SupplyStructureCard';
import StatsRow from './StatsRow';

export default function HeroSection({ lang }) {
  return (
    <section id="top" className="max-w-[1200px] mx-auto px-5 lg:px-8 pt-16 pb-16 lg:pt-24 lg:pb-[72px]">
      <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-stretch lg:items-start">
        <div className="flex-1 min-w-0">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-landing-tint border border-landing-tint-border rounded-full text-[12.5px] font-bold text-landing-brand tracking-[-0.2px]">
            <span className="w-1.5 h-1.5 rounded-full bg-landing-brand block" />
            <span>{tx(hero.badge, lang)}</span>
          </div>
          <h1 className="mt-[22px] font-extrabold text-landing-ink text-[38px] leading-[1.22] tracking-[-1.4px] lg:text-[44px] lg:leading-[1.16] lg:tracking-[-1.7px] xl:text-[56px] xl:tracking-[-2.2px] [text-wrap:balance]">
            <span>{tx(hero.h1a, lang)}</span><br />
            <span className="text-landing-brand">{tx(hero.h1b, lang)}</span>
          </h1>
          <p className="mt-6 text-[17px] leading-[1.68] text-landing-ink3 max-w-[520px] [text-wrap:pretty]">{tx(hero.body, lang)}</p>
          <div className="flex flex-wrap gap-2.5 mt-8">
            <a href="#contact" className="bg-landing-ink hover:bg-landing-brand-hover text-white text-[15px] font-bold px-6 py-3.5 rounded-[10px] transition-colors">{tx(hero.cta1, lang)}</a>
            <a href="#process" className="bg-white text-landing-ink border border-landing-line3 hover:border-landing-brand hover:text-landing-brand text-[15px] font-bold px-6 py-3.5 rounded-[10px] transition-colors">{tx(hero.cta2, lang)}</a>
          </div>
          <p className="mt-3.5 text-[13px] text-landing-muted2">{tx(hero.note, lang)}</p>
        </div>
        <SupplyStructureCard lang={lang} />
      </div>
      <StatsRow lang={lang} />
    </section>
  );
}