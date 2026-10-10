import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useLanguage } from '@/lib/LanguageContext';
import { HERO, CHAPTERS, FAQ } from '@/components/userguide/userGuideContent';
import GuideChapter from '@/components/userguide/GuideChapter';
import GuideToc from '@/components/userguide/GuideToc';

export default function UserGuide() {
  const { lang } = useLanguage();
  const zh = lang === 'zh';
  const t = (p) => (zh ? p[1] : p[0]);
  const toc = CHAPTERS.map((c) => ({ id: c.id, label: t(c.title) }));

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t(HERO.title)}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t(HERO.intro)}</p>
        <p className="text-xs text-muted-foreground mt-1">{t(HERO.note)}</p>
      </div>
      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {HERO.flow.map((f, i) => <React.Fragment key={i}>{i > 0 && <span className="text-muted-foreground">→</span>}<span className="px-2 py-1 rounded bg-primary/10 text-primary font-medium">{i + 1}. {t(f)}</span></React.Fragment>)}
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {HERO.roles.map(([r, d], i) => <div key={i} className="rounded-md border p-3"><div className="font-semibold text-sm">{t(r)}</div><div className="text-xs text-muted-foreground mt-1">{t(d)}</div></div>)}
        </div>
      </Card>
      <GuideToc items={toc} />
      {CHAPTERS.map((ch, i) => <GuideChapter key={ch.id} ch={ch} no={i + 1} zh={zh} />)}
      <Card className="p-5 md:p-6">
        <h2 className="text-lg font-bold mb-2">{zh ? '常见问题' : '자주 묻는 질문'}</h2>
        <Accordion type="single" collapsible>
          {FAQ.map(([q, a], i) => <AccordionItem key={i} value={`f${i}`}><AccordionTrigger className="text-sm text-left">{t(q)}</AccordionTrigger><AccordionContent className="text-sm text-muted-foreground">{t(a)}</AccordionContent></AccordionItem>)}
        </Accordion>
      </Card>
      <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="font-semibold">{zh ? '想了解工作顺序？请查看服务使用指南。' : '업무 순서가 궁금하면 서비스 사용 가이드를 보세요.'}</p>
        <Button asChild><Link to="/service-guide">{zh ? '打开服务使用指南' : '서비스 사용 가이드 열기'}</Link></Button>
      </Card>
    </div>
  );
}