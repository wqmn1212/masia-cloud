import React from 'react';
import { Card } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import GuideToc from '@/components/userguide/GuideToc';
import ClientGuideChapter, { NumberedList } from '@/components/client/guide/ClientGuideChapter';
import { OverviewMock } from '@/components/client/guide/clientGuideMocks';
import { tr, UI, OVERVIEW, FLOW, SHORTCUTS, CHAPTERS, FAQ } from '@/components/client/guide/clientGuideContent';

// 고객 포털(/client/guide)과 공개(/cloud-guide)가 함께 쓰는 본문
export default function ClientGuideBody({ lang = 'ko', footer }) {
  const go = (id) => document.getElementById(`ch-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const idx = Object.fromEntries(CHAPTERS.map((c, i) => [c.id, i + 1]));
  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{tr(UI.title, lang)}</h1>
        <p className="text-sm text-muted-foreground mt-1">{tr(UI.intro, lang)}</p>
        <p className="text-xs text-muted-foreground mt-1">{tr(UI.note, lang)}</p>
      </div>
      <Card className="p-5 md:p-6">
        <h2 className="text-lg font-bold mb-4">{tr(UI.overview, lang)}</h2>
        <div className="space-y-4"><OverviewMock /><NumberedList points={OVERVIEW} lang={lang} /></div>
      </Card>
      <Card className="p-5 md:p-6">
        <h2 className="text-lg font-bold mb-4">{tr(UI.flow, lang)}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {FLOW.map(([s, you, us], i) => (
            <div key={i} className="rounded-md border p-3 text-sm space-y-2">
              <div className="font-semibold text-primary">{i + 1}. {tr(s, lang)}</div>
              <div><div className="text-[11px] text-muted-foreground">{tr(UI.you, lang)}</div>{tr(you, lang)}</div>
              <div><div className="text-[11px] text-muted-foreground">{tr(UI.us, lang)}</div>{tr(us, lang)}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-5 md:p-6">
        <h2 className="text-lg font-bold mb-3">{tr(UI.shortcuts, lang)}</h2>
        <div className="flex flex-wrap gap-2">
          {SHORTCUTS.map(([label, id]) => (
            <button key={id} onClick={() => go(id)} className="px-3 py-1.5 rounded-md border text-sm hover:bg-muted">{tr(label, lang)} → {idx[id]}</button>
          ))}
        </div>
      </Card>
      <GuideToc items={CHAPTERS.map((c) => ({ id: c.id, label: tr(c.title, lang) }))} />
      {CHAPTERS.map((ch, i) => <ClientGuideChapter key={ch.id} ch={ch} no={i + 1} lang={lang} />)}
      <Card className="p-5 md:p-6">
        <h2 className="text-lg font-bold mb-2">{tr(UI.faq, lang)}</h2>
        <Accordion type="single" collapsible>
          {FAQ.map(([q, a], i) => <AccordionItem key={i} value={`f${i}`}><AccordionTrigger className="text-sm text-left">{tr(q, lang)}</AccordionTrigger><AccordionContent className="text-sm text-muted-foreground">{tr(a, lang)}</AccordionContent></AccordionItem>)}
        </Accordion>
      </Card>
      {footer}
    </div>
  );
}