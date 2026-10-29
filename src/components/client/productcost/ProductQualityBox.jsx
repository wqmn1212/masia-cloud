import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { qualitySummary } from '@/lib/claimTracking';
import { CLAIM_RESOLUTION, CLAIM_STATUS } from '@/lib/claims';

const QC = { PASS: '합격', CONDITIONAL_PASS: '조건부 합격', FAIL: '불합격' };
const QC_CLS = { PASS: 'text-primary', CONDITIONAL_PASS: 'text-warning-text', FAIL: 'text-destructive' };
const fmtDate = (d) => (d ? d.slice(0, 10).replaceAll('-', '.') : '');
const pct = (v) => `${(v * 100).toFixed(v < 0.01 ? 2 : 1)}%`;

// 상품 원가 카드의 품질 이력: 주문별 검수 결과, 불량 신고와 불량률, 보상 약속 반영 여부.
// orders: groupByProduct 의 orders (각 기록에 quality: { qc, claims })
export function useQuality(orders) {
  const rows = orders.map((o) => ({ card_id: o.card_id, order_date: o.order_date, qc: o.quality?.qc || null, claims: o.quality?.claims || [] }));
  return { rows, sum: qualitySummary(rows) };
}

export function QualityLine({ sum }) {
  if (!sum.inspected && !sum.claims) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption text-muted-foreground">
      <ShieldCheck className="h-3.5 w-3.5 text-primary" />
      <span>검수 {sum.inspected}회{sum.failed ? ` · 불합격 ${sum.failed}` : ''}</span>
      <span>· 불량 신고 {sum.claims}건{sum.defect_rate != null ? ` (불량률 ${pct(sum.defect_rate)})` : ''}</span>
      {sum.open_claims > 0 && <Badge variant="outline" className="text-micro">처리 중 {sum.open_claims}</Badge>}
      {sum.promised > 0 && <Badge variant="outline" className="text-micro text-warning-text">보상 미반영 {sum.promised}</Badge>}
    </div>
  );
}

export default function ProductQualityBox({ rows }) {
  if (!rows.some((r) => r.qc || r.claims.length)) return <p className="text-caption text-muted-foreground">아직 공개된 검수 결과와 불량 신고가 없습니다.</p>;
  return (
    <ul className="space-y-1.5">
      {[...rows].reverse().map((r) => (
        <li key={r.card_id} className="rounded-md border px-2 py-1.5 text-label">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="tabular-nums text-muted-foreground">{fmtDate(r.order_date)} 주문</span>
            {r.qc ? <span className={QC_CLS[r.qc.qc_result]}>{r.qc.inspection_type === 'SAMPLE' ? '샘플' : '출고 전'} 검수 {QC[r.qc.qc_result] || ''}</span> : <span className="text-muted-foreground">공개된 검수 없음</span>}
          </div>
          {r.claims.map((c) => (
            <p key={c.id} className="mt-0.5 text-caption">
              불량 신고 · {c.title} · {CLAIM_STATUS[c.status]}{c.resolution ? ` · ${CLAIM_RESOLUTION[c.resolution]}` : ''}
              {c.defect_qty != null && c.received_qty ? ` · ${c.defect_qty}/${c.received_qty}개` : ''}
              {c.factory_wait_days != null && <span className="text-warning-text"> · 공장 회신 대기 {c.factory_wait_days}일</span>}
              {c.compensation && <span className={c.compensation.state === 'APPLIED' ? 'text-primary' : 'text-warning-text'}> · 보상 {c.compensation.state === 'APPLIED' ? `반영됨 (${c.compensation.applied_card_title || '다음 주문'})` : '미반영'}</span>}
            </p>
          ))}
        </li>
      ))}
    </ul>
  );
}
