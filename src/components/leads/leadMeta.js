export const LEAD_STATUS = [
  { key: 'new', label: '신규', cls: 'bg-primary/15 text-primary' },
  { key: 'contacted', label: '연락함', cls: 'bg-warning/15 text-warning-text' },
  { key: 'quoting', label: '견적 중', cls: 'bg-chart-4/15 text-chart-4' },
  { key: 'converted', label: '전환 완료', cls: 'bg-success/15 text-success-text' },
  { key: 'dropped', label: '종료', cls: 'bg-muted text-muted-foreground' },
];

export const statusMeta = (key) => LEAD_STATUS.find((s) => s.key === key) || LEAD_STATUS[0];

export const formatBytes = (n) => {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};