import React from 'react';
import { Lightbulb } from 'lucide-react';
import GuideShot from './GuideShot';

export default function GuideChapter({ section, index, lang, content }) {
  const no = String(index + 1).padStart(2, '0');
  return (
    <section id={`guide-${section.id}`} aria-labelledby={`guide-title-${section.id}`} className="scroll-mt-36 rounded-2xl border bg-card text-card-foreground">
      <header className="p-5 pb-0 sm:p-7 sm:pb-0">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold tabular-nums text-primary">{no}</span>
          <h2 id={`guide-title-${section.id}`} className="text-lg font-bold leading-snug sm:text-xl">{section.title}</h2>
        </div>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{section.intro}</p>
      </header>
      <div className="space-y-6 p-5 pt-4 sm:p-7 sm:pt-5">
        {section.shots.map((shot) => <GuideShot key={shot.img} shot={shot} lang={lang} content={content} />)}
        {section.table && (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>{section.table.head.map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {section.table.rows.map(([name, steps]) => (
                  <tr key={name}><td className="whitespace-nowrap px-3 py-2.5 align-top font-medium">{name}</td><td className="px-3 py-2.5 leading-6">{steps}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {section.tips && (
          <aside className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-primary"><Lightbulb className="h-4 w-4" />{content.tips}</p>
            <ul className="mt-2 space-y-1.5 text-sm leading-6">
              {section.tips.map((tip) => <li key={tip} className="flex gap-2"><span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />{tip}</li>)}
            </ul>
          </aside>
        )}
      </div>
    </section>
  );
}
