import React from 'react';
import { cn } from '@/lib/utils';
import { tx } from '@/lib/landingContent';
import { brand } from '@/lib/brandContent';

// 이름과 역할 카드: 헤파이스토스 → 이지스 → 영웅 / 광둥 공장 → AEGIS → 고객
export default function BrandRoles({ lang }) {
  return (
    <div className="border border-landing-line rounded-[13px] bg-white p-6">
      <div className="text-[13px] font-bold text-landing-muted">{tx(brand.rolesTitle, lang)}</div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {brand.roles.map((r) => (
          <div key={r.myth[0]} className={cn('rounded-[10px] p-3 text-center', r.highlight ? 'bg-landing-tint border border-landing-tint-border' : 'bg-landing-page')}>
            <div className="text-[12px] text-landing-muted2">{tx(r.myth, lang)}</div>
            <div className={cn('mt-1 text-[15px] font-extrabold', r.highlight ? 'text-landing-brand' : 'text-landing-ink')}>{tx(r.real, lang)}</div>
            <div className="mt-1 text-[12.5px] text-landing-muted">{tx(r.d, lang)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}