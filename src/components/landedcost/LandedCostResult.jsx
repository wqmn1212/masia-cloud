import React, { useState } from 'react';
import { AlertTriangle, BadgeCheck, Check, Copy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fmtWon, quoteNotice } from '@/lib/landedCost';

const PAYER = {
  SELLER: { label: '공장 견적에 포함', cls: 'bg-muted text-muted-foreground', bar: 'bg-muted-foreground/30' },
  BUYER: { label: '별도로 냄', cls: 'bg-primary/15 text-primary', bar: 'bg-primary' },
};

// 구간 막대: 왼쪽(중국)에서 오른쪽(고객사)으로, 누가 내는지 색으로
function SegmentBar({ segments }) {
  const total = segments.reduce((s, x) => s + x.amount, 0) || 1;
  return (
    <div>
      <div className="flex h-9 w-full overflow-hidden rounded-lg border">
        {segments.map((s) => (
          <div key={s.key} title={`${s.label} ${fmtWon(s.amount)}`} style={{ width: `${Math.max(s.amount / total * 100, s.amount > 0 ? 6 : 0)}%` }}
            className={`flex items-center justify-center border-r text-[10px] font-bold last:border-r-0 ${PAYER[s.payer].bar} ${s.payer === 'BUYER' ? 'text-primary-foreground' : 'text-foreground/70'}`}>
            {s.amount > 0 && s.key}
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-6">
        {segments.map((s) => (
          <div key={s.key} className="min-w-0">
            <p className="truncate text-muted-foreground">{s.key}. {s.short}</p>
            <p className={`font-semibold tabular-nums ${s.payer === 'BUYER' ? 'text-primary' : ''}`}>{s.amount > 0 ? fmtWon(s.amount) : '-'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Lines({ result }) {
  return (
    <div className="divide-y rounded-xl border">
      {result.bySegment.filter((s) => s.lines.length).map((s) => (
        <details key={s.key} open={s.payer === 'BUYER'} className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3">
            <span className="text-sm font-semibold">{s.key}. {s.label}</span>
            <Badge className={`border-0 text-[10px] ${PAYER[s.payer].cls}`}>{PAYER[s.payer].label}</Badge>
            <span className="ml-auto text-sm font-bold tabular-nums">{fmtWon(s.amount)}</span>
          </summary>
          <ul className="space-y-2 px-4 pb-3">
            {s.lines.map((l, i) => (
              <li key={`${l.code}-${i}`} className="flex gap-3 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 font-medium">
                    {l.label}
                    {l.verified
                      ? <span className="inline-flex items-center gap-0.5 text-[10px] text-primary"><BadgeCheck className="h-3 w-3" />실제 청구 기준</span>
                      : <span className="text-[10px] text-muted-foreground">추정</span>}
                  </p>
                  <p className="text-muted-foreground">{l.basis}{l.note ? ` · ${l.note}` : ''}</p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">{fmtWon(l.amount)}</span>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

function Compare({ rows, current }) {
  const best = Math.min(...rows.filter((r) => !r.blocked).map((r) => r.allCosts));
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-xs [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr><th className="px-2 py-2 text-left font-semibold">운송 방식</th><th className="px-2 py-2 text-right font-semibold">물류비</th><th className="px-2 py-2 text-right font-semibold">물류비+세금</th><th className="px-2 py-2 text-right font-semibold">개당</th><th className="px-2 py-2 text-left font-semibold">소요</th><th className="px-2 py-2 text-right font-semibold">확인</th></tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.mode} className={r.mode === current ? 'bg-primary/5' : ''}>
              <td className="px-2 py-2 font-medium">{r.label}{r.allCosts === best && !r.blocked && <Badge className="ml-1.5 border-0 bg-primary/15 text-[10px] text-primary">{r.verifiedShare < 0.5 ? '최저 (추정)' : '최저'}</Badge>}{r.blocked && <Badge className="ml-1.5 border-0 bg-destructive/15 text-[10px] text-destructive">배터리 제한</Badge>}</td>
              <td className="px-2 py-2 text-right tabular-nums">{fmtWon(r.logisticsAll)}</td>
              <td className="px-2 py-2 text-right font-semibold tabular-nums">{fmtWon(r.allCosts)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{r.perUnitAll ? fmtWon(r.perUnitAll) : '-'}</td>
              <td className="px-2 py-2 text-muted-foreground">{r.transit}</td>
              <td className={`px-2 py-2 text-right tabular-nums ${r.verifiedShare < 0.5 ? 'text-muted-foreground' : 'text-primary'}`}>{Math.round(r.verifiedShare * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-2 py-2 text-[11px] text-muted-foreground">누가 내든 상관없이 전체 비용으로 비교했습니다. 운송 방식이 바뀌면 공장 견적가도 바뀝니다. ‘확인’은 물류비 중 실제 청구서로 확인한 요율의 비율이고, 낮은 방식은 추정 요율 위주라 실제 견적으로 확인해야 합니다.</p>
    </div>
  );
}

export default function LandedCostResult({ result, compare, showNotice = true }) {
  const [copied, setCopied] = useState(false);
  const t = result.totals;
  if (result.needsCargo) {
    return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">화물의 부피(박스 치수·박스 수 또는 총 CBM)나 무게를 넣으면 계산 결과가 나옵니다.</div>;
  }
  const copy = async () => {
    await navigator.clipboard.writeText(quoteNotice(result));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-primary/5 p-4 sm:col-span-2">
          <p className="text-xs text-muted-foreground">공장 견적 외에 별도로 낼 돈 (예상, 부가세 제외)</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-primary">{fmtWon(t.buyerExtraExVat)}</p>
          <p className="mt-1 text-xs text-muted-foreground">범위 {fmtWon(t.buyerExtraExVatRange.low)} ~ {fmtWon(t.buyerExtraExVatRange.high)}{t.perUnitBuyerExtra ? ` · 개당 ${fmtWon(t.perUnitBuyerExtra)}` : ''}</p>
          {t.buyerVat > 0 && <p className="mt-1 text-xs text-muted-foreground">+ 수입 부가세 {fmtWon(t.buyerVat)} (통관 때 납부, 사업자는 매입세액 공제로 돌려받음)</p>}
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">고객사 도착 원가 (물품 + 별도 비용)</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{fmtWon(t.landed)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t.perUnitLanded ? `개당 ${fmtWon(t.perUnitLanded)} · ` : ''}부가세 공제 후 {fmtWon(t.landedExVat)}</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {result.basis.text} · 과세가격 {fmtWon(result.customsValue)} · 물류비 중 <b className="text-foreground">{Math.round(t.verifiedShare * 100)}%</b>가 실제 청구서 기준 요율입니다.
      </p>

      <SegmentBar segments={result.bySegment} />

      {!!result.warnings.length && (
        <ul className="space-y-1.5 rounded-xl border border-chart-3/40 bg-chart-3/5 p-3">
          {result.warnings.map((w) => <li key={w} className="flex gap-2 text-xs"><AlertTriangle className="h-4 w-4 shrink-0 text-chart-3" />{w}</li>)}
        </ul>
      )}

      <Lines result={result} />

      {!!result.variables.length && (
        <div className="rounded-xl border border-dashed p-3">
          <p className="text-xs font-semibold">상황에 따라 더 생길 수 있는 비용 (합계에 미포함)</p>
          <ul className="mt-1.5 space-y-1">
            {result.variables.map((l) => <li key={l.code} className="flex justify-between gap-3 text-xs"><span className="text-muted-foreground">{l.label} · {l.basis}</span><span className="tabular-nums">{fmtWon(l.amount)}</span></li>)}
          </ul>
        </div>
      )}

      {compare && <Compare rows={compare} current={result.input.mode} />}

      {showNotice && (
        <div className="rounded-xl border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold">견적서·메시지에 붙여 넣을 안내 문구</p>
            <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={copy}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? '복사됨' : '복사'}</Button>
          </div>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-muted-foreground">{quoteNotice(result)}</pre>
        </div>
      )}
    </div>
  );
}
