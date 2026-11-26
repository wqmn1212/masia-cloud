import React from 'react';
import { Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { fmtMeasure } from '@/lib/measure3d';

// 측정 한 줄: 설계값·허용 오차를 넣으면 바로 일치/차이를 보여 주고, 차이가 나면 수정 메모를 남긴다
export default function BomMeasureRow({ row, active, onSelect, onChange, onDelete }) {
  const design = row.design === '' ? null : Number(row.design);
  const tol = row.tolerance === '' ? 0 : Number(row.tolerance);
  const diff = design == null || Number.isNaN(design) ? null : Number((row.value - design).toFixed(2));
  const ok = diff != null && Math.abs(diff) <= tol;
  const unit = row.unit === 'deg' ? '°' : ' mm';
  const set = (key) => (e) => onChange({ ...row, [key]: e.target.value });

  return (
    <div className={`space-y-2 rounded-lg border p-2.5 ${active ? 'border-primary bg-primary/5' : diff == null ? '' : ok ? 'border-success/50' : 'border-destructive/50'}`}>
      <div className="flex items-start gap-2">
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
          <span className="block text-body font-semibold">{fmtMeasure(row.value, row.unit)}</span>
          <span className="block truncate text-micro text-muted-foreground">{row.label}{row.partNames.length ? ` · ${row.partNames.join(', ')}` : ''}</span>
        </button>
        <button type="button" onClick={onDelete} className="rounded p-1 text-muted-foreground hover:text-destructive" title="삭제">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-0.5">
          <span className="block text-micro text-muted-foreground">설계값 ({row.unit === 'deg' ? '°' : 'mm'})</span>
          <Input value={row.design} onChange={set('design')} inputMode="decimal" placeholder="예: 42.0" className="h-8" />
        </label>
        <label className="space-y-0.5">
          <span className="block text-micro text-muted-foreground">허용 오차 (±)</span>
          <Input value={row.tolerance} onChange={set('tolerance')} inputMode="decimal" className="h-8" />
        </label>
      </div>
      {diff != null && (
        <p className={`flex items-center gap-1 text-caption ${ok ? 'text-success-text' : 'text-destructive'}`}>
          {ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          차이 {diff > 0 ? '+' : ''}{diff}{unit} · {ok ? '설계치와 일치' : '설계치와 다름'}
        </p>
      )}
      {diff != null && !ok && (
        <label className="block space-y-0.5">
          <span className="block text-micro text-muted-foreground">수정 내용</span>
          <Input value={row.fix} onChange={set('fix')} placeholder={`예: ${row.label} ${design}${unit}로 수정`} className="h-8" />
        </label>
      )}
    </div>
  );
}