import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import useLandingLang from '@/lib/useLandingLang';
import { getHomePath } from '@/lib/menuPermissions';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';
import InquiryForm from '@/components/landing/InquiryForm';
import LandedCostForm, { EMPTY_LANDED_INPUT, toEngineInput } from '@/components/landedcost/LandedCostForm';
import LandedCostResult from '@/components/landedcost/LandedCostResult';
import useLogisticsRates from '@/components/landedcost/useLogisticsRates';
import { calcLandedCost, compareModes, quoteNotice } from '@/lib/landedCost';
import '@/components/landing/landingMinimal.css';

const SAMPLE = { ...EMPTY_LANDED_INPUT, cargoBy: 'TOTAL', totalCbm: '9.5', totalKg: '1200', units: '5000', goodsValue: '10000', term: 'CIF' };

// 공개 수입 물류비 계산기 — 비로그인. 공장 견적의 거래 조건으로 "별도로 낼 돈"과 도착 원가를 보여 준다.
export default function LandedCost() {
  const [lang, setLang] = useLandingLang();
  const { isAuthenticated, user, navigateToLogin } = useAuth();
  const { rates, usdKrw, rateDate } = useLogisticsRates();
  const [form, setForm] = useState(SAMPLE);
  const [inquiry, setInquiry] = useState(null);
  const contactRef = useRef(null);

  useEffect(() => {
    document.title = '수입 물류비 계산기 | AEGIS';
    document.querySelector('meta[name="description"]')?.setAttribute('content', '중국 공장 견적의 거래 조건(EXW·FOB·CIF·DDP)과 운송 방식별로 한국 도착까지 별도로 드는 비용을 계산합니다.');
  }, []);

  const engineInput = useMemo(() => toEngineInput(form, usdKrw), [form, usdKrw]);
  const result = useMemo(() => calcLandedCost(engineInput, rates), [engineInput, rates]);
  const compare = useMemo(() => compareModes(engineInput, rates), [engineInput, rates]);

  const ask = () => {
    setInquiry(`[물류비 계산기에서 상담 요청]\n${quoteNotice(result)}\n\n제품·공장 정보: `);
    setTimeout(() => contactRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  return (
    <div lang={lang} className="landing-minimal font-landing text-landing-ink antialiased min-h-screen">
      <LandingHeader lang={lang} setLang={setLang} isAuthenticated={isAuthenticated} homePath={getHomePath(user)} onLogin={navigateToLogin} />
      <main className="max-w-[1200px] mx-auto px-5 lg:px-8 py-14">
        <div className="text-[12px] font-bold tracking-[.08em] text-landing-brand">LANDED COST</div>
        <h1 className="mt-3 text-[30px] md:text-[42px] font-extrabold tracking-[-1px] leading-[1.25]">공장 견적 말고,<br className="md:hidden" /> 한국 도착까지 얼마일까요?</h1>
        <p className="mt-4 max-w-[820px] text-[15px] leading-[1.8] text-landing-muted">
          같은 물건도 거래 조건(EXW·FOB·CIF·DDP)에 따라 공장 견적에 들어가는 구간이 다르고, 나머지는 도착 후에 따로 청구됩니다.
          화물과 조건을 넣으면 구간별로 누가 얼마를 내는지, 별도로 낼 돈이 얼마인지 계산합니다.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div className="rounded-2xl border border-landing-line bg-white p-5 md:p-6">
            <LandedCostForm value={form} onChange={setForm} defaultUsdKrw={usdKrw} />
          </div>
          <div className="min-w-0 space-y-4">
            <LandedCostResult result={result} compare={compare} />
            <button type="button" onClick={ask} disabled={result.needsCargo} className="w-full rounded-[10px] bg-landing-ink px-6 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-landing-brand-hover disabled:opacity-40">
              이 조건으로 정확한 견적 받기
            </button>
            <p className="text-[12px] leading-relaxed text-landing-muted2">
              이 금액은 이지스가 최근 포워더 청구 기준으로 계산한 예상치입니다{rateDate ? ` (환율 기준일 ${rateDate})` : ''}. 실제 금액은 도착 후 실측 부피, 도착일 환율, 세관 검사, 보관 기간에 따라 달라질 수 있습니다. 관세율은 품목(HS코드)으로 확인해야 합니다.
            </p>
          </div>
        </div>

        {inquiry && (
          <section ref={contactRef} className="mt-16 max-w-[760px]">
            <h2 className="text-[24px] font-extrabold tracking-[-0.5px]">이 조건으로 상담 요청</h2>
            <p className="mt-2 text-[14px] text-landing-muted">계산 결과가 문의 내용에 들어가 있습니다. 영업일 기준 1일 안에 회신드립니다.</p>
            <div className="mt-6"><InquiryForm key={inquiry} lang={lang} initialDetail={inquiry} /></div>
          </section>
        )}
      </main>
      <LandingFooter lang={lang} />
    </div>
  );
}
