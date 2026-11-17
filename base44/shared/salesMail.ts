// 영업 메일: 연결된 Gmail 로 보내기, 영업 대상의 회신 찾아 기록하기
// 보내기는 gmail.send, 회신 찾기는 gmail.readonly 권한을 쓴다 (base44/connectors/gmail.jsonc).

export const ACTIVE = ['TARGET', 'SENT', 'REPLIED', 'MEETING', 'QUOTE'];
const FOLLOW_DAYS: Record<string, number> = { TARGET: 1, SENT: 4, REPLIED: 2, MEETING: 2, QUOTE: 3 };

export const kstToday = (now = new Date()) => new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
export function addBusinessDays(ymd: string, n: number) {
  const d = new Date(`${ymd}T00:00:00Z`);
  let left = n;
  while (left > 0) { d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(); if (w !== 0 && w !== 6) left -= 1; }
  return d.toISOString().slice(0, 10);
}
export const followUp = (stage: string, today: string) => (FOLLOW_DAYS[stage] ? addBusinessDays(today, FOLLOW_DAYS[stage]) : '');

const b64 = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};
const b64url = (s: string) => b64(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const header = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const clean = (s: unknown) => String(s ?? '').replace(/[\r\n]+/g, ' ').trim();
export const validEmail = (s: unknown) => /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(String(s || '').trim());

/** Gmail API 의 raw (RFC 2822, base64url). 한글 제목·본문 그대로 */
// 보내는 사람(From)은 Gmail 이 연결된 계정으로 채운다
export function mimeMessage({ to, subject, body, replyTo = '' }: { to: string; subject: string; body: string; replyTo?: string }) {
  const lines = [
    `To: ${clean(to)}`,
    ...(replyTo ? [`Reply-To: ${clean(replyTo)}`] : []),
    `Subject: ${header(clean(subject))}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    (b64(String(body || '').replace(/\r?\n/g, '\r\n')).match(/.{1,76}/g) || []).join('\r\n'),
  ];
  return b64url(lines.join('\r\n'));
}

/** 보낸 메일 기록 → 영업 대상 변경 (대상 단계면 '메일 보냄' 으로) */
export function sentPatch(p: any, { subject, by, gmailId, threadId, nowIso }: any) {
  const today = kstToday(new Date(nowIso));
  const stage = p.stage === 'TARGET' ? 'SENT' : p.stage;
  const entry = { at: nowIso, kind: 'email', direction: 'out', note: `Gmail 로 보냄 — ${subject}`, by, stage, gmail_id: gmailId, thread_id: threadId };
  return { touches: [...(p.touches || []), entry], stage, next_follow_up: followUp(stage, today) || p.next_follow_up || '' };
}

/** 회신을 찾을 시작 시각: 처음 보낸 메일(기록) 이후. 기록이 없으면 null(찾지 않음) */
export function replySince(p: any) {
  const outs = (p.touches || []).filter((t: any) => t.kind === 'email' && t.direction !== 'in').map((t: any) => t.at).filter(Boolean).sort();
  return outs[0] || null;
}

/**
 * 받은 메일 → 새 회신 기록. 이미 기록한 메일(gmail_id)은 건너뛴다.
 * messages: [{ id, threadId, at(ISO), subject, snippet }]
 * 돌려줌: null(새 것 없음) 또는 { patch, count, latest }
 */
export function replyPatch(p: any, messages: any[], nowIso: string) {
  if (!ACTIVE.includes(p.stage)) return null;
  const since = replySince(p);
  if (!since) return null;
  const seen = new Set((p.touches || []).map((t: any) => t.gmail_id).filter(Boolean));
  const fresh = messages.filter((m) => m.id && !seen.has(m.id) && m.at > since).sort((a, b) => a.at.localeCompare(b.at));
  if (!fresh.length) return null;
  const stage = ['TARGET', 'SENT'].includes(p.stage) ? 'REPLIED' : p.stage;
  const today = kstToday(new Date(nowIso));
  const entries = fresh.map((m) => ({ at: m.at, kind: 'email', direction: 'in', note: `회신 — ${clean(m.subject) || '(제목 없음)'}${m.snippet ? `: ${clean(m.snippet).slice(0, 160)}` : ''}`, by: p.contact_name || p.company || '', stage, gmail_id: m.id, thread_id: m.threadId, auto: true }));
  // 회신이 오면 다음 연락일은 회신 단계 기본값(2영업일) 또는 이미 더 이른 날짜
  const next = followUp('REPLIED', today);
  return { patch: { touches: [...(p.touches || []), ...entries], stage, next_follow_up: p.next_follow_up && p.next_follow_up < next ? p.next_follow_up : next }, count: fresh.length, latest: fresh[fresh.length - 1] };
}
