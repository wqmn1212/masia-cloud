import React from 'react';
import { FileCheck2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { REQ_STATUS, pendingReqs, reqDone } from '@/lib/importRequirements';

// 고객 진행 정보: 이 제품을 들여오는 데 필요한 인증·신고와 진행 상태
export default function ClientImportRequirements({ list = [] }) {
  if (!list.length) return null;
  const left = pendingReqs(list).length;
  return (
    <div className="mb-4 space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <FileCheck2 className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">수입 요건 (인증·신고)</p>
        {left ? <Badge className="border-0 bg-chart-3/15 text-chart-3">남은 요건 {left}</Badge> : <Badge className="border-0 bg-primary/10 text-primary">모두 완료</Badge>}
      </div>
      <ul className="divide-y rounded-md border text-xs">
        {list.map((r) => (
          <li key={r.key} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-2.5 py-1.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${reqDone(r) ? 'bg-primary' : 'bg-chart-3'}`} />
            <span className="min-w-0 flex-1">{r.label}</span>
            <span className={reqDone(r) ? 'text-primary' : 'text-muted-foreground'}>{REQ_STATUS[r.status]}{r.cert_no ? ` · ${r.cert_no}` : ''}{!reqDone(r) && r.due_date ? ` · ${r.due_date}까지` : ''}</span>
            {r.note && <span className="w-full pl-4 text-muted-foreground">{r.note}</span>}
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">인증·신고가 끝나야 통관이 막히지 않습니다. 고객사 명의로 받아야 하는 인증은 담당자가 따로 안내드립니다.</p>
    </div>
  );
}
