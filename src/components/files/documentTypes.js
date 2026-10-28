export const DOCUMENT_TYPES = {
  GENERAL: '일반 파일',
  INVOICE_CI: '인보이스 (CI)', INVOICE_PI: '인보이스 (PI)', PACKING_LIST: '패킹리스트 (PL)', QUOTATION: '견적서',
  REMITTANCE_ACCOUNT: '송금계좌', REMITTANCE_DOWN: '송금확인증 (선금)', REMITTANCE_INTERIM: '송금확인증 (중도금)', REMITTANCE_BALANCE: '송금확인증 (잔금)',
  SPEC_SHEET: '사양서', TEST_REPORT: '성적서', CERTIFICATE: '인증서', LOGISTICS_INVOICE: '물류비 청구서',
  BILL_OF_LADING: 'B/L · AWB', CERT_ORIGIN: '원산지증명서', UN38_3: 'UN38.3 시험 성적서', MSDS: 'MSDS (물질안전보건자료)', BATTERY_SPEC: '배터리 사양서', DG_DECLARATION: '위험물 신고서 (DGD)',
  CLAIM_PHOTO: '불량 신고 사진', MOLD_OWNERSHIP: '금형 소유 확인서',
};

// 무역서류 업로드·보관함에 쓰는 유형 (불량 신고 사진·금형 소유 확인서는 각 화면에서 따로 올린다)
export const TRADE_DOCUMENT_GROUPS = [
  { label: '거래·결제', types: ['INVOICE_PI', 'INVOICE_CI', 'QUOTATION', 'REMITTANCE_DOWN', 'REMITTANCE_INTERIM', 'REMITTANCE_BALANCE', 'REMITTANCE_ACCOUNT'] },
  { label: '품질·인증', types: ['SPEC_SHEET', 'TEST_REPORT', 'CERTIFICATE'] },
  { label: '선적·통관', types: ['PACKING_LIST', 'BILL_OF_LADING', 'CERT_ORIGIN', 'LOGISTICS_INVOICE'] },
  { label: '배터리·위험물', types: ['UN38_3', 'MSDS', 'BATTERY_SPEC', 'DG_DECLARATION'] },
];
export const TRADE_DOCUMENT_TYPES = TRADE_DOCUMENT_GROUPS.flatMap((g) => g.types);

// 고객이 직접 올릴 때 고를 수 있는 유형 (직접 송금한 송금확인증, 고객이 가진 사양서·인증서)
export const CLIENT_UPLOAD_TYPES = ['GENERAL', 'REMITTANCE_DOWN', 'REMITTANCE_INTERIM', 'REMITTANCE_BALANCE', 'SPEC_SHEET', 'CERTIFICATE'];

// 결제 단계 ↔ 송금확인증 유형 (base44/shared/paymentRequest.ts 와 같다)
export const REMITTANCE_FOR_STAGE = { DOWN_PAYMENT: 'REMITTANCE_DOWN', INTERIM_PAYMENT: 'REMITTANCE_INTERIM', BALANCE_PAYMENT: 'REMITTANCE_BALANCE' };
