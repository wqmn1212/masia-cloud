import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CheckCircle2, Info, LockKeyhole, CornerDownRight } from 'lucide-react';
import { canAccessPath } from '@/lib/menuPermissions';

export default function GuideStep({ step, index, content, user }) {
  return (
    <section id={`guide-${step.id}`} aria-labelledby={`guide-title-${step.id}`} className="scroll-mt-44 rounded-2xl border bg-card text-card-foreground">
      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold tabular-nums text-primary">{String(index + 1).padStart(2, '0')}</span>
          <span className="rounded-full border bg-muted/40 px-3 py-1 text-xs font-semibold">{step.owner}</span>
        </div>
        <h2 id={`guide-title-${step.id}`} className="mt-4 text-xl sm:text-2xl font-bold tracking-tight leading-snug">{step.title}</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{step.summary}</p>
        <p className="mt-4 rounded-lg bg-muted/50 px-3 py-2 text-xs leading-6 font-medium">{step.location}</p>
        <h3 className="mt-6 text-sm font-semibold">{content.checklist}</h3>
        <ul className="mt-3 space-y-4">
          {step.checks.map(check => <li key={check} className="flex items-start gap-3 text-sm leading-7"><CheckCircle2 className="mt-1.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" /><span>{check}</span></li>)}
        </ul>
        <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-primary"><CornerDownRight className="h-4 w-4" />{content.handoff}</h3>
          <p className="mt-2 text-sm leading-7">{step.handoff}</p>
        </div>
        <aside className="mt-4 flex items-start gap-2 text-xs leading-6 text-muted-foreground"><Info className="mt-1 h-4 w-4 shrink-0" /><p><strong className="font-semibold text-foreground">{content.caution} · </strong>{step.caution}</p></aside>
      </div>
      <div className="border-t px-5 py-4 sm:px-7">
        <h3 className="mb-3 text-xs font-semibold text-muted-foreground">{content.screens}</h3>
        <div className="flex flex-wrap gap-2">{step.links.map(link => canAccessPath(user, link.path)
          ? <Link key={link.path} to={link.path} className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{link.label}<ArrowUpRight className="h-4 w-4 shrink-0" /></Link>
          : <span key={link.path} className="inline-flex min-h-11 flex-wrap items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5" />{link.label}<span>· {content.restricted}</span></span>
        )}</div>
      </div>
    </section>
  );
}