// 직원이 고객 포털을 특정 고객사 기준으로 열람할 때 쓰는 고객사 ID (읽기 전용)
// - 마스터 계정: 모든 고객사 (/client/dashboard?view_company=ID)
// - 팀 관리자·팀원: 영업 시연용 데모 고객사만 (/client/dashboard?view_company=ID&demo=1)
const KEY = 'aegis_view_company_id';
const DEMO_KEY = 'aegis_view_demo';
const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };

export function getViewCompanyId() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('view_company');
  if (fromUrl) safe(() => { sessionStorage.setItem(KEY, fromUrl); sessionStorage.setItem(DEMO_KEY, params.get('demo') === '1' ? '1' : ''); });
  return safe(() => sessionStorage.getItem(KEY), null) || undefined;
}

export const isDemoView = () => !!getViewCompanyId() && safe(() => sessionStorage.getItem(DEMO_KEY) === '1', false);

export function exitClientView() {
  safe(() => { sessionStorage.removeItem(KEY); sessionStorage.removeItem(DEMO_KEY); });
}

export const demoPortalPath = (companyId) => `/client/dashboard?view_company=${encodeURIComponent(companyId)}&demo=1`;

export const withClientView = (payload = {}) => ({ ...payload, view_company_id: getViewCompanyId() });
