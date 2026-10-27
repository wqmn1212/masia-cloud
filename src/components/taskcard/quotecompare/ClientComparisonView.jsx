import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, MessageCircleQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { money, unitMoney } from './format';

// 고객에게 보이는 비교표. 공개 스냅샷(clientView 결과)만 받아 그린다 — 원가·마진·공장명은 스냅샷에 없다.
// 직원 화면의 '고객이 보는 화면' 미리보기와 고객 포털이 같은 컴포넌트를 쓴다.
const STATE_TEXT = { INCLUDED: '본체에 포함', NOT_INCLUDED: '포함 안 됨', UNKNOWN: '확인 중' };
const COND_LABEL = { warranty: '보증', power: '전원', packing: '포장', valid: '견적 유효기간', moq: 'MOQ' };

function Best({ show, children }) {
  if (!show) return null;
  return <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-micro font-semibold text-primary">{children}</span>;
}

function landedCell(o, cur) {
  if (o.landed_total != null) return money(o.landed_total, cur);
  return <span className="text-label text-muted-foreground">물류비 확인 중</span>;
}

export default function ClientComparisonView({ snapshot, choice, onChoose, onAsk, busy = false }) {
  const [open, setOpen] = useState(false);
  if (!snapshot?.options?.length) return null;
  const cur = snapshot.base_currency;
  const opts = snapshot.options;
  const best = snapshot.best || {};
  const chosenKey = choice?.option_key || null;
  const condKeys = Object.keys(COND_LABEL).filter((k) => opts.some((o) => o.conditions?.[k]));
  const extra = snapshot.extra_conditions || [];
  const anyLanded = opts.some((o) => o.landed_total != null);
  const allSingle = opts.every((o) => Number(o.units) === 1); // 1대·1세트면 개당 줄은 합계와 같아 숨긴다
  const fxText = [snapshot.fx?.usd_krw ? `1 USD = ${Number(snapshot.fx.usd_krw).toLocaleString('ko-KR')}원` : '', snapshot.fx?.usd_cny ? `1 USD = ${snapshot.fx.usd_cny}위안` : ''].filter(Boolean).join(' · ');

  const summaryRows = [
    anyLanded && { key: 'landed', label: '한국 도착 원가 (부가세 제외)', render: (o) => <>{landedCell(o, cur)}<Best show={best.landed_per_unit === o.key}>가장 낮음</Best></> },
    anyLanded && !allSingle && { key: 'landedUnit', label: '도착 원가 · 개당', render: (o) => (o.landed_per_unit != null ? unitMoney(o.landed_per_unit, cur) : '—') },
    { key: 'quote', label: '견적 금액 (견적서 기준)', render: (o) => <>{money(o.quote_total, o.quote_currency)}{!anyLanded && <Best show={best.per_unit === o.key}>개당 가장 낮음</Best>}</> },
    allSingle
      ? { key: 'unit', label: `견적 금액 (${cur} 환산)`, render: (o) => money(o.total, cur) }
      : { key: 'unit', label: `견적 · 개당${snapshot.qty_diff ? ' (수량이 달라 개당으로 비교)' : ''}`, render: (o) => <>{unitMoney(o.per_unit, cur)} <span className="text-caption text-muted-foreground">× {Number(o.units).toLocaleString()}</span></> },
    { key: 'lead', label: '납기 (발주 후 출하)', render: (o) => <>{o.lead || <span className="text-muted-foreground">확인 중</span>}<Best show={best.lead === o.key}>가장 빠름</Best></> },
    { key: 'pay', label: '결제 (선금 / 잔금 %)', render: (o) => o.payment || '—' },
    { key: 'deposit', label: '발주할 때 필요한 금액', render: (o) => money(o.deposit, cur) },
  ].filter(Boolean);

  const detailRows = [
    ...snapshot.rows.map((r) => ({
      key: r.key, label: <>{r.label}{r.kind === 'OPTIONAL' && <span className="ml-1 text-micro text-muted-foreground">(선택)</span>}{r.kind === 'ONE_TIME' && <span className="ml-1 text-micro text-muted-foreground">(일회성)</span>}{r.spec_diff && <Badge variant="outline" className="ml-1 h-4 px-1 text-micro">사양 다름</Badge>}</>,
      render: (o) => {
        const c = r.cells[o.key];
        if (!c) return '—';
        if (c.alternatives) return <div className="space-y-0.5">{c.alternatives.map((a, i) => <p key={i} className="text-label">{a.name}: {money(a.amount, cur)}</p>)}</div>;
        if (c.state !== 'PRICED') return <span className={c.state === 'UNKNOWN' ? 'text-warning-text' : 'text-muted-foreground'}>{STATE_TEXT[c.state]}</span>;
        return <div><p>{money(c.amount, cur)}</p>{c.spec && <p className="text-caption leading-snug text-muted-foreground">{c.spec}</p>}</div>;
      },
    })),
    ...condKeys.map((k) => ({ key: `c-${k}`, label: COND_LABEL[k], render: (o) => <span className={k === 'power' && o.power_warn ? 'text-warning-text' : ''}>{o.conditions?.[k] || '—'}{k === 'power' && o.power_warn ? ' (한국 60Hz 확인 필요)' : ''}</span> })),
    ...extra.map((c) => ({ key: `x-${c.key}`, label: c.label, render: (o) => o.extra?.[c.key] || '—' })),
    { key: 'terms', label: '거래 조건', render: (o) => o.incoterms || '—' },
  ];

  const actions = (o) => (onChoose || onAsk) && (
    <div className="flex flex-wrap gap-1.5">
      {onChoose && (chosenKey === o.key
        ? <span className="inline-flex items-center gap-1 text-label font-semibold text-primary"><CheckCircle2 className="h-3.5 w-3.5" />진행 요청함</span>
        : <Button size="sm" className="h-7 text-label" disabled={busy} onClick={() => onChoose(o)}>이 안으로 진행</Button>)}
      {onAsk && <Button size="sm" variant="outline" className="h-7 gap-1 text-label" onClick={() => onAsk(o)}><MessageCircleQuestion className="h-3 w-3" />질문</Button>}
    </div>
  );

  const head = (o) => (
    <div className="space-y-0.5">
      <p className="text-body font-semibold">{o.label}{chosenKey === o.key && <CheckCircle2 className="ml-1 inline h-3.5 w-3.5 text-primary" />}</p>
      {o.factory_name && <p className="text-caption text-muted-foreground">{o.factory_name}</p>}
      {o.scope_diff && <p className="text-caption text-warning-text">일부 품목이 빠져 있어 단순 비교가 어렵습니다</p>}
    </div>
  );

  return (
    <div className="space-y-3">
      {snapshot.recommendation && <div className="rounded-lg border-l-4 border-primary bg-primary/5 px-3 py-2 text-body"><span className="mr-1 font-semibold text-primary">담당자 의견</span>{snapshot.recommendation}</div>}

      {/* 넓은 화면: 표 */}
      <div className="hidden overflow-x-auto rounded-lg border sm:block">
        <table className="w-full min-w-[560px] text-body">
          <thead className="bg-muted/50">
            <tr>
              <th className="sticky left-0 z-10 w-44 bg-muted/50 p-3 text-left text-label font-medium text-muted-foreground">항목</th>
              {opts.map((o) => <th key={o.key} className={`p-3 text-left align-top ${chosenKey === o.key ? 'bg-primary/5' : ''}`}>{head(o)}</th>)}
            </tr>
          </thead>
          <tbody>
            {[...summaryRows, ...(open ? detailRows : [])].map((r) => (
              <tr key={r.key} className="border-t">
                <th className="sticky left-0 z-10 bg-background p-3 text-left text-label font-medium text-muted-foreground">{r.label}</th>
                {opts.map((o) => <td key={o.key} className={`p-3 align-top ${chosenKey === o.key ? 'bg-primary/5' : ''}`}>{r.render(o)}</td>)}
              </tr>
            ))}
            {(onChoose || onAsk) && (
              <tr className="border-t"><th className="sticky left-0 bg-background p-3" />{opts.map((o) => <td key={o.key} className="p-3">{actions(o)}</td>)}</tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 휴대폰: 안별 카드 */}
      <div className="space-y-2 sm:hidden">
        {opts.map((o) => (
          <div key={o.key} className={`space-y-2 rounded-lg border p-3 ${chosenKey === o.key ? 'border-primary bg-primary/5' : ''}`}>
            {head(o)}
            <dl className="space-y-1 text-body">
              {summaryRows.map((r) => <div key={r.key} className="flex justify-between gap-3"><dt className="text-label text-muted-foreground">{r.label}</dt><dd className="text-right">{r.render(o)}</dd></div>)}
              {open && detailRows.map((r) => <div key={r.key} className="flex justify-between gap-3 border-t pt-1"><dt className="text-label text-muted-foreground">{r.label}</dt><dd className="text-right">{r.render(o)}</dd></div>)}
            </dl>
            {actions(o)}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-label" onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}{open ? '간단히 보기' : '품목·조건 자세히 보기'}
        </Button>
        <p className="text-caption text-muted-foreground">
          기준 통화 {cur}{fxText ? ` · 환율 ${fxText}` : ''}{snapshot.fx?.date ? ` (${snapshot.fx.date})` : ''} · 환산 금액은 참고용이며 계약은 견적서 통화 기준입니다
        </p>
      </div>
      {onChoose && <p className="text-caption text-muted-foreground">"이 안으로 진행"은 계약이 아니라 진행 요청입니다. 담당자가 확정하면 계약서를 보내 드립니다.</p>}
    </div>
  );
}
