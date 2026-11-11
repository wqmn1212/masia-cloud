import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import useLandingLang from '@/lib/useLandingLang';
import { getHomePath } from '@/lib/menuPermissions';
import usePublicPortfolio from '@/lib/usePublicPortfolio';
import { categories, tx } from '@/lib/landingContent';
import { cn } from '@/lib/utils';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';
import PortfolioCard from '@/components/landing/PortfolioCard';
import { DevCaseStudy } from '@/components/landing/DevCaseSection';
import { devCase } from '@/lib/devCaseContent';
import '@/components/landing/landingMinimal.css';

const T = {
  h1: ['개발 · 제조 포트폴리오', 'Development & manufacturing portfolio', '开发与制造案例'],
  sub: ['AEGIS가 진행한 개발 · 양산 사례와 취급 품목입니다.', 'Development and production work AEGIS has delivered, and the products we make.', 'AEGIS 完成的开发与量产案例及承接品类。'],
  empty: ['해당 카테고리의 사례가 아직 없습니다.', 'No items in this category yet.', '该品类暂无案例。'],
  cta: ['비슷한 제품을 개발하거나 만들고 싶으신가요?', 'Want something similar developed or made?', '想开发或生产类似产品？'],
  ctaBtn: ['개발·제조 문의하기', 'Start a project', '咨询开发·制造'],
};

export default function PortfolioList() {
  const [lang, setLang] = useLandingLang();
  const [params, setParams] = useSearchParams();
  const cat = params.get('category') || 'all';
  const { isAuthenticated, user, navigateToLogin } = useAuth();
  const { items } = usePublicPortfolio();
  const list = cat === 'all' ? items : items.filter((p) => p.cat === cat || (cat === 'chem' && p.cat === 'material'));

  const pick = (id) => setParams(id === 'all' ? {} : { category: id }, { replace: true });

  return (
    <div lang={lang} className="landing-minimal font-landing text-landing-ink antialiased min-h-screen" style={{ wordBreak: lang === 'zh' ? 'normal' : 'keep-all' }}>
      <LandingHeader lang={lang} setLang={setLang} isAuthenticated={isAuthenticated} homePath={getHomePath(user)} onLogin={navigateToLogin} />
      <main className="max-w-[1200px] mx-auto px-5 lg:px-8 py-14">
        <h1 className="text-[32px] md:text-[40px] font-extrabold tracking-[-1px]">{tx(T.h1, lang)}</h1>
        <p className="mt-3 text-[16px] text-landing-muted">{tx(T.sub, lang)}</p>
        <div className="mt-8 flex flex-wrap gap-2">
          {categories.tabs.map((t) => (
            <button key={t.id} type="button" onClick={() => pick(t.id)}
              className={cn('px-4 py-2 rounded-full text-[13.5px] font-bold border transition-colors',
                cat === t.id ? 'bg-landing-ink text-white border-landing-ink' : 'bg-white text-landing-ink2 border-landing-line3 hover:border-landing-brand')}>
              {tx(t.label, lang)}
            </button>
          ))}
        </div>
        {list.length === 0 ? (
          <p className="py-20 text-center text-landing-muted">{tx(T.empty, lang)}</p>
        ) : (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((p, i) => <PortfolioCard key={`${p.slug || p.cat}-${i}`} item={p} lang={lang} />)}
          </div>
        )}
        <div className="mt-16 border-t border-landing-line pt-12">
          <div className="text-[12px] font-bold tracking-[.08em] text-landing-brand">{devCase.eyebrow}</div>
          <h2 className="mt-3 text-[26px] md:text-[32px] font-extrabold tracking-[-1px] leading-[1.3]">{tx(devCase.h2, lang)}</h2>
          <p className="mt-3 max-w-[760px] text-[15.5px] leading-[1.75] text-landing-muted">{tx(devCase.sub, lang)}</p>
          <div className="mt-8"><DevCaseStudy lang={lang} /></div>
        </div>
        <div className="mt-14 rounded-[13px] bg-landing-tint p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <p className="text-[18px] font-bold">{tx(T.cta, lang)}</p>
          <a href="/#contact" className="lm-portfolio-cta self-start bg-landing-ink hover:bg-landing-brand-hover text-white text-sm font-bold px-5 py-3 rounded-[9px]">{tx(T.ctaBtn, lang)}</a>
        </div>
      </main>
      <LandingFooter lang={lang} />
    </div>
  );
}