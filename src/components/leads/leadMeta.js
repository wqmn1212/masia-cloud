export const LEAD_STATUS = [
  { key: 'new', label: '신규', cls: 'bg-blue-100 text-blue-700' },
  { key: 'contacted', label: '연락함', cls: 'bg-amber-100 text-amber-700' },
  { key: 'quoting', label: '견적 중', cls: 'bg-violet-100 text-violet-700' },
  { key: 'converted', label: '전환 완료', cls: 'bg-emerald-100 text-emerald-700' },
  { key: 'dropped', label: '종료', cls: 'bg-slate-200 text-slate-600' },
];

export const statusMeta = (key) => LEAD_STATUS.find((s) => s.key === key) || LEAD_STATUS[0];

export const formatBytes = (n) => {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};