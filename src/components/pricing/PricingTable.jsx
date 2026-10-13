import React from 'react';
import { cn } from '@/lib/utils';
import { tx } from '@/lib/landingContent';
import { PLAN_THEME } from '@/lib/planTheme';

// head/rows cells are [ko, en, zh] arrays; rows may include {group}
// colThemes: 열별 플랜 테마 키 (첫 열 null). priceRow: 플랜 색을 입힐 행
export default function PricingTable({ head, rows, lang, colThemes = [], badgeCol, badgeLabel, priceRow }) {
  const theme = (j) => (colThemes[j] ? PLAN_THEME[colThemes[j]] : null);
  return (
    <div className="overflow-x-auto rounded-[13px] border border-landing-line bg-white">
      <table className="w-full min-w-[880px] text-[14px] border-collapse">
        <thead>
          <tr className="bg-landing-page">
            {head.map((h, i) => {
              const t = theme(i);
              const dark = colThemes[i] === 'ent';
              return (
                <th key={i} className={cn('relative text-left px-4 py-3 font-bold border-b border-landing-line', t && (dark ? 'bg-landing-ink text-white' : cn(t.tint, t.text)))}>
                  {t && <span className={cn('absolute inset-x-0 top-0 h-[3px]', t.bar)} aria-hidden="true" />}
                  {tx(h, lang)}
                  {i === badgeCol && t && (
                    <span className={cn('ml-1.5 rounded-full px-2 py-0.5 text-[11px] font-extrabold text-white whitespace-nowrap', t.bar)}>{tx(badgeLabel, lang)}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => r.group ? (
            <tr key={i}><td colSpan={head.length} className="px-4 pt-4 pb-2 text-[12px] font-extrabold tracking-[.06em] text-landing-muted2">{tx(r.group, lang)}</td></tr>
          ) : (
            <tr key={i} className="border-b border-landing-line last:border-0 align-top">
              {r.map((c, j) => (
                <td key={j} className={cn(
                  'px-4 py-3 leading-[1.6]',
                  j === 0 ? 'font-semibold text-landing-ink2 whitespace-nowrap' : 'text-landing-ink',
                  i === priceRow && j > 0 && theme(j) && cn('font-extrabold', colThemes[j] === 'ent' ? 'text-landing-ink' : theme(j).text)
                )}>{j === 0 && c[0] === 'AEGIS Cloud'
                  ? <a href="/cloud" className="text-landing-brand hover:underline">AEGIS Cloud</a>
                  : tx(c, lang)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}