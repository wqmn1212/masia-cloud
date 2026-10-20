import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, CalendarClock, ChevronRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { withClientView } from '@/lib/clientView';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const DAY = ['일', '월', '화', '수', '목', '금', '토'];
const shortDate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return `${m}/${d} (${DAY[new Date(y, m - 1, d).getDay()]})`;
};

function Row({ onClick, children }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted">
        {children}
        <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    </li>
  );
}

// 고객 대시보드 맨 위: 고객이 직접 해야 할 일(기준서·출고 판단, 도착지 비용 확인)과 앞으로 2주 일정.
export default function ClientTodoCard({ onOpen }) {
  const { data } = useQuery({
    queryKey: ['client-todos'],
    queryFn: async () => (await base44.functions.invoke('listClientTodos', withClientView())).data,
    refetchInterval: 60000,
  });
  const specs = data?.spec_pending || [];
  const qc = data?.qc_pending || [];
  const destCosts = data?.dest_cost_pending || [];
  const upcoming = data?.upcoming || [];
  const count = specs.length + qc.length + destCosts.length;

  return (
    <Card className="grid gap-5 p-5 md:grid-cols-2">
      <section>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <ClipboardCheck className="h-4 w-4 text-primary" />고객님이 확인하실 일
          {count > 0 && <Badge className="border-0 bg-destructive/15 text-destructive">{count}</Badge>}
        </h2>
        {count === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">지금 확인하실 일은 없습니다.</p>
        ) : (
          <ul className="mt-2 space-y-0.5">
            {specs.map((s) => (
              <Row key={s.spec_id} onClick={() => onOpen(s.card_id, 'qc')}>
                <Badge variant="outline" className="shrink-0 text-[10px]">기준서 승인 대기</Badge>
                <span className="min-w-0 truncate">{s.card_title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">품질 기준서 v{s.version}</span>
              </Row>
            ))}
            {destCosts.map((d) => (
              <Row key={d.shipment_id} onClick={() => onOpen(d.card_id, 'overview')}>
                <Badge variant="outline" className="shrink-0 text-[10px]">도착지 비용 확인</Badge>
                <span className="min-w-0 truncate">{d.card_title}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{d.label} · 약 {d.amount.toLocaleString('ko-KR')}원</span>
              </Row>
            ))}
            {qc.map((q) => (
              <Row key={q.report_id} onClick={() => onOpen(q.card_id, 'qc')}>
                <Badge variant="outline" className="shrink-0 text-[10px]">{q.decision === 'ON_HOLD' ? '보류 중' : q.inspection_type === 'SAMPLE' ? '샘플 승인 대기' : '출고 승인 대기'}</Badge>
                <span className="min-w-0 truncate">{q.card_title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{q.inspection_type === 'SAMPLE' ? '샘플 검수' : '출고 전 검수'}</span>
              </Row>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold"><CalendarClock className="h-4 w-4 text-primary" />앞으로 2주 일정</h2>
        {upcoming.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">2주 안에 예정된 단계가 없습니다.</p>
        ) : (
          <ul className="mt-2 space-y-0.5">
            {upcoming.map((u) => (
              <Row key={u.id} onClick={() => onOpen(u.card_id, 'overview')}>
                <span className="w-16 shrink-0 text-xs font-semibold tabular-nums text-primary">{shortDate(u.planned_date)}</span>
                <span className="min-w-0 truncate">{u.label}</span>
                <span className="min-w-0 shrink truncate text-xs text-muted-foreground">{u.card_title}</span>
              </Row>
            ))}
          </ul>
        )}
      </section>
    </Card>
  );
}
