import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { PLATFORMS, formatKst } from './marketingMeta';

export default function PerformancePanel({ posts }) {
  const { data: metrics = [] } = useQuery({ queryKey: ['marketingMetrics'], queryFn: () => base44.entities.MarketingMetric.list('-metric_date', 1000) });
  const published = posts.filter((p) => p.status === 'published');
  const sum = (id, k) => metrics.filter((m) => m.post_id === id).reduce((a, m) => a + (m[k] || 0), 0);

  return (
    <div className="rounded-2xl border bg-card p-6">
      <div className="flex items-baseline justify-between mb-5">
        <h2 className="text-lg font-semibold">게시 완료 {published.length}건</h2>
        <p className="text-xs text-muted-foreground">플랫폼 성과 자동 수집은 다음 단계에서 제공됩니다.</p>
      </div>
      {!published.length && <p className="text-sm text-muted-foreground py-10 text-center">아직 게시 완료된 게시물이 없습니다.</p>}
      <div className="divide-y">
        {published.map((p) => (
          <div key={p.id} className="py-4 grid md:grid-cols-[1fr_auto] gap-3 items-center">
            <div className="min-w-0">
              <p className="font-medium truncate">{p.title}</p>
              <p className="text-xs text-muted-foreground">{p.published_at && formatKst(p.published_at)} · {p.utm_campaign || '캠페인 미지정'}</p>
              {(p.published_urls || []).map((u) => <a key={u.url} href={u.url} target="_blank" rel="noreferrer" className="text-xs text-primary block truncate">{PLATFORMS[u.platform]} 열기</a>)}
            </div>
            <div className="flex gap-6 text-sm tabular-nums">
              {[['views', '조회'], ['likes', '좋아요'], ['comments', '댓글']].map(([k, l]) => (
                <div key={k} className="text-center"><p className="font-semibold">{sum(p.id, k)}</p><p className="text-[11px] text-muted-foreground">{l}</p></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}