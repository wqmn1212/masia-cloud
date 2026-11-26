import React from 'react';
import { Ruler, Triangle, Trash2, Check, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fmtMeasure } from '@/lib/measure3d';

const STATUS = {
  MEASURED: ['측정', 'bg-muted text-muted-foreground'],
  DIFF: ['차이', 'bg-destructive/10 text-destructive'],
  MATCH: ['일치', 'bg-warning/15 text-warning-text'],
  DONE: ['완료', 'bg-success/15 text-success-text'],
};

// 저장된 측정 한 줄 — 값·설계값 대조·완료 표시
export default function MeasureRow({ row, active, onSelect, onStatus, onDelete }) {
  const [label, tone] = STATUS[row.status] || STATUS.MEASURED;
  const Icon = row.kind === 'ANGLE' ? Triangle : Ruler;
  const diff = row.design_value == null ? null : Number(row.value) - Number(row.design_value);
  return (
    <div className={`rounded-lg border p-2 ${active ? 'border-primary/60 bg-primary/5' : ''}`}>
      <div className="flex items-start gap-2">
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate text-label font-medium">{row.label || (row.kind === 'ANGLE' ? '각도 측정' : '거리 측정')}</span>
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-micro font-semibold ${tone}`}>{label}</span>
          </div>
          <p className="mt-0.5 text-caption">
            <span className="font-semibold">{fmtMeasure(row.value, row.unit)}</span>
            {row.design_value != null && (
              <span className="text-muted-foreground">
                {' / 설계 '}{fmtMeasure(row.design_value, row.unit)}{row.tolerance != null ? ` ±${row.tolerance}` : ''}
              </span>
            )}
          </p>
          {diff != null && (
            <p className={`text-micro ${Math.abs(diff) <= (Number(row.tolerance) || 0) ? 'text-success-text' : 'text-destructive'}`}>
              차이 {diff > 0 ? '+' : ''}{Number(diff.toFixed(2))}{row.unit === 'deg' ? '°' : ' mm'}
            </p>
          )}
          {row.note && <p className="truncate text-micro text-muted-foreground">{row.note}</p>}
          <p className="truncate text-micro text-muted-foreground">
            {row.model_file_name || '3D 모델'}{row.created_by_name ? ` · ${row.created_by_name}` : ''}
            {row.status === 'DONE' && row.done_by_name ? ` · 완료 ${row.done_by_name}` : ''}
          </p>
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {row.status === 'DONE' ? (
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onStatus(row, 'AUTO')}>
              <RotateCcw className="h-3.5 w-3.5" />완료 취소
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => onStatus(row, 'DONE')}>
              <Check className="h-3.5 w-3.5" />완료 표시
            </Button>
          )}
          <button type="button" onClick={() => onDelete(row)} className="rounded p-1 text-muted-foreground hover:text-destructive" title="삭제">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}