import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { sha256Hex, pinHash, newToken, newPin, cleanItems, reviewPatch, effectiveStatus, DEFAULT_DAYS, MAX_DAYS } from '../../shared/factoryRequest.ts';

// 직원: 공장 업로드 링크 만들기·검토.
//  'create'  {card_id, items, days?, message_cn?} → 링크 토큰과 PIN을 이때 한 번만 돌려준다
//  'review'  {request_id, item_key, decision: ACCEPT|REDO, reason?, client_visible?} → 채택하면 카드 파일·마일스톤·사전 QC에 반영
//  'extend'  {request_id, days} · 'revoke' {request_id}
//  'reissue' {request_id} → 새 토큰·PIN (이전 링크는 바로 막힘). 링크나 PIN을 잃어버렸을 때
const DAY = 86400000;
const plusDays = (from: number, days: number) => new Date(from + days * DAY).toISOString();

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_active === false || !['master', 'service', 'sub'].includes(user.account_tier)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole;
    const by = user.full_name || user.email || '';
    const now = new Date();
    const staffCan = (card: any) => !!card && (user.account_tier === 'master' || (!!user.tenant_id && card.tenant_id === user.tenant_id));
    const audit = async (card: any, event_type: string, details: string) => {
      try { await svc.entities.ProjectAuditLog.create({ tenant_id: card.tenant_id, card_id: card.id, event_type, actor_id: user.id, actor_name: by, details }); } catch (_e) { /* 기록 실패가 요청을 막지 않는다 */ }
    };
    const days = (v: unknown, dflt: number) => Math.min(MAX_DAYS, Math.max(1, Math.round(Number(v) || dflt)));

    if (body.action === 'create') {
      const card = typeof body.card_id === 'string' ? await svc.entities.TaskCard.get(body.card_id).catch(() => null) : null;
      if (!staffCan(card)) return Response.json({ error: '카드에 접근할 수 없습니다' }, { status: 403 });
      const milestones = (await svc.entities.CardMilestone.filter({ card_id: card.id }, 'seq', 100)).filter((m: any) => m.card_id === card.id);
      const [precheck] = await svc.entities.QCPrecheck.filter({ card_id: card.id }, '-version', 1);
      const precheckKeys = (precheck?.items || []).filter((i: any) => i.kind === 'QUESTION' && i.decision !== 'DISMISSED').map((i: any) => i.key);
      const items = cleanItems(body.items, { milestones, precheckKeys });
      if (!items.length) return Response.json({ error: '공장에 받을 항목을 하나 이상 고르세요' }, { status: 400 });
      const token = newToken(), pin = newPin();
      const request = await svc.entities.FactoryRequest.create({
        tenant_id: card.tenant_id, card_id: card.id, factory_id: card.factory_id || '', factory_name: card.factory_name || '',
        token_hash: await sha256Hex(token), pin_hash: await pinHash(token, pin),
        expires_at: plusDays(now.getTime(), days(body.days, DEFAULT_DAYS)), status: 'OPEN',
        message_cn: typeof body.message_cn === 'string' ? body.message_cn.trim().slice(0, 1000) : '',
        items, submissions: [], failed_pin_count: 0, created_by_name: by,
      });
      await audit(card, 'FACTORY_REQUEST_CREATED', `공장 업로드 링크 생성 · ${items.length}개 항목`);
      return Response.json({ ok: true, request_id: request.id, token, pin, expires_at: request.expires_at, items });
    }

    const request = typeof body.request_id === 'string' ? await svc.entities.FactoryRequest.get(body.request_id).catch(() => null) : null;
    const card = request ? await svc.entities.TaskCard.get(request.card_id).catch(() => null) : null;
    if (!request || !staffCan(card)) return Response.json({ error: '공장 요청을 찾을 수 없습니다' }, { status: 404 });

    if (body.action === 'review') {
      const out = reviewPatch(request, typeof body.item_key === 'string' ? body.item_key : '', body.decision, body.reason, by, now.toISOString());
      if (out.error) return Response.json({ error: out.error }, { status: 400 });
      const item = out.item;
      const patch: any = out.patch;
      if (body.decision === 'ACCEPT') {
        const visible = body.client_visible === true;
        const files = out.accepted.filter((s: any) => s.file_uri);
        const made: Record<string, string> = {};
        for (const s of files) {
          const att = await svc.entities.CardAttachment.create({
            tenant_id: card.tenant_id, card_id: card.id, client_visible: visible,
            document_type: item.kind === 'DOC' ? item.doc_type || 'GENERAL' : 'GENERAL',
            file_name: s.file_name, file_type: (s.file_name.split('.').pop() || '').toLowerCase(), file_url: s.file_uri,
            uploader_name: `공장 · ${request.factory_name || '업로드 링크'}`, factory_request_id: request.id,
          });
          made[s.submitted_at + s.file_uri] = att?.id || '';
        }
        patch.submissions = patch.submissions.map((s: any) => (made[s.submitted_at + s.file_uri] ? { ...s, attachment_id: made[s.submitted_at + s.file_uri] } : s));
        const text = out.accepted.map((s: any) => s.answer).filter(Boolean).join('\n');
        if (item.kind === 'MILESTONE' && item.milestone_id) {
          await svc.entities.CardMilestone.update(item.milestone_id, { factory_reported_at: now.toISOString(), factory_report_note: (text || `사진 ${files.length}장`).slice(0, 2000) }).catch(() => null);
        }
        if (item.kind === 'ANSWER' && item.precheck_item_key && text) {
          const [precheck] = await svc.entities.QCPrecheck.filter({ card_id: card.id }, '-version', 1);
          if (precheck?.items?.some((i: any) => i.key === item.precheck_item_key)) {
            await svc.entities.QCPrecheck.update(precheck.id, { items: precheck.items.map((i: any) => (i.key === item.precheck_item_key ? { ...i, factory_answer: text.slice(0, 2000), factory_answered_at: now.toISOString() } : i)) });
          }
        }
      }
      const items = patch.items;
      if (items.every((i: any) => i.status === 'ACCEPTED')) patch.status = 'DONE';
      await svc.entities.FactoryRequest.update(request.id, patch);
      await audit(card, body.decision === 'ACCEPT' ? 'FACTORY_SUBMISSION_ACCEPTED' : 'FACTORY_SUBMISSION_REDO', `${item.label_ko}${body.decision === 'REDO' ? ` 재요청: ${patch.items.find((i: any) => i.key === item.key)?.redo_reason}` : ' 채택'}`);
      return Response.json({ ok: true });
    }

    if (body.action === 'extend') {
      if (request.status === 'REVOKED') return Response.json({ error: '회수한 링크는 연장할 수 없습니다. 새 링크를 만드세요' }, { status: 409 });
      const base = Math.max(now.getTime(), Date.parse(request.expires_at) || 0);
      const expires_at = new Date(Math.min(base + days(body.days, 7) * DAY, now.getTime() + MAX_DAYS * DAY)).toISOString();
      await svc.entities.FactoryRequest.update(request.id, { expires_at, ...(request.status === 'DONE' ? {} : { status: 'OPEN' }) });
      return Response.json({ ok: true, expires_at });
    }
    if (body.action === 'revoke') {
      await svc.entities.FactoryRequest.update(request.id, { status: 'REVOKED', revoked_by_name: by });
      await audit(card, 'FACTORY_REQUEST_REVOKED', '공장 업로드 링크 회수');
      return Response.json({ ok: true });
    }
    if (body.action === 'reissue') {
      if (effectiveStatus(request, now.toISOString()) === 'DONE') return Response.json({ error: '모든 항목을 채택한 요청입니다' }, { status: 409 });
      const token = newToken(), pin = newPin();
      const expires_at = request.status === 'REVOKED' || Date.parse(request.expires_at) < now.getTime() ? plusDays(now.getTime(), DEFAULT_DAYS) : request.expires_at;
      await svc.entities.FactoryRequest.update(request.id, { token_hash: await sha256Hex(token), pin_hash: await pinHash(token, pin), failed_pin_count: 0, locked_until: '', status: 'OPEN', expires_at });
      await audit(card, 'FACTORY_REQUEST_REISSUED', '공장 업로드 링크·PIN 다시 만듦 (이전 링크 막힘)');
      return Response.json({ ok: true, token, pin, expires_at });
    }
    return Response.json({ error: '지원하지 않는 동작입니다' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
