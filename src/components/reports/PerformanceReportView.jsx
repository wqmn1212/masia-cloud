import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { perfSections, wonText } from '@/lib/performanceReport';

// 고객 성과 리포트 읽기 화면 — 고객 포털과 직원 미리보기가 같은 화면을 쓴다.
// onToggle 을 넘기면(직원 편집) 숫자마다 '고객에게 보이기/빼기' 단추가 붙고, 뺀 숫자도 흐리게 보인다.
export default function PerformanceReportView({ report, companyName, hidden = [], onToggle }) {
  const editing = typeof onToggle === 'function';
  const sections = perfSections(report.metrics || {}, hidden, { includeHidden: editing });
  const off = new Set(hidden);
  const trends = report.trends || [], products = report.products || [];
  const showTrends = trends.length > 0 && (editing || !off.has('section_trends'));
  const showProducts = products.length > 0 && (editing || !off.has('section_products'));
  const ToggleBtn = ({ k, label }) => editing ? (
    <button type="button" onClick={() => onToggle(k)} aria-label={`${label} ${off.has(k) ? '고객에게 보이기' : '고객 화면에서 빼기'}`} title={off.has(k) ? '고객에게 보이기' : '고객 화면에서 빼기'}
      className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
      {off.has(k) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
    </button>
  ) : null;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-caption text-muted-foreground">{companyName ? `${companyName} · ` : ''}AEGIS 성과 리포트</p>
        <h2 className="text-title font-bold">{report.period_label}</h2>
        <p className="text-caption text-muted-foreground">{report.period_start} ~ {report.period_end}</p>
      </div>

      {report.highlights && (
        <section className="rounded-lg bg-primary/5 p-3">
          <h3 className="mb-1 text-body font-semibold">주요 성과</h3>
          <p className="whitespace-pre-wrap text-body leading-relaxed">{report.highlights}</p>
        </section>
      )}

      {sections.map((s) => (
        <section key={s.key}>
          <h3 className="mb-2 text-body font-semibold">{s.title}</h3>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {s.items.map((it) => (
              <div key={it.key} className={`rounded-lg border p-3 ${it.hidden ? 'border-dashed opacity-50' : ''}`}>
                <dt className="flex items-start gap-1 text-micro text-muted-foreground"><span className="flex-1">{it.label}</span><ToggleBtn k={it.key} label={it.label} /></dt>
                <dd className="mt-0.5 text-xl font-bold tabular-nums">{it.value}</dd>
                {it.note && <p className="mt-0.5 text-micro text-muted-foreground">{it.note}</p>}
              </div>
            ))}
          </dl>
        </section>
      ))}
      {!sections.length && <p className="text-body text-muted-foreground">이 기간에 집계할 숫자가 없습니다.</p>}

      {showTrends && (
        <section className={off.has('section_trends') ? 'opacity-50' : ''}>
          <h3 className="mb-2 flex items-center gap-1 text-body font-semibold"><span className="flex-1">재주문 개당 원가 변화</span><ToggleBtn k="section_trends" label="재주문 개당 원가 변화" /></h3>
          <ul className="divide-y rounded-lg border">
            {trends.map((t, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2 text-body">
                <span className="font-medium">{t.product_name || '상품'}</span>
                <span className="text-caption text-muted-foreground">{t.first_date} {wonText(t.first_krw)} → {t.last_date} {wonText(t.last_krw)}</span>
                <span className={`ml-auto text-body font-semibold tabular-nums ${t.change_pct < 0 ? 'text-success-text' : t.change_pct > 0 ? 'text-warning-text' : ''}`}>{t.change_pct > 0 ? '+' : ''}{t.change_pct}%</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showProducts && (
        <section className={off.has('section_products') ? 'opacity-50' : ''}>
          <h3 className="mb-2 flex items-center gap-1 text-body font-semibold"><span className="flex-1">품목별 요약</span><ToggleBtn k="section_products" label="품목별 요약" /></h3>
          <ul className="divide-y rounded-lg border">
            {products.map((p, i) => (
              <li key={p.card_id || i} className="space-y-0.5 px-3 py-2.5 text-body">
                <div className="flex items-center gap-2"><span className="font-medium">{p.title}</span><span className="ml-auto shrink-0 text-caption text-muted-foreground">{p.status}</span></div>
                <p className="text-caption text-muted-foreground">
                  {[p.quotes_sent ? `견적 ${p.quotes_sent}건${p.first_quote_days != null ? ` (첫 견적 ${p.first_quote_days}일)` : ''}` : '', p.qc ? `검수 ${p.qc}` : '', p.arrived ? `도착 ${p.arrived}` : '', p.per_unit_krw ? `개당 도착 원가 ${wonText(p.per_unit_krw)}` : ''].filter(Boolean).join(' · ') || '진행 중'}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {report.next_plan && (
        <section>
          <h3 className="mb-1 text-body font-semibold">다음 기간 제안</h3>
          <p className="whitespace-pre-wrap text-body leading-relaxed">{report.next_plan}</p>
        </section>
      )}
    </div>
  );
}
