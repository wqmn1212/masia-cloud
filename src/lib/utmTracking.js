// 최초 유입(first-touch) UTM 과 첫 랜딩 경로를 세션에 보관한다.
// 저장소가 막혀 있거나 값이 깨져 있어도 앱이 멈추지 않도록 모두 무시한다.
const KEY = 'aegis_first_touch';
const FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];

export function captureFirstTouch() {
  try {
    if (sessionStorage.getItem(KEY)) return;
    const params = new URLSearchParams(window.location.search);
    const data = { landing_path: window.location.pathname };
    FIELDS.forEach((f) => { if (params.get(f)) data[f] = params.get(f); });
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // 무시
  }
}

export function getFirstTouch() {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}