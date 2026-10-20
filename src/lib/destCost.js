// 선적 건별 '한국에서 따로 낼 돈' 사전 확인. 계산기 엔진 결과를 고정본(snapshot)으로 저장해 고객이 확인한 금액이 그대로 남게 한다.
// 상태 규칙은 base44/shared/destCost.ts 와 같다 (둘을 함께 고칠 것).
// 검산 스크립트(node)에서도 읽도록 상대 경로로 가져온다.
import { MODES, SEGMENTS, TERMS, quoteNotice } from './landedCost.js';

// 선적(Shipment) 운송 방식 → 계산 엔진 방식
export const ENGINE_MODE = { SEA_LCL: 'SEA_LCL', SEA_FCL: 'SEA_FCL20', AIR: 'AIR', EXPRESS: 'EXPRESS' };

export const DEST_COST_STATE = {
  NONE: '미작성',
  DRAFT: '보내기 전',
  SENT: '고객 확인 대기',
  ACKNOWLEDGED: '고객 확인 완료',
  QUESTION: '고객 문의',
};

export function destCostState(s) {
  if (!s?.dest_cost_estimate) return 'NONE';
  if (!s.dest_cost_sent_at) return 'DRAFT';
  return s.dest_cost_decision || 'SENT';
}

// 저장·고객 화면용 고정본. 구매자(고객) 부담 항목만 담고, 요율 근거(source)는 넣지 않는다.
export function destCostSnapshot(result, { computedBy = '' } = {}) {
  const t = result.totals;
  const term = TERMS.find((x) => x.value === result.input.term);
  const mode = MODES.find((x) => x.value === result.input.mode);
  return {
    term: result.input.term,
    term_label: term?.label || result.input.term,
    mode: result.input.mode,
    mode_label: mode?.label || result.input.mode,
    basis_text: result.basis.text,
    usd_krw: result.input.usdKrw,
    units: result.input.units || 0,
    buyer_ex_vat: t.buyerExtraExVat,
    range_low: t.buyerExtraExVatRange.low,
    range_high: t.buyerExtraExVatRange.high,
    buyer_vat: t.buyerVat,
    per_unit_buyer_extra: t.perUnitBuyerExtra || 0,
    per_unit_landed: t.perUnitLanded || 0,
    included: result.bySegment.filter((s) => s.payer === 'SELLER' && s.amount > 0).map((s) => s.short),
    // 구간 합계도 부가세를 뺀 금액으로 (구간 합 = buyer_ex_vat)
    segments: result.bySegment.filter((s) => s.payer === 'BUYER')
      .map((s) => ({ key: s.key, label: s.label, short: s.short, amount: s.lines.filter((l) => l.code !== 'VAT').reduce((sum, l) => sum + l.amount, 0) }))
      .filter((s) => s.amount > 0),
    lines: result.lines.filter((l) => l.payer === 'BUYER' && l.code !== 'VAT').map((l) => ({ segment: l.segment, label: l.label, amount: l.amount, verified: !!l.verified })),
    variables: result.variables.filter((v) => v.payer === 'BUYER').map((v) => v.label),
    notice: quoteNotice(result),
    computed_at: new Date().toISOString(),
    computed_by_name: computedBy,
  };
}

// 실제 청구와 예상의 차이 (부가세 제외 금액끼리 비교)
export function destCostDiff(estimate, actual) {
  if (!estimate || actual == null || actual === '' || !Number.isFinite(Number(actual))) return null;
  const diff = Number(actual) - estimate.buyer_ex_vat;
  const pct = estimate.buyer_ex_vat > 0 ? diff / estimate.buyer_ex_vat : null;
  const inRange = Number(actual) >= estimate.range_low && Number(actual) <= estimate.range_high;
  return { diff, pct, inRange };
}

export const SEGMENT_LABEL = Object.fromEntries(SEGMENTS.map((s) => [s.key, s.short]));
