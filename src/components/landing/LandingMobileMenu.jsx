import React from 'react';
import { Menu } from 'lucide-react';
import { nav, tx } from '@/lib/landingContent';

export default function LandingMobileMenu({ lang }) {
  return (
    <details className="lm-mobile-menu">
      <summary aria-label={tx(['메뉴 열기', 'Open menu', '打开菜单'], lang)}><Menu size={20} /></summary>
      <nav aria-label={tx(['페이지 메뉴', 'Page navigation', '页面导航'], lang)}>
        {nav.map((item) => <a key={item.href} href={item.href} onClick={(e) => { e.currentTarget.closest('details').open = false; }}>{tx(item.label, lang)}</a>)}
      </nav>
    </details>
  );
}