// 콜드메일 자동화 (영업 대상 찾기 → 맞춤 메일 → 회사소개서 → 후속 메일 → 회신·수신거부에 멈춤)
//
// 법규 (정보통신망법) 를 코드로 지킨다:
//  - 제50조: 광고성 메일은 수신자의 사전 동의가 원칙. 동의·거래 관계 등 '보낼 근거' 가 기록된 주소에만 보낸다 (BASIS).
//  - 제50조의2: 홈페이지에서 이메일 주소를 자동으로 수집하면 안 된다 → AI 는 회사만 찾고 주소는 만들지·찾지 않는다.
//    주소는 담당자가 명함·문의·전시회 명단 등에서 넣고 출처를 남긴다.
//  - 제50조 ④·시행령: 제목 앞 (광고), 보낸 사람 이름·연락처, 무료 수신거부 방법을 본문에 넣는다 (adSubject·footer).
//  - 밤 9시~아침 8시 광고 전송 제한 → 평일 9~18시(한국 시간)에만 보낸다 (inWindow).

export const BASIS: Record<string, string> = {
  opt_in: '수신 동의를 받음 (자료 받기 신청·뉴스레터 등)',
  customer: '거래·문의 고객 (같은 종류 제품, 법정 기간 안)',
  inquiry: '상대가 먼저 자료·견적을 요청함',
  overseas: '해외 수신자 — 수신거부 방식 국가 (담당자 확인)',
  none: '근거 없음 — 보내지 않음',
};
export const SENDABLE_BASIS = ['opt_in', 'customer', 'inquiry', 'overseas'];

// CANDIDATE: AI 가 찾음(주소·근거 없음) · READY: 주소·근거 있음 · DRAFTED: 초안 있음 · APPROVED: 승인(첫 메일 대기)
// SENDING: 보내는 중(후속 대기) · DONE: 마지막 메일까지 보냄 · REPLIED: 회신 · UNSUBSCRIBED: 수신거부 · STOPPED: 사람이 멈춤
export const OUT_STATUS = ['CANDIDATE', 'READY', 'DRAFTED', 'APPROVED', 'SENDING', 'DONE', 'REPLIED', 'UNSUBSCRIBED', 'STOPPED'];
export const LIVE = ['APPROVED', 'SENDING'];
const ENDED_STAGES = ['REPLIED', 'MEETING', 'QUOTE', 'WON', 'LOST'];

export const validEmail = (s: unknown) => /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(String(s || '').trim());
export const normEmail = (s: unknown) => String(s || '').trim().toLowerCase();
const clip = (s: unknown, n: number) => String(s ?? '').trim().slice(0, n);

/** 한국 시간의 날짜·시·요일 */
export function kst(now = new Date()) {
  const d = new Date(now.getTime() + 9 * 3600000);
  return { ymd: d.toISOString().slice(0, 10), hour: d.getUTCHours(), dow: d.getUTCDay() };
}
/** 보내도 되는 시간: 평일 9~18시 (한국 시간) */
export const inWindow = (now = new Date()) => { const t = kst(now); return t.dow >= 1 && t.dow <= 5 && t.hour >= 9 && t.hour < 18; };

/** 두 시각 사이 영업일 수 (한국 시간 날짜 기준, 주말 제외) */
export function businessDaysBetween(fromIso: string, now = new Date()) {
  const a = new Date(`${kst(new Date(fromIso)).ymd}T00:00:00Z`);
  const b = new Date(`${kst(now).ymd}T00:00:00Z`);
  let n = 0;
  while (a < b) { a.setUTCDate(a.getUTCDate() + 1); const w = a.getUTCDay(); if (w !== 0 && w !== 6) n += 1; }
  return n;
}

const AD = { ko: '(광고) ', en: '[Ad] ', zh: '(广告) ' } as Record<string, string>;
/** 제목 앞 광고 표시 (이미 있으면 그대로) */
export function adSubject(subject: string, lang = 'ko', label = true) {
  const s = clip(subject, 180).replace(/^\s*(\(광고\)|\[ad\]|\(广告\))\s*/i, '');
  return label ? `${AD[lang] || AD.ko}${s}` : s;
}

/** 본문 아래: 보낸 사람 정보 + 무료 수신거부 */
export function footer(c: any, unsubUrl: string, lang = 'ko') {
  const s = c?.sender || {};
  const who = [s.company, s.name && `${s.name}${s.title ? ` ${s.title}` : ''}`].filter(Boolean).join(' · ');
  const contact = [s.phone, s.email, s.address].filter(Boolean).join(' · ');
  const unsub = lang === 'en' ? `This is a commercial message. To stop receiving emails from us, open this link (free): ${unsubUrl}`
    : lang === 'zh' ? `本邮件为商业广告。如不希望再收到，请打开此链接（免费）：${unsubUrl}`
      : `더 이상 받기를 원하지 않으시면 아래 링크를 열어 주세요 (무료 수신거부): ${unsubUrl}`;
  const from = lang === 'ko' ? `보낸 사람: ${who}` : who;
  return ['', '—', from, contact, s.website || ''].filter((l, i) => i < 2 || l).join('\n') + `\n\n${unsub}`;
}

/** 후속 메일 틀의 {회사} {담당자} {제품} {보낸사람} 채우기 */
export function render(tpl: string, v: Record<string, string>) {
  return String(tpl || '')
    .replace(/\{회사\}/g, v.company || '')
    .replace(/\{담당자\}/g, v.contact || (v.lang === 'en' ? 'there' : '담당자'))
    .replace(/\{제품\}/g, v.product || '')
    .replace(/\{보낸사람\}/g, v.sender || '')
    .replace(/[ \t]+\n/g, '\n');
}

/** 이 영업 대상이 지금 보낼 단계 (0 = 첫 메일). 없으면 null */
export function dueStep(p: any, c: any, now = new Date()) {
  const o = p?.outreach || {};
  const steps = Array.isArray(c?.steps) ? c.steps : [];
  if (o.status === 'APPROVED' && !Number.isFinite(o.step)) return 0;
  if (o.status !== 'SENDING' || !Number.isFinite(o.step) || !o.last_sent_at) return null;
  const next = o.step + 1;
  if (next > steps.length) return null; // steps[k-1] = k 번째 후속 메일
  const wait = Math.max(1, Number(steps[next - 1]?.after_days) || 3);
  return businessDaysBetween(o.last_sent_at, now) >= wait ? next : null;
}

/** 보내도 되는지 (안 되면 이유) */
export function canSend(p: any, c: any, { suppressed = new Set<string>(), now = new Date() } = {}) {
  const o = p?.outreach || {};
  if (c?.status !== 'ACTIVE') return { ok: false, reason: '캠페인이 진행 중이 아닙니다' };
  if (!inWindow(now)) return { ok: false, reason: '보내는 시간(평일 9~18시)이 아닙니다' };
  if (!validEmail(p?.email)) return { ok: false, reason: '이메일 주소가 없습니다' };
  if (!SENDABLE_BASIS.includes(o.consent_basis)) return { ok: false, reason: '보낼 근거(수신 동의 등)가 기록되지 않았습니다' };
  if (suppressed.has(normEmail(p.email))) return { ok: false, reason: '수신거부한 주소입니다' };
  if (ENDED_STAGES.includes(p?.stage)) return { ok: false, reason: '이미 회신했거나 영업이 끝난 대상입니다' };
  if (!LIVE.includes(o.status)) return { ok: false, reason: '승인된 대상이 아닙니다' };
  if (o.status === 'APPROVED' && !(o.draft?.subject && o.draft?.body)) return { ok: false, reason: '첫 메일 초안이 없습니다' };
  return { ok: true, reason: '' };
}

/** 승인할 수 있는지 (사람이 누르는 단계의 점검) */
export function approvable(p: any, suppressed = new Set<string>()) {
  const o = p?.outreach || {};
  if (!validEmail(p?.email)) return '이메일 주소를 넣으세요';
  if (!clip(o.email_source, 200)) return '이메일 주소의 출처를 적으세요 (명함·문의·전시회 명단 등)';
  if (!SENDABLE_BASIS.includes(o.consent_basis)) return '보낼 근거를 고르세요 (근거가 없으면 보낼 수 없습니다)';
  if (suppressed.has(normEmail(p.email))) return '수신거부한 주소입니다';
  if (!(o.draft?.subject && o.draft?.body)) return '첫 메일 초안을 먼저 만드세요';
  if (['REPLIED', 'UNSUBSCRIBED'].includes(o.status) || ENDED_STAGES.includes(p?.stage)) return '이미 회신했거나 끝난 대상입니다';
  return '';
}

/** 주소·근거를 고친 뒤의 상태 (보내는 중인 것은 건드리지 않는다) */
export function statusAfterEdit(p: any) {
  const o = p?.outreach || {};
  if (['APPROVED', 'SENDING', 'DONE', 'REPLIED', 'UNSUBSCRIBED', 'STOPPED'].includes(o.status)) return o.status;
  if (o.draft?.subject && o.draft?.body) return 'DRAFTED';
  return validEmail(p?.email) && SENDABLE_BASIS.includes(o.consent_basis) ? 'READY' : 'CANDIDATE';
}

// ---------- 메일 만들기 (RFC 2822, 첨부 가능) ----------
const b64 = (s: string) => { const bytes = new TextEncoder().encode(s); let bin = ''; for (const b of bytes) bin += String.fromCharCode(b); return btoa(bin); };
const b64url = (s: string) => b64(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const header = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const one = (s: unknown) => String(s ?? '').replace(/[\r\n]+/g, ' ').trim();
const wrap = (b: string) => (b.match(/.{1,76}/g) || []).join('\r\n');

/** attachment.data 는 base64 (줄바꿈 없음). html 을 주면 글자·HTML 두 가지로 (메일 앱이 고른다) */
export function mimeMail({ to, subject, body, html = '', replyTo = '', attachment = null, unsubUrl = '' }: { to: string; subject: string; body: string; html?: string; replyTo?: string; attachment?: { name: string; type: string; data: string } | null; unsubUrl?: string }) {
  const head = [
    `To: ${one(to)}`,
    ...(replyTo ? [`Reply-To: ${one(replyTo)}`] : []),
    `Subject: ${header(one(subject))}`,
    ...(unsubUrl ? [`List-Unsubscribe: <${one(unsubUrl)}>`] : []),
    'MIME-Version: 1.0',
  ];
  const text = wrap(b64(String(body || '').replace(/\r?\n/g, '\r\n')));
  if (html && !attachment) {
    const alt = `aegis_alt_${Math.random().toString(36).slice(2)}`;
    return b64url([
      ...head, `Content-Type: multipart/alternative; boundary="${alt}"`, '',
      `--${alt}`, 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', text,
      `--${alt}`, 'Content-Type: text/html; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', wrap(b64(html)),
      `--${alt}--`, '',
    ].join('\r\n'));
  }
  if (!attachment) return b64url([...head, 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', text].join('\r\n'));
  const boundary = `aegis_${Math.random().toString(36).slice(2)}`;
  return b64url([
    ...head,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`, 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', text,
    `--${boundary}`, `Content-Type: ${one(attachment.type) || 'application/pdf'}; name="${header(one(attachment.name))}"`, 'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename="${header(one(attachment.name))}"`, '', wrap(attachment.data),
    `--${boundary}--`, '',
  ].join('\r\n'));
}

// ---------- 캠페인 값 정리 ----------
export function cleanCampaign(x: any) {
  const s = x?.sender || {};
  const steps = (Array.isArray(x?.steps) ? x.steps : []).slice(0, 3).map((t: any) => ({ after_days: Math.min(20, Math.max(1, Math.round(Number(t?.after_days) || 3))), subject: clip(t?.subject, 180), body: clip(t?.body, 4000) })).filter((t: any) => t.body);
  const b = x?.brochure || {};
  return {
    name: clip(x?.name, 80) || '새 캠페인',
    status: ['DRAFT', 'ACTIVE', 'PAUSED', 'DONE'].includes(x?.status) ? x.status : 'DRAFT',
    target: clip(x?.target, 1500), region: clip(x?.region, 200), exclude: clip(x?.exclude, 800),
    offer: clip(x?.offer, 2000), language: ['ko', 'en', 'zh'].includes(x?.language) ? x.language : 'ko',
    sender: { company: clip(s.company, 80), name: clip(s.name, 40), title: clip(s.title, 40), phone: clip(s.phone, 40), email: validEmail(s.email) ? clip(s.email, 120) : '', address: clip(s.address, 160), website: clip(s.website, 160) },
    brochure: { mode: ['attach', 'link', 'none'].includes(b.mode) ? b.mode : 'link', file_uri: clip(b.file_uri, 400), file_name: clip(b.file_name, 120), size: Number(b.size) > 0 ? Math.round(Number(b.size)) : 0 },
    steps, daily_limit: Math.min(50, Math.max(1, Math.round(Number(x?.daily_limit) || 20))), ad_label: x?.ad_label !== false,
  };
}
/** 캠페인을 시작할 수 있는지 (보낸 사람 정보는 법정 표시 사항) */
export function startProblems(c: any) {
  const s = c?.sender || {};
  const out = [];
  if (!s.company) out.push('보낸 회사 이름');
  if (!s.phone && !s.email) out.push('연락처(전화 또는 이메일)');
  if (!s.address) out.push('주소');
  if (!c?.offer) out.push('제안 내용');
  if (c?.brochure?.mode !== 'none' && !c?.brochure?.file_uri) out.push('회사소개서 파일 (또는 보내지 않음으로)');
  return out;
}

// ---------- AI ----------
export const DISCOVER_SCHEMA = {
  type: 'object',
  properties: { companies: { type: 'array', items: { type: 'object', properties: {
    company: { type: 'string' }, website: { type: 'string' }, industry: { type: 'string' }, region: { type: 'string' }, size: { type: 'string' },
    why_fit: { type: 'string', description: '왜 우리 고객이 될 만한지 (근거가 된 사실 포함, 2문장 이내)' },
    product_idea: { type: 'string', description: '이 회사와 함께 만들 만한 제품·제안 (1문장)' },
    contact_page: { type: 'string', description: '공식 홈페이지의 문의·연락 페이지 주소 (있으면)' },
  }, required: ['company', 'why_fit'] } } },
  required: ['companies'],
};

export function discoverPrompt(c: any, count: number, known: string[]) {
  return [
    `너는 B2B 제조 서비스 회사의 영업 리서처다. 아래 조건에 맞는 실제 존재하는 회사 ${count}곳을 인터넷에서 찾아라.`,
    `우리 회사: ${c.sender?.company || ''} ${c.sender?.website || ''}`,
    `우리가 제안하는 것: ${c.offer || ''}`,
    `찾을 고객사: ${c.target || ''}`,
    c.region ? `지역: ${c.region}` : '',
    c.exclude ? `제외: ${c.exclude}` : '',
    known.length ? `이미 목록에 있는 회사(다시 넣지 말 것): ${known.slice(0, 200).join(', ')}` : '',
    '규칙:',
    '- 실제로 확인한 회사만. 지어내지 말 것. 홈페이지 주소는 확인한 것만 적고 모르면 비워 둘 것.',
    '- 이메일 주소·전화번호·개인 이름 같은 개인정보는 절대 적지 말 것 (법으로 자동 수집이 금지됨). 문의 페이지 주소까지만.',
    '- why_fit 에는 판단 근거가 된 사실(제품군, 최근 출시, 채용, 투자 등)을 짧게.',
    '- 한국어로.',
  ].filter(Boolean).join('\n');
}

export const DRAFT_SCHEMA = { type: 'object', properties: { subject: { type: 'string' }, body: { type: 'string' } }, required: ['subject', 'body'] };

export function draftPrompt(c: any, p: any) {
  const lang = c.language || 'ko';
  const L = lang === 'en' ? 'English' : lang === 'zh' ? '简体中文' : '한국어';
  return [
    `처음 연락하는 B2B 제안 메일을 ${L}로 써라.`,
    `보내는 사람: ${c.sender?.company || ''} ${c.sender?.name || ''} ${c.sender?.title || ''}`,
    `우리가 제안하는 것: ${c.offer || ''}`,
    `받는 회사: ${p.company} (${p.industry || ''}) ${p.website || ''}`,
    `받는 사람: ${p.contact_name || '담당자'} ${p.contact_title || ''}`,
    p.outreach?.fit_reason ? `이 회사를 고른 이유: ${p.outreach.fit_reason}` : '',
    p.product_idea ? `함께 만들 만한 것: ${p.product_idea}` : '',
    c.brochure?.mode !== 'none' && c.brochure?.file_uri ? '회사소개서를 함께 보낸다는 한 줄을 넣어라 (첨부 또는 아래 링크).' : '',
    '규칙:',
    '- 제목은 30자 안쪽, 상대 회사 이름이나 제품을 넣어 구체적으로. 제목 앞에 (광고) 는 붙이지 말 것 (보낼 때 자동으로 붙음).',
    '- 본문 120~180단어. 첫 문장에 이 회사를 고른 구체적 이유. 우리 제안은 2~3문장. 마지막은 부담 없는 질문 하나 (예: 15분 통화 가능한지).',
    '- 과장·허위 실적·확인되지 않은 숫자 금지. 상대 회사에 대한 사실은 위에 준 정보만.',
    '- 서명·회사 정보·수신거부 문구는 쓰지 말 것 (보낼 때 자동으로 붙음).',
  ].filter(Boolean).join('\n');
}

/** AI 결과 정리: 회사 이름 없는 것·중복·이미 있는 것은 뺀다. 개인정보처럼 보이는 값은 지운다 */
export function cleanCompanies(list: any[], known: string[]) {
  const seen = new Set(known.map((k) => k.replace(/\s+/g, '').toLowerCase()));
  const noPii = (s: unknown) => clip(s, 400).replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '').replace(/\+?\d[\d\s-]{7,}\d/g, '').trim();
  const out = [];
  for (const x of Array.isArray(list) ? list : []) {
    const name = clip(x?.company, 80);
    const key = name.replace(/\s+/g, '').toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    const site = clip(x?.website, 200);
    out.push({ company: name, website: /^https?:\/\//.test(site) ? site : site ? `https://${site}` : '', industry: clip(x?.industry, 60), region: clip(x?.region, 60), size: clip(x?.size, 40), why_fit: noPii(x?.why_fit), product_idea: noPii(x?.product_idea), contact_page: /^https?:\/\//.test(String(x?.contact_page || '')) ? clip(x.contact_page, 300) : '' });
  }
  return out;
}

export const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, '0')).join('');

// ---------- Gmail 보내기 (연결된 Gmail) ----------
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
export async function gmailSend(token: string, raw: string) {
  const res = await fetch(`${GMAIL}/messages/send`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ raw }), signal: AbortSignal.timeout(30000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e: any = new Error(data?.error?.message || `Gmail ${res.status}`); e.status = res.status; throw e; }
  return data;
}
export async function gmailToken(svc: any) {
  try { return (await svc.connectors.getConnection('gmail')).accessToken || ''; } catch { return ''; }
}
/** 수신거부 명단 (재동의로 풀린 것은 뺀다) */
export const activeSuppressed = (rows: any[]) => new Set((rows || []).filter((s: any) => !s.lifted_at).map((s: any) => normEmail(s.email)));
