// AEGIS 메일 공통 틀: 머리(AEGIS · 메일 종류) · 흰 카드(눈썹·제목·본문) · 바닥(회신 안내·회사 한 줄)
// 메일 프로그램(Gmail·네이버·Outlook)에서 깨지지 않게 표 구조와 인라인 스타일만 쓴다. 웹 글꼴 없이 기본 글꼴.
// 색은 앱 디자인 토큰과 아침 업무 메일(opsDigest.ts MAIL_COLORS)에 맞춘다. 검산: npm run check:email-layout

export const EMAIL_COLORS = {
  ink: '#161618', body: '#3F4147', muted: '#6F727B', faint: '#9A9CA3', line: '#E4E4E7', page: '#F4F5F7', card: '#FFFFFF',
  primary: '#0066FF', primarySoft: '#EAF2FF', danger: '#E5484D', dangerSoft: '#FFF0F0', warn: '#AD5100', warnSoft: '#FFF4E6', success: '#147147', successSoft: '#E9F7EF',
};
const C = EMAIL_COLORS;
const FONT = `'Pretendard','Apple SD Gothic Neo','Malgun Gothic','맑은 고딕','PingFang SC','Microsoft YaHei',Arial,sans-serif`;

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
/** 줄바꿈이 있는 글을 안전한 HTML 로 (빈 줄은 문단 나눔) */
export const textToHtml = (text: unknown) => String(text ?? '').trim().split(/\n{2,}/).filter(Boolean)
  .map((para) => p(esc(para).replace(/\n/g, '<br>'))).join('');

export const appBase = () => {
  // deno 와 node(검산) 모두에서 동작
  const env = (globalThis as any).Deno?.env?.get?.('APP_BASE_URL');
  return String(env || 'https://aegistrade.biz').replace(/\/$/, '');
};
export const appUrl = (path = '') => (/^https?:\/\//.test(path) ? path : `${appBase()}${path.startsWith('/') ? '' : '/'}${path}`);

// ── 부품 (html 인자는 이미 안전한 HTML, 글자 인자는 esc 한다)
export const p = (html: string, style = '') => `<p style="margin:0 0 12px;font-size:15px;line-height:24px;color:${C.body};${style}">${html}</p>`;
export const strong = (text: unknown) => `<b style="color:${C.ink}">${esc(text)}</b>`;
export const button = (label: string, href: string) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 4px"><tr><td bgcolor="${C.primary}" style="border-radius:8px;background:${C.primary}"><a href="${esc(appUrl(href))}" style="display:inline-block;padding:12px 24px;font-size:15px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px"><font color="#ffffff">${esc(label)}</font></a></td></tr></table>`;
export const linkFallback = (href: string, lang = 'ko') => `<div style="margin-top:10px;font-size:12.5px;line-height:19px;color:${C.muted}">${esc(T[L(lang)].fallback)}<br><a href="${esc(appUrl(href))}" style="color:${C.primary};word-break:break-all">${esc(appUrl(href))}</a></div>`;
/** 이름표 표: rows = [[이름, 값HTML]] (값은 esc 한 HTML) */
export const facts = (rows: [string, string][]) => !rows.length ? '' : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 4px;border:1px solid ${C.line};border-radius:10px;border-collapse:separate">${rows.map(([k, v], i) => `<tr><td style="padding:10px 14px;${i ? `border-top:1px solid ${C.line};` : ''}width:96px;font-size:13px;line-height:20px;color:${C.muted};vertical-align:top">${esc(k)}</td><td style="padding:10px 14px 10px 0;${i ? `border-top:1px solid ${C.line};` : ''}font-size:14px;line-height:20px;color:${C.ink};font-weight:500">${v}</td></tr>`).join('')}</table>`;
type Tone = 'primary' | 'warn' | 'danger' | 'success';
const TONE: Record<Tone, [string, string]> = { primary: [C.primary, C.primarySoft], warn: [C.warn, C.warnSoft], danger: [C.danger, C.dangerSoft], success: [C.success, C.successSoft] };
export const badge = (label: string, tone: Tone = 'primary') => `<span style="display:inline-block;padding:2px 10px;border-radius:8px;background:${TONE[tone][1]};color:${TONE[tone][0]};font-size:12px;line-height:18px;font-weight:600;white-space:nowrap">${esc(label)}</span>`;
export const notice = (html: string, tone: Tone = 'warn') => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 4px"><tr><td style="padding:12px 14px;border-radius:10px;background:${TONE[tone][1]};font-size:13.5px;line-height:21px;color:${TONE[tone][0]}">${html}</td></tr></table>`;
export const heading = (text: string) => `<div style="margin:22px 0 2px;font-size:15px;line-height:22px;font-weight:700;color:${C.ink}">${esc(text)}</div>`;
export const steps = (items: [string, string][]) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px">${items.map(([t, d], i) => `<tr><td width="36" style="padding:8px 0;vertical-align:top"><div style="width:26px;height:26px;border-radius:13px;background:${C.primarySoft};color:${C.primary};font-size:13px;line-height:26px;font-weight:700;text-align:center">${i + 1}</div></td><td style="padding:8px 0;vertical-align:top"><div style="font-size:14.5px;line-height:22px;font-weight:600;color:${C.ink}">${esc(t)}</div><div style="font-size:13.5px;line-height:21px;color:${C.muted}">${esc(d)}</div></td></tr>`).join('')}</table>`;
export const stats = (items: [string, number | string, string?][]) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 4px;border-collapse:separate;border-spacing:0"><tr>${items.map(([k, n, color], i) => `<td width="${Math.floor(100 / items.length)}%" style="padding:12px 14px;border:1px solid ${C.line};border-radius:10px"><div style="font-size:12px;line-height:18px;color:${C.muted}">${esc(k)}</div><div style="margin-top:2px;font-size:24px;line-height:32px;font-weight:700;color:${color || C.ink}">${esc(n)}</div></td>${i < items.length - 1 ? '<td width="8" style="font-size:0">&nbsp;</td>' : ''}`).join('')}</tr></table>`;
/** 목록: rows = [[제목, 보조 글, 오른쪽 배지HTML]] */
export const listRows = (rows: [string, string, string?][]) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px">${rows.map(([t, sub, b]) => `<tr><td style="padding:10px 0;border-top:1px solid ${C.line}"><div style="font-size:14.5px;line-height:21px;font-weight:600;color:${C.ink}">${esc(t)}</div>${sub ? `<div style="font-size:13px;line-height:19px;color:${C.muted}">${esc(sub)}</div>` : ''}</td><td align="right" style="padding:10px 0 10px 8px;border-top:1px solid ${C.line};vertical-align:middle">${b || ''}</td></tr>`).join('')}</table>`;
/** 인증번호 같은 큰 숫자 칸 */
export const codeBox = (code: string, caption: string) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 6px"><tr><td align="center" style="padding:18px 0;border-radius:12px;background:${C.primarySoft}"><div style="font-size:34px;line-height:40px;font-weight:800;letter-spacing:10px;padding-left:10px;color:${C.primary};font-family:${FONT}">${esc(code)}</div><div style="margin-top:4px;font-size:13px;line-height:18px;color:${C.muted}">${esc(caption)}</div></td></tr></table>`;

const T = {
  ko: { foot: 'AEGIS Cloud 자동 메일입니다. 이 메일에는 회신하지 마시고, 문의는 프로젝트 카드의 문의 탭을 이용해 주세요.', company: '이지스(AEGIS) · 한국 PM과 광둥성 현지 QC·PM이 함께하는 중국 제조 관리', fallback: '버튼이 열리지 않으면 이 주소를 브라우저에 붙여 넣어 주세요.' },
  en: { foot: 'This is an automated AEGIS Cloud email. Please do not reply; use the inquiry tab on your project card instead.', company: 'AEGIS · China manufacturing management by a Korean PM and on-site QC/PM in Guangdong', fallback: 'If the button does not open, paste this address into your browser.' },
  zh: { foot: '本邮件为 AEGIS Cloud 自动发送，请勿回复；如需沟通请使用项目卡片的咨询标签。', company: 'AEGIS · 韩国 PM 与广东当地 QC·PM 共同管理中国制造', fallback: '如果按钮无法打开，请将以下地址粘贴到浏览器中。' },
} as const;
const L = (lang?: string) => (lang === 'en' || lang === 'zh' ? lang : 'ko') as keyof typeof T;

/**
 * 메일 전체 HTML.
 * kind: 머리 오른쪽 메일 종류 · eyebrow: 제목 위 파란 작은 글 · title: 제목(글자) · body: 본문 HTML
 * preheader: 받은편지함 목록 미리보기 · footNote: 바닥 첫 줄(없으면 기본 회신 안내)
 */
export function emailLayout({ kind = '', eyebrow = '', title, body, preheader = '', footNote, lang = 'ko' }: { kind?: string; eyebrow?: string; title: string; body: string; preheader?: string; footNote?: string; lang?: string }) {
  const t = T[L(lang)];
  return `<!doctype html><html lang="${L(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.page}" style="background:${C.page}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:${FONT};color:${C.ink}">
<tr><td style="padding:0 4px 14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:20px;line-height:28px;font-weight:800;letter-spacing:-0.5px;color:${C.ink}">AEGIS</td>
<td align="right" style="font-size:12.5px;line-height:28px;color:${C.muted}">${esc(kind)}</td></tr></table></td></tr>
<tr><td bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.line};border-radius:14px;padding:30px 28px 26px">
${eyebrow ? `<div style="font-size:13px;line-height:18px;font-weight:700;color:${C.primary};letter-spacing:.02em">${esc(eyebrow)}</div>` : ''}
<h1 style="margin:6px 0 14px;font-size:22px;line-height:31px;letter-spacing:-0.5px;font-weight:700;color:${C.ink}">${esc(title)}</h1>
${body}
</td></tr>
<tr><td style="padding:18px 6px 0;font-size:12px;line-height:19px;color:${C.muted}">
${esc(footNote ?? t.foot)}<br>
<span style="color:${C.faint}">${esc(t.company)} · <a href="https://aegistrade.biz" style="color:${C.faint};text-decoration:underline">aegistrade.biz</a></span>
</td></tr></table></td></tr></table></body></html>`;
}
