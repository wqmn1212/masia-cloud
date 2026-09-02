import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import useLandingLang from '@/lib/useLandingLang';
import LandingHeader from '@/components/landing/LandingHeader';
import HeroSection from '@/components/landing/HeroSection';
import AboutSection from '@/components/landing/AboutSection';
import ProcessSection from '@/components/landing/ProcessSection';
import CategorySection from '@/components/landing/CategorySection';
import TrustSection from '@/components/landing/TrustSection';
import ContactSection from '@/components/landing/ContactSection';
import LandingFooter from '@/components/landing/LandingFooter';

export default function Landing() {
  const [lang, setLang] = useLandingLang();
  const [cat, setCat] = useState('all');
  const { isAuthenticated } = useAuth();

  return (
    <div
      className="font-landing bg-landing-page text-landing-ink min-w-[320px] antialiased"
      style={{ wordBreak: lang === 'zh' ? 'normal' : 'keep-all', overflowWrap: 'break-word' }}
    >
      <LandingHeader lang={lang} setLang={setLang} isAuthenticated={isAuthenticated} />
      <HeroSection lang={lang} />
      <AboutSection lang={lang} />
      <ProcessSection lang={lang} />
      <CategorySection lang={lang} cat={cat} setCat={setCat} />
      <TrustSection lang={lang} />
      <ContactSection lang={lang} />
      <LandingFooter lang={lang} />
    </div>
  );
}