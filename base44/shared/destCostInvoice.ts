// 관세사·포워더 정산서(한국 도착 비용) 읽기 결과를 정리하는 규칙. AI 는 줄만 읽고, 합계는 여기서 다시 계산한다.
// dest_cost_actual = 부가세를 뺀 별도 비용(관세·운임·통관수수료·창고료 등), dest_cost_actual_vat = 수입 부가세.
// 수수료에 붙는 부가세도 매입세액 공제 대상이라 원가에서 뺀다. 검산: scripts/check-dest-cost-invoice.mjs

export const LINE_KINDS = ['DUTY', 'IMPORT_VAT', 'SERVICE_VAT', 'FREIGHT', 'CUSTOMS_FEE', 'LOCAL', 'OTHER'];
export const KIND_LABEL: Record<string, string> = {
  DUTY: '관세', IMPORT_VAT: '수입 부가세', SERVICE_VAT: '수수료 부가세', FREIGHT: '운임', CUSTOMS_FEE: '통관 수수료', LOCAL: '항구·창고·내륙 운송', OTHER: '기타',
};
const VAT_RE = /부가세|부가가치세|vat|v\.a\.t/i;
const SERVICE_RE = /수수료|대행|운임|운송|창고|보관|fee|freight|handling|commission/i;
const IMPORT_RE = /수입|세관|import|customs/i;

const num = (v: any) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = Number(String(v ?? '').replace(/[,\s원₩]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// AI 가 고른 종류가 비어 있거나 틀려도 이름으로 부가세 줄은 바로잡는다 (부가세를 원가에 넣는 실수가 가장 비싸다)
export function normalizeKind(kind: string, label = '') {
  const k = LINE_KINDS.includes(kind) ? kind : 'OTHER';
  if (VAT_RE.test(label)) {
    if (SERVICE_RE.test(label)) return 'SERVICE_VAT';
    if (IMPORT_RE.test(label)) return 'IMPORT_VAT';
    return k === 'SERVICE_VAT' ? 'SERVICE_VAT' : 'IMPORT_VAT'; // '부가세'·'VAT' 한 줄만 있으면 보통 수입 부가세
  }
  if (k === 'IMPORT_VAT' || k === 'SERVICE_VAT') return /관세(?!사)/.test(label) && !VAT_RE.test(label) ? 'DUTY' : k;
  return k;
}

// 정리: 줄별 금액(원) → 부가세 제외 합계, 수입 부가세, 경고
export function summarizeInvoice(parsed: any = {}, { estimateExVat = null }: any = {}) {
  const lines = (Array.isArray(parsed.lines) ? parsed.lines : [])
    .map((l: any) => ({ label: String(l.label || '').trim().slice(0, 80), amount: Math.round(num(l.amount_krw ?? l.amount)), kind: normalizeKind(l.kind, String(l.label || '')) }))
    .filter((l: any) => l.label && l.amount !== 0);
  const sum = (pred: (l: any) => boolean) => lines.filter(pred).reduce((t: number, l: any) => t + l.amount, 0);
  const vatKinds = ['IMPORT_VAT', 'SERVICE_VAT'];
  const exVat = sum((l) => !vatKinds.includes(l.kind));
  const importVat = sum((l) => l.kind === 'IMPORT_VAT');
  const serviceVat = sum((l) => l.kind === 'SERVICE_VAT');
  const all = exVat + importVat + serviceVat;
  const grand = Math.round(num(parsed.grand_total_krw));
  const warnings: string[] = [];
  if (!lines.length) warnings.push('NO_LINES');
  if (grand && Math.abs(grand - all) > Math.max(10, grand * 0.002)) warnings.push('TOTAL_MISMATCH');
  if (String(parsed.currency || 'KRW').toUpperCase() !== 'KRW') warnings.push('NOT_KRW');
  if (lines.some((l: any) => l.amount < 0)) warnings.push('NEGATIVE_LINE');
  if (estimateExVat != null && num(estimateExVat) > 0) {
    const r = exVat / num(estimateExVat);
    if (r > 1.5 || r < 0.5) warnings.push('FAR_FROM_ESTIMATE');
  }
  return {
    lines: lines.map((l: any) => ({ ...l, kind_label: KIND_LABEL[l.kind] })),
    ex_vat: exVat, import_vat: importVat, service_vat: serviceVat, total: all, grand_total_read: grand || null,
    diff_vs_estimate: estimateExVat != null && num(estimateExVat) > 0 ? exVat - Math.round(num(estimateExVat)) : null,
    warnings,
  };
}

export const WARNING_TEXT: Record<string, string> = {
  NO_LINES: '금액 줄을 읽지 못했습니다. 더 선명한 파일을 올려 주세요',
  TOTAL_MISMATCH: '줄을 더한 값이 정산서 총액과 다릅니다. 빠진 줄이 없는지 확인하세요',
  NOT_KRW: '원화가 아닌 정산서입니다. 원화 금액으로 확인하세요',
  NEGATIVE_LINE: '음수(차감) 줄이 있습니다. 환급·할인인지 확인하세요',
  FAR_FROM_ESTIMATE: '고객에게 보낸 예상액과 50% 넘게 다릅니다. 다른 선적의 정산서가 아닌지 확인하세요',
};

// 선적 찾기: B/L·AWB 번호가 같으면 그 선적, 아니면 후보만
export function matchShipment(parsed: any, shipments: any[]) {
  const clean = (s: string) => String(s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const bl = clean(parsed.bl_no);
  if (bl.length >= 6) {
    const hit = shipments.find((s) => clean(s.tracking_no) && (clean(s.tracking_no).includes(bl) || bl.includes(clean(s.tracking_no))));
    if (hit) return { shipment: hit, by: 'BL' };
  }
  return { shipment: null, by: '' };
}
