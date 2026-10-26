// 전자서명 공용 규칙: 문서 지문값(SHA-256), 감사 기록 사슬, 인증번호, 상태 전환.
// 서버 함수와 검산 스크립트(scripts/check-signature.mjs)가 같은 모듈을 쓴다 — Web Crypto 만 쓰고 SDK 를 가져오지 않는다.
// 법적 효력에 관한 설명은 일반 정보이며, 동의 문구·조항은 운영 전에 법무 검토를 받는다.

export const OTP_TTL_MS = 10 * 60 * 1000; // 인증번호 유효 10분
export const OTP_MAX_ATTEMPTS = 5; // 5회 틀리면
export const OTP_LOCK_MS = 30 * 60 * 1000; // 30분 잠금
export const OTP_RESEND_GAP_MS = 60 * 1000; // 다시 보내기 1분 간격
export const SIGN_WINDOW_MS = 15 * 60 * 1000; // 인증 후 15분 안에 서명
export const DEFAULT_DUE_DAYS = 14;
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_SIGNATURE_IMAGE_BYTES = 600 * 1024;
export const SIGN_METHODS = ['DRAW', 'TYPE', 'SEAL'];
export const REQUEST_STATUS = ['OUT', 'COMPLETED', 'DECLINED', 'REVOKED', 'EXPIRED'];
export const EVENT_TYPES = ['SENT', 'VIEWED', 'READ_TO_END', 'OTP_SENT', 'OTP_VERIFIED', 'OTP_FAILED', 'SIGNED', 'DECLINED', 'REVOKED', 'EXPIRED', 'COMPLETED', 'DOWNLOADED', 'REMINDED', 'EXTENDED'];

// 고객이 서명 직전에 체크하는 문구. 바꾸면 이후 서명부터 적용되고, 서명 기록에는 그때의 원문이 남는다.
export const CONSENT_TEXT = '위 계약서 내용을 끝까지 확인했으며, 이지스 클라우드의 전자서명으로 이 계약을 체결하는 데 동의합니다. 이 전자서명은 자필 서명 또는 기명날인과 같은 효력을 갖는 것으로 합니다.';

// 계약서 본문에 있어야 하는 전자서명 조항 (조항 라이브러리·템플릿과 같은 문구)
export const ESIGN_CLAUSE_TITLE = '(전자서명)';
export const hasEsignClause = (body: string) => /제\s?\d+\s?조\s*\(전자서명\)/.test(String(body || ''));

// ── 지문값 ─────────────────────────────────────────────────────
const enc = new TextEncoder();
export async function sha256Hex(input: Uint8Array | ArrayBuffer | string): Promise<string> {
  const bytes = typeof input === 'string' ? enc.encode(input) : input instanceof Uint8Array ? input : new Uint8Array(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 키 순서를 고정한 JSON (같은 내용이면 항상 같은 문자열)
export function canonical(value: any): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).filter((k) => value[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}

export const isPdf = (bytes: Uint8Array) => bytes.length > 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d; // %PDF-

// ── 감사 기록 사슬 ─────────────────────────────────────────────
// 각 기록의 hash = SHA-256(앞 기록 hash + 이 기록 내용). 하나를 빼거나 고치면 그 뒤가 모두 어긋난다.
const HASHED = ['request_id', 'seq', 'type', 'actor_type', 'actor_id', 'actor_label', 'at', 'ip', 'user_agent', 'data', 'prev_hash'];
export async function eventHash(ev: any): Promise<string> {
  const body: any = {};
  for (const k of HASHED) body[k] = ev[k] ?? null;
  return sha256Hex(canonical(body));
}

// 다음 기록 만들기. prev 는 같은 요청의 마지막 기록(없으면 null)
export async function nextEvent(prev: any, fields: any) {
  const ev = {
    request_id: fields.request_id, seq: prev ? Number(prev.seq) + 1 : 1, type: fields.type,
    actor_type: fields.actor_type || 'SYSTEM', actor_id: fields.actor_id || '', actor_label: fields.actor_label || '',
    at: fields.at || new Date().toISOString(), ip: fields.ip || '', user_agent: String(fields.user_agent || '').slice(0, 300),
    data: fields.data || {}, prev_hash: prev ? prev.hash : '',
  };
  if (!EVENT_TYPES.includes(ev.type)) throw new Error(`알 수 없는 기록 유형: ${ev.type}`);
  return { ...ev, hash: await eventHash(ev) };
}

// 사슬 검사: seq 가 1부터 빠짐없이 이어지고, 각 hash 가 내용과 앞 기록에 맞는지
export async function verifyChain(events: any[]) {
  const list = [...events].sort((a, b) => Number(a.seq) - Number(b.seq));
  let prevHash = '';
  for (let i = 0; i < list.length; i++) {
    const ev = list[i];
    if (Number(ev.seq) !== i + 1) return { ok: false, brokenAt: i + 1, reason: 'SEQ_GAP' };
    if ((ev.prev_hash || '') !== prevHash) return { ok: false, brokenAt: ev.seq, reason: 'PREV_MISMATCH' };
    if ((await eventHash(ev)) !== ev.hash) return { ok: false, brokenAt: ev.seq, reason: 'HASH_MISMATCH' };
    prevHash = ev.hash;
  }
  return { ok: true, count: list.length, head: prevHash };
}

// ── 인증번호 ───────────────────────────────────────────────────
export function generateOtp(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1000000).padStart(6, '0');
}
// 요청·사용자별 소금을 섞어 해시로만 저장한다
export const otpHash = (code: string, requestId: string, userId: string) => sha256Hex(`${requestId}:${userId}:${String(code).trim()}`);

// 인증번호를 다시 보낼 수 있는지
export function canSendOtp(otp: any, now = Date.now()) {
  if (otp?.locked_until && Date.parse(otp.locked_until) > now) return { ok: false, reason: 'LOCKED', until: otp.locked_until };
  if (otp?.sent_at && now - Date.parse(otp.sent_at) < OTP_RESEND_GAP_MS) return { ok: false, reason: 'TOO_SOON', wait_s: Math.ceil((OTP_RESEND_GAP_MS - (now - Date.parse(otp.sent_at))) / 1000) };
  return { ok: true };
}

// 새 인증번호 레코드 값 (잠금은 유지)
export async function freshOtp({ requestId, userId, code, now = Date.now() }: any) {
  return {
    request_id: requestId, user_id: userId, code_hash: await otpHash(code, requestId, userId),
    sent_at: new Date(now).toISOString(), expires_at: new Date(now + OTP_TTL_MS).toISOString(), attempts: 0, verified_at: null,
  };
}

// 입력한 번호 확인. patch 는 레코드에 그대로 저장할 값
export async function checkOtp(otp: any, code: string, { requestId, userId, now = Date.now() }: any) {
  if (otp?.locked_until && Date.parse(otp.locked_until) > now) return { ok: false, reason: 'LOCKED', patch: null };
  if (!otp?.code_hash) return { ok: false, reason: 'NO_CODE', patch: null };
  if (otp.verified_at) return { ok: false, reason: 'USED', patch: null };
  if (Date.parse(otp.expires_at) <= now) return { ok: false, reason: 'EXPIRED', patch: null };
  if (!/^\d{6}$/.test(String(code || '').trim())) return { ok: false, reason: 'FORMAT', patch: null };
  if ((await otpHash(code, requestId, userId)) === otp.code_hash) return { ok: true, reason: 'OK', patch: { verified_at: new Date(now).toISOString(), attempts: Number(otp.attempts) || 0 } };
  const attempts = (Number(otp.attempts) || 0) + 1;
  const locked = attempts >= OTP_MAX_ATTEMPTS;
  return {
    ok: false, reason: locked ? 'LOCKED_NOW' : 'WRONG', left: Math.max(0, OTP_MAX_ATTEMPTS - attempts),
    patch: locked ? { attempts: 0, locked_until: new Date(now + OTP_LOCK_MS).toISOString(), code_hash: '' } : { attempts },
  };
}

// 서명 직전: 인증한 지 15분 안인지
export const otpFreshForSigning = (otp: any, now = Date.now()) => !!otp?.verified_at && now - Date.parse(otp.verified_at) <= SIGN_WINDOW_MS;

// ── 상태 ───────────────────────────────────────────────────────
export const isExpired = (req: any, now = Date.now()) => !!req?.due_at && Date.parse(req.due_at) < now;

// 서명자가 행동할 수 있는 요청인지 (null 이면 가능, 아니면 막는 이유)
export function signerBlock(req: any, userId: string, now = Date.now()) {
  if (!req) return 'NOT_FOUND';
  if (req.status === 'REVOKED') return 'REVOKED';
  if (req.status === 'DECLINED') return 'DECLINED';
  if (req.status === 'COMPLETED') return 'COMPLETED';
  if (req.status === 'EXPIRED' || (req.status === 'OUT' && isExpired(req, now))) return 'EXPIRED';
  if (req.status !== 'OUT') return 'NOT_OUT';
  const s = (req.signers || []).find((x: any) => x.user_id === userId);
  if (!s) return 'NOT_SIGNER';
  if (s.status === 'SIGNED') return 'ALREADY_SIGNED';
  return null;
}

export const BLOCK_TEXT: Record<string, string> = {
  NOT_FOUND: '계약서를 찾을 수 없습니다', REVOKED: '담당자가 회수한 계약서입니다', DECLINED: '수정을 요청한 계약서입니다. 담당자가 고친 계약서를 다시 보내 드립니다',
  COMPLETED: '이미 체결된 계약서입니다', EXPIRED: '서명 기한이 지났습니다. 담당자에게 다시 요청해 주세요', NOT_OUT: '서명할 수 없는 상태입니다',
  NOT_SIGNER: '이 계약서의 서명자로 지정된 계정이 아닙니다', ALREADY_SIGNED: '이미 서명했습니다',
};

// 문서 번호: SG-2026-0012
export const documentNo = (year: number, n: number) => `SG-${year}-${String(n).padStart(4, '0')}`;

// ── 요청 정보 ──────────────────────────────────────────────────
export const maskEmail = (email: string) => {
  const [id, domain] = String(email || '').split('@');
  if (!domain) return '';
  return `${id.slice(0, 2)}${'*'.repeat(Math.max(1, id.length - 2))}@${domain}`;
};
export const maskIp = (ip: string) => {
  const s = String(ip || '');
  if (s.includes('.')) return s.split('.').map((p, i) => (i >= 2 ? '*' : p)).join('.');
  if (s.includes(':')) return `${s.split(':').slice(0, 3).join(':')}:*`;
  return s;
};
export function clientIp(req: Request) {
  const h = req.headers;
  return (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || h.get('cf-connecting-ip') || '';
}
export const userAgent = (req: Request) => String(req.headers.get('user-agent') || '').slice(0, 300);

// base64 → 바이트 (data: 접두어 허용)
export function fromBase64(b64: string) {
  const s = String(b64 || '').replace(/^data:[^,]*,/, '');
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// 감사 추적 표시용 이름
export const EVENT_LABEL: Record<string, string> = {
  SENT: '서명 요청', VIEWED: '열람', READ_TO_END: '본문 끝까지 확인', OTP_SENT: '인증번호 발송', OTP_VERIFIED: '본인 확인', OTP_FAILED: '인증 실패',
  SIGNED: '서명', DECLINED: '수정 요청', REVOKED: '회수', EXPIRED: '기한 지남', COMPLETED: '체결 완료', DOWNLOADED: '완료본 내려받기', REMINDED: '다시 알림', EXTENDED: '기한 연장',
};
