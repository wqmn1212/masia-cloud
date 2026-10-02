import React from 'react';

export default function GuideMockFrame({ label, children }) {
  return (
    <div className="rounded-[12px] border border-landing-line bg-white overflow-hidden shadow-[0_8px_24px_#1717190b] select-none" aria-hidden="true">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-landing-line bg-landing-page">
        <span className="w-2.5 h-2.5 rounded-full bg-landing-line3" />
        <span className="w-2.5 h-2.5 rounded-full bg-landing-line3" />
        <span className="w-2.5 h-2.5 rounded-full bg-landing-line3" />
        <span className="ml-2 text-[11px] text-landing-muted">AEGIS Cloud</span>
        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded border border-landing-line text-landing-muted">{label}</span>
      </div>
      <div className="p-4 text-[12px] text-landing-ink">{children}</div>
    </div>
  );
}