import React from 'react';
import { cn } from '@/lib/utils';

export default function GuideOutline({ content, active }) {
  const current = Math.max(0, content.steps.findIndex(step => step.id === active));
  return (
    <nav aria-label={content.overview} className="sticky top-16 z-20 rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2 text-xs">
        <span className="font-semibold">{content.overview}</span>
        <span className="text-muted-foreground">{content.current} <strong className="ml-1 tabular-nums text-primary">{String(current + 1).padStart(2, '0')} / 05</strong></span>
      </div>
      <ol className="flex gap-2 overflow-x-auto p-2">
        {content.steps.map((step, index) => <li key={step.id} className="flex-1 shrink-0 min-w-[104px]">
          <a href={`#guide-${step.id}`} aria-current={active === step.id ? 'step' : undefined} className={cn('flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', active === step.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
            <span className="tabular-nums opacity-75">{String(index + 1).padStart(2, '0')}</span><span className="whitespace-nowrap">{step.short}</span>
          </a>
        </li>)}
      </ol>
    </nav>
  );
}