import React from 'react';
import { team } from '@/lib/landingTeamContent';
import { tx } from '@/lib/landingContent';
import SectionHeading from './SectionHeading';
import TeamRolesScope from './TeamRolesScope';
import TeamDeliverables from './TeamDeliverables';
import TeamPricing from './TeamPricing';

export default function TeamServiceSection({ lang }) {
  return (
    <section id="team" className="border-t border-landing-line px-5 lg:px-8 py-16 lg:py-[88px]">
      <div className="max-w-[1200px] mx-auto">
        <SectionHeading eyebrow={team.eyebrow} title={tx(team.h2, lang)} maxWidth="max-w-[640px]" />
        <p className="mt-3.5 text-base text-landing-ink3 max-w-[600px] leading-[1.6]">{tx(team.sub, lang)}</p>
        <TeamRolesScope lang={lang} />
        <TeamDeliverables lang={lang} />
        <TeamPricing lang={lang} />
        <a href="#contact" className="inline-block mt-8 bg-landing-ink hover:bg-landing-brand-hover text-white text-[15px] font-bold px-6 py-3.5 rounded-[10px] transition-colors">
          {tx(team.cta, lang)}
        </a>
      </div>
    </section>
  );
}