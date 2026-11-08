import React from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// 표 형태 행 편집기 (부품표·연결 관계). columns = [{key, label, width, type, options}]
export default function RowsEditor({ rows = [], columns, onChange, addLabel }) {
  const set = (i, key, val) => onChange(rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-label">
          <thead><tr>{columns.map((c) => <th key={c.key} className="px-1 py-1 text-left text-caption font-medium text-muted-foreground whitespace-nowrap">{c.label}</th>)}<th /></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c.key} className="px-1 py-1">
                    {c.options ? (
                      <select className="h-8 w-full rounded-md border bg-transparent px-1 text-label" value={r[c.key] || c.options[0].value} onChange={(e) => set(i, c.key, e.target.value)}>
                        {c.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input
                        className="h-8 rounded-md border bg-transparent px-2 text-label"
                        style={{ width: c.width || 110 }}
                        type={c.type || 'text'}
                        value={r[c.key] ?? ''}
                        onChange={(e) => set(i, c.key, c.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
                      />
                    )}
                  </td>
                ))}
                <td className="px-1"><Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onChange(rows.filter((_, idx) => idx !== i))}><X className="w-4 h-4" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button size="sm" variant="outline" onClick={() => onChange([...rows, {}])}><Plus className="w-4 h-4" />{addLabel}</Button>
    </div>
  );
}