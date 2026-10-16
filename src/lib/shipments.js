// 선적(Shipment) 화면 공용 값. 서류 규칙은 base44/shared/shipments.ts 와 같다 (둘을 함께 고칠 것).
export const SHIPMENT_STATUS = {
  PREPARING: '출고 준비', BOOKED: '선적 예약', DEPARTED: '출항', ARRIVED: '도착', CUSTOMS: '통관 중', CLEARED: '통관 완료', DELIVERED: '입고 완료', ON_HOLD: '보류',
};
export const STATUS_FLOW = ['PREPARING', 'BOOKED', 'DEPARTED', 'ARRIVED', 'CUSTOMS', 'CLEARED', 'DELIVERED'];
export const MODES = { SEA_FCL: '해상 (FCL)', SEA_LCL: '해상 (LCL)', AIR: '항공', EXPRESS: '특송', RAIL: '철도', TRUCK: '육로' };
export const DOC_LABEL = {
  COMMERCIAL_INVOICE: '상업송장 (CI)', PACKING_LIST: '포장명세서 (PL)', BILL_OF_LADING: 'B/L · AWB', CERT_ORIGIN: '원산지증명서 (FTA)',
  UN38_3: 'UN38.3 시험 성적서', MSDS: '물질안전보건자료 (MSDS)', BATTERY_SPEC: '배터리 사양서', DG_DECLARATION: '위험물 신고서 (DGD)', OTHER: '기타',
};
const DOC_FROM_ATTACHMENT = {
  INVOICE_CI: 'COMMERCIAL_INVOICE', PACKING_LIST: 'PACKING_LIST', BILL_OF_LADING: 'BILL_OF_LADING', CERT_ORIGIN: 'CERT_ORIGIN',
  UN38_3: 'UN38_3', MSDS: 'MSDS', BATTERY_SPEC: 'BATTERY_SPEC', DG_DECLARATION: 'DG_DECLARATION',
};
const BASE_DOCS = ['COMMERCIAL_INVOICE', 'PACKING_LIST', 'BILL_OF_LADING', 'CERT_ORIGIN'];
const DG_DOCS = ['UN38_3', 'MSDS', 'BATTERY_SPEC', 'DG_DECLARATION'];
const BEFORE_DEPARTURE = ['COMMERCIAL_INVOICE', 'PACKING_LIST', ...DG_DOCS];

export const requiredDocs = (s) => [...BASE_DOCS, ...(s.dangerous_goods ? DG_DOCS : [])];
export function docStatus(s, attachmentTypes = []) {
  const uploaded = new Set(attachmentTypes.map((t) => DOC_FROM_ATTACHMENT[t]).filter(Boolean));
  const manual = new Map((s.docs || []).map((d) => [d.key, d.status]));
  return requiredDocs(s).map((key) => {
    const m = manual.get(key);
    const status = m === 'NA' ? 'NA' : m === 'READY' || uploaded.has(key) ? 'READY' : 'MISSING';
    return { key, label: DOC_LABEL[key], status, auto: status === 'READY' && m !== 'READY' };
  });
}
export const missingBeforeDeparture = (s, attachmentTypes = []) => docStatus(s, attachmentTypes).filter((d) => d.status === 'MISSING' && BEFORE_DEPARTURE.includes(d.key));
export const daysUntil = (date) => {
  if (!date) return null;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
};
