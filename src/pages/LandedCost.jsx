import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import useLandingLang from '@/lib/useLandingLang';
import { getHomePath } from '@/lib/menuPermissions';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';
import InquiryForm from '@/components/landing/InquiryForm';
import LandedCostForm, { EMPTY_LANDED_INPUT, toEngineInput } from '@/components/landedcost/LandedCostForm';
import LandingCostResult from '@/components/landedcost/LandingCostResult';
import useLogisticsRates from '@/components/landedcost/useLogisticsRates';
import { calcLandedCost, compareModes, fmtWon, quoteNotice } from '@/lib/landedCost';
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
  const resultRef = useRef(null);
  const [resultInView, setResultInView] = useState(false);

  // 결과 영역이 화면에 들어오면 모바일 하단 요약 바를 숨긴다
  useEffect(() => {
    const el = resultRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setResultInView(e.isIntersecting), { rootMargin: '0px 0px -30% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

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
    <div lang={lang} className="landing-minimal font-landing text-landing-ink antialiased min-h-screen overflow-x-hidden pb-20 lg:pb-0">
      <LandingHeader lang={lang} setLang={setLang} isAuthenticated={isAuthenticated} homePath={getHomePath(user)} onLogin={navigateToLogin} />
      <main className="max-w-[1200px] mx-auto px-5 lg:px-8 py-14">
        <div className="text-[12px] font-bold tracking-[.08em] text-landing-brand">LANDED COST</div>
        <h1 className="mt-3 text-[32px] md:text-[44px] font-extrabold tracking-[-1px] leading-[1.25]">공장 견적 말고, <span className="text-landing-brand">한국 도착까지</span> 얼마일까요?</h1>
        <p className="mt-5 max-w-[820px] text-[16px] leading-[1.85] text-landing-muted">
          같은 물건도 거래 조건(EXW·FOB·CIF·DDP)에 따라 공장 견적에 들어가는 구간이 다르고, 나머지는 도착 후에 따로 청구됩니다.
          화물과 조건을 넣으면 구간별로 누가 얼마를 내는지, 따로 낼 돈이 얼마인지 바로 계산합니다.
        </p>

        <div className="mt-10 grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,.95fr)_minmax(0,1.05fr)]">
          <div className="rounded-[12px] border border-[#e2e2e4] bg-white p-6 shadow-[0_8px_24px_#1717190b]">
            <LandedCostForm value={form} onChange={setForm} defaultUsdKrw={usdKrw} />
          </div>
          <div id="result" ref={resultRef} className="min-w-0 space-y-6 scroll-mt-[96px]">
            <LandingCostResult result={result} compare={compare} />
            <div className="rounded-[12px] bg-landing-ink p-6 text-white">
              <p className="text-[17px] font-extrabold tracking-[-.3px]">이 금액, 실제 견적으로 확인해 드립니다</p>
              <p className="mt-1.5 text-[14px] leading-[1.75] text-landing-dark-body">계산 결과가 문의 내용에 그대로 들어갑니다. 영업일 기준 1일 안에 회신드립니다.</p>
              <button type="button" onClick={ask} disabled={result.needsCargo} className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-lg bg-white px-5 text-[15px] font-bold text-landing-ink transition-colors hover:bg-landing-brand hover:text-white disabled:opacity-40">
                이 조건으로 상담 요청
              </button>
            </div>
            <p className="text-[12.5px] leading-[1.7] text-landing-muted">
              이 금액은 이지스가 최근 포워더 청구 기준으로 계산한 예상치입니다{rateDate ? ` (환율 기준일 ${rateDate})` : ''}. 실제 금액은 도착 후 실측 부피, 도착일 환율, 세관 검사, 보관 기간에 따라 달라질 수 있습니다. 관세율은 품목(HS코드)으로 확인해야 합니다.
            </p>
          </div>
        </div>

        {inquiry && (
          <section ref={contactRef} className="mt-16 scroll-mt-[96px] border-t border-landing-line pt-12">
            <div className="text-[11px] font-extrabold tracking-[.08em] text-landing-brand">CONTACT</div>
            <h2 className="mt-2 text-[26px] md:text-[30px] font-extrabold tracking-[-.8px]">이 조건으로 상담 요청</h2>
            <p className="mt-2 text-[15px] leading-[1.8] text-landing-muted">계산 결과가 문의 내용에 들어가 있습니다. 회사와 연락처만 넣어 주세요.</p>
            <div className="mt-6"><InquiryForm key={inquiry} lang={lang} initialDetail={inquiry} /></div>
          </section>
        )}
      </main>

      {/* 모바일: 입력하는 동안 결과 요약을 아래에 고정해서 보여 준다 */}
      {!result.needsCargo && !resultInView && (
        <a href="#result" className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-between gap-3 rounded-[12px] bg-landing-ink px-4 py-3 text-white shadow-[0_8px_24px_#17171940] lg:hidden">
          <span className="min-w-0">
            <span className="block text-[11.5px] text-landing-dark-body">따로 낼 돈 (부가세 제외)</span>
            <span className="block truncate text-[18px] font-extrabold">{fmtWon(result.totals.buyerExtraExVat)}</span>
          </span>
          <span className="shrink-0 text-[13px] font-bold">결과 보기 ↓</span>
        </a>
      )}
      <LandingFooter lang={lang} />
    </div>
  );
}
