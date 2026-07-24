export const TEAM_MENU_OPTIONS = [
  { path: '/', label: '대시보드' },
  { path: '/quotations', label: '견적 관리' },
  { path: '/financial-report', label: '재무 리포트' },
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

const matchesPath = (allowedPath, pathname) =>
  allowedPath === '/'
    ? pathname === '/'
    : pathname === allowedPath || pathname.startsWith(`${allowedPath}/`);

const SERVICE_ADMIN_PATHS = ['/team', '/user-permissions'];

export const canAccessPath = (user, pathname) => {
  if (!user) return false;
  if (user.account_tier === 'master') return matchesPath('/master-admin', pathname);
  if (user.account_tier === 'service') {
    return [...TEAM_MENU_OPTIONS.map(item => item.path), ...SERVICE_ADMIN_PATHS]
      .some(path => matchesPath(path, pathname));
  }
  if (user.account_tier === 'sub') {
    return (user.allowed_tabs || []).some(path => matchesPath(path, pathname));
  }
  return false;
};