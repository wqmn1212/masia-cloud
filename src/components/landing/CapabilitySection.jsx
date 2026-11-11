import React from 'react';
import { Box, Cpu, Layers, FlaskConical, ShieldCheck, FileCheck } from 'lucide-react';
import { capabilities } from '@/lib/landingCapabilities';
import { tx } from '@/lib/landingContent';
import SectionHeading from './SectionHeading';
import ConceptDemo from './ConceptDemo';

const ICONS = { concept: Box, circuit: Cpu, mold: Layers, test: FlaskConical, quality: ShieldCheck, docs: FileCheck };

// 기술력: 왼쪽은 컨셉 스튜디오 3D 데모, 오른쪽은 다루는 기술 6가지
export default function CapabilitySection({ lang }) {
  return (
    <section id="capabilities" className="border-t border-landing-line bg-white px-5 lg:px-8 py-16 lg:py-[88px]">
      <div className="max-w-[1200px] mx-auto">
        <SectionHeading eyebrow={capabilities.eyebrow} title={tx(capabilities.h2, lang)} maxWidth="max-w-[760px]" />
        <p className="mt-4 max-w-[760px] text-[15.5px] leading-[1.75] text-landing-ink3">{tx(capabilities.sub, lang)}</p>
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.05fr_1fr] items-start">
          <ConceptDemo lang={lang} />
          <div className="grid gap-3 sm:grid-cols-2">
            {capabilities.items.map((c) => {
              const Icon = ICONS[c.icon] || Box;
              return (
                <div key={c.icon} className="rounded-[14px] border border-landing-line bg-landing-page p-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-landing-tint text-landing-brand"><Icon className="h-[18px] w-[18px]" /></span>
                  <h3 className="mt-3 text-[16px] font-bold tracking-[-0.4px] text-landing-ink">{tx(c.t, lang)}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-[1.65] text-landing-ink3">{tx(c.d, lang)}</p>
                </div>
              );
            })}
          </div>
        </div>
        <p className="mt-6 text-[12.5px] text-landing-muted">{tx(capabilities.note, lang)}</p>
      </div>
    </section>
  );
}
