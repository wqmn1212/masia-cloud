import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const STATUS_COLOR = {
  TODO:        'bg-muted-foreground/70 text-white',
  IN_PROGRESS: 'bg-chart-3 text-white',
  REVIEW:      'bg-accent text-white',
  PRODUCTION:  'bg-chart-4 text-white',
  DONE:        'bg-primary text-white',
};

const STATUS_LABEL = {
  TODO: '대기', IN_PROGRESS: '소싱 중', REVIEW: '견적 검토', PRODUCTION: '발주·제작', DONE: '완료',
};

const PRIORITY_DOT = {
  LOW: 'bg-muted-foreground', MEDIUM: 'bg-chart-3', HIGH: 'bg-destructive', URGENT: 'bg-destructive',
};

const WEEK_DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function TaskCalendar({ cards = [], onCardClick, onDateClick }) {
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
      map[key].push(card);
    });
    return map;
  }, [cards]);

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

  return (
    <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">
            {currentYear}년 {currentMonth + 1}월
          </h2>
          <Badge variant="outline" className="text-xs">{cardsWithDueDate}개 업무</Badge>
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
          const dayOfWeek = dayObj.date.getDay();
          const todayStyle = isToday(dayObj.date);

          return (
            <div
              key={idx}
              onClick={() => onDateClick && onDateClick(key)}
              className={`border-r border-b p-1 min-h-[100px] cursor-pointer group transition-colors
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

              {/* Cards */}
              <div className="space-y-0.5">
                {dayCards.slice(0, 3).map(card => (
                  <div
                    key={card.id}
                    onClick={(e) => { e.stopPropagation(); onCardClick && onCardClick(card); }}
                    onMouseEnter={() => setHoveredCard(card.id)}
                    onMouseLeave={() => setHoveredCard(null)}
                    className={`relative text-[10px] rounded px-1.5 py-0.5 truncate cursor-pointer font-medium transition-opacity
                      ${STATUS_COLOR[card.status] || 'bg-muted text-foreground'}
                      ${hoveredCard === card.id ? 'opacity-80' : 'opacity-100'}
                    `}
                    title={card.title}
                  >
                    {card.priority && card.priority !== 'MEDIUM' && (
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${PRIORITY_DOT[card.priority]} opacity-80`} />
                    )}
                    {card.title}
                  </div>
                ))}
                {dayCards.length > 3 && (
                  <div className="text-[9px] text-muted-foreground px-1 font-medium">
                    +{dayCards.length - 3}개 더
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-6 py-3 border-t bg-muted/20 flex-wrap">
        {Object.entries(STATUS_LABEL).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${STATUS_COLOR[k]?.split(' ')[0]}`} />
            <span className="text-[10px] text-muted-foreground">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}