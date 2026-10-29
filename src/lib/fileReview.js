// 디자인·도면 고객 확인 화면용 사본. 서버 base44/shared/fileReview.ts 와 같은 규칙 (검산: npm run check:file-review).
export const REVIEW_LABEL = { PENDING: '고객 확인 중', APPROVED: '고객 승인', REVISION_REQUESTED: '수정 요청', CANCELED: '요청 거둠' };
export const MAX_PINS = 30;
const IMAGE_TYPES = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
export const viewKind = (fileType) => {
  const t = String(fileType || '').toLowerCase();
  if (IMAGE_TYPES.includes(t)) return 'image';
  if (t === 'pdf') return 'pdf';
  return 'other';
};

// 공장 전달 승인본으로 지정해도 되는지 (서버 factoryApprovalBlock 과 같은 문장)
export function factoryApprovalBlock(file, requiresClient) {
  if (!requiresClient || !file?.client_review_status || file.client_review_status === 'CANCELED') return null;
  if (file.client_review_status === 'APPROVED') return null;
  return file.client_review_status === 'PENDING' ? '고객이 아직 확인 중인 파일입니다. 고객이 승인한 뒤 지정하세요' : '고객이 수정을 요청한 파일입니다. 고친 판을 다시 확인받으세요';
}

// 고객 확인을 요청할 만한 파일 (디자인·도면·사양): 일반 파일과 사양서. 인보이스·송금확인증 같은 무역서류는 빼고 본다
export const REVIEWABLE_TYPES = ['GENERAL', 'SPEC_SHEET', 'BATTERY_SPEC'];
export const isReviewable = (file) => REVIEWABLE_TYPES.includes(file?.document_type || 'GENERAL');
