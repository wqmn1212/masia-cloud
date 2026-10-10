import React from 'react';
import { Card } from '@/components/ui/card';
import { STAFF_MOCKS } from '@/components/userguide/staffGuideMocks';

export default function GuideChapter({ ch, no, zh }) {
  const t = (p) => (zh ? p[1] : p[0]);
  const Mock = STAFF_MOCKS[ch.id];
  const list = (
    <ol className="space-y-2">
      {ch.points.map((p, i) => (
        <li key={i} className="flex gap-2 text-sm"><span className="shrink-0 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span><span>{t(p)}</span></li>
      ))}
    </ol>
  );
  return (
    <Card id={`ch-${ch.id}`} className="p-5 md:p-6 scroll-mt-28">
      <div className="text-xs font-semibold text-primary">{String(no).padStart(2, '0')}</div>
      <h2 className="text-lg font-bold mt-0.5">{t(ch.title)}</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-4">{t(ch.intro)}</p>
      <div className={ch.wide ? 'space-y-4' : 'grid lg:grid-cols-2 gap-5 items-start'}>
        {ch.wide ? <><Mock zh={zh} />{list}</> : <>{list}<Mock zh={zh} /></>}
      </div>
      {ch.tips && (
        <div className="mt-4 rounded-md bg-muted p-3 text-sm space-y-1">
          <div className="font-semibold">{zh ? '注意' : '알아두세요'}</div>
          {ch.tips.map((p, i) => <p key={i}>· {t(p)}</p>)}
        </div>
      )}
    </Card>
  );
}