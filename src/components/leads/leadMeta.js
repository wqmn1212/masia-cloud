export const LEAD_STATUS = [
  { key: 'new', label: '신규', className: 'bg-blue-100 text-blue-700' },
  { key: 'contacted', label: '연락함', className: 'bg-amber-100 text-amber-700' },
  { key: 'quoting', label: '견적 중', className: 'bg-violet-100 text-violet-700' },
  { key: 'converted', label: '전환 완료', className: 'bg-emerald-100 text-emerald-700' },
  { key: 'dropped', label: '종료', className: 'bg-slate-100 text-slate-600' },
];

export const leadStatusMeta = (key) => LEAD_STATUS.find((s) => s.key === key) || LEAD_STATUS[0];