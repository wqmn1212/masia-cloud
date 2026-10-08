import React, { useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import useLandingLang from '@/lib/useLandingLang';
import { getHomePath } from '@/lib/menuPermissions';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';
import GuideSection from '@/components/client/guide/GuideSection';
import CardTabsGuide from '@/components/client/guide/CardTabsGuide';
import GuideFaq from '@/components/client/guide/GuideFaq';
import { MockSidebar, MockDashboard, MockBoard } from '@/components/client/guide/GuideMockups';
import { G, t } from '@/components/client/guide/guideI18n';
import { Card } from '@/components/ui/card';
import '@/components/landing/landingMinimal.css';

// 고객 대시보드의 이용 가이드와 동일한 구성 (공개용, 3개 언어)
export default function CloudGuide() {
  const [lang, setLang] = useLandingLang();
  const { isAuthenticated, user, navigateToLogin } = useAuth();
  useEffect(() => { document.title = `AEGIS Cloud ${t(G.title, lang)}`; }, [lang]);

  return (
    <div lang={lang} className="landing-minimal font-landing text-landing-ink antialiased min-h-screen">
      <LandingHeader lang={lang} setLang={setLang} isAuthenticated={isAuthenticated} homePath={getHomePath(user)} onLogin={navigateToLogin} />
      <div className="bg-background text-foreground px-5 lg:px-8 py-10">
        <div className="max-w-6xl mx-auto space-y-5">
          <div>
            <h1 className="text-2xl font-bold">{t(G.title, lang)}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t(G.sub, lang)}</p>
          </div>
          <GuideSection no="01" title={t(G.s1, lang)} mock={<MockSidebar lang={lang} />}><p>{t(G.s1d, lang)}</p></GuideSection>
          <GuideSection no="02" title={t(G.s2, lang)} mock={<MockDashboard lang={lang} />}><p>{t(G.s2d, lang)}</p></GuideSection>
          <GuideSection no="03" title={t(G.s3, lang)} mock={<MockBoard lang={lang} />}><p>{t(G.s3d, lang)}</p></GuideSection>
          <CardTabsGuide lang={lang} />
          <GuideFaq lang={lang} />
          <Card className="p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{t(G.ctaT, lang)}</p>
              <p className="text-sm text-muted-foreground">{t(G.ctaD, lang)}</p>
            </div>
            <a href="/#contact" className="bg-primary text-primary-foreground text-sm font-semibold px-4 py-2.5 rounded-md">{t(G.ctaB, lang)}</a>
          </Card>
        </div>
      </div>
      <LandingFooter lang={lang} />
    </div>
  );
}