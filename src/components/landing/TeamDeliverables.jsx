import React from 'react';
import { team } from '@/lib/landingTeamContent';
import { tx } from '@/lib/landingContent';

export default function TeamDeliverables({ lang }) {
  return (
    <div className="mt-12">
      <h3 className="text-lg font-bold tracking-[-0.5px] text-landing-ink">{tx(team.deliverTitle, lang)}</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px mt-4 bg-landing-line border border-landing-line rounded-[13px] overflow-hidden">
        {team.deliverables.map((d, i) => (
          <div key={i} className="bg-white p-[22px]">
            <div className="text-[22px] font-extrabold tracking-[-0.8px] text-landing-ink">{tx(d.v, lang)}</div>
            <div className="mt-1.5 text-sm text-landing-muted">{tx(d.t, lang)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}