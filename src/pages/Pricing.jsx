import React, { useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import useLandingLang from '@/lib/useLandingLang';
import { getHomePath } from '@/lib/menuPermissions';
import { tx } from '@/lib/landingContent';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';
import PricingTable from '@/components/pricing/PricingTable';
import PricingBlock from '@/components/pricing/PricingBlock';
import { page, plans, compareRows, compareNotes, included, includedNotes, singles, singleNotes, terms, termsNote } from '@/lib/pricingContent';
import '@/components/landing/landingMinimal.css';

export default function Pricing() {
  const [lang, setLang] = useLandingLang();
  const { isAuthenticated, user, navigateToLogin } = useAuth();
  useEffect(() => {
    document.title = tx(page.meta, lang);
    document.querySelector('meta[name="description"]')?.setAttribute('content', tx(page.desc, lang));
  }, [lang]);

  return (
    <div lang={lang} className="landing-minimal font-landing text-landing-ink antialiased min-h-screen">
      <LandingHeader lang={lang} setLang={setLang} isAuthenticated={isAuthenticated} homePath={getHomePath(user)} onLogin={navigateToLogin} />
      <main className="max-w-[1200px] mx-auto px-5 lg:px-8 py-14">
        <div className="text-[12px] font-bold tracking-[.08em] text-landing-brand">PRICING</div>
        <h1 className="mt-3 text-[32px] md:text-[44px] font-extrabold tracking-[-1px] leading-[1.25]">{tx(page.h1, lang)}</h1>
        <p className="mt-5 max-w-[820px] text-[16px] leading-[1.85] text-landing-muted">{tx(page.lead, lang)}</p>

        <PricingBlock title={page.compareTitle} notes={compareNotes} lang={lang}>
          <PricingTable head={[page.item, ...plans]} rows={compareRows} highlightCol={2} lang={lang} />
        </PricingBlock>
        <PricingBlock title={page.includedTitle} notes={includedNotes} lang={lang}>
          <PricingTable head={page.incHead} rows={included} lang={lang} />
        </PricingBlock>
        <PricingBlock title={page.singlesTitle} notes={singleNotes} lang={lang}>
          <PricingTable head={page.singleHead} rows={singles} lang={lang} />
        </PricingBlock>
        <PricingBlock title={page.termsTitle} notes={[termsNote]} lang={lang}>
          <PricingTable head={[page.item, page.condition]} rows={terms} lang={lang} />
        </PricingBlock>

        <div className="mt-16 rounded-[13px] bg-landing-tint p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <p className="text-[18px] font-bold">{tx(page.ctaTitle, lang)}</p>
          <a href="/#contact" className="bg-landing-ink hover:bg-landing-brand-hover text-white text-sm font-bold px-5 py-3 rounded-[9px]">{tx(page.ctaBtn, lang)}</a>
        </div>
      </main>
      <LandingFooter lang={lang} />
    </div>
  );
}