import React from 'react';
import { REPORT_METRICS, monthLabel } from '@/lib/agreements';

// 월간 업무 리포트 읽기 화면 — 고객 포털과 직원 미리보기가 같은 화면을 쓴다.
export default function MonthlyReportView({ report, companyName }) {
  const m = report.metrics || {};
  const qcLine = m.qc_reports ? `합격 ${m.qc_pass || 0} · 조건부 ${m.qc_conditional || 0} · 불합격 ${m.qc_fail || 0}` : '';
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-muted-foreground">{companyName ? `${companyName} · ` : ''}AEGIS 월간 업무 리포트</p>
        <h2 className="text-lg font-bold">{monthLabel(report.month)}</h2>
      </div>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {REPORT_METRICS.map(([key, label, unit]) => (
          <div key={key} className="rounded-lg border p-3">
            <dt className="text-[11px] text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 text-xl font-bold tabular-nums">{m[key] ?? 0}<span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span></dd>
            {key === 'qc_reports' && qcLine && <p className="mt-0.5 text-[11px] text-muted-foreground">{qcLine}</p>}
          </div>
        ))}
      </dl>
      {report.highlights && (
        <section>
          <h3 className="mb-1 text-sm font-semibold">이번 달 주요 내용</h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{report.highlights}</p>
        </section>
      )}
      {!!report.cards?.length && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">프로젝트별 진행</h3>
          <ul className="divide-y rounded-lg border">
            {report.cards.map((c) => (
              <li key={c.card_id} className="space-y-0.5 px-3 py-2.5 text-sm">
                <div className="flex items-center gap-2"><span className="font-medium">{c.title}</span><span className="ml-auto shrink-0 text-xs text-muted-foreground">{c.status}</span></div>
                {!!c.done_steps?.length && <p className="text-xs">완료: {c.done_steps.join(', ')}</p>}
                {c.next_step && <p className="text-xs text-muted-foreground">다음: {c.next_step}{c.next_date ? ` (${c.next_date})` : ''}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {report.next_plan && (
        <section>
          <h3 className="mb-1 text-sm font-semibold">다음 달 계획</h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{report.next_plan}</p>
        </section>
      )}
    </div>
  );
}
