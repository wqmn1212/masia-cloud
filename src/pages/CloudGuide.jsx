import React, { useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import useLandingLang from '@/lib/useLandingLang';
import { getHomePath } from '@/lib/menuPermissions';
import { tx } from '@/lib/landingContent';
import { guideMeta, steps } from '@/lib/cloudGuideContent';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';
import GuideMockFrame from '@/components/cloudguide/GuideMockFrame';
import { MockMenu, MockDashboard, MockBoard } from '@/components/cloudguide/GuideMocksA';
import { MockDetail, MockChat } from '@/components/cloudguide/GuideMocksB';
import '@/components/landing/landingMinimal.css';

const MOCKS = { menu: MockMenu, dashboard: MockDashboard, board: MockBoard, detail: MockDetail, chat: MockChat };

export default function CloudGuide() {
  const [lang, setLang] = useLandingLang();
  const { isAuthenticated, user, navigateToLogin } = useAuth();
  useEffect(() => {
    document.title = tx(guideMeta.title, lang);
    document.querySelector('meta[name="description"]')?.setAttribute('content', tx(guideMeta.desc, lang));
  }, [lang]);

  return (
    <div lang={lang} className="landing-minimal font-landing text-landing-ink antialiased min-h-screen">
      <LandingHeader lang={lang} setLang={setLang} isAuthenticated={isAuthenticated} homePath={getHomePath(user)} onLogin={navigateToLogin} />
      <main className="max-w-[1200px] mx-auto px-5 lg:px-8 py-14">
        <div className="text-[12px] font-bold tracking-[.08em] text-landing-brand">{tx(guideMeta.eyebrow, lang)}</div>
        <h1 className="mt-3 text-[32px] md:text-[44px] font-extrabold tracking-[-1px] leading-[1.25]">{tx(guideMeta.title, lang)}</h1>
        <p className="mt-5 max-w-[820px] text-[16px] leading-[1.85] text-landing-muted">{tx(guideMeta.lead, lang)}</p>
        <div className="mt-12 space-y-14">
          {steps.map((s, i) => {
            const Mock = MOCKS[s.mock];
            return (
              <section key={s.id} className="grid lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] gap-6 lg:gap-12 items-center">
                <div>
                  <div className="text-[13px] font-bold text-landing-brand">{String(i + 1).padStart(2, '0')}</div>
                  <h2 className="mt-2 text-[22px] md:text-[26px] font-extrabold tracking-[-.5px]">{tx(s.t, lang)}</h2>
                  <p className="mt-3 text-[15px] leading-[1.8] text-landing-muted">{tx(s.d, lang)}</p>
                </div>
                <GuideMockFrame label={tx(guideMeta.sample, lang)}><Mock lang={lang} /></GuideMockFrame>
              </section>
            );
          })}
        </div>
        <div className="mt-16 rounded-[13px] bg-landing-tint p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <p className="text-[18px] font-bold">{tx(guideMeta.ctaTitle, lang)}</p>
          <a href="/#contact" className="bg-landing-ink hover:bg-landing-brand-hover text-white text-sm font-bold px-5 py-3 rounded-[9px]">{tx(guideMeta.ctaBtn, lang)}</a>
        </div>
      </main>
      <LandingFooter lang={lang} />
    </div>
  );
}