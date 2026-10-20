// 공장 확인 카드: 거래 공장이 진짜 제조사인지 확인한 항목. 서버 쪽 base44/shared/factoryCheck.ts 와 같은 목록을 쓴다 (둘을 함께 고칠 것).
export const FACTORY_CHECKS = [
  { key: 'LICENSE', label: '사업자등록증 원본 확인', hint: '营业执照의 회사명·통일사회신용코드가 견적서·계약서와 같은지' },
  { key: 'SCOPE', label: '경영 범위에 생산 포함', hint: '经营范围에 生产·制造가 있는지. 销售·贸易만 있으면 무역회사입니다' },
  { key: 'MANUFACTURER', label: '실제 제조사 (무역회사 아님)', hint: '공장 건물 임대·소유 계약, 생산 인력·사회보험 인원 확인' },
  { key: 'SITE_VISIT', label: '공장 현장 방문', hint: '방문한 주소가 등록 주소와 같은지 (방문일 기록)' },
  { key: 'EQUIPMENT', label: '생산 설비·라인 확인', hint: '이 제품을 만드는 설비가 있는지 (사출기 톤수, 라인 수). 사진은 공장 서류에 올려 주세요' },
];
export const CHECK_STATUS = { OK: '확인', NG: '문제', NA: '해당 없음' };
export const FACTORY_CHECK_STATE = {
  NONE: { label: '공장 확인 전', cls: 'bg-destructive/10 text-destructive' },
  PARTIAL: { label: '공장 확인 중', cls: 'bg-chart-3/15 text-chart-3' },
  VERIFIED: { label: '공장 확인 완료', cls: 'bg-primary/10 text-primary' },
  FLAGGED: { label: '공장 확인 문제', cls: 'bg-destructive/15 text-destructive' },
};

// 문제 항목이 하나라도 있으면 FLAGGED, 전부 확인(또는 해당 없음)이면 VERIFIED
export function factoryCheckStatus(items = {}) {
  const st = FACTORY_CHECKS.map((c) => items?.[c.key]?.status || '');
  if (st.includes('NG')) return 'FLAGGED';
  if (st.every((s) => s === 'OK' || s === 'NA')) return 'VERIFIED';
  return st.some(Boolean) ? 'PARTIAL' : 'NONE';
}
export const factoryCheckDone = (items = {}) => FACTORY_CHECKS.filter((c) => ['OK', 'NA'].includes(items?.[c.key]?.status)).length;
