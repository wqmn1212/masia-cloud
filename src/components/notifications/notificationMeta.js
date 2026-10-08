export const NOTIFICATION_META = {
  card_moved: { label: '진행 단계 변경', icon: '🔄' },
  card_shared: { label: '프로젝트 공개', icon: '📂' },
  chat_message: { label: '새 메시지', icon: '💬' },
  quote_published: { label: '견적서 발행', icon: '📄' },
  settlement_due: { label: '정산 예정', icon: '💰' },
  portfolio_edit_request: { label: '포트폴리오 수정 요청', icon: '✏️' },
  payment_confirmed: { label: '입금 확인', icon: '💳' },
  schedule_changed: { label: '일정 변경', icon: '📅' },
  file_shared: { label: '파일 공유', icon: '📎' },
  requirements_updated: { label: '요구사항 변경', icon: '📝' },
  marketing_comment: { label: '마케팅 새 댓글', icon: '💬' },
  sample_submitted: { label: '샘플 사진 등록', icon: '📷' },
  sample_feedback: { label: '샘플 의견 도착', icon: '🗨️' },
  holiday_conflict: { label: '중국 휴무 겹침', icon: '🏮' },
  holiday_notice: { label: '휴무 전 발주 안내', icon: '🗓️' },
  reorder_due: { label: '재주문 시점', icon: '🔁' },
  milestone_overdue: { label: '일정 지연', icon: '⏰' },
};

export const notificationMeta = (type) => NOTIFICATION_META[type] || { label: '알림', icon: '🔔' };