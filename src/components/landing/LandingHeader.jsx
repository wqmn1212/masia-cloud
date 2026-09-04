import React from 'react';
import { Link } from 'react-router-dom';
import { nav, header, tx, LANDING_LANGS } from '@/lib/landingContent';
import { cn } from '@/lib/utils';

const LANG_LABEL = { ko: 'KO', en: 'EN', zh: '中' };

export default function LandingHeader({ lang, setLang, isAuthenticated }) {
  return (
    <header className="sticky top-0 z-50 bg-landing-page/90 backdrop-blur-[14px] border-b border-landing-line">
      <div className="max-w-[1200px] mx-auto px-5 lg:px-8 h-[66px] flex items-center gap-9">
        <a href="#top" className="flex items-center flex-none">
          <span className="text-[23px] font-extrabold tracking-[-0.6px] text-landing-ink leading-none">ChinaSourcing</span>
        </a>
        <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold">
          {nav.map((n) => (
            <a key={n.href} href={n.href} className="text-landing-ink2 hover:text-landing-brand transition-colors">
              {tx(n.label, lang)}
            </a>
          ))}
        </nav>
        <div className="flex-1" />
        <div className="flex items-center gap-0.5 p-[3px] bg-landing-toggle rounded-lg flex-none">
          {LANDING_LANGS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={cn(
                'text-xs font-bold px-2.5 py-[5px] rounded-md transition-colors',
                lang === l ? 'bg-white text-landing-ink shadow-[0_1px_2px_rgba(0,0,0,.08)]' : 'bg-transparent text-landing-muted'
              )}
            >
              {LANG_LABEL[l]}
            </button>
          ))}
        </div>
        {isAuthenticated ? (
          <Link to="/dashboard" className="flex-none bg-landing-ink hover:bg-landing-brand-hover text-white text-sm font-bold px-[18px] py-2.5 rounded-[9px] transition-colors">
            {tx(header.dashboard, lang)}
          </Link>
        ) : (
          <a href="#contact" className="flex-none bg-landing-ink hover:bg-landing-brand-hover text-white text-sm font-bold px-[18px] py-2.5 rounded-[9px] transition-colors">
            {tx(header.cta, lang)}
          </a>
        )}
      </div>
    </header>
  );
}