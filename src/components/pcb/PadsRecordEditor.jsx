import React from 'react';
import { Input } from '@/components/ui/input';

export default function PadsRecordEditor({ record, section, error, onPatch }) {
  if (!record) return <p className="rounded-xl border bg-card p-4 text-caption text-muted-foreground">기록을 고르면 필드 값을 여기서 수정합니다. 값은 원래 PADS ASCII 형식 그대로 기록됩니다.</p>;
  return (
    <section className="space-y-2 rounded-xl border bg-card p-4">
      <h2 className="text-title font-semibold">{section} · {record.lineNo}행</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {record.tokens.map((token, i) => (
          <label key={i} className="block space-y-1"><span className="text-caption text-muted-foreground">필드 {i + 1}</span><Input aria-label={`필드 ${i + 1}`} value={token.value} onChange={e => onPatch(i, e.target.value)} /></label>
        ))}
      </div>
      {error && <p role="alert" className="text-caption text-destructive">{error}</p>}
    </section>
  );
}