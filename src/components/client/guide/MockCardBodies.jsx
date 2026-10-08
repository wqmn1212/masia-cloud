import React from 'react';
import { M, t } from './guideI18n';

const Row = ({ k, v }) => (
  <div className="flex justify-between text-[11px] py-1 border-b border-border"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>
);
const FileBadge = ({ ext }) => <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{ext}</span>;

export function MockOverviewBody({ lang = 'ko' }) {
  return (
    <div className="space-y-2">
      <Row k={t(M.sched, lang)} v={t(M.schedV, lang)} /><Row k={t(M.stage, lang)} v={t(M.stageV, lang)} /><Row k={t(M.target, lang)} v="2026-11-14" />
      <div className="rounded-lg border border-border p-2 bg-card">
        <p className="text-[11px] font-medium">{t(M.req, lang)} <span className="text-[10px] text-muted-foreground font-normal">{t(M.reqOnly, lang)}</span></p>
        <p className="text-[11px] mt-1 p-2 rounded bg-muted/50">{t(M.reqV, lang)}</p>
        <div className="flex justify-end mt-2"><span className="text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground">{t(M.reqSave, lang)}</span></div>
      </div>
    </div>
  );
}

export function MockQuotationBody({ lang = 'ko' }) {
  const rows = [[M.q1, '2026.10.08 · USD · DBM-3000'], [M.q2, '2026.10.15 · USD']];
  return (
    <div className="space-y-2">
      {rows.map(([q, m], i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
          <FileBadge ext="PDF" />
          <div className="flex-1 min-w-0"><p className="text-[11px] font-medium truncate">{t(q, lang)}</p><p className="text-[10px] text-muted-foreground">{m}</p></div>
          <span className="text-[10px] px-2 py-0.5 rounded border border-border">↓ PDF</span>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground">{t(M.qNote, lang)}</p>
    </div>
  );
}

export function MockChatBody({ lang = 'ko' }) {
  return (
    <div className="space-y-2">
      <div className="max-w-[85%] rounded-lg bg-muted p-2 text-[11px]"><p className="text-[10px] text-muted-foreground">{t(M.agent, lang)}</p>{t(M.c1, lang)}</div>
      <div className="max-w-[85%] ml-auto rounded-lg bg-primary text-primary-foreground p-2 text-[11px]">{t(M.c2, lang)}</div>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 text-[11px] text-muted-foreground">📎 <span className="flex-1">{t(M.msgPh, lang)}</span>➤</div>
    </div>
  );
}

export function MockSettlementBody({ lang = 'ko' }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center rounded-lg border border-border bg-card p-2 text-[11px]"><b>{t(M.dep, lang)}</b><span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/15 text-accent">{t(M.approved, lang)}</span></div>
      <div className="flex justify-between items-center rounded-lg border border-border bg-card p-2 text-[11px]"><b>{t(M.bal, lang)}</b><span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t(M.waiting, lang)}</span></div>
      <p className="text-[10px] text-muted-foreground">{t(M.payNote, lang)}</p>
    </div>
  );
}

export function MockFilesBody({ lang = 'ko' }) {
  const files = [['PDF', M.f1], ['ZIP', M.f2], ['PDF', M.f3]];
  return (
    <div className="space-y-2">
      {files.map(([e, n], i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 text-[11px]">
          <FileBadge ext={e} /><span className="flex-1 truncate">{t(n, lang)}</span><span className="text-primary text-[10px]">{t(M.open, lang)}</span>
        </div>
      ))}
    </div>
  );
}