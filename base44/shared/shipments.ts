// 선적(Shipment) 서류 규칙. 화면 쪽 src/lib/shipments.js 와 같은 규칙을 쓴다 (둘을 함께 고칠 것).
export const SHIPMENT_STATUS_LABEL = {
  PREPARING: '출고 준비', BOOKED: '선적 예약', DEPARTED: '출항', ARRIVED: '도착', CUSTOMS: '통관 중', CLEARED: '통관 완료', DELIVERED: '입고 완료', ON_HOLD: '보류',
};
export const MODE_LABEL = { SEA_FCL: '해상 (FCL)', SEA_LCL: '해상 (LCL)', AIR: '항공', EXPRESS: '특송', RAIL: '철도', TRUCK: '육로' };

export const DOC_LABEL = {
  COMMERCIAL_INVOICE: '상업송장 (CI)', PACKING_LIST: '포장명세서 (PL)', BILL_OF_LADING: 'B/L · AWB', CERT_ORIGIN: '원산지증명서 (FTA)',
  UN38_3: 'UN38.3 시험 성적서', MSDS: '물질안전보건자료 (MSDS)', BATTERY_SPEC: '배터리 사양서', DG_DECLARATION: '위험물 신고서 (DGD)', OTHER: '기타',
};
// 카드 무역서류 보관함의 문서 유형 → 선적 서류 (올라와 있으면 준비된 것으로 본다)
export const DOC_FROM_ATTACHMENT = {
  INVOICE_CI: 'COMMERCIAL_INVOICE', PACKING_LIST: 'PACKING_LIST', BILL_OF_LADING: 'BILL_OF_LADING', CERT_ORIGIN: 'CERT_ORIGIN',
  UN38_3: 'UN38_3', MSDS: 'MSDS', BATTERY_SPEC: 'BATTERY_SPEC', DG_DECLARATION: 'DG_DECLARATION',
};
const BASE_DOCS = ['COMMERCIAL_INVOICE', 'PACKING_LIST', 'BILL_OF_LADING', 'CERT_ORIGIN'];
const DG_DOCS = ['UN38_3', 'MSDS', 'BATTERY_SPEC', 'DG_DECLARATION'];
// 출항 전에 꼭 있어야 하는 서류 (B/L 은 출항 뒤 나오므로 출항 전 경고에서 뺀다)
const BEFORE_DEPARTURE = ['COMMERCIAL_INVOICE', 'PACKING_LIST', ...DG_DOCS];

export const requiredDocs = (s) => [...BASE_DOCS, ...(s.dangerous_goods ? DG_DOCS : [])];

// 서류별 상태: 직접 '준비됨/해당 없음'으로 표시했거나, 보관함에 그 유형 파일이 있으면 준비됨
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

// 고객 서류함의 '아직 공유되지 않은 서류': 선적 예약 뒤엔 인보이스·패킹리스트(위험물이면 위험물 서류), 출항 뒤엔 B/L·원산지증명서까지.
// 담당자가 '해당 없음'으로 표시한 서류는 빼고, 공유 여부는 고객 공개 파일의 종류로 본다 (내부에서 '준비됨'이어도 공유 전이면 빠진 것).
const AFTER_DEPARTURE = ['DEPARTED', 'ARRIVED', 'CUSTOMS', 'CLEARED', 'DELIVERED'];
export function missingSharedDocs(shipments = [], sharedTypes = []) {
  const shared = new Set(sharedTypes.map((t) => DOC_FROM_ATTACHMENT[t]).filter(Boolean));
  return shipments.flatMap((s) => {
    if (!['BOOKED', ...AFTER_DEPARTURE].includes(s.status)) return [];
    const na = new Set((s.docs || []).filter((d) => d.status === 'NA').map((d) => d.key));
    const departed = AFTER_DEPARTURE.includes(s.status);
    return requiredDocs(s)
      .filter((k) => departed || !['BILL_OF_LADING', 'CERT_ORIGIN'].includes(k))
      .filter((k) => !na.has(k) && !shared.has(k))
      .map((k) => ({ shipment_id: s.id, shipment_label: s.label || '선적', key: k, label: DOC_LABEL[k] }));
  });
}
