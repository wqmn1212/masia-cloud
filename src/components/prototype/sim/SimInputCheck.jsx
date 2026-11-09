import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

const ICON = {
  ok: <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-success" />,
  warn: <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-warning" />,
  error: <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />,
};

export default function SimInputCheck({ items }) {
  return (
    <div className="rounded-lg border bg-secondary/40 p-3 space-y-1.5">
      <p className="text-label font-semibold">입력 점검 — 해석 가능 여부·누락 정보</p>
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-2 text-caption">
          {ICON[it.level]}
          <span><b className="font-medium">{it.label}</b> <span className="text-muted-foreground">— {it.detail}</span></span>
        </div>
      ))}
    </div>
  );
}