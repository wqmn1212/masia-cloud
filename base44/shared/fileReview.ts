// 디자인·도면 고객 확인(FileReview) 공용 규칙 (2단계 D).
// 직원이 파일·질문·기한을 보내고, 고객은 위치에 핀 의견을 남겨 승인 또는 수정 요청을 고른다.
// 화면 src/lib/fileReview.js 가 같은 규칙을 쓴다. 검산: npm run check:file-review
export const REVIEW_DECISIONS = ['APPROVED', 'REVISION_REQUESTED'];
export const REVIEW_LABEL: Record<string, string> = { PENDING: '고객 확인 중', APPROVED: '고객 승인', REVISION_REQUESTED: '수정 요청', CANCELED: '요청 거둠' };
export const MAX_PINS = 30;
// 고객 화면에서 바로 볼 수 있는 파일 (이미지·PDF). 그 밖의 파일은 내려받아 확인한다
export const IMAGE_TYPES = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
export const viewKind = (fileType: unknown) => {
  const t = String(fileType || '').toLowerCase();
  if (IMAGE_TYPES.includes(t)) return 'image';
  if (t === 'pdf') return 'pdf';
  return 'other';
};

const clamp01 = (v: unknown) => Math.min(1, Math.max(0, Number(v) || 0));
const round4 = (v: number) => Math.round(v * 10000) / 10000;

// 핀 의견 정리: 쪽(1부터)·위치(0~1 비율)·내용. 내용이 빈 핀은 버리고 번호를 다시 매긴다
export function normalizePins(list: unknown, byName: string, at: string) {
  return (Array.isArray(list) ? list : [])
    .map((p: any) => ({ page: Math.max(1, Math.round(Number(p?.page) || 1)), x: round4(clamp01(p?.x)), y: round4(clamp01(p?.y)), text: String(p?.text || '').trim().slice(0, 500) }))
    .filter((p) => p.text)
    .slice(0, MAX_PINS)
    .map((p, i) => ({ n: i + 1, ...p, by_name: byName, at }));
}

// 직원 요청 입력 확인. { error } 또는 { patch }
export function reviewRequestPatch(input: any, { file, today, by, now }: { file: any; today: string; by: string; now: string }) {
  const question = String(input?.question || '').trim().slice(0, 1000);
  if (!question) return { error: '고객에게 확인받을 내용을 적어 주세요' };
  const due = String(input?.due_date || '').trim();
  if (due && (!/^\d{4}-\d{2}-\d{2}$/.test(due) || due < today)) return { error: '기한은 오늘 이후 날짜로 정해 주세요' };
  if (file?.superseded_by_id) return { error: '이미 새 판으로 바뀐 파일입니다. 최신 판으로 요청하세요' };
  return {
    patch: {
      attachment_id: file.id, previous_attachment_id: String(input?.previous_attachment_id || file.supersedes_id || ''),
      file_name: file.file_name || '', file_type: String(file.file_type || '').toLowerCase(),
      question, due_date: due, status: 'PENDING', pins: [], decision_note: '', decided_by_name: '', decided_at: '',
      requested_by_name: by, requested_at: now,
    },
  };
}

// 공장 전달 승인본으로 지정해도 되는지 (설정이 켜져 있고 고객 확인을 요청한 파일이면 고객 승인 판만)
export function factoryApprovalBlock(file: any, requiresClient: boolean) {
  if (!requiresClient || !file?.client_review_status || file.client_review_status === 'CANCELED') return null;
  if (file.client_review_status === 'APPROVED') return null;
  return file.client_review_status === 'PENDING' ? '고객이 아직 확인 중인 파일입니다. 고객이 승인한 뒤 지정하세요' : '고객이 수정을 요청한 파일입니다. 고친 판을 다시 확인받으세요';
}
