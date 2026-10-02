// 요금 플랜별 색 — Tailwind가 읽을 수 있도록 클래스명을 통째로 적는다
export const PLAN_THEME = {
  lite: { bar: 'bg-landing-lite', text: 'text-landing-lite-text', tint: 'bg-landing-lite-tint', line: 'border-landing-lite-line' },
  std: { bar: 'bg-landing-brand', text: 'text-landing-brand', tint: 'bg-landing-tint', line: 'border-landing-tint-border' },
  pro: { bar: 'bg-landing-pro', text: 'text-landing-pro-text', tint: 'bg-landing-pro-tint', line: 'border-landing-pro-line' },
  ent: { bar: 'bg-landing-ent-accent', text: 'text-landing-ent-accent', tint: 'bg-landing-ink', line: 'border-landing-ink' },
};

// 비교표 열 순서와 같다: 라이트 · 스탠다드 · 프로 · 엔터프라이즈
export const PLAN_KEYS = ['lite', 'std', 'pro', 'ent'];