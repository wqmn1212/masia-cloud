export const TEAM_MENU_OPTIONS = [
  { path: '/dashboard', label: '대시보드' },
  { path: '/leads', label: '문의 접수' },
  { path: '/quotations', label: '견적 관리' },
  { path: '/contracts', label: '계약서 관리' },
  { path: '/decisions', label: '결정 기록' },
  { path: '/bom-extractor', label: 'STEP 도면 분석' },
  { path: '/financial-report', label: '재무 리포트' },
  { path: '/task-board', label: '업무 보드' },
  { path: '/assistant', label: 'AI 업무 비서' },
  { path: '/file-center', label: '파일 센터' },
  { path: '/settlement', label: '정산 관리' },
  { path: '/knowledge', label: '지식 관리' },
  { path: '/factories', label: '공장 관리' },
  { path: '/agent-quotes', label: '에이전트 견적' },
  { path: '/requirements', label: '요구사항' },
  { path: '/clients', label: '고객사 관리' },
  { path: '/timeline', label: '생산 일정' },
  { path: '/as-requests', label: 'A/S 요청' },
];

// 레거시 allowed_tabs 의 '/' 는 대시보드('/dashboard')로 취급
const normalize = (p) => (p === '/' ? '/dashboard' : p);

const matchesPath = (allowedPath, pathname) => {
  const allowed = normalize(allowedPath);
  return pathname === allowed || pathname.startsWith(`${allowed}/`);
};

const SERVICE_ADMIN_PATHS = ['/team', '/user-permissions'];

export const canAccessPath = (user, pathname) => {
  if (!user) return false;
  if (user.account_tier === 'master') return true;
  if (user.account_tier === 'service') {
    return [...TEAM_MENU_OPTIONS.map(item => item.path), ...SERVICE_ADMIN_PATHS]
      .some(path => matchesPath(path, pathname));
  }
  if (user.account_tier === 'sub') {
    return (user.allowed_tabs || []).some(path => matchesPath(path, pathname));
  }
  return false;
};