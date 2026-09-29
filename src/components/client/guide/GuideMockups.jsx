import React from 'react';
import { LayoutDashboard, Kanban, BookOpen } from 'lucide-react';
import MockFrame from './MockFrame';
import { CLIENT_COLUMNS } from '@/components/client/clientBoardMeta';

export function MockSidebar() {
  const items = [[LayoutDashboard, '고객 대시보드'], [Kanban, '소싱 보드'], [BookOpen, '이용 가이드']];
  return (
    <MockFrame title="왼쪽 메뉴">
      <div className="rounded-lg bg-sidebar p-2 space-y-1 max-w-[220px]">
        <p className="text-[10px] px-2 py-1 text-sidebar-foreground/50">고객 포털</p>
        {items.map(([Icon, label], i) => (
          <div key={label} className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${i === 2 ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/80'}`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </div>
        ))}
      </div>
    </MockFrame>
  );
}

export function MockDashboard() {
  const kpis = [['5', '전체'], ['2', '소싱 중'], ['1', '견적 검토'], ['1', '제작']];
  const rows = [['드립백 포장기 도입', '소싱 중'], ['라벨러 2호기 증설', '견적 검토'], ['튜브 실링기 교체', '발주 · 제작']];
  return (
    <MockFrame title="고객 대시보드">
      <div className="grid grid-cols-4 gap-2 mb-3">
        {kpis.map(([n, l]) => (
          <div key={l} className="rounded-lg bg-card border border-border p-2 text-center">
            <p className="text-base font-bold">{n}</p><p className="text-[10px] text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg bg-card border border-border">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-xs font-semibold">진행 중인 프로젝트 3건</span>
          <span className="text-[10px] px-2 py-0.5 rounded border border-border">보드로 보기</span>
        </div>
        {rows.map(([t, s]) => (
          <div key={t} className="flex items-center justify-between px-3 py-2 text-xs border-b border-border last:border-0">
            <span className="truncate">{t}</span><span className="text-[10px] text-muted-foreground shrink-0">{s}</span>
          </div>
        ))}
      </div>
    </MockFrame>
  );
}

const BOARD_SAMPLE = { TODO: ['신규 문의 검토'], IN_PROGRESS: ['드립백 포장기 도입', '충전기 금형'], REVIEW: ['라벨러 2호기 증설'], PRODUCTION: ['튜브 실링기 교체'], DONE: [] };

export function MockBoard() {
  return (
    <MockFrame title="소싱 보드">
      <div className="flex justify-end mb-2">
        <span className="text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground">＋ 신규 문의 작성</span>
      </div>
      <div className="overflow-x-auto">
        <div className="grid grid-cols-5 gap-2 min-w-[520px]">
          {CLIENT_COLUMNS.map(col => {
            const cards = BOARD_SAMPLE[col.id] || [];
            return (
              <div key={col.id} className={`rounded-lg p-2 ${col.color}`}>
                <p className="flex items-center gap-1 text-[10px] font-semibold mb-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${col.dotColor}`} />{col.label}
                  <span className="text-muted-foreground font-normal">{cards.length}</span>
                </p>
                <div className="space-y-1.5">
                  {cards.map(c => <div key={c} className="rounded bg-card border border-border px-2 py-1.5 text-[10px]">{c}</div>)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </MockFrame>
  );
}