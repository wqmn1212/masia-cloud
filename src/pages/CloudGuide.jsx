import React, { useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import useLandingLang from '@/lib/useLandingLang';
import { getHomePath } from '@/lib/menuPermissions';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';
import ClientGuideBody from '@/components/client/guide/ClientGuideBody';
import { tr, UI } from '@/components/client/guide/clientGuideContent';
import { Card } from '@/components/ui/card';
import '@/components/landing/landingMinimal.css';

const CTA = {
  t: ['AEGIS와 프로젝트를 시작해 보세요', 'Start a project with AEGIS', '与 AEGIS 开始项目'],
  d: ['요구사항을 남겨 주시면 담당자가 연락드립니다.', 'Leave your requirements and we will contact you.', '留下需求，负责人会与您联系。'],
  b: ['견적 요청하기', 'Request a quote', '申请报价'],
};

// 고객 포털 이용 가이드와 같은 본문 (공개용, 3개 언어)
export default function CloudGuide() {
  const [lang, setLang] = useLandingLang();
  const { isAuthenticated, user, navigateToLogin } = useAuth();
  useEffect(() => { document.title = `AEGIS Cloud ${tr(UI.title, lang)}`; }, [lang]);

  return (
    <div lang={lang} className="landing-minimal font-landing text-landing-ink antialiased min-h-screen">
      <LandingHeader lang={lang} setLang={setLang} isAuthenticated={isAuthenticated} homePath={getHomePath(user)} onLogin={navigateToLogin} />
      <div className="bg-background text-foreground px-5 lg:px-8 py-10">
        <ClientGuideBody lang={lang} footer={
          <Card className="p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{tr(CTA.t, lang)}</p>
              <p className="text-sm text-muted-foreground">{tr(CTA.d, lang)}</p>
            </div>
            <a href="/#contact" className="bg-primary text-primary-foreground text-sm font-semibold px-4 py-2.5 rounded-md">{tr(CTA.b, lang)}</a>
          </Card>
        } />
      </div>
      <LandingFooter lang={lang} />
    </div>
  );
}