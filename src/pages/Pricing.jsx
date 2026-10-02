import React, { useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import useLandingLang from '@/lib/useLandingLang';
import { getHomePath } from '@/lib/menuPermissions';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';
import PricingTable from '@/components/pricing/PricingTable';
import PricingBlock from '@/components/pricing/PricingBlock';
import { plans, compareRows, compareNotes, included, includedNotes, singles, singleNotes, terms, termsNote } from '@/lib/pricingContent';
import '@/components/landing/landingMinimal.css';

export default function Pricing() {
  const [lang, setLang] = useLandingLang();
  const { isAuthenticated, user, navigateToLogin } = useAuth();
  useEffect(() => {
    document.title = 'AEGIS 제조팀 구독 플랜 · 상세 요금 비교';
    document.querySelector('meta[name="description"]')?.setAttribute('content', 'AEGIS 라이트·스탠다드·프로 구독 플랜 비교, 포함 범위와 실비, 단건 상품, 계약 조건 안내.');
  }, []);

  return (
    <div className="landing-minimal font-landing text-landing-ink antialiased min-h-screen">
      <LandingHeader lang={lang} setLang={setLang} isAuthenticated={isAuthenticated} homePath={getHomePath(user)} onLogin={navigateToLogin} />
      <main className="max-w-[1200px] mx-auto px-5 lg:px-8 py-14">
        <div className="text-[12px] font-bold tracking-[.08em] text-landing-brand">PRICING</div>
        <h1 className="mt-3 text-[32px] md:text-[44px] font-extrabold tracking-[-1px] leading-[1.25]">제조팀 구독 플랜 상세 비교</h1>
        <p className="mt-5 max-w-[820px] text-[16px] leading-[1.85] text-landing-muted">세 플랜 모두 같은 담당 팀(한국 PM 1명 + 중국 현지 QC·PM 2명)이 맡습니다. 플랜에 따라 관리 범위와 현장 방문 횟수가 달라집니다. VAT 별도.</p>

        <PricingBlock title="플랜 비교" notes={compareNotes}>
          <PricingTable head={['항목', ...plans]} rows={compareRows} highlightCol={2} />
        </PricingBlock>
        <PricingBlock title="포함 범위와 실비" notes={includedNotes}>
          <PricingTable head={['구독료에 포함', '실비로 따로 청구']} rows={included} />
        </PricingBlock>
        <PricingBlock title="단건 상품 (구독 전 체험)" notes={singleNotes}>
          <PricingTable head={['상품', '내용', '결과물', '가격 (VAT 별도)']} rows={singles} />
        </PricingBlock>
        <PricingBlock title="계약 조건" notes={[termsNote]}>
          <PricingTable head={['항목', '조건']} rows={terms} />
        </PricingBlock>

        <div className="mt-16 rounded-[13px] bg-landing-tint p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <p className="text-[18px] font-bold">어떤 플랜이 맞을지 무료 상담으로 안내해 드립니다</p>
          <a href="/#contact" className="bg-landing-ink hover:bg-landing-brand-hover text-white text-sm font-bold px-5 py-3 rounded-[9px]">무료 상담 요청</a>
        </div>
      </main>
      <LandingFooter lang={lang} />
    </div>
  );
}