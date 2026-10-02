import React from 'react';
import { tx } from '@/lib/landingContent';
import { brand } from '@/lib/brandContent';
import SectionHeading from './SectionHeading';
import BrandRoles from './BrandRoles';
import BrandGuards from './BrandGuards';

// 메인 이지스 소개 섹션 — Hero 와 01 WHAT WE DO 사이
export default function BrandSection({ lang }) {
  return (
    <section id="brand" className="border-t border-landing-line px-5 lg:px-8 py-16 lg:py-[88px]">
      <div className="max-w-[1200px] mx-auto">
        <SectionHeading eyebrow={brand.eyebrow} title={tx(brand.h2, lang)} />
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 items-start">
          <p className="text-base text-landing-ink3 leading-[1.8]">{tx(brand.lead, lang)}</p>
          <BrandRoles lang={lang} />
        </div>
        <h3 className="mt-10 text-[18px] font-bold text-landing-ink">{tx(brand.guardsTitle, lang)}</h3>
        <div className="mt-4"><BrandGuards lang={lang} /></div>
        <a href="/about" className="mt-6 inline-block text-sm font-bold text-landing-brand hover:underline">{tx(brand.more, lang)} →</a>
      </div>
    </section>
  );
}