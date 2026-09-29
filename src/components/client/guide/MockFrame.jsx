import React from 'react';

export default function MockFrame({ title, children }) {
  return (
    <div className="rounded-xl border border-border bg-background overflow-hidden select-none" aria-hidden="true">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50">
        <span className="text-[11px] font-medium text-muted-foreground">{title}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-card border border-border text-muted-foreground">예시 화면</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}