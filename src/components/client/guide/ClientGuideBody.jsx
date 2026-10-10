import React, { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, ChevronDown, Info, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CLIENT_COLUMNS } from '@/components/client/clientBoardMeta';
import { CG, STAGE, t } from './clientGuideContent';
import { GlanceMock, MOCKS } from './clientGuideMocks';

const Num = ({ n, className }) => <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-600 text-[11px] font-bold text-white', className)}>{n}</span>;

function Points({ points, lang }) {
  return (
    <ol className="space-y-2.5">
      {points.map((p, i) => <li key={i} className="flex gap-2.5 text-sm leading-6"><Num n={i + 1} className="mt-0.5" /><span className="min-w-0">{t(p, lang)}</span></li>)}
    </ol>
  );
}

function Section({ section, index, lang }) {
  const Mock = MOCKS[section.id];
  return (
    <section id={`cg-${section.id}`} aria-labelledby={`cg-title-${section.id}`} className="scroll-mt-36 rounded-2xl border bg-card p-5 text-card-foreground sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold tabular-nums text-primary">{String(index + 1).padStart(2, '0')}</span>
        <h2 id={`cg-title-${section.id}`} className="text-lg font-bold leading-snug sm:text-xl">{t(section.title, lang)}</h2>
      </div>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">{t(section.intro, lang)}</p>
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
        <div className="min-w-0 space-y-5 lg:order-1">
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">{t(CG.legend, lang)}</p>
            <Points points={section.points} lang={lang} />
          </div>
          {section.tips && (
            <aside className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-primary"><Lightbulb className="h-4 w-4" />{t(CG.tips, lang)}</p>
              <ul className="mt-2 space-y-1.5 text-sm leading-6">
                {section.tips.map((tip, i) => <li key={i} className="flex gap-2"><span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />{t(tip, lang)}</li>)}
              </ul>
            </aside>
          )}
        </div>
        <div className="min-w-0 lg:order-2">{Mock && <Mock lang={lang} />}</div>
      </div>
      {section.table && (
        <div className="mt-5 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr>{section.table.head.map((h, i) => <th key={i} className="px-3 py-2 font-semibold">{t(h, lang)}</th>)}</tr></thead>
            <tbody className="divide-y">{section.table.rows.map(([a, b], i) => <tr key={i}><td className="whitespace-nowrap px-3 py-2.5 align-top font-medium">{t(a, lang)}</td><td className="px-3 py-2.5 leading-6">{t(b, lang)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// 고객 이용 가이드 본문. 고객 포털(/client/guide)과 공개 가이드(/cloud-guide)가 같이 쓴다.
export default function ClientGuideBody({ lang = 'ko', cta, stickyTop = 'top-16' }) {
  const { sections } = CG;
  const [active, setActive] = useState(sections[0].id);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      let current = sections[0].id;
      for (const s of sections) { const el = document.getElementById(`cg-${s.id}`); if (el && el.getBoundingClientRect().top <= 170) current = s.id; }
      setActive(current);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); };
  }, [sections]);
  // 현재 항목이 가로 목차 밖이면 목차만 옆으로 넘긴다
  useEffect(() => {
    const item = document.getElementById(`cg-toc-${active}`);
    const bar = item?.closest('ol');
    if (!item || !bar) return;
    const left = item.offsetLeft - bar.offsetLeft;
    if (left < bar.scrollLeft || left + item.offsetWidth > bar.scrollLeft + bar.clientWidth) bar.scrollTo({ left: left - 8, behavior: 'smooth' });
  }, [active]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-5 pb-10 break-keep [overflow-wrap:anywhere]">
      <header className="rounded-2xl border bg-card p-5 text-card-foreground sm:p-8">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-primary"><BookOpen className="h-4 w-4" />{t(CG.eyebrow, lang)}</p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{t(CG.title, lang)}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">{t(CG.sub, lang)}</p>
        <p className="mt-4 flex items-start gap-2 text-xs leading-6 text-muted-foreground"><Info className="mt-1 h-3.5 w-3.5 shrink-0" />{t(CG.sampleNote, lang)}</p>
      </header>

      {/* 한눈에 보기 */}
      <section aria-labelledby="cg-glance" className="rounded-2xl border bg-card p-5 text-card-foreground sm:p-6">
        <h2 id="cg-glance" className="text-lg font-bold sm:text-xl">{t(CG.glance.title, lang)}</h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">{t(CG.glance.desc, lang)}</p>
        <div className="mt-4"><GlanceMock lang={lang} /></div>
        <div className="mt-5 grid gap-x-6 gap-y-2.5 md:grid-cols-2">
          {CG.glance.points.map((p, i) => <p key={i} className="flex gap-2.5 text-sm leading-6"><Num n={i + 1} className="mt-0.5" /><span>{t(p, lang)}</span></p>)}
        </div>
      </section>

      {/* 진행 흐름 */}
      <section aria-labelledby="cg-flow" className="rounded-2xl border bg-card p-5 text-card-foreground sm:p-6">
        <h2 id="cg-flow" className="text-lg font-bold sm:text-xl">{t(CG.flow.title, lang)}</h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">{t(CG.flow.desc, lang)}</p>
        <ol className="mt-4 grid gap-3 lg:grid-cols-5">
          {CG.flow.stages.map((s, i) => {
            const col = CLIENT_COLUMNS.find((c) => c.id === s.id);
            return (
              <li key={s.id} className={cn('relative rounded-xl border p-3.5', col.color)}>
                <p className="flex items-center gap-1.5 text-sm font-semibold"><span className="text-xs tabular-nums text-muted-foreground">{i + 1}</span><i className={cn('h-2 w-2 rounded-full', col.dotColor)} />{t(STAGE[s.id], lang)}</p>
                <p className="mt-3 text-[11px] font-semibold text-muted-foreground">{t(CG.flow.you, lang)}</p>
                <p className="mt-0.5 text-sm leading-6">{t(s.you, lang)}</p>
                <p className="mt-2.5 text-[11px] font-semibold text-muted-foreground">{t(CG.flow.aegis, lang)}</p>
                <p className="mt-0.5 text-sm leading-6 text-muted-foreground">{t(s.aegis, lang)}</p>
                {i < CG.flow.stages.length - 1 && <ArrowRight className="absolute -right-2.5 top-4 z-10 hidden h-4 w-4 rounded-full bg-background text-muted-foreground lg:block" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      </section>

      {/* 이럴 땐 여기로 */}
      <section aria-labelledby="cg-quick" className="rounded-2xl border bg-card p-5 text-card-foreground sm:p-6">
        <h2 id="cg-quick" className="text-lg font-bold sm:text-xl">{t(CG.quick.title, lang)}</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {CG.quick.items.map(([label, id]) => {
            const n = sections.findIndex((s) => s.id === id) + 1;
            return (
              <a key={id} href={`#cg-${id}`} className="group flex min-h-11 items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2.5 text-sm font-medium transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span>{t(label, lang)}</span><span className="shrink-0 text-xs tabular-nums text-muted-foreground group-hover:text-primary">{String(n).padStart(2, '0')} →</span>
              </a>
            );
          })}
        </div>
      </section>

      <nav aria-label={t(CG.toc, lang)} className={cn('sticky z-20 rounded-xl border bg-card/95 shadow-sm backdrop-blur', stickyTop)}>
        <ol className="flex gap-1.5 overflow-x-auto p-2">
          {sections.map((s, i) => (
            <li key={s.id} className="shrink-0">
              <a id={`cg-toc-${s.id}`} href={`#cg-${s.id}`} aria-current={active === s.id ? 'location' : undefined}
                className={cn('flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active === s.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                <span className="tabular-nums opacity-75">{String(i + 1).padStart(2, '0')}</span>{t(s.short, lang)}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-5">{sections.map((s, i) => <Section key={s.id} section={s} index={i} lang={lang} />)}</div>

      <section aria-labelledby="cg-faq" className="rounded-2xl border bg-card p-5 text-card-foreground sm:p-6">
        <h2 id="cg-faq" className="text-lg font-bold sm:text-xl">{t(CG.faqTitle, lang)}</h2>
        <div className="mt-4 divide-y rounded-lg border">
          {CG.faq.map(([q, a], i) => (
            <details key={i} className="group px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden">{t(q, lang)}<ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" /></summary>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t(a, lang)}</p>
            </details>
          ))}
        </div>
      </section>

      {cta}
    </div>
  );
}
