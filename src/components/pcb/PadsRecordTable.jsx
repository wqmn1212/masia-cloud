import React from 'react';

export default function PadsRecordTable({ rows, sections, sel, onSelect, total, cap = 200 }) {
  const shown = rows.slice(0, cap);
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="max-h-[46vh] overflow-auto">
        <table className="w-full text-caption">
          <thead className="sticky top-0 bg-card"><tr className="border-b text-left text-muted-foreground"><th className="px-3 py-2 font-medium">줄</th><th className="py-2 font-medium">구역</th><th className="py-2 pr-3 font-medium">기록</th></tr></thead>
          <tbody>
            {shown.map(({ s, r, record }) => (
              <tr key={`${s}-${r}`} onClick={() => onSelect({ s, r })} className={`cursor-pointer border-b border-border/50 align-top ${sel?.s === s && sel?.r === r ? 'bg-primary/10' : 'hover:bg-muted'}`}>
                <td className="px-3 py-1 tabular-nums text-muted-foreground">{record.lineNo}</td>
                <td className="py-1 text-muted-foreground">{sections[s].label}</td>
                <td className="py-1 pr-3"><span className="font-medium">{record.tokens[0]?.value}</span><span className="ml-2 text-muted-foreground">{record.tokens.slice(1).map(t => t.value).join(' · ')}</span></td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">기록이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="border-t px-3 py-1.5 text-micro text-muted-foreground">표시 {shown.length} / {total} 기록</p>
    </div>
  );
}