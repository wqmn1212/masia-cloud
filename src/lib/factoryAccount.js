// 공장 지급 계좌 화면 공용 값. 서버 규칙은 base44/shared/factoryAccount.ts 와 같다 (둘을 함께 고칠 것).
export const VERIFY_METHODS = { VISIT: '공장 방문 확인', VIDEO_CALL: '영상통화 확인', PHONE: '대표 번호 전화 확인', DOCUMENT: '서류 확인' };

export const accountState = (rows = []) => ({
  verified: rows.find((r) => r.status === 'VERIFIED') || null,
  pending: rows.filter((r) => r.status === 'PENDING'),
});
