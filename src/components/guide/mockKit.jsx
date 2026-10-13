import React, { createContext, useContext } from 'react';

// 번호 숨김: 소개 페이지에서 Mark 테두리·Pin·"예시 화면" 배지를 감춘다
export const MockPlainContext = createContext(false);

export function Pin({ n, pos = 'tr' }) {
  const place = { tl: '-top-2 -left-2', tr: '-top-2 -right-2', bl: '-bottom-2 -left-2', br: '-bottom-2 -right-2' }[pos];
  return <span className={`absolute ${place} z-10 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shadow`}>{n}</span>;
}

export function Mark({ n, inline = false, pos, className = '', children }) {
  const Tag = inline ? 'span' : 'div';
  const plain = useContext(MockPlainContext);
  if (plain) return <Tag className={`${inline ? 'inline-block' : 'block'} ${className}`}>{children}</Tag>;
  return (
    <Tag className={`relative ${inline ? 'inline-block pr-3' : 'block'} rounded border-2 border-destructive/70 ${className}`}>
      {children}
      <Pin n={n} pos={pos} />
    </Tag>
  );
}

export function Frame({ title, badge = '예시 화면', children }) {
  const plain = useContext(MockPlainContext);
  return (
    <div aria-hidden="true" className="pointer-events-none select-none rounded-lg border bg-card shadow-sm overflow-hidden text-xs">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/50">
        <span className="w-2 h-2 rounded-full bg-destructive/60" /><span className="w-2 h-2 rounded-full bg-chart-3/60" /><span className="w-2 h-2 rounded-full bg-accent/60" />
        <span className="font-medium ml-1 truncate">{title}</span>
        {!plain && <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{badge}</span>}
      </div>
      <div className="p-3 md:p-4">{children}</div>
    </div>
  );
}

export const Btn = ({ children, primary }) => <span className={`inline-flex items-center px-2 py-1 rounded-md text-[11px] font-medium ${primary ? 'bg-primary text-primary-foreground' : 'border bg-background'}`}>{children}</span>;
export const Field = ({ label, value }) => (
  <div className="space-y-1"><div className="text-[10px] text-muted-foreground">{label}</div><div className="px-2 py-1 rounded border bg-background">{value}</div></div>
);
export const Badge = ({ children, tone = 'muted' }) => {
  const c = { muted: 'bg-muted text-muted-foreground', red: 'bg-destructive/15 text-destructive', amber: 'bg-chart-3/15 text-chart-3', blue: 'bg-primary/10 text-primary', green: 'bg-accent/15 text-accent' }[tone];
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${c}`}>{children}</span>;
};