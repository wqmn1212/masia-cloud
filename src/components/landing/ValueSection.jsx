import React from 'react';
import { value } from '@/lib/landingCapabilities';
import { tx } from '@/lib/landingContent';
import SectionHeading from './SectionHeading';

// 합리적인 가격의 근거 5가지 (수치 약속 없이 구조로 설명)
export default function ValueSection({ lang }) {
  return (
    <section id="value" className="border-t border-landing-line px-5 lg:px-8 py-16 lg:py-[88px]">
      <div className="max-w-[1200px] mx-auto">
        <SectionHeading eyebrow={value.eyebrow} title={tx(value.h2, lang)} />
        <p className="mt-4 max-w-[760px] text-[15.5px] leading-[1.75] text-landing-ink3">{tx(value.sub, lang)}</p>
        <ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {value.items.map((v, i) => (
            <li key={i} className="flex flex-col rounded-[14px] border border-landing-line bg-white p-5">
              <span className="font-mono text-[12px] font-bold text-landing-brand">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mt-2 text-[16px] font-bold tracking-[-0.4px] text-landing-ink">{tx(v.t, lang)}</h3>
              <p className="mt-1.5 text-[13.5px] leading-[1.65] text-landing-ink3">{tx(v.d, lang)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
