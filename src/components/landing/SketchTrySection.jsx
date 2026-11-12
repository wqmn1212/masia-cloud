import React from 'react';
import { ArrowRight } from 'lucide-react';
import { sketchTry as T } from '@/lib/landingSketch';
import { tx } from '@/lib/landingContent';
import SectionHeading from './SectionHeading';
import SketchTryCard from './SketchTryCard';

const EXAMPLE = {
  doodle: 'https://media.base44.com/images/public/6a0c1b56a385588fbd4454f5/832a98c84_sketch-example-doodle.jpg',
  design: 'https://media.base44.com/images/public/6a0c1b56a385588fbd4454f5/8314bf57f_sketch-example-design.jpg',
};

// 스케치 → 디자인 시안 3장 체험: 왼쪽은 설명과 예시, 오른쪽은 올리는 카드
export default function SketchTrySection({ lang }) {
  return (
    <section id="sketch" className="border-t border-landing-line bg-landing-page px-5 lg:px-8 py-16 lg:py-[88px] scroll-mt-16">
      <div className="max-w-[1200px] mx-auto grid gap-10 lg:grid-cols-[1fr_520px] items-start">
        <div className="min-w-0">
          <SectionHeading eyebrow={T.eyebrow} title={tx(T.h2, lang)} maxWidth="max-w-[600px]" />
          <p className="mt-4 max-w-[600px] text-[15.5px] leading-[1.75] text-landing-ink3">{tx(T.sub, lang)}</p>

          <ol className="mt-8 grid gap-3 sm:grid-cols-3">
            {T.steps.map(([title, desc], i) => (
              <li key={title[0]} className="rounded-[14px] border border-landing-line bg-white p-4">
                <span className="font-mono text-[12px] font-bold text-landing-brand">0{i + 1}</span>
                <p className="mt-1.5 text-[15px] font-bold tracking-[-0.3px] text-landing-ink">{tx(title, lang)}</p>
                <p className="mt-1 text-[12.5px] leading-[1.55] text-landing-ink3">{tx(desc, lang)}</p>
              </li>
            ))}
          </ol>

          <figure className="mt-8 max-w-[520px]">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div>
                <img src={EXAMPLE.doodle} alt={tx(T.exampleFrom, lang)} loading="lazy" className="aspect-square w-full rounded-[14px] border border-landing-line object-cover" />
                <p className="mt-2 text-center text-[12.5px] font-semibold text-landing-ink3">{tx(T.exampleFrom, lang)}</p>
              </div>
              <ArrowRight className="mb-6 h-5 w-5 text-landing-brand" />
              <div>
                <img src={EXAMPLE.design} alt={tx(T.exampleTo, lang)} loading="lazy" className="aspect-square w-full rounded-[14px] border border-landing-line object-cover" />
                <p className="mt-2 text-center text-[12.5px] font-semibold text-landing-ink3">{tx(T.exampleTo, lang)}</p>
              </div>
            </div>
            <figcaption className="mt-3 text-[12px] text-landing-muted2">{tx(T.exampleNote, lang)}</figcaption>
          </figure>
        </div>
        <SketchTryCard lang={lang} />
      </div>
    </section>
  );
}
