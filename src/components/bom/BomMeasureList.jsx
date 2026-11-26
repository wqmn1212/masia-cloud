import React from 'react';
import { Trash2 } from 'lucide-react';
import { fmtMeasure } from '@/lib/measure3d';

// 이 화면에서 잰 측정 목록 (저장하지 않는 임시 기록) — 누르면 도면 위에 다시 표시
export default function BomMeasureList({ rows, selectedId, onSelect, onDelete }) {
  if (!rows.length) return <p className="px-1 text-caption text-muted-foreground">아직 측정한 값이 없습니다.</p>;
  return (
    <div className="space-y-1">
      {rows.map((r) => (
        <div key={r.id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${selectedId === r.id ? 'bg-primary/10' : 'hover:bg-muted'}`}>
          <button type="button" onClick={() => onSelect(selectedId === r.id ? '' : r.id)} className="min-w-0 flex-1 text-left">
            <span className="block text-body font-semibold">{fmtMeasure(r.value, r.unit)}</span>
            <span className="block truncate text-micro text-muted-foreground">{r.label}{r.partNames.length ? ` · ${r.partNames.join(', ')}` : ''}</span>
          </button>
          <button type="button" onClick={() => onDelete(r.id)} className="rounded p-1 text-muted-foreground hover:text-destructive" title="삭제">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}