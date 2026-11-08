import React from 'react';
import Pill from '@/components/prototype/Pill';
import { REVIEW_AREAS, REVIEW_VERDICT, fmtDate } from '@/lib/prototype';

export default function ReviewHistory({ reviews, selectedId, onSelect }) {
  return (
    <div className="rounded-xl border bg-card p-2">
      <p className="px-2 py-1.5 text-caption font-semibold text-muted-foreground">검토 기록</p>
      {reviews.length === 0 && <p className="px-2 pb-2 text-caption text-muted-foreground">아직 검토 기록이 없습니다.</p>}
      {reviews.map((r) => {
        const open = (r.findings || []).filter((f) => f.status === 'OPEN').length;
        return (
          <button key={r.id} type="button" onClick={() => onSelect(r.id)} className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${selectedId === r.id ? 'bg-primary/10' : 'hover:bg-muted'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-label font-semibold">{fmtDate(r.created_date)}{r.version_no ? ` · v${r.version_no}` : ''}</span>
              <Pill meta={REVIEW_VERDICT[r.verdict]} />
            </div>
            <p className="text-micro text-muted-foreground">{(r.areas || []).map((a) => REVIEW_AREAS[a]).join('·')} · 미해결 {open} · {r.reviewer_name}</p>
          </button>
        );
      })}
    </div>
  );
}