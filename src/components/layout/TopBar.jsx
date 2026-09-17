import React from 'react';
import { Search, Menu } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/LanguageContext';
import { useSearch } from '@/lib/SearchContext';
import NotificationBell from '@/components/notifications/NotificationBell';

export default function TopBar({ onMenuClick, user }) {
  const { lang, setLang, t } = useLanguage();
  const { query, setQuery } = useSearch();
  const [translationPaused, setTranslationPaused] = React.useState(false);
  React.useEffect(() => {
    const markPaused = () => setTranslationPaused(true);
    window.addEventListener('translation-unavailable', markPaused);
    return () => window.removeEventListener('translation-unavailable', markPaused);
  }, []);
  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-3 md:px-6 sticky top-0 z-30 gap-2">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={onMenuClick}>
          <Menu className="w-5 h-5" />
        </Button>
        <div className="relative w-full max-w-xs md:w-80 md:max-w-none">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('topbar.search')}
            className="pl-10 bg-secondary/50 border-0 focus-visible:ring-1"
          />
        </div>
      </div>
      <div className="flex items-center gap-1 md:gap-3 shrink-0">
        <NotificationBell user={user} />
        {translationPaused && <span className="hidden lg:inline text-[10px] text-chart-3 font-medium">{lang === 'zh' ? '自动翻译暂停' : '자동 번역 일시 중지'}</span>}
        <div className="flex h-8 rounded-md border bg-muted/40 p-0.5" aria-label="Language">
          <button onClick={() => setLang('ko')} className={`rounded px-2 text-[11px] font-bold transition-colors ${lang === 'ko' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}>KR</button>
          <button onClick={() => setLang('zh')} className={`rounded px-2 text-[11px] font-bold transition-colors ${lang === 'zh' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}>中文</button>
        </div>
        <div className="flex items-center gap-2.5 pl-2 md:pl-3 md:border-l md:border-border">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
            M
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-semibold leading-none">{t('topbar.admin')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('topbar.hq')}</p>
          </div>
        </div>
      </div>
    </header>
  );
}