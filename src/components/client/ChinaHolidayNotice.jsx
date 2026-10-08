import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarOff } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { withClientView } from '@/lib/clientView';

// 고객 대시보드 "중국 휴무 안내" — 앞으로 90일 안의 공휴일과 발주 마감일
export default function ChinaHolidayNotice() {
  const { data: holidays = [] } = useQuery({
    queryKey: ['client-holidays'],
    queryFn: async () => (await base44.functions.invoke('listClientHolidays', withClientView())).data?.holidays || [],
  });
  if (!holidays.length) return null;
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold flex items-center gap-1.5"><CalendarOff className="w-4 h-4 text-primary" />중국 휴무 안내 (90일 이내)</h2>
      <div className="mt-3 divide-y">
        {holidays.map((h) => (
          <div key={h.id} className="py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-medium">{h.name}</span>
            <span>{h.start_date} ~ {h.end_date}</span>
            {h.factory_start !== h.start_date && <span className="text-muted-foreground">공장 휴무 예상 {h.factory_start} ~ {h.factory_end}</span>}
            {h.order_cutoff_date && <span className="text-primary font-medium">휴무 전 출고 발주 마감 {h.order_cutoff_date} (추정)</span>}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-2">공장 휴무와 발주 마감일은 추정치이며 공장 사정에 따라 달라질 수 있습니다.</p>
    </Card>
  );
}