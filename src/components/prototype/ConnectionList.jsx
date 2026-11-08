import React from 'react';
import { ArrowRight } from 'lucide-react';

// 부품 연결·신호 관계
export default function ConnectionList({ connections = [] }) {
  if (!connections.length) return <p className="text-caption text-muted-foreground">연결 관계가 없습니다.</p>;
  return (
    <ul className="space-y-1.5">
      {connections.map((c, i) => (
        <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-label">
          <span className="font-medium">{c.from}</span>
          <ArrowRight className="w-3.5 h-3.5 text-primary" />
          <span className="font-medium">{c.to}</span>
          {c.signal && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-micro text-primary">{c.signal}</span>}
          {c.voltage && <span className="rounded bg-chart-3/15 px-1.5 py-0.5 text-micro text-warning-text">{c.voltage}</span>}
          {c.note && <span className="text-caption text-muted-foreground">{c.note}</span>}
        </li>
      ))}
    </ul>
  );
}