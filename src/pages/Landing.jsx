import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import useLandingLang from '@/lib/useLandingLang';
import { getHomePath } from '@/lib/menuPermissions';
import usePublicPortfolio from '@/lib/usePublicPortfolio';
import LandingHeader from '@/components/landing/LandingHeader';
import HeroSection from '@/components/landing/HeroSection';
import CapabilitySection from '@/components/landing/CapabilitySection';
import ValueSection from '@/components/landing/ValueSection';
import CloudFeatureSection from '@/components/landing/CloudFeatureSection';
import BrandSection from '@/components/landing/BrandSection';
import ProcessSection from '@/components/landing/ProcessSection';
import DevCaseSection from '@/components/landing/DevCaseSection';
import GuangdongSection from '@/components/landing/GuangdongSection';
import FastShippingSection from '@/components/landing/FastShippingSection';
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
      {/* 순서: 기술력 → 합리적인 가격 → 고객 편의 기능 → 진행 방식 → 개발 사례(가상 예시) → 브랜드 → 현장·물류 → 구독 → 대상 → 품목 → 보안 → 문의 */}
      <HeroSection lang={lang} />
      <CapabilitySection lang={lang} />
      <ValueSection lang={lang} />
      <CloudFeatureSection lang={lang} />
      <ProcessSection lang={lang} />
      <DevCaseSection lang={lang} />
      <BrandSection lang={lang} />
      <GuangdongSection lang={lang} />
      <FastShippingSection lang={lang} />
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