import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import useLandingLang from '@/lib/useLandingLang';
import PortfolioDetailBody from '@/components/portfolio/PortfolioDetailBody';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function PortfolioDetail() {
  const { slug } = useParams();
  const [lang] = useLandingLang();
  const [state, setState] = useState({ loading: true, item: null });

  useEffect(() => {
    let alive = true;
    setState({ loading: true, item: null });
    base44.functions
      .invoke('getPublicPortfolio', { slug })
      .then((res) => { if (alive) setState({ loading: false, item: res?.data?.item || null }); })
      .catch(() => { if (alive) setState({ loading: false, item: null }); });
    return () => { alive = false; };
  }, [slug]);

  return (
    <div className="min-h-screen bg-white font-landing">
      <header className="border-b border-landing-line px-5 lg:px-8 h-[60px] flex items-center">
        <a href="/" className="inline-flex items-center gap-2 text-[14px] font-bold text-landing-ink2 hover:text-landing-brand">
          <ArrowLeft className="w-4 h-4" /> AEGIS
        </a>
      </header>

      {state.loading ? (
        <div className="py-32 flex justify-center text-landing-muted"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : !state.item ? (
        <div className="py-32 text-center">
          <p className="text-[16px] text-landing-muted">해당 품목을 찾을 수 없습니다.</p>
          <a href="/#category" className="mt-4 inline-block text-[14px] font-bold text-landing-brand">취급 품목 전체 보기</a>
        </div>
      ) : (
        <PortfolioDetailBody item={state.item} lang={lang} contactHref="/#contact" />
      )}
    </div>
  );
}