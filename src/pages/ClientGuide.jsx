import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/LanguageContext';
import ClientGuideBody from '@/components/client/guide/ClientGuideBody';
import { CG, t } from '@/components/client/guide/clientGuideContent';

// 고객 포털 이용 가이드 — 모든 고객 기능을 HTML 예시 화면과 함께 설명
export default function ClientGuide() {
  const { lang } = useLanguage();
  return (
    <ClientGuideBody
      lang={lang}
      cta={
        <Card className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center md:p-6">
          <div>
            <p className="font-semibold">{t(CG.ctaApp.title, lang)}</p>
            <p className="text-sm text-muted-foreground">{t(CG.ctaApp.desc, lang)}</p>
          </div>
          <Button asChild><Link to="/client/board">{t(CG.ctaApp.button, lang)}</Link></Button>
        </Card>
      }
    />
  );
}
