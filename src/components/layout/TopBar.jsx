import React from 'react';
import { Bell, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/lib/LanguageContext';

export default function TopBar() {
  const { lang, toggleLang, t } = useLanguage();
  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t('topbar.search')}
          className="pl-10 bg-secondary/50 border-0 focus-visible:ring-1"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-[18px] h-[18px]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleLang}
          className="h-8 px-3 text-xs font-bold tracking-wide border-2"
          title={lang === 'ko' ? '中文으로 전환' : '한국어로 전환'}
        >
          {lang === 'ko' ? '🇨🇳 中文' : '🇰🇷 한국어'}
        </Button>
        <div className="flex items-center gap-2.5 pl-3 border-l border-border">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
            M
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold leading-none">{t('topbar.admin')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('topbar.hq')}</p>
          </div>
        </div>
      </div>
    </header>
  );
}