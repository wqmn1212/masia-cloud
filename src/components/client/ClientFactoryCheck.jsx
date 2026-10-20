import React from 'react';
import { CheckCircle2, CircleDashed, ShieldCheck, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { FACTORY_CHECK_STATE } from '@/lib/factoryCheck';

const ICON = {
  OK: <CheckCircle2 className="h-3.5 w-3.5 text-primary" />,
  NA: <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />,
  NG: <XCircle className="h-3.5 w-3.5 text-destructive" />,
};

// 고객 진행 정보: 이 프로젝트 공장이 진짜 제조사인지 이지스가 확인한 항목
export default function ClientFactoryCheck({ check }) {
  if (!check) return null;
  const st = FACTORY_CHECK_STATE[check.status] || FACTORY_CHECK_STATE.NONE;
  return (
    <div className="mb-4 space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">공장 확인</p>
        <Badge className={`border-0 ${st.cls}`}>{st.label}</Badge>
        {check.visited_at && <span className="ml-auto text-xs text-muted-foreground">현장 방문 {check.visited_at}</span>}
      </div>
      <ul className="grid gap-1 text-xs sm:grid-cols-2">
        {check.items.map((i) => (
          <li key={i.key} className="flex items-center gap-1.5">{ICON[i.status] || <CircleDashed className="h-3.5 w-3.5 text-muted-foreground" />}<span className={i.status ? '' : 'text-muted-foreground'}>{i.label}{i.status === 'NA' ? ' (해당 없음)' : ''}</span></li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">공장 실사 결과입니다. 모든 항목이 확인돼야 이지스가 생산 착수를 진행합니다.</p>
    </div>
  );
}
