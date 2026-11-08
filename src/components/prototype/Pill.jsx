import React from 'react';

// 상태 표시 작은 배지. meta = { label, className }
export default function Pill({ meta, children }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-micro font-medium whitespace-nowrap ${meta?.className || 'bg-muted text-muted-foreground'}`}>{children || meta?.label}</span>;
}