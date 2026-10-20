import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtWon, quoteNotice } from '@/lib/landedCost';

// 공개 계산기 결과 — 랜딩 디자인(요금표·문의 폼 카드·단계 그리드)과 같은 규칙으로 그린다.
const card = 'rounded-[12px] border border-[#e2e2e4] bg-white shadow-[0_8px_24px_#1717190b]';
const eyebrow = 'text-[11px] font-extrabold tracking-[.08em] text-landing-brand';

const PayerTag = ({ payer }) => (
  <span className={cn('inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold',
    payer === 'BUYER' ? 'bg-landing-tint text-landing-brand' : 'bg-landing-page text-landing-muted')}>
    {payer === 'BUYER' ? '따로 냄' : '견적에 포함'}
  </span>
);

function Summary({ t, units }) {
  return (
    <div className={cn(card, 'p-6')}>
      <div className={eyebrow}>RESULT</div>
      <p className="mt-2 text-[14px] text-landing-body">공장 견적 외에 따로 낼 돈 <span className="text-landing-muted">(예상, 부가세 제외)</span></p>
      <p className="mt-1 text-[40px] font-extrabold leading-[1.15] tracking-[-1.2px] text-landing-brand">{fmtWon(t.buyerExtraExVat)}</p>
      <p className="mt-2 text-[13px] text-landing-muted">범위 {fmtWon(t.buyerExtraExVatRange.low)} ~ {fmtWon(t.buyerExtraExVatRange.high)}</p>
      {t.buyerVat > 0 && <p className="mt-1 text-[13px] text-landing-muted">+ 수입 부가세 {fmtWon(t.buyerVat)} · 통관 때 납부하고 사업자는 매입세액으로 돌려받습니다</p>}
      <dl className="mt-5 grid grid-cols-1 border-t border-[#dedee1] sm:grid-cols-3">
        {[
          ['개당 따로 낼 돈', t.perUnitBuyerExtra ? fmtWon(t.perUnitBuyerExtra) : '-'],
          ['도착 원가', fmtWon(t.landedExVat)],
          ['개당 도착 원가', units > 0 ? fmtWon(Math.round(t.landedExVat / units)) : '-'],
        ].map(([k, v], i) => (
          <div key={k} className={cn('flex min-w-0 items-baseline justify-between gap-3 border-b border-[#efeff0] py-2.5 sm:block sm:border-b-0 sm:py-0 sm:pt-4', i > 0 && 'sm:border-l sm:border-[#e6e6e8] sm:pl-4')}>
            <dt className="text-[12.5px] text-landing-muted">{k}</dt>
            <dd className="mt-0.5 truncate text-[17px] font-extrabold tracking-[-.4px] text-landing-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[12px] text-landing-muted2">도착 원가는 공장 견적 + 따로 낼 돈 (부가세 제외)</p>
    </div>
  );
}

// 단계 그리드(lm-steps)와 같은 6칸: 중국 → 한국 순서로 누가 내는지
function Segments({ segments }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-[#e2e2e4] bg-landing-line sm:grid-cols-3">
      {segments.map((s) => (
        <div key={s.key} className={cn('min-w-0 px-3 py-3.5', s.payer === 'BUYER' ? 'bg-landing-tint-soft' : 'bg-white')}>
          <div className="text-[11px] font-extrabold text-landing-brand">{s.key}</div>
          <div className="mt-0.5 truncate text-[13px] font-bold text-landing-ink2">{s.short}</div>
          <div className={cn('mt-1 truncate text-[14px] font-extrabold', s.payer === 'BUYER' ? 'text-landing-brand' : 'text-landing-ink')}>{s.amount > 0 ? fmtWon(s.amount) : '-'}</div>
          <div className="mt-1.5"><PayerTag payer={s.payer} /></div>
        </div>
      ))}
    </div>
  );
}

function Lines({ result }) {
  return (
    <div className="overflow-hidden rounded-[13px] border border-landing-line bg-white">
      {result.bySegment.filter((s) => s.lines.length).map((s) => (
        <details key={s.key} open={s.payer === 'BUYER'} className="group border-b border-landing-line last:border-0">
          <summary className="flex cursor-pointer list-none items-center gap-2 bg-landing-page px-4 py-3">
            <span className="text-[14px] font-bold text-landing-ink">{s.key}. {s.label}</span>
            <PayerTag payer={s.payer} />
            <span className="ml-auto text-[14px] font-extrabold text-landing-ink">{fmtWon(s.amount)}</span>
            <span className="text-[12px] text-landing-muted2 group-open:rotate-180">▾</span>
          </summary>
          <ul className="divide-y divide-landing-line">
            {s.lines.map((l, i) => (
              <li key={`${l.code}-${i}`} className="flex gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-landing-ink2">
                    {l.label}
                    <span className={cn('ml-1.5 text-[11.5px] font-bold', l.verified ? 'text-landing-brand' : 'text-landing-muted2')}>{l.verified ? '청구서 기준' : '추정'}</span>
                  </p>
                  <p className="mt-0.5 text-[12.5px] leading-[1.6] text-landing-muted">{l.basis}{l.note ? ` · ${l.note}` : ''}</p>
                </div>
                <span className="shrink-0 text-[14px] font-bold text-landing-ink">{fmtWon(l.amount)}</span>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

function Compare({ rows, current }) {
  const pool = rows.filter((r) => !r.blocked);
  const best = pool.length ? Math.min(...pool.map((r) => r.allCosts)) : null;
  return (
    <div className="overflow-x-auto rounded-[13px] border border-landing-line bg-white">
      <table className="w-full min-w-[460px] border-collapse text-[14px]">
        <thead>
          <tr className="bg-landing-page text-left">
            {['운송 방식', '물류비+세금', '개당', '소요', '확인'].map((h, i) => (
              <th key={h} className={cn('whitespace-nowrap border-b border-landing-line px-3 py-3 font-bold text-landing-ink2', i > 0 && i !== 3 && 'text-right')}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.mode} className={cn('border-b border-landing-line last:border-0', r.mode === current && 'bg-landing-tint-soft')}>
              <td className="whitespace-nowrap px-3 py-3 font-semibold text-landing-ink2">
                {r.label}
                {r.allCosts === best && <span className="ml-1.5 rounded-full bg-landing-brand px-2 py-0.5 text-[11px] font-extrabold text-white">{r.verifiedShare < 0.5 ? '최저 (추정)' : '최저'}</span>}
                {r.blocked && <span className="ml-1.5 text-[12px] font-bold text-landing-muted">배터리 제한</span>}
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-right font-extrabold text-landing-ink">{fmtWon(r.allCosts)}</td>
              <td className="whitespace-nowrap px-3 py-3 text-right text-landing-ink">{r.perUnitAll ? fmtWon(r.perUnitAll) : '-'}</td>
              <td className="whitespace-nowrap px-3 py-3 text-landing-muted">{r.transit}</td>
              <td className="whitespace-nowrap px-3 py-3 text-right text-landing-muted">{Math.round(r.verifiedShare * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Block = ({ title, note, children }) => (
  <section>
    <h3 className="text-[18px] font-extrabold tracking-[-.4px] text-landing-ink">{title}</h3>
    <div className="mt-3">{children}</div>
    {note && <p className="mt-2 text-[12.5px] leading-[1.7] text-landing-muted">{note}</p>}
  </section>
);

export default function LandingCostResult({ result, compare }) {
  const [copied, setCopied] = useState(false);
  if (result.needsCargo) {
    return (
      <div className={cn(card, 'flex min-h-[320px] flex-col items-center justify-center p-8 text-center')}>
        <div className={eyebrow}>RESULT</div>
        <p className="mt-3 text-[16px] font-bold text-landing-ink">화물 정보를 넣으면 결과가 나옵니다</p>
        <p className="mt-1 text-[14px] text-landing-muted">박스 치수와 박스 수, 또는 총 부피를 넣어 주세요.</p>
      </div>
    );
  }
  const t = result.totals;
  const copy = async () => {
    try { await navigator.clipboard.writeText(quoteNotice(result)); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* 복사 권한이 없으면 무시 */ }
  };

  return (
    <div className="space-y-8">
      <Summary t={t} units={result.input.units} />

      <Block title="구간별로 누가 내나요" note={`${result.basis.text} · 물류비 중 ${Math.round(t.verifiedShare * 100)}%가 실제 포워더 청구서 기준 요율입니다.`}>
        <Segments segments={result.bySegment} />
      </Block>

      {!!result.warnings.length && (
        <ul className="space-y-2 rounded-[10px] border border-landing-tint-border bg-landing-tint-soft px-4 py-3.5">
          {result.warnings.map((w) => (
            <li key={w} className="relative pl-4 text-[13.5px] leading-[1.7] text-landing-ink2">
              <span className="absolute left-0 top-[10px] h-[5px] w-[5px] rounded-full bg-landing-brand" aria-hidden="true" />{w}
            </li>
          ))}
        </ul>
      )}

      <Block title="항목별 내역">
        <Lines result={result} />
        {!!result.variables.length && (
          <div className="mt-3 rounded-[10px] border border-dashed border-landing-line3 px-4 py-3">
            <p className="text-[13px] font-bold text-landing-ink2">상황에 따라 더 생길 수 있는 비용 (합계에 미포함)</p>
            {result.variables.map((l) => (
              <p key={l.code} className="mt-1 flex justify-between gap-3 text-[13px] text-landing-muted"><span>{l.label} · {l.basis}</span><span>{fmtWon(l.amount)}</span></p>
            ))}
          </div>
        )}
      </Block>

      {compare && (
        <Block title="운송 방식별 비교" note="물류비와 세금을 누가 내든 상관없이 합쳐서 비교했습니다. ‘확인’은 실제 포워더 청구서 기준 요율의 비율입니다. 운송 방식이 바뀌면 공장 견적가도 바뀝니다. 비율이 낮은 방식은 실제 견적으로 확인해야 합니다.">
          <Compare rows={compare} current={result.input.mode} />
        </Block>
      )}

      <Block title="견적서·메시지에 붙여 넣을 안내 문구">
        <div className="rounded-[10px] border border-landing-line bg-landing-page p-4">
          <pre className="whitespace-pre-wrap font-landing text-[13px] leading-[1.75] text-landing-ink2">{quoteNotice(result)}</pre>
          <button type="button" onClick={copy} className="mt-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#dedee1] bg-white px-4 text-[13px] font-bold text-landing-ink hover:border-landing-brand hover:text-landing-brand">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? '복사했습니다' : '문구 복사'}
          </button>
        </div>
      </Block>
    </div>
  );
}
