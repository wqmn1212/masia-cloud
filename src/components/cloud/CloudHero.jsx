import React from 'react';
import { cloud } from '@/lib/cloudContent';
import { tx } from '@/lib/landingContent';
import CloudMock from './CloudMock';

export default function CloudHero({ lang }) {
  return (
    <section className="px-5 lg:px-8 pt-14 pb-16 lg:pt-20 lg:pb-24">
      <div className="max-w-[1200px] mx-auto grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-landing-brand tracking-[.04em]">AEGIS Cloud</p>
          <h1 className="mt-3 text-[32px] lg:text-[46px] font-extrabold tracking-[-1.2px] leading-[1.2] text-landing-ink">{tx(cloud.h1, lang)}</h1>
          <p className="mt-5 text-base lg:text-[17px] text-landing-ink3 leading-[1.7] max-w-[540px]">{tx(cloud.sub, lang)}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/#contact" className="bg-landing-brand hover:bg-landing-brand-hover text-white text-[15px] font-bold px-5 py-3 rounded-[10px]">{tx(cloud.cta1, lang)}</a>
            <a href="/pricing" className="border border-landing-line3 bg-white text-landing-ink2 text-[15px] font-bold px-5 py-3 rounded-[10px] hover:border-landing-brand">{tx(cloud.cta2, lang)}</a>
          </div>
        </div>
        <CloudMock name="dash" lang={lang} />
      </div>
    </section>
  );
}