import React from 'react';
import { LayoutDashboard, Kanban, BookOpen } from 'lucide-react';
import { tx } from '@/lib/landingContent';
import { STAGES, sampleCards } from '@/lib/cloudGuideContent';

export function MockMenu({ lang }) {
  const items = [[LayoutDashboard, ['고객 대시보드', 'Dashboard', '客户控制台']], [Kanban, ['소싱 보드', 'Sourcing board', '采购看板']], [BookOpen, ['이용 가이드', 'Guide', '使用指南']]];
  return (
    <div className="flex gap-3">
      <div className="w-40 rounded-lg bg-landing-ink text-white p-2 space-y-1">
        <div className="px-2 py-1.5 text-[11px] font-bold">[TEST] 데모전자</div>
        {items.map(([Icon, l], i) => (
          <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded ${i === 0 ? 'bg-landing-brand' : 'text-landing-dark-body'}`}><Icon size={13} />{tx(l, lang)}</div>
        ))}
      </div>
      <div className="flex-1 rounded-lg bg-landing-page" />
    </div>
  );
}

export function MockDashboard({ lang }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-1.5">
        {STAGES.map((s) => (
          <div key={s.status} className="rounded-md border border-landing-line p-2">
            <div className="text-[10px] text-landing-muted truncate">{tx(s.label, lang)}</div>
            <div className="text-[16px] font-extrabold">{sampleCards.filter((c) => c.status === s.status).length}</div>
          </div>
        ))}
      </div>
      <div className="rounded-md border border-landing-line divide-y divide-landing-line">
        {sampleCards.slice(1, 4).map((c) => (
          <div key={c.title} className="flex justify-between px-3 py-2"><span className="font-semibold">{c.title}</span><span className="text-landing-brand">{tx(STAGES.find((s) => s.status === c.status).label, lang)}</span></div>
        ))}
      </div>
    </div>
  );
}

export function MockBoard({ lang }) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {STAGES.map((s) => (
        <div key={s.status} className="rounded-md bg-landing-page p-1.5 min-h-[120px]">
          <div className="text-[10px] font-bold text-landing-muted mb-1.5 truncate">{tx(s.label, lang)}</div>
          {sampleCards.filter((c) => c.status === s.status).map((c) => (
            <div key={c.title} className="rounded bg-white border border-landing-line p-1.5 text-[10px] leading-snug">
              <div className="font-semibold">{c.title}</div>
              {c.factory && <div className="text-landing-muted mt-0.5">{c.factory}</div>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}