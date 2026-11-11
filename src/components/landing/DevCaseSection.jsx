import React from 'react';
import { tx } from '@/lib/landingContent';
import { devCase } from '@/lib/devCaseContent';
import SectionHeading from './SectionHeading';

// 개발 사례 본문 (가상 예시): 왼쪽 요약 카드, 오른쪽 단계별 진행 — 메인과 포트폴리오에서 함께 쓴다
export function DevCaseStudy({ lang }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr] lg:items-start">
      <div className="rounded-[14px] border border-landing-line bg-landing-page p-5 lg:sticky lg:top-24">
        <span className="inline-block rounded-full bg-landing-ink px-2.5 py-1 text-[11.5px] font-bold text-white">{tx(devCase.badge, lang)}</span>
        <h3 className="mt-3 text-[18px] font-bold tracking-[-0.4px] text-landing-ink">{tx(devCase.product, lang)}</h3>
        <dl className="mt-4 space-y-3">
          {devCase.facts.map((f) => (
            <div key={f.k[0]}>
              <dt className="text-[12px] font-bold text-landing-muted2">{tx(f.k, lang)}</dt>
              <dd className="mt-0.5 text-[14px] leading-[1.6] text-landing-ink2">{tx(f.v, lang)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 border-t border-landing-line pt-3 text-[12px] leading-[1.6] text-landing-muted2">{tx(devCase.note, lang)}</p>
      </div>
      <ol className="relative space-y-3">
        {devCase.stages.map((s, i) => (
          <li key={s.t[0]} className="grid gap-x-4 gap-y-1 rounded-[14px] border border-landing-line bg-white p-5 sm:grid-cols-[96px_1fr]">
            <div className="flex items-baseline gap-2 sm:block">
              <span className="font-mono text-[12px] font-bold text-landing-brand">{String(i + 1).padStart(2, '0')}</span>
              <span className="text-[13px] font-semibold text-landing-muted sm:mt-1 sm:block">{tx(s.w, lang)}</span>
            </div>
            <div className="min-w-0">
              <h4 className="text-[16px] font-bold tracking-[-0.4px] text-landing-ink">{tx(s.t, lang)}</h4>
              <p className="mt-1 text-[14px] leading-[1.7] text-landing-ink3">{tx(s.d, lang)}</p>
              <p className="mt-2 rounded-[8px] bg-landing-tint px-3 py-2 text-[13px] leading-[1.6] text-landing-brand-deep">
                <span className="mr-1.5 font-bold">{tx(devCase.pointLabel, lang)}</span>{tx(s.p, lang)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function DevCaseSection({ lang }) {
  return (
    <section id="dev-case" className="border-t border-landing-line bg-white px-5 lg:px-8 py-16 lg:py-[88px]">
      <div className="max-w-[1200px] mx-auto">
        <SectionHeading eyebrow={devCase.eyebrow} title={tx(devCase.h2, lang)} />
        <p className="mt-4 max-w-[760px] text-[15.5px] leading-[1.75] text-landing-ink3">{tx(devCase.sub, lang)}</p>
        <div className="mt-10"><DevCaseStudy lang={lang} /></div>
      </div>
    </section>
  );
}
