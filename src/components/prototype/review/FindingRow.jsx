import React from 'react';
import Pill from '@/components/prototype/Pill';
import { FINDING_STATUS, SEVERITY } from '@/lib/prototype';

// 지적 사항 한 줄 — 처리 상태를 바꿀 수 있다
export default function FindingRow({ finding: f, onStatus, busy }) {
  return (
    <li className={`rounded-lg border p-3 ${f.status !== 'OPEN' ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Pill meta={SEVERITY[f.severity]} />
        <span className="text-body font-medium mr-auto">{f.title}</span>
        <select className={`h-8 rounded-md border bg-transparent px-1 text-label ${FINDING_STATUS[f.status]?.className || ''}`} value={f.status || 'OPEN'} disabled={busy} onChange={(e) => onStatus(f.id, e.target.value)}>
          {Object.entries(FINDING_STATUS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </select>
      </div>
      {f.location && <p className="mt-1 text-caption text-primary">위치: {f.location}</p>}
      {f.detail && <p className="mt-1 text-caption text-muted-foreground whitespace-pre-wrap">{f.detail}</p>}
      {f.recommendation && <p className="mt-1 text-caption">권고: {f.recommendation}</p>}
      {f.resolved_by_name && f.status !== 'OPEN' && <p className="mt-1 text-micro text-muted-foreground">처리: {f.resolved_by_name}</p>}
    </li>
  );
}