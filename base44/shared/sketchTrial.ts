// 메인페이지 '스케치 → 디자인 시안 3장' 체험 (sketchTrial 함수와 검산이 같이 쓴다)
//
// 로그인 없이 누구나 부르는 공개 기능이라 비용(이미지 생성)과 남용을 막는 규칙을 한곳에 둔다.
// · 연락처(이름·전화·이메일)를 남겨야 시안을 만든다 → 문의 접수 목록에 '스케치 시안' 문의로 남는다
// · 같은 이메일은 하루 2번, 전체는 하루 40번까지
// · 스케치는 PNG·JPG·WEBP 한 장, 8MB 이하, 짧은 변 200px 이상

export const TRIAL_SOURCE = 'sketch_tool';
export const TRIAL_PER_EMAIL = 2;
export const TRIAL_PER_DAY = 40;
export const TRIAL_WINDOW_MS = 24 * 60 * 60 * 1000;
export const TRIAL_MAX_BYTES = 8 * 1024 * 1024;
export const TRIAL_MIN_PX = 200;

const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export const isToken = (v: unknown) => typeof v === 'string' && TOKEN.test(v);

/** 입력 정리. 문제가 있으면 { error, code } */
export function cleanTrialInput(body: any) {
  // 사람 눈에 안 보이는 칸(website)이 채워져 있으면 자동 프로그램으로 본다
  if (clean(body?.website)) return { error: 'invalid request', code: 'bot' };
  if (!isToken(body?.token)) return { error: 'invalid token', code: 'token' };
  const contact_name = clean(body.contact_name, 100);
  const phone = clean(body.phone, 50);
  const email = clean(body.email, 200).toLowerCase();
  const idea = clean(body.idea, 600);
  if (!contact_name || !phone || !email) return { error: 'contact required', code: 'contact' };
  if (!EMAIL.test(email)) return { error: 'invalid email', code: 'email' };
  if (phone.replace(/\D/g, '').length < 8) return { error: 'invalid phone', code: 'phone' };
  if (idea.length < 2) return { error: 'idea required', code: 'idea' };
  const lang = ['ko', 'en', 'zh'].includes(body.lang) ? body.lang : 'ko';
  return { value: { token: String(body.token).toLowerCase(), contact_name, phone, email, idea, lang, company: clean(body.company, 200) } };
}

/** 스케치 파일 확인: 실제 바이트 머리말로 종류를 본다 (확장자·MIME 은 믿지 않는다) */
export function sketchKind(bytes: Uint8Array) {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg' };
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { ext: 'png', type: 'image/png' };
  if (bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return { ext: 'webp', type: 'image/webp' };
  return null;
}

/** 사용 한도. recent: 최근 체험 문의 [{ email, created_date }] (실패한 것은 빼고 넘긴다) */
export function trialLimit(recent: any[], email: string, nowMs = Date.now()) {
  const within = (recent || []).filter((r) => nowMs - new Date(r.created_date).getTime() < TRIAL_WINDOW_MS);
  if (within.filter((r) => String(r.email || '').toLowerCase() === email).length >= TRIAL_PER_EMAIL) return 'limit_email';
  if (within.length >= TRIAL_PER_DAY) return 'limit_daily';
  return null;
}

/** 화면에 돌려줄 값만 (형태 설명·연락처 같은 내부 값은 빼고) */
export function publicTrial(lead: any) {
  const t = lead?.sketch_trial || {};
  return {
    token: lead?.sketch_token || '',
    status: t.status || 'PENDING',
    variants: (t.variants || []).map((v: any) => ({ label: v.label, url: v.url })),
    notes: t.notes || [],
    chosen: t.chosen ?? null,
    inquired: !!t.inquired_at,
    error: t.error || '',
  };
}
