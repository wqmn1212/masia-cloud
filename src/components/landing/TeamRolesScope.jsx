import React from 'react';
import { Check } from 'lucide-react';
import { team } from '@/lib/landingTeamContent';
import { tx } from '@/lib/landingContent';

export default function TeamRolesScope({ lang }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4 mt-11">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
        {team.roles.map((r, i) => (
          <div key={i} className="bg-white border border-landing-line rounded-[13px] p-[22px]">
            <div className="text-[11px] font-extrabold font-mono text-landing-brand">{tx(r.count, lang)}</div>
            <h3 className="mt-3 text-[16.5px] font-bold tracking-[-0.4px] text-landing-ink">{tx(r.t, lang)}</h3>
            <p className="mt-2 text-sm leading-[1.62] text-landing-muted">{tx(r.d, lang)}</p>
          </div>
        ))}
      </div>
      <div className="bg-white border border-landing-line rounded-[13px] p-[22px]">
        <h3 className="text-[16.5px] font-bold tracking-[-0.4px] text-landing-ink">{tx(team.scopeTitle, lang)}</h3>
        <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">
          {team.scope.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-[1.55] text-landing-ink3">
              <Check className="w-4 h-4 mt-0.5 shrink-0 text-landing-brand" />
              <span>{tx(s, lang)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}