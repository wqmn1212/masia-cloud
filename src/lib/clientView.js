// 마스터 관리자가 고객 포털을 특정 고객사 기준으로 열람할 때 쓰는 고객사 ID
const KEY = 'aegis_view_company_id';

export function getViewCompanyId() {
  const fromUrl = new URLSearchParams(window.location.search).get('view_company');
  if (fromUrl) sessionStorage.setItem(KEY, fromUrl);
  return sessionStorage.getItem(KEY) || undefined;
}

export const withClientView = (payload = {}) => ({ ...payload, view_company_id: getViewCompanyId() });