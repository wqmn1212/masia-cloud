export const TEAM_MENU_OPTIONS = [
  { path: '/', label: '대시보드' },
  { path: '/quotations', label: '견적 관리' },
  { path: '/task-board', label: '업무 보드' },
  { path: '/settlement', label: '정산 관리' },
  { path: '/knowledge', label: '지식 관리' },
  { path: '/factories', label: '공장 관리' },
  { path: '/agent-quotes', label: '에이전트 견적' },
  { path: '/requirements', label: '요구사항' },
  { path: '/clients', label: '고객사 관리' },
  { path: '/timeline', label: '생산 일정' },
  { path: '/as-requests', label: 'A/S 요청' },
];

export const canAccessPath = (user, pathname) => {
  if (!user || user.account_tier !== 'sub') return true;
  return (user.allowed_tabs || []).some(path => path === '/' ? pathname === '/' : pathname.startsWith(path));
};