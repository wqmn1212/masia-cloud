// 최초 유입(first-touch) UTM 과 첫 랜딩 경로를 세션에 보관한다.
const KEY = 'aegis_first_touch';
const FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];

export function captureFirstTouch() {
  if (sessionStorage.getItem(KEY)) return;
  const params = new URLSearchParams(window.location.search);
  const data = { landing_path: window.location.pathname };
  FIELDS.forEach((f) => { if (params.get(f)) data[f] = params.get(f); });
  sessionStorage.setItem(KEY, JSON.stringify(data));
}

export function getFirstTouch() {
  return JSON.parse(sessionStorage.getItem(KEY) || '{}');
}