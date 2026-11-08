import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from '@/components/ui/use-toast';
import Pill from '@/components/prototype/Pill';
import FindingRow from '@/components/prototype/review/FindingRow';
import { REVIEW_AREAS, REVIEW_VERDICT, fmtDate } from '@/lib/prototype';
import { actorName, errorText } from '@/lib/prototypeApi';

const READ_AS = { image: '이미지·PDF', text: '텍스트', table: '표 변환', unreadable: '읽지 못함' };

export default function ReviewResult({ review: r, user, onChanged }) {
  const [busy, setBusy] = useState(false);
  const findings = r.findings || [];

  const setStatus = async (id, status) => {
    setBusy(true);
    try {
      const next = findings.map((f) => (f.id === id ? { ...f, status, resolved_by_name: status === 'OPEN' ? '' : actorName(user) } : f));
      await base44.entities.ProtoDesignReview.update(r.id, { findings: next });
      onChanged();
    } catch (e) { toast({ title: errorText(e), variant: 'destructive' }); }
    setBusy(false);
  };

  const groups = Object.keys(REVIEW_AREAS).map((a) => [a, findings.filter((f) => f.area === a)]).filter(([, l]) => l.length);
  const open = findings.filter((f) => f.status === 'OPEN').length;

  return (
    <div className="rounded-xl border bg-card p-5 space-y-5 min-w-0">
      <div>
        <div className="flex flex-wrap items-center gap-2"><p className="text-title font-semibold">검토 결과</p><Pill meta={REVIEW_VERDICT[r.verdict]} /><span className="text-caption text-muted-foreground">지적 {findings.length} · 미해결 {open}</span></div>
        <p className="text-caption text-muted-foreground">{fmtDate(r.created_date)} · {r.reviewer_name}{r.version_no ? ` · v${r.version_no} 대조` : ''}{r.instruction ? ` · 요청: ${r.instruction}` : ''}</p>
        {r.summary && <p className="mt-2 text-body">{r.summary}</p>}
      </div>
      {groups.map(([area, list]) => (
        <section key={area} className="space-y-2">
          <h3 className="text-label font-semibold text-muted-foreground">{REVIEW_AREAS[area]} {list.length}</h3>
          <ul className="space-y-2">{list.map((f) => <FindingRow key={f.id} finding={f} busy={busy} onStatus={setStatus} />)}</ul>
        </section>
      ))}
      {r.bom_checks?.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-label font-semibold text-muted-foreground">부품표 확인 필요</h3>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-label">
              <thead className="bg-muted/60 text-caption text-muted-foreground"><tr>{['Ref', '부품번호', '문제', '제안'].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y">{r.bom_checks.map((b, i) => <tr key={i} className="align-top"><td className="px-3 py-2 font-mono text-caption">{b.ref || '-'}</td><td className="px-3 py-2 font-mono text-caption">{b.part_no || '-'}</td><td className="px-3 py-2">{b.issue}</td><td className="px-3 py-2 text-muted-foreground">{b.suggestion || '-'}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {r.questions?.length > 0 && <div className="rounded-lg bg-primary/5 p-3"><p className="text-label font-semibold">설계자 확인 질문</p><ul className="mt-1 list-disc pl-5 text-caption space-y-0.5">{r.questions.map((q, i) => <li key={i}>{q}</li>)}</ul></div>}
        {r.unverified?.length > 0 && <div className="rounded-lg bg-warning/10 p-3 text-warning-text"><p className="text-label font-semibold">확인하지 못한 항목</p><ul className="mt-1 list-disc pl-5 text-caption space-y-0.5">{r.unverified.map((q, i) => <li key={i}>{q}</li>)}</ul></div>}
      </div>
      {r.files?.length > 0 && <p className="text-micro text-muted-foreground">검토한 파일: {r.files.map((f) => `${f.name}(${READ_AS[f.read_as] || f.read_as})`).join(', ')}</p>}
    </div>
  );
}