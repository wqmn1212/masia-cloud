import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import useLandingLang from '@/lib/useLandingLang';
import { getHomePath } from '@/lib/menuPermissions';
import usePublicPortfolio from '@/lib/usePublicPortfolio';
import LandingHeader from '@/components/landing/LandingHeader';
import HeroSection from '@/components/landing/HeroSection';
import AboutSection from '@/components/landing/AboutSection';
import ProcessSection from '@/components/landing/ProcessSection';
import CategorySection from '@/components/landing/CategorySection';
import TeamServiceSection from '@/components/landing/TeamServiceSection';
import FitSection from '@/components/landing/FitSection';
import TrustSection from '@/components/landing/TrustSection';
import ContactSection from '@/components/landing/ContactSection';
import LandingFooter from '@/components/landing/LandingFooter';
import '@/components/landing/landingMinimal.css';

export default function Landing() {
  const [lang, setLang] = useLandingLang();
  const [cat, setCat] = useState('all');
  const { isAuthenticated, user, navigateToLogin } = useAuth();
  const { items: portfolioItems } = usePublicPortfolio();

  return (
    <div
      lang={lang}
      className="landing-minimal font-landing text-landing-ink antialiased min-h-screen"
      style={{ wordBreak: lang === 'zh' ? 'normal' : 'keep-all', overflowWrap: 'break-word' }}
    >
      <LandingHeader
        lang={lang}
        setLang={setLang}
        isAuthenticated={isAuthenticated}
        homePath={getHomePath(user)}
        onLogin={navigateToLogin}
      />
      <main>
      <HeroSection lang={lang} />
      <AboutSection lang={lang} />
      <ProcessSection lang={lang} />
      <TeamServiceSection lang={lang} />
      <FitSection lang={lang} />
      <CategorySection lang={lang} cat={cat} setCat={setCat} source={portfolioItems} />
      <TrustSection lang={lang} />
      <ContactSection lang={lang} />
      </main>
      <LandingFooter lang={lang} />
    </div>
  );
}