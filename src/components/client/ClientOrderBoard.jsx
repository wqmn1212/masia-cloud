import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Kanban, List, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ClientExportButton from './ClientExportButton';
import ClientArrivalCalendar from './ClientArrivalCalendar';
import { shortDate, dday } from './clientFormat';

// 주문 현황판: 진행 중인 프로젝트를 한 줄씩 — 지금 단계 · 다음 일정 · 누구 차례인지 · 일정 상태 · 도착 예정 · 입금.
// 요약과 순서는 서버(listClientTodos → base44/shared/clientSummary.ts)가 정한다. 지연 일수는 보여 주지 않는다.
const TURN = {
  CLIENT: { label: '고객님', cls: 'bg-primary text-primary-foreground' },
  AEGIS: { label: '이지스', cls: 'bg-muted text-foreground' },
  FACTORY: { label: '공장', cls: 'bg-chart-4/15 text-chart-4' },
  DONE: { label: '완료', cls: 'bg-muted text-muted-foreground' },
};
const SCHEDULE = {
  CHANGED: { label: '일정 변경', cls: 'bg-warning/15 text-warning-text' },
  HOLD: { label: '보류', cls: 'bg-destructive/15 text-destructive' },
};
// 사이드바를 연 노트북 화면에서도 칸이 잘리지 않도록 표는 아주 넓은 화면(xl)에서만, 그 아래는 두 칸 카드
const COLS = 'xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]';

// 좁은 화면에서는 칸 이름을 왼쪽에 붙여 카드처럼, 아주 넓은 화면에서는 표의 한 칸
function Cell({ label, children }) {
  return (
    <div className="grid min-w-0 grid-cols-[64px_minmax(0,1fr)] items-start gap-2 xl:block">
      <span className="pt-0.5 text-caption text-muted-foreground xl:hidden">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const Dash = () => <span className="text-label text-muted-foreground">—</span>;

function PaidBar({ percent }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-label tabular-nums">{percent}%</span>
      <div className="h-1.5 max-w-[72px] flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  );
}

function OrderRow({ card, s, onOpen }) {
  const turn = TURN[s.turn] || TURN.AEGIS;
  const pay = s.payment;
  const payUrgent = pay?.state === 'REQUESTED' && pay.days_left != null && pay.days_left <= 3;
  return (
    <li>
      <button type="button" onClick={() => onOpen(card.id, s.open_tab)} className={cn('grid w-full gap-x-4 gap-y-2 rounded-lg px-2 py-3 text-left hover:bg-muted/50 sm:grid-cols-2 xl:items-center', COLS)}>
        <div className="min-w-0 sm:col-span-2 xl:col-span-1">
          <p className="truncate text-label font-semibold">{card.title}</p>
          {card.category_label && <p className="truncate text-caption text-muted-foreground">{card.category_label}</p>}
        </div>
        <Cell label="지금 단계">
          <p className="truncate text-label">{s.stage_label}{s.stage_due && <span className="text-muted-foreground"> · {shortDate(s.stage_due)} 예정</span>}</p>
          {s.next_label
            ? <p className="truncate text-caption text-muted-foreground">다음 {s.next_label}{s.next_date ? ` · ${shortDate(s.next_date)}` : ''}</p>
            : card.due_date ? <p className="truncate text-caption text-muted-foreground">목표일 {shortDate(card.due_date)}</p> : null}
        </Cell>
        <Cell label="차례">
          <Badge className={cn('border-0', turn.cls)}>{turn.label}</Badge>
          {s.turn_reason && <p className="mt-0.5 truncate text-caption text-muted-foreground">{s.turn_reason}{s.todo_count > 1 ? ` 외 ${s.todo_count - 1}건` : ''}</p>}
        </Cell>
        <Cell label="일정">
          {SCHEDULE[s.schedule] ? <Badge className={cn('border-0', SCHEDULE[s.schedule].cls)}>{SCHEDULE[s.schedule].label}</Badge> : <span className="text-label text-muted-foreground">정상</span>}
          {s.schedule_reason && <p className="mt-0.5 line-clamp-2 text-caption text-muted-foreground">{s.schedule_reason}</p>}
        </Cell>
        <Cell label="도착">
          {s.arrival ? (
            <>
              <p className="text-label tabular-nums">{shortDate(s.arrival.date)}</p>
              <p className="truncate text-caption text-muted-foreground">{s.arrival.state === 'ARRIVED' ? `${s.arrival.label} 도착` : `${s.arrival.label} · ${dday(s.arrival.days_left)}`}</p>
            </>
          ) : <Dash />}
        </Cell>
        <Cell label="입금">
          {s.paid_percent == null ? <Dash /> : <PaidBar percent={s.paid_percent} />}
          {pay && (
            <p className={cn('mt-0.5 truncate text-caption', payUrgent ? 'font-medium text-warning-text' : 'text-muted-foreground')}>
              {pay.state === 'REPORTED' ? `${pay.label} 송금 확인 중` : `${pay.label} ${pay.due_date ? `기한 ${shortDate(pay.due_date)}${payUrgent ? ` · ${dday(pay.days_left)}` : ''}` : '결제 요청'}`}
            </p>
          )}
        </Cell>
      </button>
    </li>
  );
}

export default function ClientOrderBoard({ cards, overview, loading, onOpen }) {
  const [view, setView] = useState('list');
  const active = cards.filter((c) => !['DONE', 'CANCELLED'].includes(c.status));
  const summaries = overview?.summaries || {};
  const pos = new Map((overview?.order || []).map((id, i) => [id, i]));
  const rows = [...active].sort((a, b) => (pos.get(a.id) ?? Infinity) - (pos.get(b.id) ?? Infinity));
  const mine = rows.filter((c) => summaries[c.id]?.turn === 'CLIENT').length;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h2 className="text-body font-semibold">진행 중인 프로젝트 {active.length}건</h2>
          {mine > 0 && <p className="text-caption text-muted-foreground">고객님 차례인 프로젝트 {mine}건이 맨 위에 있습니다</p>}
        </div>
        <div className="flex rounded-lg border p-0.5" role="group" aria-label="보기 방식">
          <Button type="button" size="sm" variant={view === 'list' ? 'secondary' : 'ghost'} className="h-7 gap-1 px-2.5 text-label" aria-pressed={view === 'list'} onClick={() => setView('list')}><List className="h-3.5 w-3.5" />목록</Button>
          <Button type="button" size="sm" variant={view === 'calendar' ? 'secondary' : 'ghost'} className="h-7 gap-1 px-2.5 text-label" aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}><CalendarDays className="h-3.5 w-3.5" />입고 달력</Button>
        </div>
        <ClientExportButton />
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link to="/client/board"><Kanban className="h-3.5 w-3.5" />보드로 보기</Link>
        </Button>
      </div>

      {view === 'calendar' ? (
        <ClientArrivalCalendar events={overview?.calendar || []} loading={loading} onOpen={onOpen} />
      ) : active.length === 0 ? (
        <p className="py-10 text-center text-label text-muted-foreground">아직 공개된 프로젝트가 없습니다. 담당자가 검토를 마치면 여기에 표시됩니다.</p>
      ) : (
        <div className="mt-3">
          <div className={cn('hidden gap-x-4 border-b px-2 pb-2 text-caption text-muted-foreground xl:grid', COLS)}>
            <span>프로젝트</span><span>지금 단계 · 다음 일정</span><span>차례</span><span>일정</span><span>도착 예정</span><span>입금</span>
          </div>
          <ul className="divide-y">
            {rows.map((c) => (summaries[c.id]
              ? <OrderRow key={c.id} card={c} s={summaries[c.id]} onOpen={onOpen} />
              : (
                <li key={c.id}>
                  <button type="button" onClick={() => onOpen(c.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-3 text-left hover:bg-muted/50">
                    <span className="truncate text-label font-semibold">{c.title}</span>
                    {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  </button>
                </li>
              )))}
          </ul>
        </div>
      )}
    </Card>
  );
}
