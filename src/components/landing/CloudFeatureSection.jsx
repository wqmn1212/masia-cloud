import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { MockPlainContext } from '@/components/guide/mockKit';
import { QuoteMock } from '@/components/client/guide/clientMocksB';
import { DashMock, PayMock } from '@/components/client/guide/clientMocksC';
import { ReviewMock, ApprovalMock } from '@/components/client/guide/clientMocksD';
import { CostsMock } from '@/components/client/guide/clientMocksE';
import { cloudFeatures } from '@/lib/landingCapabilities';
import { tx } from '@/lib/landingContent';
import SectionHeading from './SectionHeading';

const MOCKS = { dash: DashMock, quote: QuoteMock, review: ReviewMock, approval: ApprovalMock, costs: CostsMock, pay: PayMock };

// 고객 편의 기능: 왼쪽 기능 목록을 누르면 오른쪽에 그 기능의 예시 화면
export default function CloudFeatureSection({ lang }) {
  const [active, setActive] = useState(cloudFeatures.tabs[0].key);
  const tab = cloudFeatures.tabs.find((t) => t.key === active);
  const Mock = MOCKS[active];

  return (
    <section id="cloud-features" className="border-t border-landing-line bg-white px-5 lg:px-8 py-16 lg:py-[88px]">
      <div className="max-w-[1200px] mx-auto">
        <SectionHeading eyebrow={cloudFeatures.eyebrow} title={tx(cloudFeatures.h2, lang)} />
        <p className="mt-4 max-w-[760px] text-[15.5px] leading-[1.75] text-landing-ink3">{tx(cloudFeatures.sub, lang)}</p>

        <div className="mt-10 grid gap-6 lg:grid-cols-[340px_1fr] lg:items-stretch">
          <div role="tablist" aria-label="AEGIS Cloud" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {cloudFeatures.tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={t.key === active}
                onClick={() => setActive(t.key)}
                className={`shrink-0 rounded-[12px] border px-4 py-3 text-left transition-colors lg:w-full ${t.key === active ? 'border-landing-brand bg-landing-tint' : 'border-landing-line bg-white hover:bg-landing-page'}`}
              >
                <span className={`block text-[14.5px] font-bold ${t.key === active ? 'text-landing-brand-deep' : 'text-landing-ink'}`}>{tx(t.t, lang)}</span>
                <span className="mt-1 hidden text-[13px] leading-[1.6] text-landing-ink3 lg:block">{tx(t.d, lang)}</span>
              </button>
            ))}
          </div>
          <div role="tabpanel" className="flex min-w-0 flex-col justify-center rounded-[14px] border border-landing-line bg-landing-page p-4 sm:p-6">
            <p className="mb-3 text-[13.5px] leading-[1.6] text-landing-ink3 lg:hidden">{tx(tab.d, lang)}</p>
            <div className="mx-auto w-full max-w-[560px] text-left lg:my-10 lg:origin-center lg:scale-[1.2]"><MockPlainContext.Provider value={true}><Mock /></MockPlainContext.Provider></div>
            <p className="mt-3 text-center text-[11px] text-landing-muted2 lg:mt-6">{tx(cloudFeatures.sample, lang)}</p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-bold text-landing-ink2">{tx(cloudFeatures.extrasTitle, lang)}</span>
            {cloudFeatures.extras.map((e) => (
              <span key={e[0]} className="inline-flex items-center gap-1 rounded-full border border-landing-line bg-white px-3 py-1.5 text-[12.5px] font-semibold text-landing-ink3"><Check className="h-3.5 w-3.5 text-landing-brand" />{tx(e, lang)}</span>
            ))}
          </div>
          <a href="/cloud" className="shrink-0 text-[14px] font-bold text-landing-brand hover:underline">{tx(cloudFeatures.more, lang)}</a>
        </div>
      </div>
    </section>
  );
}
