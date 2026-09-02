// 고객 포털 보드 — 어드민과 동일한 5단계 컬럼 (읽기 전용)
export const CLIENT_COLUMNS = [
  { id: 'TODO', label: '대기 중', color: 'bg-muted/60', dotColor: 'bg-muted-foreground' },
  { id: 'IN_PROGRESS', label: '소싱 중', color: 'bg-chart-3/10', dotColor: 'bg-chart-3' },
  { id: 'REVIEW', label: '견적 검토', color: 'bg-accent/10', dotColor: 'bg-accent' },
  { id: 'PRODUCTION', label: '발주 · 제작', color: 'bg-chart-4/10', dotColor: 'bg-chart-4' },
  { id: 'DONE', label: '완료', color: 'bg-primary/10', dotColor: 'bg-primary' },
];

export const CLIENT_STATUS_LABEL = CLIENT_COLUMNS.reduce((m, c) => ({ ...m, [c.id]: c.label }), { CANCELLED: '취소' });

export const CLIENT_PRIORITY = {
  LOW: { label: '낮음', className: 'bg-muted text-muted-foreground' },
  MEDIUM: { label: '보통', className: 'bg-chart-3/15 text-chart-3' },
  HIGH: { label: '높음', className: 'bg-destructive/15 text-destructive' },
  URGENT: { label: '긴급', className: 'bg-destructive text-destructive-foreground' },
};

export const CAT_LABEL = {
  DRIP_BAG: '드립백',
  SLEEVE: '슬리브',
  DESKTOP_LABELER: '탁상 라벨러',
  TUBE_SEALER: '튜브 실링기',
};