import React from 'react';
import { Card } from '@/components/ui/card';
import { CLIENT_MOCKS } from '@/components/client/guide/clientGuideMocks';
import { tr, UI } from '@/components/client/guide/clientGuideContent';

export function NumberedList({ points, lang }) {
  return (
    <ol className="space-y-2">
      {points.map((p, i) => (
        <li key={i} className="flex gap-2 text-sm"><span className="shrink-0 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span><span>{tr(p, lang)}</span></li>
      ))}
    </ol>
  );
}

export default function ClientGuideChapter({ ch, no, lang }) {
  const Mock = CLIENT_MOCKS[ch.id];
  const list = <NumberedList points={ch.points} lang={lang} />;
  return (
    <Card id={`ch-${ch.id}`} className="p-5 md:p-6 scroll-mt-28">
      <div className="text-xs font-semibold text-primary">{String(no).padStart(2, '0')}</div>
      <h2 className="text-lg font-bold mt-0.5">{tr(ch.title, lang)}</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-4">{tr(ch.intro, lang)}</p>
      <div className={ch.wide ? 'space-y-4' : 'grid lg:grid-cols-2 gap-5 items-start'}>
        {ch.wide ? <><Mock />{list}</> : <>{list}<Mock /></>}
      </div>
      {ch.tips && (
        <div className="mt-4 rounded-md bg-muted p-3 text-sm space-y-1">
          <div className="font-semibold">{tr(UI.tips, lang)}</div>
          {ch.tips.map((p, i) => <p key={i}>· {tr(p, lang)}</p>)}
        </div>
      )}
    </Card>
  );
}