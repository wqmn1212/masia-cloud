// 실시간 디자인 리뷰 방 공용 규칙: 누가 들어올 수 있는지, 손님에게 보낼 모양, 접속자 표시.
// 들어오는 길은 네 가지 — 우리 팀원(로그인), 카드 고객사 계정(로그인), 이메일 초대 링크, 공유 링크 + PIN.

export const PRESENCE_TTL_MS = 15_000;
export const MAX_INVITES = 50;
export const MAX_COMMENT = 2000;
export const COLORS = ['#2563eb', '#db2777', '#16a34a', '#ea580c', '#7c3aed', '#0891b2', '#ca8a04', '#dc2626'];
export const REVIEW_KINDS = ['image', 'pdf'];
const IMAGE = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

export const fileKind = (name: unknown, type: unknown) => {
  const ext = String(type || String(name || '').split('.').pop() || '').toLowerCase().replace(/^\./, '');
  if (IMAGE.includes(ext) || /^image\//.test(ext)) return 'image';
  if (ext === 'pdf' || ext === 'application/pdf') return 'pdf';
  return null;
};

/** 같은 사람은 늘 같은 색 */
export function colorOf(key: string) {
  let h = 0;
  for (const ch of String(key || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

export const cleanEmail = (v: unknown) => {
  const e = String(v || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200 ? e : '';
};

/** 위치 값 정리: 이미지·PDF 는 {page, x, y}(0~1), 3D 는 {point:[x,y,z]} */
export function cleanSpot(input: any, kind: string) {
  if (!input || typeof input !== 'object') return null;
  if (kind === 'model') {
    const p = input.point;
    if (!Array.isArray(p) || p.length !== 3 || !p.every((x: unknown) => Number.isFinite(Number(x)))) return null;
    return { point: p.map((x: unknown) => Math.round(Number(x) * 10) / 10) };
  }
  const x = Number(input.x), y = Number(input.y), page = Math.max(1, Math.min(999, Math.round(Number(input.page) || 1)));
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { page, x: Math.round(x * 10000) / 10000, y: Math.round(y * 10000) / 10000 };
}

/** 손님(이메일·링크)에게는 다른 사람 이메일을 보내지 않는다 */
export function commentView(c: any, guest: boolean) {
  return {
    id: c.id, version: c.version ?? 0, page: c.page ?? null, x: c.x ?? null, y: c.y ?? null, point: c.point || null, part_name: c.part_name || '',
    parent_id: c.parent_id || null, text: c.text, resolved: !!c.resolved, resolved_by: c.resolved_by || '', resolved_at: c.resolved_at || null,
    author_kind: c.author_kind, author_name: c.author_name, author_email: guest ? undefined : c.author_email || '', author_key: c.author_key || '',
    color: colorOf(c.author_key || c.author_name || ''), created_at: c.created_date || c.created_at || null, updated_at: c.updated_date || c.created_date || null,
  };
}

export function roomView(room: any) {
  return {
    id: room.id, title: room.title, kind: room.kind, status: room.status || 'OPEN', card_id: room.card_id,
    versions: (room.versions || []).map((v: any) => ({ v: v.v, file_name: v.file_name, file_type: v.file_type, at: v.at })),
    model: room.kind === 'model' && room.model ? { at: room.model.at, dev: room.model.dev, parts: room.model.parts } : null,
  };
}

export const livePresence = (rows: any[], nowMs: number, exceptSid = '') => rows
  .filter((r) => r.sid !== exceptSid && Date.parse(r.seen_at || '') > nowMs - PRESENCE_TTL_MS)
  .map((r) => ({ sid: r.sid, name: r.name, kind: r.kind, color: r.color, version: r.version ?? null, cursor: r.cursor || null, seen_at: r.seen_at }));

/** 공유 링크 상태 (토큰·PIN 해시는 내보내지 않는다) */
export const linkView = (link: any, nowIso: string) => (link?.on ? { on: true, expires_at: link.expires_at, expired: link.expires_at < nowIso, at: link.at, by: link.by } : { on: false });
export const inviteView = (list: any[]) => (list || []).map((i) => ({ email: i.email, name: i.name || '', at: i.at, by: i.by || '', last_seen_at: i.last_seen_at || null, revoked: !!i.revoked }));
