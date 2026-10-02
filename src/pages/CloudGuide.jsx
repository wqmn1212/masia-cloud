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
import { Card } from '@/components/ui/card';
import '@/components/landing/landingMinimal.css';

// 고객 대시보드의 이용 가이드와 동일한 구성 (공개용)
export default function CloudGuide() {
  const [lang, setLang] = useLandingLang();
  const { isAuthenticated, user, navigateToLogin } = useAuth();
  useEffect(() => { document.title = 'AEGIS Cloud 이용 가이드'; }, []);

  return (
    <div lang={lang} className="landing-minimal font-landing text-landing-ink antialiased min-h-screen">
      <LandingHeader lang={lang} setLang={setLang} isAuthenticated={isAuthenticated} homePath={getHomePath(user)} onLogin={navigateToLogin} />
      <div className="bg-background text-foreground px-5 lg:px-8 py-10">
        <div className="max-w-6xl mx-auto space-y-5">
          <div>
            <h1 className="text-2xl font-bold">이용 가이드</h1>
            <p className="text-sm text-muted-foreground mt-1">AEGIS Cloud에서 프로젝트 진행 상황을 확인하고 담당자와 소통하는 방법을 안내합니다</p>
          </div>
          <GuideSection no="01" title="왼쪽 메뉴에서 시작합니다" mock={<MockSidebar />}>
            <p>왼쪽에 메뉴 세 개가 있습니다. 진행 상황을 한눈에 보려면 고객 대시보드, 프로젝트를 단계별로 보려면 소싱 보드, 사용법이 궁금하면 이 이용 가이드입니다.</p>
          </GuideSection>
          <GuideSection no="02" title="고객 대시보드에서 전체를 확인합니다" mock={<MockDashboard />}>
            <p>맨 위 숫자는 단계별 프로젝트 건수입니다. 그 아래에 진행 중인 프로젝트가 나열되고, 제목을 누르면 상세 화면이 열립니다. 담당자 연락처와 공유 파일도 이 화면에 있습니다.</p>
          </GuideSection>
          <GuideSection no="03" title="소싱 보드에서 단계를 확인합니다" mock={<MockBoard />}>
            <p>프로젝트가 대기 중, 소싱 중, 견적 검토, 발주·제작, 완료 다섯 단계를 지나갑니다. 단계는 AEGIS 담당자가 업데이트하므로 직접 옮기실 필요는 없습니다. 새 프로젝트를 맡기실 때는 오른쪽 위 신규 문의 작성을 누르세요.</p>
          </GuideSection>
          <CardTabsGuide />
          <GuideFaq />
          <Card className="p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-semibold">문의를 남기면 AEGIS Cloud 계정을 발급해 드립니다</p>
              <p className="text-sm text-muted-foreground">영업일 기준 1일 이내에 담당자가 회신드립니다.</p>
            </div>
            <a href="/#contact" className="bg-primary text-primary-foreground text-sm font-semibold px-4 py-2.5 rounded-md">견적 요청하기</a>
          </Card>
        </div>
      </div>
      <LandingFooter lang={lang} />
    </div>
  );
}