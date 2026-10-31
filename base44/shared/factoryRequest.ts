// 공장 업로드 링크 (4단계 ②). 공장 담당자가 계정 없이 링크 + PIN 6자리로 사진·서류·답·견적서를 올리고, 직원이 채택하거나 재요청한다.
//  - 견적서(QUOTE)는 올라오면 서버가 읽어 견적 초안을 만든다 (factoryQuote.ts · importFactoryQuote).
//  - 링크 토큰(32바이트)과 PIN은 해시로만 저장한다. 원문은 만들 때 한 번만 직원에게 돌려준다.
//  - PIN 5번 틀리면 30분 잠금. 링크 기본 14일, 직원이 연장·회수할 수 있다.
//  - 공장에게 보이는 것은 factoryView 가 고른 필드뿐이다 (고객사명·금액·다른 공장 없음).
// 화면 src/lib/factoryRequest.js 가 같은 목록·상태 규칙을 쓴다. 검산: npm run check:factory-request
export const ITEM_KINDS = ['PHOTO', 'DOC', 'ANSWER', 'MILESTONE', 'QUOTE'];
export const KIND_LABEL: Record<string, { ko: string; cn: string }> = {
  PHOTO: { ko: '진행 사진', cn: '照片' },
  DOC: { ko: '서류', cn: '文件' },
  ANSWER: { ko: '질문 답변', cn: '回答问题' },
  MILESTONE: { ko: '완료 보고', cn: '完成报告' },
  QUOTE: { ko: '견적서', cn: '报价单' },
};
// 서류 항목을 채택할 때 카드 파일의 문서 종류 (CardAttachment.document_type)
export const DOC_TYPES = ['GENERAL', 'INVOICE_CI', 'INVOICE_PI', 'PACKING_LIST', 'CERT_ORIGIN', 'QUOTATION', 'TEST_REPORT', 'CERTIFICATE', 'SPEC_SHEET'];
export const DEFAULT_DAYS = 14;
export const MAX_DAYS = 60;
export const MAX_ITEMS = 20;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const DAILY_SUBMIT_LIMIT = 100;
export const PIN_TRIES = 5;
export const LOCK_MINUTES = 30;
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'gif', 'pdf', 'xls', 'xlsx', 'csv', 'docx'];

const clean = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const DAY = 86400000;

export const extOf = (name: string) => (String(name || '').split('.').pop() || '').toLowerCase();
export const fileAllowed = (name: string, bytes: number) => {
  if (!ALLOWED_EXT.includes(extOf(name))) return '사진·PDF·엑셀·워드(.docx)만 올릴 수 있습니다 / 仅支持照片、PDF、Excel、Word(.docx)';
  if (!(bytes > 0)) return '빈 파일입니다 / 文件为空';
  if (bytes > MAX_FILE_BYTES) return '파일은 10MB 이하여야 합니다 / 文件不能超过10MB';
  return '';
};

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
export async function sha256Hex(text: string) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}
// PIN 해시는 토큰과 묶어 같은 PIN이라도 링크마다 다르게 저장한다
export const pinHash = (token: string, pin: string) => sha256Hex(`${token}:${pin}`);
export function newToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function newPin() {
  // 균등하게 000000~999999 (거부 샘플링)
  const max = 4294967296 - (4294967296 % 1000000);
  let n = 0;
  do { n = crypto.getRandomValues(new Uint32Array(1))[0]; } while (n >= max);
  return String(n % 1000000).padStart(6, '0');
}
export const validToken = (t: unknown) => typeof t === 'string' && /^[A-Za-z0-9_-]{40,64}$/.test(t);
export const validPin = (p: unknown) => typeof p === 'string' && /^\d{6}$/.test(p);

/**
 * 직원이 고른 항목을 정리한다. 마일스톤·사전 QC 질문은 그 카드에 실제로 있는 것만 받는다.
 * input: [{ kind, label_ko, label_cn, milestone_id?, precheck_item_key?, doc_type? }]
 */
export function cleanItems(input: unknown, { milestones = [], precheckKeys = [] }: { milestones?: any[]; precheckKeys?: string[] } = {}) {
  const out: any[] = [];
  const seen = new Set<string>();
  for (const raw of (Array.isArray(input) ? input : []).slice(0, MAX_ITEMS)) {
    const kind = ITEM_KINDS.includes(raw?.kind) ? raw.kind : '';
    if (!kind) continue;
    const ms = kind === 'MILESTONE' ? milestones.find((m: any) => m.id === raw.milestone_id) : null;
    if (kind === 'MILESTONE' && !ms) continue;
    const pk = kind === 'ANSWER' && precheckKeys.includes(raw?.precheck_item_key) ? raw.precheck_item_key : '';
    const label_ko = clean(raw.label_ko, 200) || (ms ? `${ms.label} 완료 보고` : '');
    const label_cn = clean(raw.label_cn, 200) || (ms ? `${ms.label_cn || ms.label} 完成报告` : '');
    if (!label_ko && !label_cn) continue;
    const dedupe = `${kind}:${ms?.id || pk || label_ko || label_cn}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({
      key: `i${out.length + 1}`,
      kind,
      label_ko: label_ko || label_cn,
      label_cn: label_cn || label_ko,
      note_cn: clean(raw.note_cn, 300),
      milestone_id: ms?.id || '',
      precheck_item_key: pk,
      doc_type: kind === 'QUOTE' ? 'QUOTATION' : kind === 'DOC' && DOC_TYPES.includes(raw?.doc_type) ? raw.doc_type : (kind === 'DOC' ? 'GENERAL' : ''),
      status: 'WAITING',
      redo_reason: '',
    });
  }
  return out;
}

// 지금 상태: 기한이 지나면 EXPIRED (저장값이 OPEN 이어도), 모든 항목을 채택하면 DONE
export function effectiveStatus(req: any, now = new Date().toISOString()) {
  if (!req) return 'MISSING';
  if (req.status === 'REVOKED') return 'REVOKED';
  const items = req.items || [];
  if (items.length && items.every((i: any) => i.status === 'ACCEPTED')) return 'DONE';
  if (req.expires_at && now > req.expires_at) return 'EXPIRED';
  return 'OPEN';
}
export function counts(req: any) {
  const c = { WAITING: 0, SUBMITTED: 0, ACCEPTED: 0, REDO: 0 } as Record<string, number>;
  for (const i of req?.items || []) c[i.status] = (c[i.status] || 0) + 1;
  return { waiting: c.WAITING, submitted: c.SUBMITTED, accepted: c.ACCEPTED, redo: c.REDO, open: c.WAITING + c.REDO, total: (req?.items || []).length };
}

/**
 * PIN 확인. 잠금 중이면 바로 거절하고, 틀리면 실패 수를 올려 5번째에 30분 잠근다.
 * 돌려주는 patch 를 저장해야 실패 수·잠금이 남는다.
 */
export function checkPin(req: any, ok: boolean, now = new Date()) {
  const iso = now.toISOString();
  if (req.locked_until && iso < req.locked_until) return { ok: false, locked: true, locked_until: req.locked_until, patch: null };
  if (ok) return { ok: true, locked: false, patch: (req.failed_pin_count || req.locked_until) ? { failed_pin_count: 0, locked_until: '' } : null };
  const failed = (req.locked_until && iso >= req.locked_until ? 0 : Number(req.failed_pin_count) || 0) + 1;
  if (failed >= PIN_TRIES) {
    const until = new Date(now.getTime() + LOCK_MINUTES * 60000).toISOString();
    return { ok: false, locked: true, locked_until: until, left: 0, patch: { failed_pin_count: failed, locked_until: until } };
  }
  return { ok: false, locked: false, left: PIN_TRIES - failed, patch: { failed_pin_count: failed, locked_until: '' } };
}

// 공장에게 보여 줄 것만. 제품명은 공장용 이름(중국어 제목)을 먼저 쓴다
export function factoryView(req: any, card: any, now = new Date().toISOString()) {
  const status = effectiveStatus(req, now);
  const subs = req.submissions || [];
  return {
    status,
    product: clean(card?.title_cn, 200) || clean(card?.title, 200),
    factory: clean(req.factory_name, 200),
    expires_at: req.expires_at || '',
    message_cn: clean(req.message_cn, 1000),
    items: (req.items || []).map((i: any) => ({
      key: i.key,
      kind: i.kind,
      label_cn: i.label_cn,
      label_ko: i.label_ko,
      note_cn: i.note_cn || '',
      status: i.status,
      redo_reason: i.status === 'REDO' ? i.redo_reason || '' : '',
      submitted: subs.filter((s: any) => s.item_key === i.key).map((s: any) => ({ name: s.file_name || '', answer: s.answer || '', at: s.submitted_at })),
    })),
  };
}

// 하루 제출 수 (한국 날짜 기준이 아니라 지난 24시간)
export const submissionsLastDay = (req: any, now = new Date()) => (req.submissions || []).filter((s: any) => now.getTime() - Date.parse(s.submitted_at) < DAY).length;

/**
 * 항목 하나에 제출. 사진·서류는 파일이 있어야 하고, 질문 답변은 글이 있어야 한다. 완료 보고는 글 또는 사진.
 * 채택된 항목에는 더 올릴 수 없다. 돌려주는 patch 를 저장한다.
 */
export function submitPatch(req: any, itemKey: string, { file_name = '', file_uri = '', answer = '' }: any, now = new Date()) {
  const status = effectiveStatus(req, now.toISOString());
  if (status !== 'OPEN') return { error: status === 'EXPIRED' ? '링크 기한이 지났습니다 / 链接已过期' : '이 링크는 더 이상 쓸 수 없습니다 / 此链接已失效' };
  const item = (req.items || []).find((i: any) => i.key === itemKey);
  if (!item) return { error: '항목을 찾을 수 없습니다 / 找不到该项目' };
  if (item.status === 'ACCEPTED') return { error: '이미 확인된 항목입니다 / 该项目已确认' };
  const text = clean(answer, 2000);
  if ((item.kind === 'PHOTO' || item.kind === 'DOC') && !file_uri) return { error: '파일을 올려 주세요 / 请上传文件' };
  if (item.kind === 'QUOTE' && !file_uri) return { error: '견적서 파일을 올려 주세요 / 请上传报价单文件' };
  if (item.kind === 'ANSWER' && !text && !file_uri) return { error: '답을 적어 주세요 / 请填写回答' };
  if (item.kind === 'MILESTONE' && !text && !file_uri) return { error: '완료 내용이나 사진을 올려 주세요 / 请填写完成情况或上传照片' };
  if (submissionsLastDay(req, now) >= DAILY_SUBMIT_LIMIT) return { error: '오늘 올릴 수 있는 수를 넘었습니다. 내일 다시 올려 주세요 / 今日上传次数已达上限' };
  const sub = { item_key: itemKey, file_name: clean(file_name, 200), file_uri, answer: text, submitted_at: now.toISOString(), review: '' };
  return {
    item,
    patch: {
      submissions: [...(req.submissions || []), sub],
      items: req.items.map((i: any) => (i.key === itemKey ? { ...i, status: 'SUBMITTED', redo_reason: i.status === 'REDO' ? i.redo_reason : '' } : i)),
      last_submitted_at: now.toISOString(),
      ...(item.kind === 'QUOTE' ? { quote_import_pending: true } : {}),
    },
  };
}

/**
 * 직원 검토: ACCEPT 이면 아직 검토하지 않은 그 항목의 제출물을 채택하고, REDO 이면 사유와 함께 다시 요청한다.
 * accepted 는 채택된 제출물들 (파일·마일스톤·사전 QC 반영에 쓴다).
 */
export function reviewPatch(req: any, itemKey: string, decision: string, reason = '', by = '', now = new Date().toISOString()) {
  const item = (req.items || []).find((i: any) => i.key === itemKey);
  if (!item) return { error: '항목을 찾을 수 없습니다' };
  if (!['ACCEPT', 'REDO'].includes(decision)) return { error: '채택 또는 재요청을 고르세요' };
  if (item.status !== 'SUBMITTED') return { error: '확인할 제출물이 없습니다' };
  const why = clean(reason, 500);
  if (decision === 'REDO' && !why) return { error: '재요청 사유를 적어 주세요 (공장에 보입니다)' };
  const fresh = (req.submissions || []).filter((s: any) => s.item_key === itemKey && !s.review);
  const mark = decision === 'ACCEPT' ? 'ACCEPTED' : 'REDO';
  return {
    item,
    accepted: decision === 'ACCEPT' ? fresh : [],
    patch: {
      items: req.items.map((i: any) => (i.key === itemKey ? { ...i, status: mark, redo_reason: decision === 'REDO' ? why : '', reviewed_by_name: by, reviewed_at: now } : i)),
      submissions: (req.submissions || []).map((s: any) => (s.item_key === itemKey && !s.review ? { ...s, review: mark } : s)),
    },
  };
}

// 위챗으로 보낼 중국어 안내 (링크와 PIN 포함). PIN은 만들 때 한 번만 알 수 있다
export function inviteText({ link, pin, product, expires_at, items }: any) {
  const lines = [
    '您好！请通过下面的链接上传资料，不需要注册账号。',
    `产品：${product || ''}`,
    `链接：${link}`,
    `验证码（PIN）：${pin}`,
    `截止日期：${String(expires_at || '').slice(0, 10)}`,
  ];
  if (items?.length) lines.push('需要提交：', ...items.map((i: any, n: number) => `${n + 1}. ${i.label_cn || i.label_ko}`));
  lines.push('可以分多次上传，用同一个链接继续即可。谢谢！');
  return lines.join('\n');
}
