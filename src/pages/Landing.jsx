import React, { useState } from 'react';
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
  const [prefill, setPrefill] = useState(null);
  const { isAuthenticated, user } = useAuth();

  const inquireAbout = (item) => {
    setPrefill({
      categoryValue: item.formValue,
      productName: item.title,
      intent: item.priceType === 'catalog' ? 'purchase' : 'quote',
      nonce: Date.now(),
    });
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div
      lang={lang}
      className="font-landing bg-landing-page text-landing-ink min-w-[320px] antialiased min-h-screen"
      style={{ wordBreak: lang === 'zh' ? 'normal' : 'keep-all', overflowWrap: 'break-word' }}
    >
      <LandingHeader lang={lang} setLang={setLang} isAuthenticated={isAuthenticated} user={user} />
      <HeroSection lang={lang} />
      <AboutSection lang={lang} />
      <ProcessSection lang={lang} />
      <CategorySection lang={lang} cat={cat} setCat={setCat} onInquire={inquireAbout} />
      <TrustSection lang={lang} />
      <ContactSection lang={lang} prefill={prefill} />
      <LandingFooter lang={lang} />
    </div>
  );
}