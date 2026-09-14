import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import useQuotationHistory from '@/components/quotation/useQuotationHistory';
import QuotationRevisionCompare from '@/components/quotation/QuotationRevisionCompare';
import QuotationRevisionList from '@/components/quotation/QuotationRevisionList';

export default function QuotationHistoryPanel({ quotationId }) {
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('current');
  const state = useQuotationHistory(quotationId, leftId, rightId);
  const { history, rows } = state;
  if (history.isPending) return <p className="p-6 text-sm text-muted-foreground">수정 이력을 불러오는 중…</p>;
  if (history.isError && !history.data) return <div className="space-y-2"><p className="text-sm text-destructive">{history.error?.response?.data?.error || '이력을 불러오지 못했습니다.'}</p><Button onClick={() => history.refetch()}>다시 시도</Button></div>;
  const selected = leftId || rows[0]?.id || 'current';
  const options = [{ id: 'current', label: `v${state.currentVersion} · 현재 견적` }, ...rows.map(r => ({ id: r.id, label: `v${r.revision_no} · ${new Date(r.source_updated_date).toLocaleString('ko-KR')}` }))];
  return <div className="space-y-5">
    <p className="text-sm">현재 견적 <strong>v{state.currentVersion}</strong><span className="ml-2 text-muted-foreground">원가 포함 · 내부 관리자 전용</span></p>
    <QuotationRevisionList rows={rows} hasMore={history.hasNextPage} loadingMore={history.isFetchingNextPage} onMore={() => history.fetchNextPage()} onCompare={id => { setLeftId(id); setRightId('current'); }} />
    {history.isFetchNextPageError && <p className="text-sm text-destructive">이전 이력을 불러오지 못했습니다. 다시 더 보기를 눌러주세요.</p>}
    {rows.length > 0 && <section className="space-y-3 border-t pt-4">
      <h3 className="text-sm font-semibold">버전 비교</h3>
      <div className="grid grid-cols-2 gap-3">{[{ label: '기준 버전', value: selected, change: setLeftId }, { label: '비교 버전', value: rightId, change: setRightId }].map(s => <label key={s.label} className="space-y-1 text-xs">{s.label}<select className="block w-full rounded-md border bg-background p-2 text-foreground" value={s.value} onChange={e => s.change(e.target.value)}>{options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>)}</div>
      {state.loading ? <p className="text-sm text-muted-foreground">견적 내용을 불러오는 중…</p> : state.error ? <div><p className="text-sm text-destructive">견적 내용을 불러오지 못했습니다.</p><Button variant="outline" onClick={state.retry}>다시 시도</Button></div> : state.before && state.after ? <QuotationRevisionCompare before={state.before} after={state.after} /> : null}
    </section>}
  </div>;
}