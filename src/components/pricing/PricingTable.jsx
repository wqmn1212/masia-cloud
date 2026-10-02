import React from 'react';
import { cn } from '@/lib/utils';
import { tx } from '@/lib/landingContent';

// head/rows cells are [ko, en, zh] arrays; rows may include {group}
export default function PricingTable({ head, rows, highlightCol, lang }) {
  return (
    <div className="overflow-x-auto rounded-[13px] border border-landing-line bg-white">
      <table className="w-full min-w-[880px] text-[14px] border-collapse">
        <thead>
          <tr className="bg-landing-page">
            {head.map((h, i) => (
              <th key={i} className={cn('text-left px-4 py-3 font-bold border-b border-landing-line', i === highlightCol && 'text-landing-brand bg-landing-tint')}>{tx(h, lang)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => r.group ? (
            <tr key={i}><td colSpan={head.length} className="px-4 pt-4 pb-2 text-[12px] font-extrabold tracking-[.06em] text-landing-brand">{tx(r.group, lang)}</td></tr>
          ) : (
            <tr key={i} className="border-b border-landing-line last:border-0 align-top">
              {r.map((c, j) => (
                <td key={j} className={cn('px-4 py-3 leading-[1.6]', j === 0 ? 'font-semibold text-landing-ink2 whitespace-nowrap' : 'text-landing-ink', j === highlightCol && 'bg-landing-tint-soft font-semibold')}>{tx(c, lang)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}