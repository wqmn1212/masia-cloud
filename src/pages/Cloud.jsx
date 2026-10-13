import React, { useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import useLandingLang from '@/lib/useLandingLang';
import { getHomePath } from '@/lib/menuPermissions';
import { tx } from '@/lib/landingContent';
import { cloud } from '@/lib/cloudContent';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';
import CloudHero from '@/components/cloud/CloudHero';
import CloudBeforeAfter from '@/components/cloud/CloudBeforeAfter';
import CloudScenes from '@/components/cloud/CloudScenes';
import CloudExtras from '@/components/cloud/CloudExtras';
import CloudAccount from '@/components/cloud/CloudAccount';
import '@/components/landing/landingMinimal.css';

export default function Cloud() {
  const [lang, setLang] = useLandingLang();
  const { isAuthenticated, user, navigateToLogin } = useAuth();
  useEffect(() => { document.title = tx(cloud.docTitle, lang); }, [lang]);

  return (
    <div lang={lang} className="landing-minimal font-landing text-landing-ink antialiased min-h-screen overflow-x-hidden">
      <LandingHeader lang={lang} setLang={setLang} isAuthenticated={isAuthenticated} homePath={getHomePath(user)} onLogin={navigateToLogin} />
      <CloudHero lang={lang} />
      <CloudBeforeAfter lang={lang} />
      <CloudScenes lang={lang} />
      <CloudExtras lang={lang} />
      <CloudAccount lang={lang} />
      <section className="bg-landing-dark-panel px-5 lg:px-8 py-16 text-center">
        <h2 className="text-[24px] lg:text-[30px] font-extrabold tracking-[-0.6px] text-white">{tx(cloud.finalTitle, lang)}</h2>
        <a href="/#contact" className="inline-block mt-6 bg-landing-brand hover:bg-landing-brand-hover text-white text-[15px] font-bold px-6 py-3 rounded-[10px]">{tx(cloud.finalCta, lang)}</a>
      </section>
      <LandingFooter lang={lang} />
    </div>
  );
}