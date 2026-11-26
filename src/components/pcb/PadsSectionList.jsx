import React from 'react';

export default function PadsSectionList({ sections, active, onSelect }) {
  return (
    <ul className="max-h-[52vh] overflow-auto rounded-xl border bg-card p-2 text-caption">
      {sections.map((section, i) => (
        <li key={`${section.name}-${i}`}>
          <button type="button" aria-pressed={active === i} onClick={() => onSelect(i)} className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left ${active === i ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}>
            <span className="truncate" title={section.header}>{section.label}</span>
            <span className="tabular-nums text-muted-foreground">{section.records.length}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}