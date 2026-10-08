import React from 'react';
import { LayoutDashboard, Kanban, BookOpen } from 'lucide-react';
import MockFrame from './MockFrame';
import { CLIENT_COLUMNS } from '@/components/client/clientBoardMeta';
import { M, t } from './guideI18n';

export function MockSidebar({ lang = 'ko' }) {
  const items = [[LayoutDashboard, M.dash], [Kanban, M.board], [BookOpen, M.guide]];
  return (
    <MockFrame lang={lang} title={t(M.menu, lang)}>
      <div className="rounded-lg bg-sidebar p-2 space-y-1 max-w-[220px]">
        <p className="text-[10px] px-2 py-1 text-sidebar-foreground/50">{t(M.portal, lang)}</p>
        {items.map(([Icon, label], i) => (
          <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${i === 2 ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/80'}`}>
            <Icon className="w-3.5 h-3.5" />{t(label, lang)}
          </div>
        ))}
      </div>
    </MockFrame>
  );
}

export function MockDashboard({ lang = 'ko' }) {
  const nums = ['5', '2', '1', '1'];
  const rows = [[M.p1, M.st.IN_PROGRESS], [M.p2, M.st.REVIEW], [M.p3, M.st.PRODUCTION]];
  return (
    <MockFrame lang={lang} title={t(M.dash, lang)}>
      <div className="grid grid-cols-4 gap-2 mb-3">
        {M.kpis.map((l, i) => (
          <div key={i} className="rounded-lg bg-card border border-border p-2 text-center">
            <p className="text-base font-bold">{nums[i]}</p><p className="text-[10px] text-muted-foreground">{t(l, lang)}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg bg-card border border-border">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-xs font-semibold">{t(M.active, lang)}</span>
          <span className="text-[10px] px-2 py-0.5 rounded border border-border">{t(M.toBoard, lang)}</span>
        </div>
        {rows.map(([p, s], i) => (
          <div key={i} className="flex items-center justify-between px-3 py-2 text-xs border-b border-border last:border-0">
            <span className="truncate">{t(p, lang)}</span><span className="text-[10px] text-muted-foreground shrink-0">{t(s, lang)}</span>
          </div>
        ))}
      </div>
    </MockFrame>
  );
}

const BOARD_SAMPLE = { TODO: [M.p4], IN_PROGRESS: [M.p1, M.p5], REVIEW: [M.p2], PRODUCTION: [M.p3], DONE: [] };

export function MockBoard({ lang = 'ko' }) {
  return (
    <MockFrame lang={lang} title={t(M.board, lang)}>
      <div className="flex justify-end mb-2">
        <span className="text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground">{t(M.newInq, lang)}</span>
      </div>
      <div className="overflow-x-auto">
        <div className="grid grid-cols-5 gap-2 min-w-[520px]">
          {CLIENT_COLUMNS.map(col => {
            const cards = BOARD_SAMPLE[col.id] || [];
            return (
              <div key={col.id} className={`rounded-lg p-2 ${col.color}`}>
                <p className="flex items-center gap-1 text-[10px] font-semibold mb-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${col.dotColor}`} />{t(M.cols[col.id], lang)}
                  <span className="text-muted-foreground font-normal">{cards.length}</span>
                </p>
                <div className="space-y-1.5">
                  {cards.map((c, i) => <div key={i} className="rounded bg-card border border-border px-2 py-1.5 text-[10px]">{t(c, lang)}</div>)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </MockFrame>
  );
}