import React from 'react';
import { cn } from '@/lib/utils';
import { STAFF_MOCKS, WIDE } from './staffGuideMocks';

// 예시 화면(HTML) + 번호별 설명. 넓은 화면은 설명을 아래에, 나머지는 설명을 왼쪽에 둔다.
export default function GuideShot({ shot, lang, content }) {
  const Mock = STAFF_MOCKS[shot.img];
  const wide = WIDE.includes(shot.img);
  const legend = (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-semibold text-muted-foreground">{content.legend}</p>
      <ol className={cn('space-y-2.5', wide && 'md:grid md:grid-cols-2 md:gap-x-6 md:space-y-0 md:gap-y-2.5')}>
        {shot.points.map((point, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-6">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-600 text-[11px] font-bold text-white">{i + 1}</span>
            <span className="min-w-0">{point}</span>
          </li>
        ))}
      </ol>
    </div>
  );
  // 실제 화면이 한국어뿐인 곳은 shot.lang 으로 화면 언어를 고정한다
  const screen = (
    <div className="min-w-0">
      {shot.caption && <figcaption className="mb-2 text-xs font-semibold text-muted-foreground">{shot.caption}</figcaption>}
      {Mock && <Mock lang={shot.lang || lang} />}
    </div>
  );
  return wide
    ? <figure className="space-y-5">{screen}{legend}</figure>
    : <figure className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">{legend}{screen}</figure>;
}
