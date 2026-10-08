import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, BookOpen, ChevronDown, Info } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { cn } from '@/lib/utils';
import { userGuideContent } from '@/components/userguide/userGuideContent';
import GuideChapter from '@/components/userguide/GuideChapter';

// 이용 가이드: 업무 관리 기능을 실제 화면 캡처와 함께 설명 (한국어·중국어)
export default function UserGuide() {
  const { lang } = useLanguage();
  const content = userGuideContent[lang] || userGuideContent.ko;
  const { sections } = content;
  const [active, setActive] = useState(sections[0].id);

  // 스크롤 위치에 맞춰 목차의 현재 항목 표시
  useEffect(() => {
    let frame = 0;
    const update = () => {
      let current = sections[0].id;
      for (const s of sections) {
        const el = document.getElementById(`guide-${s.id}`);
        if (el && el.getBoundingClientRect().top <= 170) current = s.id;
      }
      setActive(current);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); };
  }, [sections]);
  // 현재 항목이 가로 목차 밖에 있으면 목차만 옆으로 넘긴다 (페이지는 움직이지 않음)
  useEffect(() => {
    const item = document.getElementById(`toc-${active}`);
    const bar = item?.closest('ol');
    if (!item || !bar) return;
    const left = item.offsetLeft - bar.offsetLeft;
    if (left < bar.scrollLeft || left + item.offsetWidth > bar.scrollLeft + bar.clientWidth) bar.scrollTo({ left: left - 8, behavior: 'smooth' });
  }, [active]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-5 pb-10 break-keep [overflow-wrap:anywhere]">
      <header className="overflow-hidden rounded-2xl border bg-card text-card-foreground">
        <div className="p-5 sm:p-8">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-primary"><BookOpen className="h-4 w-4" />{content.eyebrow}</p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{content.title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">{content.subtitle}</p>
          <h2 className="mt-6 text-sm font-semibold">{content.flowTitle}</h2>
          <ol className="mt-3 flex flex-wrap items-center gap-2">
            {content.flow.map((step, i) => (
              <li key={step} className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-medium"><span className="tabular-nums text-primary">{i + 1}</span>{step}</span>
                {i < content.flow.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
              </li>
            ))}
          </ol>
          <h2 className="mt-6 text-sm font-semibold">{content.rolesTitle}</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {content.roles.map((role) => (
              <div key={role.who} className="rounded-xl border bg-background p-4">
                <p className="text-sm font-semibold">{role.who}</p>
                <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
                  {role.what.map((w) => <li key={w} className="flex gap-1.5"><span aria-hidden="true">·</span>{w}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <p className="flex items-start gap-2 border-t bg-muted/30 px-5 py-3 text-xs leading-6 text-muted-foreground sm:px-8"><Info className="mt-1 h-3.5 w-3.5 shrink-0" />{content.sampleNote}</p>
      </header>

      <nav aria-label={content.toc} className="sticky top-16 z-20 rounded-xl border bg-card/95 shadow-sm backdrop-blur">
        <ol className="flex gap-1.5 overflow-x-auto p-2">
          {sections.map((s, i) => (
            <li key={s.id} className="shrink-0">
              <a id={`toc-${s.id}`} href={`#guide-${s.id}`} aria-current={active === s.id ? 'location' : undefined}
                className={cn('flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active === s.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                <span className="tabular-nums opacity-75">{String(i + 1).padStart(2, '0')}</span>{s.short || s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-6">
        {sections.map((s, i) => <GuideChapter key={s.id} section={s} index={i} lang={lang} content={content} />)}
      </div>

      <section className="rounded-2xl border bg-card p-5 sm:p-7">
        <h2 className="text-lg font-bold">{content.faqTitle}</h2>
        <div className="mt-4 divide-y rounded-lg border">
          {content.faq.map(([q, a]) => (
            <details key={q} className="group px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                {q}<ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="flex flex-col gap-3 rounded-xl border border-dashed px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-muted-foreground">{content.footer}</p>
        <Link to="/service-guide" className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-sm font-medium hover:border-primary hover:text-primary">
          {content.footerLink}<ArrowUpRight className="h-4 w-4" />
        </Link>
      </footer>
    </div>
  );
}
