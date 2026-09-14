import React from 'react';
import { Button } from '@/components/ui/button';
import { revisionLabels } from '@/components/quotation/quotationRevisionLabels';

export default function QuotationRevisionList({ rows, hasMore, loadingMore, onMore, onCompare }) {
  return <div className="space-y-2">
    {rows.length === 0 && <p className="rounded-lg border p-4 text-sm text-muted-foreground">아직 보관된 수정 이력이 없습니다. 기능 적용 이후 수정 저장한 내역부터 기록됩니다.</p>}
    {rows.map(r => <div key={r.id} className="rounded-lg border p-3 space-y-1">
      <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">v{r.revision_no} → v{r.revision_no + 1}</p><Button size="sm" variant="outline" onClick={() => onCompare(r.id)}>현재와 비교</Button></div>
      <p className="text-xs text-muted-foreground">{new Date(r.created_date).toLocaleString('ko-KR')} · {r.changed_by_name}</p>
      <p className="text-sm whitespace-pre-wrap">{r.reason}</p>
      <p className="text-xs text-muted-foreground">{(r.changed_fields || []).map(k => revisionLabels[k] || k).join(', ')}</p>
    </div>)}
    {hasMore && <Button size="sm" variant="outline" disabled={loadingMore} onClick={onMore}>{loadingMore ? '불러오는 중…' : '이전 이력 더 보기'}</Button>}
  </div>;
}