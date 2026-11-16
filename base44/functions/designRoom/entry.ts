import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { sha256Hex, pinHash, newToken, newPin, validToken, validPin, checkPin } from '../../shared/factoryRequest.ts';
import { modelSnapshot } from '../../shared/protoClient.ts';
import { FROM_NAME, emailBody } from '../../shared/notify.ts';
import { appUrl } from '../../shared/emailLayout.ts';
import {
  MAX_INVITES, MAX_COMMENT, fileKind, colorOf, cleanEmail, cleanSpot, commentView, roomView, livePresence, linkView, inviteView,
} from '../../shared/designRoom.ts';

// 실시간 디자인 리뷰 방 (/design/<방 ID>). 여러 사람이 같은 시안을 보며 핀·댓글을 남기고, 서로의 커서·접속을 본다.
// 직원 (master·service·sub, 같은 팀):
//   create {card_id, attachment_id} | {project_id, snapshot}   방 만들기 (같은 파일·시제품의 열린 방이 있으면 그 방)
//   add_version {room_id, attachment_id}   새 시안 판 올리기 (예전 판은 남는다)
//   update_model {room_id, snapshot}       3D 방의 모형을 지금 설계로 바꾸기
//   set_link {room_id, on, days}           공유 링크 + PIN 새로 만들기(on) · 끄기 — 토큰·PIN 은 이때 한 번만 돌려준다
//   invite {room_id, emails[], note}       이메일 초대 (사람마다 다른 링크)
//   revoke_invite {room_id, email}
//   set_status {room_id, status: OPEN|CLOSED}
//   list {card_id}                         카드의 방 목록 (고객 계정은 고객 공개 방만)
//   share_info {room_id}                   공유 링크 상태와 초대 목록
// 참여자 (직원·카드 고객사 계정·초대 손님·링크 손님 — 손님은 매 요청에 invite 또는 token+pin+name 을 함께 보낸다):
//   join {room_id, sid}                    방 내용·댓글 전체·접속자
//   sync {room_id, sid, since, version, cursor}   내 커서·접속 표시를 남기고, since 뒤로 바뀐 댓글과 지금 접속자를 받는다
//   comment {room_id, version, spot, part_name, parent_id, text}
//   resolve {room_id, comment_id, resolved}
//   file {room_id, v}                      시안 파일 열람 주소 (1시간)
const STAFF = ['master', 'service', 'sub'];
const clip = (s: unknown, n: number) => String(s ?? '').trim().slice(0, n);
const NOT_FOUND = { error: '리뷰 방을 찾을 수 없습니다', code: 'not_found' };
const json = (b: unknown, status = 200) => Response.json(b, { status, headers: { 'Cache-Control': 'no-store' } });

export default async function (req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const now = new Date();
    const nowIso = now.toISOString();
    const action = String(body.action || '');
    const me = await base44.auth.me().catch(() => null);
    const isStaff = !!me && me.is_active !== false && STAFF.includes(me.account_tier);
    const ownTenant = (t: string) => isStaff && (me.account_tier === 'master' || (!!t && t === me.tenant_id));
    const byName = me ? (me.full_name || me.email || '') : '';

    const loadRoom = async (id: unknown) => (typeof id === 'string' && id ? await svc.entities.DesignRoom.get(id).catch(() => null) : null);
    const touch = (room: any, patch: any = {}) => svc.entities.DesignRoom.update(room.id, { ...patch, last_activity_at: nowIso });

    // ── 직원 관리 ──
    if (['create', 'add_version', 'update_model', 'set_link', 'invite', 'revoke_invite', 'set_status', 'share_info'].includes(action)) {
      if (!isStaff) return json({ error: 'Forbidden' }, 403);
      if (action === 'create') {
        if (body.project_id) {
          const p = await svc.entities.ProtoProject.get(String(body.project_id)).catch(() => null);
          if (!p || !ownTenant(p.tenant_id)) return json({ error: '시제품을 찾을 수 없습니다' }, 404);
          if (!p.card_id) return json({ error: '업무 카드에 묶인 시제품만 리뷰 방을 만들 수 있습니다' }, 409);
          let snap;
          try { snap = modelSnapshot(body.snapshot); } catch (e) { return json({ error: String((e as Error).message) }, 400); }
          const model = { at: nowIso, by: byName, ...snap };
          const [open] = (await svc.entities.DesignRoom.filter({ project_id: p.id, kind: 'model' }, '-created_date', 5)).filter((r: any) => r.status !== 'CLOSED');
          if (open) { await touch(open, { model }); return json({ room: roomView({ ...open, model }) }); }
          const room = await svc.entities.DesignRoom.create({ tenant_id: p.tenant_id, card_id: p.card_id, title: `${p.title} · 3D`, kind: 'model', project_id: p.id, model, versions: [], status: 'OPEN', link: { on: false }, invites: [], client_visible: true, comment_count: 0, open_count: 0, last_activity_at: nowIso, created_by_name: byName });
          return json({ room: roomView(room) });
        }
        const card = await svc.entities.TaskCard.get(String(body.card_id || '')).catch(() => null);
        if (!card || !ownTenant(card.tenant_id)) return json({ error: '업무 카드를 찾을 수 없습니다' }, 404);
        const att = await svc.entities.CardAttachment.get(String(body.attachment_id || '')).catch(() => null);
        if (!att || att.card_id !== card.id) return json({ error: '파일을 찾을 수 없습니다' }, 404);
        const ft = fileKind(att.file_name, att.file_type);
        if (!ft) return json({ error: '이미지(PNG·JPG 등)와 PDF 만 실시간 리뷰할 수 있습니다' }, 400);
        const existing = (await svc.entities.DesignRoom.filter({ card_id: card.id, kind: 'file' }, '-created_date', 100))
          .find((r: any) => r.status !== 'CLOSED' && (r.versions || []).some((v: any) => v.attachment_id === att.id));
        if (existing) return json({ room: roomView(existing) });
        const room = await svc.entities.DesignRoom.create({ tenant_id: card.tenant_id, card_id: card.id, title: clip(body.title, 120) || att.file_name, kind: 'file', versions: [{ v: 1, attachment_id: att.id, file_name: att.file_name, file_type: ft, at: nowIso, by: byName }], status: 'OPEN', link: { on: false }, invites: [], client_visible: true, comment_count: 0, open_count: 0, last_activity_at: nowIso, created_by_name: byName });
        return json({ room: roomView(room) });
      }
      const room = await loadRoom(body.room_id);
      if (!room || !ownTenant(room.tenant_id)) return json(NOT_FOUND, 404);
      if (action === 'share_info') return json({ link: linkView(room.link, nowIso), invites: inviteView(room.invites) });
      if (action === 'add_version') {
        if (room.kind !== 'file') return json({ error: '3D 방은 “지금 설계로 갱신”을 쓰세요' }, 400);
        const att = await svc.entities.CardAttachment.get(String(body.attachment_id || '')).catch(() => null);
        if (!att || att.card_id !== room.card_id) return json({ error: '파일을 찾을 수 없습니다' }, 404);
        const ft = fileKind(att.file_name, att.file_type);
        if (!ft) return json({ error: '이미지와 PDF 만 올릴 수 있습니다' }, 400);
        if ((room.versions || []).some((v: any) => v.attachment_id === att.id)) return json({ error: '이미 올린 판입니다' }, 409);
        const versions = [...(room.versions || []), { v: (room.versions || []).length + 1, attachment_id: att.id, file_name: att.file_name, file_type: ft, at: nowIso, by: byName }];
        await touch(room, { versions });
        return json({ room: roomView({ ...room, versions }) });
      }
      if (action === 'update_model') {
        if (room.kind !== 'model') return json({ error: '3D 방이 아닙니다' }, 400);
        let snap;
        try { snap = modelSnapshot(body.snapshot); } catch (e) { return json({ error: String((e as Error).message) }, 400); }
        const model = { at: nowIso, by: byName, ...snap };
        await touch(room, { model });
        return json({ room: roomView({ ...room, model }) });
      }
      if (action === 'set_status') {
        const status = body.status === 'CLOSED' ? 'CLOSED' : 'OPEN';
        await touch(room, { status });
        return json({ ok: true, status });
      }
      if (action === 'set_link') {
        if (body.on === false) { await touch(room, { link: { ...(room.link || {}), on: false, off_at: nowIso, off_by: byName } }); return json({ link: { on: false } }); }
        const days = Math.min(60, Math.max(1, Math.round(Number(body.days) || 14)));
        const token = newToken(), pin = newPin();
        const link = { on: true, token_hash: await sha256Hex(token), pin_hash: await pinHash(token, pin), expires_at: new Date(now.getTime() + days * 86400000).toISOString(), failed_pin_count: 0, locked_until: '', at: nowIso, by: byName };
        await touch(room, { link });
        return json({ link: linkView(link, nowIso), token, pin, url: appUrl(`/design/${room.id}?k=${token}`) });
      }
      if (action === 'revoke_invite') {
        const email = cleanEmail(body.email);
        const invites = (room.invites || []).map((i: any) => (i.email === email ? { ...i, revoked: true, revoked_at: nowIso, revoked_by: byName } : i));
        await touch(room, { invites });
        return json({ invites: inviteView(invites) });
      }
      // invite
      const emails = [...new Set((Array.isArray(body.emails) ? body.emails : String(body.emails || '').split(/[\s,;]+/)).map(cleanEmail).filter(Boolean))].slice(0, 20);
      if (!emails.length) return json({ error: '초대할 이메일을 넣어 주세요' }, 400);
      let invites = [...(room.invites || [])];
      if (invites.filter((i: any) => !i.revoked).length + emails.length > MAX_INVITES) return json({ error: `한 방에 ${MAX_INVITES}명까지 초대할 수 있습니다` }, 400);
      const card = await svc.entities.TaskCard.get(room.card_id).catch(() => null);
      const note = clip(body.note, 500);
      const sent: string[] = [];
      for (const email of emails) {
        const token = newToken();
        const rec = { email, name: clip(body.names?.[email], 40), token_hash: await sha256Hex(token), at: nowIso, by: byName, revoked: false };
        invites = [...invites.filter((i: any) => i.email !== email), rec]; // 다시 초대하면 예전 링크는 더는 열리지 않는다
        const link = `/design/${room.id}?i=${token}`;
        try {
          await svc.integrations.Core.SendEmail({
            to: email, from_name: FROM_NAME, subject: `[AEGIS] ${room.title} 디자인 리뷰에 초대합니다`,
            body: emailBody(`${byName} 님이 디자인 리뷰에 초대했습니다.\n\n${note ? `${note}\n\n` : ''}링크를 열면 계정 없이 바로 들어와 시안을 함께 보며 위치를 찍고 댓글을 남길 수 있습니다. 이 링크는 받으신 분 전용입니다.`, card?.title || room.title, link, { title: `${room.title} 디자인 리뷰 초대`, button: '리뷰 열기', kind: '디자인 리뷰' }),
          });
          sent.push(email);
        } catch (_e) { /* 한 사람 실패가 다른 초대를 막지 않는다 */ }
      }
      await touch(room, { invites });
      return json({ invites: inviteView(invites), sent });
    }

    // ── 방 목록 (직원·고객) ──
    if (action === 'list') {
      const card = await svc.entities.TaskCard.get(String(body.card_id || '')).catch(() => null);
      if (!card) return json({ error: '업무 카드를 찾을 수 없습니다' }, 404);
      const client = !!me && me.account_tier === 'client' && me.is_active !== false && card.client_visible === true && card.client_id === me.company_id;
      if (!ownTenant(card.tenant_id) && !client) return json({ error: 'Forbidden' }, 403);
      const rows = (await svc.entities.DesignRoom.filter({ card_id: card.id }, '-last_activity_at', 100)).filter((r: any) => !client || (r.client_visible !== false && r.status !== 'CLOSED'));
      return json({ rooms: rows.map((r: any) => ({ ...roomView(r), model: undefined, comment_count: r.comment_count || 0, open_count: r.open_count || 0, last_activity_at: r.last_activity_at, link_on: client ? undefined : !!r.link?.on && r.link.expires_at > nowIso })) });
    }

    // ── 참여자 ──
    if (!['join', 'sync', 'comment', 'resolve', 'file'].includes(action)) return json({ error: '알 수 없는 요청입니다' }, 400);
    const room = await loadRoom(body.room_id);
    if (!room) return json(NOT_FOUND, 404);
    // 누구인지 정한다: 초대 링크 → 공유 링크 + PIN → 로그인 계정
    let who: { kind: string; name: string; email: string; key: string; manage: boolean } | null = null;
    if (body.invite !== undefined) {
      if (!validToken(body.invite)) return json(NOT_FOUND, 404);
      const h = await sha256Hex(body.invite);
      const inv = (room.invites || []).find((i: any) => i.token_hash === h);
      if (!inv || inv.revoked) return json({ error: '초대가 취소되었거나 새 초대 메일로 바뀌었습니다. 가장 최근 메일의 링크를 열어 주세요', code: 'invite_revoked' }, 403);
      who = { kind: 'guest', name: inv.name || inv.email.split('@')[0], email: inv.email, key: `inv:${inv.email}`, manage: false };
      if (action === 'join') await svc.entities.DesignRoom.update(room.id, { invites: (room.invites || []).map((i: any) => (i.token_hash === h ? { ...i, last_seen_at: nowIso } : i)) });
    } else if (body.token !== undefined) {
      const link = room.link || {};
      if (!validToken(body.token) || !link.on || link.token_hash !== await sha256Hex(body.token)) return json({ error: '링크가 꺼졌거나 새 링크로 바뀌었습니다. 담당자에게 새 링크를 받아 주세요', code: 'link_off' }, 403);
      if (link.expires_at < nowIso) return json({ error: '링크 기한이 지났습니다. 담당자에게 새 링크를 받아 주세요', code: 'expired' }, 410);
      if (body.pin === undefined) return json({ needs_pin: true, title: room.title });
      if (!validPin(body.pin)) return json({ error: 'PIN 6자리를 넣어 주세요', code: 'bad_pin' }, 400);
      const pin = checkPin(link, (await pinHash(body.token, body.pin)) === link.pin_hash, now);
      if (pin.patch) await svc.entities.DesignRoom.update(room.id, { link: { ...link, ...pin.patch } });
      if (!pin.ok) return json(pin.locked ? { error: 'PIN을 여러 번 틀려 잠겼습니다. 30분 뒤 다시 해 주세요', code: 'locked' } : { error: `PIN이 맞지 않습니다 (${pin.left}번 남음)`, code: 'wrong_pin' }, 403);
      const name = clip(body.name, 30);
      if (!name) return json({ error: '이름을 넣어 주세요', code: 'need_name' }, 400);
      who = { kind: 'guest', name, email: '', key: `link:${name}`, manage: false };
    } else if (me && ownTenant(room.tenant_id)) {
      who = { kind: 'staff', name: byName, email: me.email || '', key: `user:${me.id}`, manage: true };
    } else if (me && me.account_tier === 'client' && me.is_active !== false && room.client_visible !== false) {
      const card = await svc.entities.TaskCard.get(room.card_id).catch(() => null);
      if (card && card.client_visible === true && card.client_id === me.company_id) who = { kind: 'client', name: byName, email: me.email || '', key: `user:${me.id}`, manage: false };
    }
    if (!who) return json(me ? { error: '이 리뷰 방에 들어올 권한이 없습니다', code: 'forbidden' } : { error: '로그인하거나 받으신 링크로 들어와 주세요', code: 'login' }, me ? 403 : 401);
    const guest = who.kind === 'guest';
    if (room.status === 'CLOSED' && who.kind !== 'staff') return json({ error: '리뷰가 끝난 방입니다', code: 'closed' }, 410);
    const sid = clip(body.sid, 64).replace(/[^A-Za-z0-9_-]/g, '');
    const color = colorOf(who.key);
    const comments = async () => svc.entities.DesignComment.filter({ room_id: room.id }, 'created_date', 2000);
    const presence = async () => livePresence(await svc.entities.DesignPresence.filter({ room_id: room.id }, '-seen_at', 200), now.getTime(), sid);
    const writePresence = async (cursor: unknown) => {
      if (!sid) return;
      const [row] = await svc.entities.DesignPresence.filter({ room_id: room.id, sid }, '-seen_at', 1);
      const cur = cursor === undefined ? undefined : (cleanSpot(cursor, room.kind) || null);
      const ver = Number.isFinite(Number(body.version)) ? Number(body.version) : null;
      const stale = !row || Date.parse(row.seen_at || '') < now.getTime() - 5000;
      const moved = cur !== undefined && JSON.stringify(cur) !== JSON.stringify(row?.cursor ?? null);
      if (!stale && !moved && row?.version === ver && row?.name === who!.name) return;
      const patch = { name: who!.name, kind: who!.kind, color, version: ver, seen_at: nowIso, ...(cur !== undefined ? { cursor: cur } : {}) };
      if (row) await svc.entities.DesignPresence.update(row.id, patch);
      else await svc.entities.DesignPresence.create({ tenant_id: room.tenant_id, room_id: room.id, sid, cursor: null, ...patch });
    };

    if (action === 'join') {
      await writePresence(null);
      return json({ room: roomView(room), me: { kind: who.kind, name: who.name, color, key: who.key, manage: who.manage }, comments: (await comments()).map((c: any) => commentView(c, guest)), presence: await presence(), now: nowIso });
    }
    if (action === 'sync') {
      await writePresence(body.cursor);
      const since = typeof body.since === 'string' ? body.since : '';
      const changed = (await comments()).filter((c: any) => !since || (c.changed_at || c.created_date || '') >= since);
      const fresh = await loadRoom(room.id);
      return json({ comments: changed.map((c: any) => commentView(c, guest)), presence: await presence(), versions: (fresh?.versions || []).length, model_at: fresh?.model?.at || null, status: fresh?.status || 'OPEN', now: nowIso });
    }
    if (action === 'file') {
      const ver = (room.versions || []).find((v: any) => v.v === Number(body.v)) || (room.versions || []).at(-1);
      if (!ver) return json({ error: '시안 파일이 없습니다' }, 404);
      const att = await svc.entities.CardAttachment.get(ver.attachment_id).catch(() => null);
      if (!att) return json({ error: '시안 파일을 찾을 수 없습니다' }, 404);
      const url = /^https?:\/\//i.test(att.file_url || '') ? att.file_url : (await svc.integrations.Core.CreateFileSignedUrl({ file_uri: att.file_url, expires_in: 3600 })).signed_url;
      return json({ url, v: ver.v, file_type: ver.file_type });
    }
    if (room.status === 'CLOSED') return json({ error: '리뷰가 끝난 방입니다. 다시 열어야 댓글을 남길 수 있습니다', code: 'closed' }, 410);
    const recount = async () => {
      const all = await comments();
      const tops = all.filter((c: any) => !c.parent_id);
      await touch(room, { comment_count: all.length, open_count: tops.filter((c: any) => !c.resolved).length });
    };
    if (action === 'comment') {
      const text = clip(body.text, MAX_COMMENT);
      if (!text) return json({ error: '댓글을 적어 주세요' }, 400);
      let parent = null;
      if (body.parent_id) {
        parent = await svc.entities.DesignComment.get(String(body.parent_id)).catch(() => null);
        if (!parent || parent.room_id !== room.id) return json({ error: '답글을 달 댓글을 찾을 수 없습니다' }, 404);
        if (parent.parent_id) parent = await svc.entities.DesignComment.get(parent.parent_id).catch(() => parent);
      }
      const spot = parent ? null : cleanSpot(body.spot, room.kind);
      const version = room.kind === 'model' ? 0 : Math.max(1, Math.min((room.versions || []).length, Math.round(Number(body.version) || (room.versions || []).length)));
      const c = await svc.entities.DesignComment.create({
        tenant_id: room.tenant_id, room_id: room.id, version: parent ? parent.version : version, parent_id: parent ? parent.id : '', text,
        ...(spot && 'point' in spot ? { point: spot.point, part_name: clip(body.part_name, 80) } : spot ? { page: spot.page, x: spot.x, y: spot.y } : {}),
        resolved: false, author_kind: who.kind, author_name: who.name, author_email: who.email, author_key: who.key, changed_at: nowIso,
      });
      await recount();
      return json({ comment: commentView(c, guest) });
    }
    // resolve: 직원·고객은 누구 댓글이든, 손님은 자기 댓글만
    const c = await svc.entities.DesignComment.get(String(body.comment_id || '')).catch(() => null);
    if (!c || c.room_id !== room.id || c.parent_id) return json({ error: '댓글을 찾을 수 없습니다' }, 404);
    if (guest && c.author_key !== who.key) return json({ error: '내가 쓴 댓글만 해결로 바꿀 수 있습니다' }, 403);
    const resolved = body.resolved !== false;
    const updated = await svc.entities.DesignComment.update(c.id, resolved ? { resolved: true, resolved_by: who.name, resolved_at: nowIso, changed_at: nowIso } : { resolved: false, resolved_by: '', resolved_at: '', changed_at: nowIso });
    await recount();
    return json({ comment: commentView({ ...c, ...updated }, guest) });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
}
