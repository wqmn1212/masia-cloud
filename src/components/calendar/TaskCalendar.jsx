import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// 인라인 스타일 기반 색상 (Tailwind 퍼지 문제 방지)
const STATUS_BG = {
  TODO:        '#6b7280',
  IN_PROGRESS: '#f59e0b',
  REVIEW:      '#14b8a6',
  PRODUCTION:  '#a855f7',
  DONE:        '#3b82f6',
};

const PRIORITY_BG = {
  URGENT: '#ef4444',
  HIGH:   '#f97316',
  // MEDIUM → STATUS_BG 사용
  LOW:    '#94a3b8',
};

function getCardBg(priority, status) {
  if (priority && PRIORITY_BG[priority]) return PRIORITY_BG[priority];
  return STATUS_BG[status] || '#6b7280';
}

const PRIORITY_EMOJI = { URGENT: '🔴', HIGH: '🟠', LOW: '⚪' };

const STATUS_LABEL = {
  TODO: '대기', IN_PROGRESS: '소싱 중', REVIEW: '견적 검토', PRODUCTION: '발주·제작', DONE: '완료',
};

const PRIORITY_DOT = {
  LOW: 'bg-muted-foreground', MEDIUM: 'bg-chart-3', HIGH: 'bg-destructive', URGENT: 'bg-destructive',
};

const WEEK_DAYS = ['일', '월', '화', '수', '목', '금', '토'];

const ITEM_STATUS_BG = {
  TODO:        '#9ca3af',
  IN_PROGRESS: '#fbbf24',
  DONE:        '#60a5fa',
};

export default function TaskCalendar({ cards = [], taskItems = [], onCardClick, onDateClick }) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-indexed
  const [hoveredCard, setHoveredCard] = useState(null);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };
  const goToday = () => { setCurrentYear(today.getFullYear()); setCurrentMonth(today.getMonth()); };

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startOffset = firstDay.getDay(); // 0=Sun
    const days = [];

    // Prev month padding
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth, -i);
      days.push({ date: d, isCurrentMonth: false });
    }
    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ date: new Date(currentYear, currentMonth, d), isCurrentMonth: true });
    }
    // Next month padding to complete grid
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(currentYear, currentMonth + 1, i), isCurrentMonth: false });
    }
    return days;
  }, [currentYear, currentMonth]);

  // Map cards to date strings
  const cardsByDate = useMemo(() => {
    const map = {};
    cards.forEach(card => {
      if (!card.due_date) return;
      const key = card.due_date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push({ ...card, _type: 'card' });
    });
    return map;
  }, [cards]);

  // Map task items to date strings
  const itemsByDate = useMemo(() => {
    const map = {};
    taskItems.forEach(item => {
      if (!item.due_date) return;
      const key = item.due_date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push({ ...item, _type: 'item' });
    });
    return map;
  }, [taskItems]);

  const formatDateKey = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const isToday = (date) =>
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  const cardsWithDueDate = cards.filter(c => c.due_date).length;
  const itemsWithDueDate = taskItems.filter(i => i.due_date).length;

  return (
    <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 sm:px-6 py-3 sm:py-4 border-b bg-card">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <CalendarDays className="w-5 h-5 text-primary" />
          <h2 className="text-base sm:text-lg font-bold">
            {currentYear}년 {currentMonth + 1}월
          </h2>
          <Badge variant="outline" className="text-[10px] sm:text-xs">{cardsWithDueDate}개 카드 · {itemsWithDueDate}개 세부업무</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday} className="text-xs h-7 px-3">
            오늘
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Week header */}
      <div className="grid grid-cols-7 border-b">
        {WEEK_DAYS.map((day, i) => (
          <div key={day} className={`text-center text-xs font-medium py-2 ${i === 0 ? 'text-destructive' : i === 6 ? 'text-primary' : 'text-muted-foreground'}`}>
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7" style={{ minHeight: '480px' }}>
        {calendarDays.map((dayObj, idx) => {
          const key = formatDateKey(dayObj.date);
          const dayCards = cardsByDate[key] || [];
          const dayItems = itemsByDate[key] || [];
          const allDayEntries = [...dayCards, ...dayItems];
          const dayOfWeek = dayObj.date.getDay();
          const todayStyle = isToday(dayObj.date);

          return (
            <div
              key={idx}
              onClick={() => onDateClick && onDateClick(key)}
              className={`border-r border-b p-0.5 sm:p-1 min-h-[68px] sm:min-h-[100px] cursor-pointer group transition-colors
                ${!dayObj.isCurrentMonth ? 'bg-muted/20' : 'hover:bg-accent/5'}
                ${idx % 7 === 6 ? 'border-r-0' : ''}
              `}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full
                  ${todayStyle ? 'bg-primary text-primary-foreground' : ''}
                  ${!dayObj.isCurrentMonth ? 'text-muted-foreground/40' : ''}
                  ${dayOfWeek === 0 && !todayStyle ? 'text-destructive' : ''}
                  ${dayOfWeek === 6 && !todayStyle ? 'text-primary' : ''}
                `}>
                  {dayObj.date.getDate()}
                </span>
              </div>

              {/* Cards & Items */}
              <div className="space-y-0.5">
                {allDayEntries.slice(0, 3).map(entry => (
                  entry._type === 'card' ? (
                    <div
                      key={entry.id}
                      onClick={(e) => { e.stopPropagation(); onCardClick && onCardClick(entry); }}
                      onMouseEnter={() => setHoveredCard(entry.id)}
                      onMouseLeave={() => setHoveredCard(null)}
                      className={`relative text-[10px] rounded px-1.5 py-0.5 truncate cursor-pointer font-medium transition-opacity text-white
                        ${hoveredCard === entry.id ? 'opacity-80' : 'opacity-100'}
                      `}
                      style={{
                        backgroundColor: getCardBg(entry.priority, entry.status),
                        textDecoration: entry.status === 'DONE' ? 'line-through' : 'none',
                      }}
                      title={`[${entry.priority || '우선순위없음'}] ${entry.title}`}
                    >
                      {PRIORITY_EMOJI[entry.priority] && (
                        <span className="mr-0.5 text-[9px]">{PRIORITY_EMOJI[entry.priority]}</span>
                      )}
                      {entry.title}
                    </div>
                  ) : (
                    <div
                      key={entry.id}
                      className="text-[10px] rounded px-1.5 py-0.5 truncate font-medium text-white border border-white/20"
                      style={{
                        backgroundColor: PRIORITY_BG[entry.priority] || ITEM_STATUS_BG[entry.status] || '#9ca3af',
                        opacity: 0.85,
                        textDecoration: entry.status === 'DONE' ? 'line-through' : 'none',
                      }}
                      title={`[세부업무] ${entry.title}`}
                    >
                      ↳ {PRIORITY_EMOJI[entry.priority] || ''}{entry.title}
                    </div>
                  )
                ))}
                {allDayEntries.length > 3 && (
                  <div className="text-[9px] text-muted-foreground px-1 font-medium">
                    +{allDayEntries.length - 3}개 더
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-2 sm:py-3 border-t bg-muted/20 flex-wrap">
        <span className="text-[10px] font-semibold text-muted-foreground mr-1">우선순위:</span>
        {[['URGENT','#ef4444','긴급'], ['HIGH','#f97316','높음'], ['MEDIUM',null,'보통'], ['LOW','#94a3b8','낮음']].map(([k, color, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color || '#6366f1' }} />
            <span className="text-[10px] text-muted-foreground">{v}</span>
          </div>
        ))}
        <span className="text-[10px] font-semibold text-muted-foreground ml-2 mr-1">↳ 세부업무</span>
      </div>
    </div>
  );
}