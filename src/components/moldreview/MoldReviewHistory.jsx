import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, History } from 'lucide-react';
import MoldIssueList from '@/components/moldreview/MoldIssueList';
import MoldSpecBox from '@/components/moldreview/MoldSpecBox';

const fmtDate = (v) => (v ? new Date(v).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) : '');

/** 저장한 검토 기록. 3D 형상은 저장하지 않으므로 판정·지시서·캡처를 보여 준다 */
export default function MoldReviewHistory() {
  const [open, setOpen] = useState(null);
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['mold-reviews'],
    queryFn: () => base44.entities.MoldReview.list('-created_date', 30),
  });

  if (isLoading) {
    return <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" />기록을 불러오는 중...</div>;
  }
  if (error) return <p className="text-xs text-muted-foreground">기록을 불러오지 못했습니다.</p>;
  if (!rows.length) return <p className="text-xs text-muted-foreground">저장한 검토가 없습니다.</p>;

  const items = open
    ? (open.issues || []).map((it) => ({
      id: it.key, level: it.level, mode: null,
      title: { ko: it.title_ko, zh: it.title_zh }, text: { ko: it.text_ko, zh: it.text_zh },
    }))
    : [];

  return (
    <>
      <div className="divide-y rounded-lg border">
        {rows.map((r) => (
          <button key={r.id} type="button" onClick={() => setOpen(r)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50">
            <History className="w-4 h-4 flex-none text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.part_name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{r.source_file_name || '샘플'} · {r.material} · {fmtDate(r.created_date)}</p>
            </div>
            {r.high_count > 0 && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-bold text-red-700 dark:bg-red-950 dark:text-red-300">높음 {r.high_count}</span>}
            {r.caution_count > 0 && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">주의 {r.caution_count}</span>}
          </button>
        ))}
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-[720px] w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">{open?.part_name}</DialogTitle>
          </DialogHeader>
          {open && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {open.source_file_name || '샘플'} · {open.material} · 빼기 방향 {open.pull_direction} · {fmtDate(open.created_date)}
                {open.note ? ` · ${open.note}` : ''}
              </p>
              {open.snapshot_url && <img src={open.snapshot_url} alt="검토 화면" className="w-full rounded-lg border" />}
              <MoldIssueList items={items} onShow={() => {}} />
              <MoldSpecBox spec={{ ko: open.spec_ko || '', zh: open.spec_zh || '' }} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
