import React from 'react';
import { Star } from 'lucide-react';
import { SAMPLE_LOCATIONS } from '@/lib/goldenSample';

// 고객 검수 탭 맨 위: 승인한 기준 샘플 — 양산품은 이 샘플과 나란히 비교해 검수한다
export default function ClientGoldenSample({ sample }) {
  if (!sample || (!sample.approved_at && !sample.photos?.length)) return null;
  const locs = Object.entries(sample.locations || {}).filter(([, n]) => Number(n) > 0);
  return (
    <div className="mb-4 space-y-2 rounded-xl border p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold"><Star className="h-4 w-4 text-primary" />기준 샘플</p>
      {!!sample.photos.length && (
        <div className="flex flex-wrap gap-2">
          {sample.photos.map((p) => <a key={p.url} href={p.url} target="_blank" rel="noreferrer" className="h-20 w-20 overflow-hidden rounded-md border"><img src={p.url} alt={p.name} className="h-full w-full object-cover" /></a>)}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {sample.approved_at ? `${sample.approved_at} 승인${sample.approved_by ? ` (${sample.approved_by})` : ''}` : '승인일 미기록'}
        {sample.seal_no ? ` · 봉인 번호 ${sample.seal_no}` : ''}
        {locs.length ? ` · ${locs.map(([k, n]) => `${SAMPLE_LOCATIONS[k] || k} ${n}개`).join(', ')}` : ''}
      </p>
      <p className="text-[11px] text-muted-foreground">양산품 검수는 이 샘플과 나란히 놓고 비교합니다. 받은 물건이 이 샘플과 다르면 아래 &lsquo;불량 신고&rsquo;로 알려 주세요.</p>
    </div>
  );
}
