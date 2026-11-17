import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireClient, cardVisibleToClient } from '../../shared/clientAccess.ts';
import { notifyUsers, internalUsersOfTenant, clientUsersOfCompany } from '../../shared/notify.ts';
import { uploadPrivateAttachments, linkCardAttachments } from '../../shared/privateAttachments.ts';
import { TEMPLATES, cleanItems, requestView, progressOf } from '../../shared/clientRequest.ts';

// 고객 자료 요청 체크리스트
// 직원 (같은 팀): templates · create {card_id, template, title, note, due_date, items} · list {card_id} · review {id, key, decision: ACCEPTED|REDO, note} · close {id} · reopen {id} · set_remind {id, auto_remind} · file {id, key, idx}
// 고객 (카드가 공개된 고객사): list {card_id} · submit {id, key, answer, attachments[]} · file {id, key, idx}
// 고객이 올린 파일은 카드 파일 탭에도 고객 공개로 남는다. 자료는 지우지 않고, 다시 올리면 쌓인다.
const STAFF = ['master', 'service', 'sub'];
const clip = (s: unknown, n: number) => String(s ?? '').trim().slice(0, n);
const json = (b: unknown, status = 200) => Response.json(b, { status });

export default async function (req: Request) {
  try {
    const body = await req.clone().json().catch(() => ({}));
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const nowIso = new Date().toISOString();
    const me = await base44.auth.me().catch(() => null);
    if (!me) return json({ error: 'Unauthorized' }, 401);
    const action = String(body.action || '');
    const isStaff = me.is_active !== false && STAFF.includes(me.account_tier);
    const name = me.full_name || me.email || '';

    if (action === 'templates') return json({ templates: Object.entries(TEMPLATES).map(([k, t]) => ({ key: k, ...t })) });

    // 카드 확인: 직원은 같은 팀, 고객은 공개된 자기 회사 카드 (직원 미리보기는 view_company_id)
    let card: any = null, client = false, companyId = '';
    const loadCard = async (id: unknown) => (typeof id === 'string' && id ? await svc.entities.TaskCard.get(id).catch(() => null) : null);
    let reqRow: any = null;
    if (body.id) {
      reqRow = await svc.entities.ClientRequest.get(String(body.id)).catch(() => null);
      if (!reqRow) return json({ error: '자료 요청을 찾을 수 없습니다' }, 404);
      card = await loadCard(reqRow.card_id);
    } else card = await loadCard(body.card_id);
    if (!card) return json({ error: '업무 카드를 찾을 수 없습니다' }, 404);
    if (isStaff && (me.account_tier === 'master' || card.tenant_id === me.tenant_id) && !body.view_company_id) {
      // 직원
    } else {
      const auth = await requireClient(base44, ['list', 'file'].includes(action) ? req : undefined);
      if (auth.error) return auth.error;
      if (!cardVisibleToClient(card, auth.companyId)) return json({ error: 'Forbidden' }, 403);
      client = true; companyId = auth.companyId;
    }

    if (action === 'list') {
      const rows = await svc.entities.ClientRequest.filter({ card_id: card.id }, '-created_date', 50);
      return json({ requests: rows.map(requestView) });
    }
    if (action === 'file') {
      const item = (reqRow?.items || []).find((x: any) => x.key === body.key);
      const f = item?.files?.[Number(body.idx)];
      if (!f) return json({ error: '파일을 찾을 수 없습니다' }, 404);
      const r = await svc.integrations.Core.CreateFileSignedUrl({ file_uri: f.uri, expires_in: 600 });
      return json({ url: r.signed_url, name: f.name });
    }

    if (!client) {
      if (action === 'create') {
        const t = TEMPLATES[String(body.template)] || TEMPLATES.custom;
        const items = cleanItems(Array.isArray(body.items) ? body.items : t.items);
        if (!items.length) return json({ error: '요청할 항목을 하나 이상 넣어 주세요' }, 400);
        const due = /^\d{4}-\d{2}-\d{2}$/.test(String(body.due_date || '')) ? body.due_date : '';
        const row = await svc.entities.ClientRequest.create({ tenant_id: card.tenant_id, card_id: card.id, title: clip(body.title, 80) || t.title, template: String(body.template || 'custom'), note: clip(body.note ?? t.note, 1000), due_date: due, items, status: 'OPEN', created_by_name: name, sent_at: nowIso });
        let notified = false;
        if (card.client_visible === true && card.client_id) {
          await notifyUsers(svc, await clientUsersOfCompany(svc, card.client_id), { type: 'client_request', title: `[자료 요청] ${card.title} · ${row.title}`, body: `${items.length}개 항목을 요청드립니다${due ? ` (회신 기한 ${due})` : ''}. 프로젝트 화면 "진행 정보" 맨 위에서 항목마다 파일이나 답을 올려 주세요.`, link: `/client/board?card=${card.id}&tab=overview`, task_card_id: card.id, card_title: card.title }).catch(() => 0);
          notified = true;
        }
        return json({ request: requestView(row), notified });
      }
      if (!reqRow) return json({ error: '자료 요청을 찾을 수 없습니다' }, 404);
      if (action === 'close' || action === 'reopen') {
        await svc.entities.ClientRequest.update(reqRow.id, action === 'close' ? { status: 'CLOSED', closed_at: nowIso } : { status: 'OPEN' });
        return json({ ok: true });
      }
      if (action === 'set_remind') {
        await svc.entities.ClientRequest.update(reqRow.id, { auto_remind: !!body.auto_remind });
        return json({ request: requestView({ ...reqRow, auto_remind: !!body.auto_remind }) });
      }
      if (action === 'review') {
        if (!['ACCEPTED', 'REDO'].includes(body.decision)) return json({ error: '확인 또는 다시 요청을 고르세요' }, 400);
        const note = clip(body.note, 500);
        if (body.decision === 'REDO' && !note) return json({ error: '다시 요청하는 이유를 적어 주세요' }, 400);
        let found = false;
        const items = (reqRow.items || []).map((x: any) => {
          if (x.key !== body.key) return x;
          found = true;
          return { ...x, status: body.decision, staff_note: note, reviewed_at: nowIso, reviewed_by: name, history: [...(x.history || []), { at: nowIso, by: name, action: body.decision, note }] };
        });
        if (!found) return json({ error: '항목을 찾을 수 없습니다' }, 404);
        await svc.entities.ClientRequest.update(reqRow.id, { items });
        if (body.decision === 'REDO' && card.client_visible === true && card.client_id) {
          const it = items.find((x: any) => x.key === body.key);
          await notifyUsers(svc, await clientUsersOfCompany(svc, card.client_id), { type: 'client_request', title: `[자료 다시 요청] ${card.title} · ${it.label}`, body: `담당자 메모: ${note}`, link: `/client/board?card=${card.id}&tab=overview`, task_card_id: card.id, card_title: card.title }).catch(() => 0);
        }
        return json({ request: requestView({ ...reqRow, items }) });
      }
      return json({ error: '알 수 없는 요청입니다' }, 400);
    }

    // 고객: 항목 제출
    if (action !== 'submit') return json({ error: '알 수 없는 요청입니다' }, 400);
    if (!reqRow) return json({ error: '자료 요청을 찾을 수 없습니다' }, 404);
    if (reqRow.status === 'CLOSED') return json({ error: '마감된 요청입니다. 담당자에게 문의해 주세요' }, 409);
    const item = (reqRow.items || []).find((x: any) => x.key === body.key);
    if (!item) return json({ error: '항목을 찾을 수 없습니다' }, 404);
    if (item.status === 'ACCEPTED') return json({ error: '이미 확인이 끝난 항목입니다' }, 409);
    const answer = clip(body.answer, 4000);
    const uploaded = await uploadPrivateAttachments(svc, body.attachments);
    if (!answer && !uploaded.length) return json({ error: item.kind === 'file' ? '파일을 올리거나 링크·설명을 적어 주세요' : '답을 적어 주세요' }, 400);
    const files = uploaded.map((f) => ({ name: f.name, uri: f.url, size: f.size, at: nowIso, by: name }));
    if (files.length) await linkCardAttachments(svc, { tenantId: card.tenant_id, cardId: card.id, attachments: uploaded, uploaderName: name, clientVisible: true, uploaderRole: null, documentType: 'GENERAL' });
    const items = (reqRow.items || []).map((x: any) => (x.key !== item.key ? x : {
      ...x, status: 'SUBMITTED', answer: answer || x.answer || '', files: [...(x.files || []), ...files], submitted_at: nowIso, submitted_by: name,
      history: [...(x.history || []), { at: nowIso, by: name, action: 'SUBMITTED', note: answer.slice(0, 200), files: files.map((f) => f.name) }],
    }));
    await svc.entities.ClientRequest.update(reqRow.id, { items });
    const p = progressOf(items);
    await notifyUsers(svc, await internalUsersOfTenant(svc, card.tenant_id), { type: 'client_request_reply', title: `[고객 자료] ${card.title} · ${item.label}`, body: `${name}: ${files.length ? `파일 ${files.length}개` : ''}${files.length && answer ? ' · ' : ''}${answer.slice(0, 200)}\n진행 ${p.done + p.submitted}/${p.total}`, link: `/task-board?card=${card.id}&tab=talk%23card-client-request`, task_card_id: card.id, card_title: card.title }).catch(() => 0);
    return json({ request: requestView({ ...reqRow, items }), company_id: companyId });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
}
