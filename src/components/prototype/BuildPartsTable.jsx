import React from 'react';

const STATUS = [
  { value: 'MATCH', label: '일치', className: 'text-success-text' },
  { value: 'SUBSTITUTE', label: '대체', className: 'text-warning-text' },
  { value: 'MISSING', label: '누락', className: 'text-destructive' },
];

export default function BuildPartsTable({ parts = [], onChange }) {
  const set = (i, key, val) => onChange(parts.map((p, idx) => (idx === i ? { ...p, [key]: val } : p)));
  const diff = parts.filter((p) => p.status !== 'MATCH').length;
  if (!parts.length) return <p className="text-caption text-muted-foreground">설계 부품표가 비어 있습니다.</p>;
  return (
    <div className="space-y-2">
      <p className="text-label font-semibold">부품 대조 {diff > 0 && <span className="text-warning-text">· 설계와 다름 {diff}</span>}</p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-label">
          <thead className="bg-muted/60 text-caption text-muted-foreground">
            <tr>{['Ref', '부품', '설계 부품번호', '실제 부품번호', '실제 제조사', '상태', '메모'].map((h) => <th key={h} className="px-2 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {parts.map((p, i) => (
              <tr key={i}>
                <td className="px-2 py-1.5 font-mono text-caption">{p.ref || '-'}</td>
                <td className="px-2 py-1.5">{p.name}</td>
                <td className="px-2 py-1.5 font-mono text-caption text-muted-foreground">{p.planned_part_no || '-'}</td>
                <td className="px-2 py-1.5"><input className="h-8 w-36 rounded-md border bg-transparent px-2 font-mono text-caption" value={p.actual_part_no || ''} onChange={(e) => set(i, 'actual_part_no', e.target.value)} /></td>
                <td className="px-2 py-1.5"><input className="h-8 w-28 rounded-md border bg-transparent px-2 text-label" value={p.actual_manufacturer || ''} onChange={(e) => set(i, 'actual_manufacturer', e.target.value)} /></td>
                <td className="px-2 py-1.5">
                  <select className={`h-8 rounded-md border bg-transparent px-1 text-label ${STATUS.find((s) => s.value === p.status)?.className || ''}`} value={p.status || 'MATCH'} onChange={(e) => set(i, 'status', e.target.value)}>
                    {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5"><input className="h-8 w-44 rounded-md border bg-transparent px-2 text-label" value={p.note || ''} onChange={(e) => set(i, 'note', e.target.value)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}