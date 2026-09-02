export const NOTIFICATION_META = {
  card_moved: { label: '진행 단계 변경', icon: '🔄' },
  card_shared: { label: '프로젝트 공개', icon: '📂' },
  chat_message: { label: '새 메시지', icon: '💬' },
  quote_published: { label: '견적서 발행', icon: '📄' },
  settlement_due: { label: '정산 예정', icon: '💰' },
};

export const notificationMeta = (type) => NOTIFICATION_META[type] || { label: '알림', icon: '🔔' };