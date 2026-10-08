import React from 'react';
import { Card } from '@/components/ui/card';
import { Activity, AlarmClock, UserX, CheckCircle2, TrendingDown } from 'lucide-react';

const Metric = ({ icon: Icon, label, value, sub, warn }) => (
  <div className="border rounded-lg p-3">
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="w-3.5 h-3.5" />{label}</div>
    <p className={`text-2xl font-bold mt-1 ${warn ? 'text-destructive' : ''}`}>{value}</p>
    {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
  </div>
);

// 운영 지표 — 카드 기준 진행·지연·책임자 현황
export default function OpsMetrics({ cards, onOpenCard }) {
  const today = new Date().toISOString().slice(0, 10);
  const active = cards.filter((c) => !['DONE', 'CANCELLED'].includes(c.status));
  const delayed = active.filter((c) => c.delay_days > 0 || c.overdue_steps > 0).sort((a, b) => (b.delay_days || 0) - (a.delay_days || 0));
  const avgDelay = delayed.length ? (delayed.reduce((s, c) => s + (c.delay_days || 0), 0) / delayed.length).toFixed(1) : 0;
  const overdueActions = active.filter((c) => c.next_action_due && c.next_action_due < today).length;
  const unassigned = active.filter((c) => !c.owner_id).length;
  // 정시 납품률: 계획 확정된 완료 카드만, 납품 단계 실제일 ≤ 기준일(지연 0)이면 정시
  const doneAll = cards.filter((c) => c.status === 'DONE');
  const done = doneAll.filter((c) => c.plan_confirmed_at);
  const onTimeCount = done.filter((c) => !(c.delay_days > 0)).length;
  const onTime = done.length ? Math.round((onTimeCount / done.length) * 100) : null;

  return (
    <Card className="p-4 space-y-4">
      <h2 className="font-semibold">운영 지표</h2>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Metric icon={Activity} label="진행 중 카드" value={active.length} />
        <Metric icon={TrendingDown} label="지연 카드" value={delayed.length} sub={delayed.length ? `평균 +${avgDelay}일` : '지연 없음'} warn={delayed.length > 0} />
        <Metric icon={AlarmClock} label="다음 할 일 기한 지남" value={overdueActions} warn={overdueActions > 0} />
        <Metric icon={UserX} label="책임자 미지정" value={unassigned} warn={unassigned > 0} />
        <Metric icon={CheckCircle2} label="정시 납품률" value={onTime === null ? '-' : `${onTime}%`} sub={`${done.length}건 중 ${onTimeCount}건 · 계획 미확정 ${doneAll.length - done.length}건`} />
      </div>
      {delayed.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground">지연 상위 카드</p>
          {delayed.slice(0, 5).map((c) => (
            <button key={c.id} onClick={() => onOpenCard(c)} className="w-full flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-muted text-left">
              <span className="flex-1 truncate">{c.title}</span>
              <span className="text-xs text-muted-foreground truncate max-w-[30%]">{c.current_milestone_label || ''} · {c.owner_name || '미지정'}</span>
              <span className="text-xs font-semibold text-destructive">+{c.delay_days}일</span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}