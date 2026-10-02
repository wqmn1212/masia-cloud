import React, { useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import useLandingLang from '@/lib/useLandingLang';
import { getHomePath } from '@/lib/menuPermissions';
import { tx } from '@/lib/landingContent';
import { about } from '@/lib/aboutContent';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';
import '@/components/landing/landingMinimal.css';

export default function About() {
  const [lang, setLang] = useLandingLang();
  const { isAuthenticated, user, navigateToLogin } = useAuth();

  useEffect(() => {
    document.title = tx(about.title, lang);
    document.querySelector('meta[name="description"]')?.setAttribute('content', tx(about.desc, lang));
  }, [lang]);

  return (
    <div lang={lang} className="landing-minimal font-landing text-landing-ink antialiased min-h-screen" style={{ wordBreak: lang === 'zh' ? 'normal' : 'keep-all' }}>
      <LandingHeader lang={lang} setLang={setLang} isAuthenticated={isAuthenticated} homePath={getHomePath(user)} onLogin={navigateToLogin} />
      <main className="max-w-[1200px] mx-auto px-5 lg:px-8 py-14">
        <div className="text-[12px] font-bold tracking-[.08em] text-landing-brand">{tx(about.eyebrow, lang)}</div>
        <h1 className="mt-3 text-[32px] md:text-[44px] font-extrabold tracking-[-1px] leading-[1.25]">{tx(about.h1, lang)}</h1>
        <p className="mt-5 max-w-[820px] text-[16px] leading-[1.85] text-landing-muted">{tx(about.lead, lang)}</p>

        <h2 className="mt-14 text-[24px] font-extrabold tracking-[-.5px]">{tx(about.diffTitle, lang)}</h2>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {about.diffs.map((d) => (
            <div key={d.t[0]} className="border border-landing-line rounded-[13px] p-6 bg-white">
              <h3 className="text-[17px] font-bold">{tx(d.t, lang)}</h3>
              <p className="mt-2 text-[14.5px] leading-[1.75] text-landing-muted">{tx(d.d, lang)}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-14 text-[24px] font-extrabold tracking-[-.5px]">{tx(about.areaTitle, lang)}</h2>
        <p className="mt-3 text-[16px] text-landing-muted">{tx(about.area, lang)}</p>

        <div className="mt-14 rounded-[13px] bg-landing-tint p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <p className="text-[18px] font-bold">{tx(about.cta, lang)}</p>
          <div className="flex gap-2">
            <a href="/portfolio" className="border border-landing-line3 bg-white text-landing-ink2 text-sm font-bold px-5 py-3 rounded-[9px]">{tx(about.portfolioBtn, lang)}</a>
            <a href="/#contact" className="bg-landing-ink hover:bg-landing-brand-hover text-white text-sm font-bold px-5 py-3 rounded-[9px]">{tx(about.ctaBtn, lang)}</a>
          </div>
        </div>
      </main>
      <LandingFooter lang={lang} />
    </div>
  );
}