import React from 'react';
import { BookOpen, Users, ClipboardList, Handshake, ArrowRight } from 'lucide-react';

const icons = [Users, ClipboardList, Handshake];
export default function GuideIntro({ content }) {
  return (
    <header className="overflow-hidden rounded-2xl border bg-card text-card-foreground">
      <div className="p-5 sm:p-8">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-primary"><BookOpen className="h-4 w-4" />{content.eyebrow}</p>
        <h1 className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight">{content.title}</h1>
        <p className="mt-3 text-base sm:text-lg font-medium leading-relaxed">{content.subtitle}</p>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">{content.description}</p>
        <div className="mt-6 grid gap-3 xl:grid-cols-3">
          {content.roles.map((role, index) => { const Icon = icons[index]; return (
            <div key={role.title} className="flex items-center gap-3 rounded-xl border bg-background p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">{role.title}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{role.detail}</p></div>
              {index < 2 && <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
            </div>
          ); })}
        </div>
      </div>
      <div className="border-t bg-muted/30 px-5 py-4 sm:px-8 text-xs leading-6 text-muted-foreground"><p>{content.roleNote}</p><p className="mt-1">{content.permissions}</p></div>
    </header>
  );
}