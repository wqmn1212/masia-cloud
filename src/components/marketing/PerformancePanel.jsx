import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { PLATFORMS, formatKst } from './marketingMeta';

const COLS = [['views', '조회'], ['likes', '좋아요'], ['comments', '댓글'], ['reach', '도달'], ['leads', '문의'], ['converted', '전환']];

export default function PerformancePanel({ posts }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const { data: metrics = [] } = useQuery({ queryKey: ['marketingMetrics'], queryFn: () => base44.entities.MarketingMetric.list('-metric_date', 1000) });
  const { data: leads = [] } = useQuery({ queryKey: ['marketingLeads'], queryFn: () => base44.entities.ManufacturingLead.list('-created_date', 2000) });
  const published = posts.filter((p) => p.status === 'published');

  // 게시물별 최신 스냅샷(플랫폼별 마지막 날짜) 합산
  const latest = (id, k) => Object.values(metrics.filter((m) => m.post_id === id).reduce((acc, m) => {
    if (!acc[m.platform] || m.metric_date > acc[m.platform].metric_date) acc[m.platform] = m;
    return acc;
  }, {})).reduce((a, m) => a + (m[k] || 0), 0);
  const hasMetric = (id) => metrics.some((m) => m.post_id === id);
  const value = (p, k) => {
    if (k === 'reach') return '미제공';
    if (k === 'leads' || k === 'converted') {
      if (!p.utm_campaign) return '미분류';
      const ls = leads.filter((l) => l.utm_campaign === p.utm_campaign);
      return k === 'leads' ? ls.length : ls.filter((l) => l.status === 'converted').length;
    }
    return hasMetric(p.id) ? latest(p.id, k) : '미제공';
  };

  const refresh = async () => {
    setBusy(true);
    const res = await base44.functions.invoke('refreshMarketingMetrics', {});
    setResult(res.data);
    qc.invalidateQueries({ queryKey: ['marketingMetrics'] });
    qc.invalidateQueries({ queryKey: ['socialConnections'] });
    setBusy(false);
  };

  return (
    <div className="rounded-2xl border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 className="text-lg font-semibold">게시 완료 {published.length}건</h2>
        <Button size="sm" onClick={refresh} disabled={busy}><RefreshCw className={busy ? 'animate-spin' : ''} /> 직접 갱신</Button>
      </div>
      {result && (
        <div className="mb-5 grid sm:grid-cols-2 gap-2 text-xs">
          {Object.entries(PLATFORMS).map(([k, l]) => (
            <div key={k} className={`rounded-lg px-3 py-2 ${result[k]?.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{l}: {result[k]?.message}</div>
          ))}
        </div>
      )}
      {!published.length && <p className="text-sm text-muted-foreground py-10 text-center">아직 게시 완료된 게시물이 없습니다.</p>}
      <div className="divide-y">
        {published.map((p) => (
          <div key={p.id} className="py-4 grid md:grid-cols-[1fr_auto] gap-3 items-center">
            <div className="min-w-0">
              <p className="font-medium truncate">{p.title}</p>
              <p className="text-xs text-muted-foreground">{p.published_at && formatKst(p.published_at)} · {p.utm_campaign || '캠페인 미지정'}</p>
              {(p.published_urls || []).map((u) => <a key={u.url} href={u.url} target="_blank" rel="noreferrer" className="text-xs text-primary block truncate">{PLATFORMS[u.platform]} 열기</a>)}
            </div>
            <div className="flex gap-5 text-sm tabular-nums">
              {COLS.map(([k, l]) => {
                const v = value(p, k);
                return <div key={k} className="text-center"><p className={typeof v === 'number' ? 'font-semibold' : 'text-xs text-muted-foreground'}>{v}</p><p className="text-[11px] text-muted-foreground">{l}</p></div>;
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}