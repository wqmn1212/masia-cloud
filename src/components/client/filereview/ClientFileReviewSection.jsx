import React, { useState } from 'react';
import { ChevronRight, Palette } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { REVIEW_LABEL } from '@/lib/fileReview';
import ClientFileReviewDialog from './ClientFileReviewDialog';

const STATUS_CLS = { PENDING: 'bg-warning/15 text-warning-text', APPROVED: 'bg-primary/15 text-primary', REVISION_REQUESTED: 'bg-destructive/15 text-destructive' };

// 고객 카드 파일 탭 맨 위: 담당자가 보낸 디자인·도면 확인 요청. 눌러서 보고 승인·수정 요청을 고른다.
export default function ClientFileReviewSection({ cardId, reviews = [], openId }) {
  const [selectedId, setSelectedId] = useState(openId || null);
  if (!reviews.length) return null;
  const selected = reviews.find((r) => r.id === selectedId) || null;
  return (
    <section className="mb-4 space-y-2 rounded-xl border border-primary/30 p-4">
      <h3 className="flex items-center gap-1.5 text-body font-semibold"><Palette className="h-4 w-4 text-primary" />디자인·도면 확인</h3>
      <ul className="divide-y">
        {reviews.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => setSelectedId(r.id)} className="flex w-full items-center gap-2 rounded-lg px-1 py-2 text-left hover:bg-muted/50">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-label font-medium">
                  <span className="truncate">{r.file_name}</span>
                  <Badge className={cn('border-0 text-micro', STATUS_CLS[r.status])}>{REVIEW_LABEL[r.status]}</Badge>
                  {r.status === 'PENDING' && r.due_date && <span className="text-caption font-normal text-muted-foreground">기한 {r.due_date}</span>}
                </div>
                <p className="truncate text-caption text-muted-foreground">{r.status === 'PENDING' ? r.question : `${r.decided_by_name} · ${r.pins.length ? `위치 의견 ${r.pins.length}개` : r.decision_note || REVIEW_LABEL[r.status]}`}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
      <ClientFileReviewDialog cardId={cardId} review={selected} onClose={() => setSelectedId(null)} />
    </section>
  );
}
