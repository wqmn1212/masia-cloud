import React, { useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import useLandingLang from '@/lib/useLandingLang';
import { getHomePath } from '@/lib/menuPermissions';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';
import ClientGuideBody from '@/components/client/guide/ClientGuideBody';
import { CG, t } from '@/components/client/guide/clientGuideContent';
import { Card } from '@/components/ui/card';
import '@/components/landing/landingMinimal.css';

// 고객 포털 이용 가이드와 같은 본문 (공개용, 3개 언어)
export default function CloudGuide() {
  const [lang, setLang] = useLandingLang();
  const { isAuthenticated, user, navigateToLogin } = useAuth();
  useEffect(() => { document.title = `AEGIS Cloud ${t(CG.title, lang)}`; }, [lang]);

  return (
    <div lang={lang} className="landing-minimal font-landing text-landing-ink antialiased min-h-screen">
      <LandingHeader lang={lang} setLang={setLang} isAuthenticated={isAuthenticated} homePath={getHomePath(user)} onLogin={navigateToLogin} />
      <div className="bg-background text-foreground px-5 lg:px-8 py-10">
        <ClientGuideBody
          lang={lang}
          stickyTop="top-[74px]"
          cta={
            <Card className="p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{t(CG.ctaPublic.title, lang)}</p>
                <p className="text-sm text-muted-foreground">{t(CG.ctaPublic.desc, lang)}</p>
              </div>
              <a href="/#contact" className="bg-primary text-primary-foreground text-sm font-semibold px-4 py-2.5 rounded-md">{t(CG.ctaPublic.button, lang)}</a>
            </Card>
          }
        />
      </div>
      <LandingFooter lang={lang} />
    </div>
  );
}