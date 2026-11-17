import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireClient, cardVisibleToClient } from '../../shared/clientAccess.ts';
import { notifyUsers, internalUsersOfTenant, clientUsersOfCompany } from '../../shared/notify.ts';
import { can } from '../../shared/clientRoles.ts';
import { DOCS, ECO_DECISIONS, DOC_DECISIONS, modelSnapshot, clientView, hasShare } from '../../shared/protoClient.ts';

// 시제품 개발 내용을 고객 포털에 공개하고, 고객의 결정·의견을 받는다.
// 직원 (master·service·sub, 같은 팀):
//   share_model  {project_id, on, snapshot:{dev, parts, render_url}}  3D·동작 시뮬레이션 공개(갱신)·중단
//   share_doc    {project_id, doc:'nameplate'|'manual', text}          명판·설명서 초안 확인 요청 (보낼 때마다 판 번호 +1)
//   share_eco    {project_id, no}                                       고객 확인이 필요한 변경 요청서(ECO) 보내기 (dev.ecos 에 있는 것만)
//   resolve_comment {project_id, comment_id, resolved}                  고객 위치 의견 처리 표시
//   staff_view   {project_id}                                           직원 화면용: 공개 내용과 고객 결정
// 고객 (client, 카드가 공개된 고객사):
//   list         {card_id}                                              이 카드에 묶인 시제품 중 공개된 것 (직원 미리보기는 view_company_id)
//   eco_decide   {project_id, no, decision:'APPROVED'|'REJECTED', note}
//   doc_decide   {project_id, doc, version, decision:'APPROVED'|'CHANGES', note}
//   comment      {project_id, part_id, part_name, point:[x,y,z], text}
const STAFF = ['master', 'service', 'sub'];
const clip = (s: unknown, n: number) => String(s ?? '').trim().slice(0, n);
const nowIso = () => new Date().toISOString();
const nameOf = (u: any) => u.full_name || u.account_label || u.email || '';

export default async function (req: Request) {
  try {
    const body = await req.clone().json().catch(() => ({}));
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const action = String(body.action || '');
    const me = await base44.auth.me().catch(() => null);
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // ── 직원 ──
    if (['share_model', 'share_doc', 'share_eco', 'resolve_comment', 'staff_view'].includes(action)) {
      if (me.is_active === false || !STAFF.includes(me.account_tier)) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const p = await svc.entities.ProtoProject.get(String(body.project_id || '')).catch(() => null);
      if (!p || (me.account_tier !== 'master' && p.tenant_id !== me.tenant_id)) return Response.json({ error: '시제품을 찾을 수 없습니다' }, { status: 404 });
      const card = p.card_id ? await svc.entities.TaskCard.get(p.card_id).catch(() => null) : null;
      if (action === 'staff_view') return Response.json({ share: p.client_share || {}, review: p.client_review || {}, card: card ? { id: card.id, client_visible: card.client_visible === true, has_client: !!card.client_id } : null });
      if (action === 'resolve_comment') {
        const review = p.client_review || {};
        const comments = (review.comments || []).map((c: any) => (c.id === body.comment_id ? { ...c, resolved: body.resolved !== false, resolved_by: nameOf(me), resolved_at: nowIso() } : c));
        await svc.entities.ProtoProject.update(p.id, { client_review: { ...review, comments } });
        return Response.json({ ok: true });
      }
      if (!card || !card.client_id) return Response.json({ error: '고객사가 정해진 업무 카드에 묶인 시제품만 고객에게 공개할 수 있습니다' }, { status: 409 });
      const share = { ...(p.client_share || {}) };
      let notice: { title: string; body: string } | null = null;
      if (action === 'share_model') {
        if (body.on === false) share.model = { ...(share.model || {}), on: false, off_at: nowIso(), off_by: nameOf(me) };
        else {
          let snap;
          try { snap = modelSnapshot(body.snapshot); } catch (e) { return Response.json({ error: String((e as Error).message) }, { status: 400 }); }
          if (!snap.dev.features.length && !snap.parts.length) return Response.json({ error: '공개할 3D 모형이나 기능이 없습니다' }, { status: 400 });
          const first = !share.model?.on;
          share.model = { on: true, at: nowIso(), by: nameOf(me), ...snap };
          notice = { title: `[시제품] ${p.title} 3D·동작 시뮬레이션 ${first ? '공개' : '갱신'}`, body: '고객 포털 업무 카드의 “개발” 탭에서 3D 를 돌려 보고 버튼·조명을 눌러 볼 수 있습니다. 고칠 곳은 부품을 눌러 의견을 남겨 주세요.' };
        }
      } else if (action === 'share_doc') {
        const doc = String(body.doc || '');
        if (!DOCS[doc]) return Response.json({ error: '문서 종류가 맞지 않습니다' }, { status: 400 });
        const text = clip(body.text, 20000);
        if (!text) return Response.json({ error: '보낼 내용이 없습니다' }, { status: 400 });
        const prev = share.docs?.[doc];
        if (prev && prev.text === text) return Response.json({ error: '지난번에 보낸 내용과 같습니다' }, { status: 409 });
        const version = (prev?.version || 0) + 1;
        share.docs = { ...(share.docs || {}), [doc]: { version, text, at: nowIso(), by: nameOf(me) } };
        share.doc_history = [...(share.doc_history || []), ...(prev ? [{ doc, ...prev }] : [])]; // 예전 판은 지우지 않고 남긴다
        notice = { title: `[확인 요청] ${p.title} ${DOCS[doc].ko} v${version}`, body: `고객 포털 업무 카드의 “개발” 탭에서 ${DOCS[doc].ko}을 확인하고 승인하거나 고칠 곳을 알려 주세요.` };
      } else {
        const no = String(body.no || '');
        const eco = (p.dev?.ecos || []).find((e: any) => e.no === no);
        if (!eco) return Response.json({ error: '변경 요청서를 찾을 수 없습니다. 저장한 뒤 다시 보내 주세요' }, { status: 404 });
        if (!['OPEN', 'WAIT_CLIENT'].includes(eco.status)) return Response.json({ error: '이미 처리된 변경 요청서입니다' }, { status: 409 });
        if ((share.ecos || []).some((e: any) => e.no === no && !e.withdrawn)) return Response.json({ error: '이미 고객에게 보낸 변경 요청서입니다' }, { status: 409 });
        share.ecos = [...(share.ecos || []), { no, reason: clip(eco.reason, 2000), changes: (eco.changes || []).slice(0, 60).map((c: any) => ({ area: clip(c.area, 20), text: clip(c.text, 300) })), impact: (eco.impact || []).slice(0, 10).map((t: any) => clip(t, 200)), from_version: eco.from_version, at: nowIso(), by: nameOf(me) }];
        notice = { title: `[승인 요청] ${p.title} 설계 변경 ${no}`, body: `변경 이유: ${clip(eco.reason, 300)}\n고객 포털 업무 카드의 “개발” 탭에서 바뀌는 내용을 보고 승인하거나 반려해 주세요.` };
      }
      await svc.entities.ProtoProject.update(p.id, { client_share: share });
      if (notice && card.client_visible === true) {
        await notifyUsers(svc, await clientUsersOfCompany(svc, card.client_id), { type: 'proto_client_share', ...notice, link: `/client/board?card=${card.id}&tab=dev`, task_card_id: card.id, card_title: card.title }).catch(() => 0);
      }
      return Response.json({ ok: true, share, notified: !!notice && card.client_visible === true });
    }

    // ── 고객 ──
    const auth = await requireClient(base44, action === 'list' ? req : undefined);
    if (auth.error) return auth.error;
    if (action === 'list') {
      const card = await svc.entities.TaskCard.get(String(body.card_id || '')).catch(() => null);
      if (!cardVisibleToClient(card, auth.companyId)) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const rows = await svc.entities.ProtoProject.filter({ card_id: card.id }, '-updated_date', 20);
      return Response.json({ projects: rows.filter(hasShare).map(clientView) });
    }
    if (!['eco_decide', 'doc_decide', 'comment'].includes(action)) return Response.json({ error: '알 수 없는 요청입니다' }, { status: 400 });
    const p = await svc.entities.ProtoProject.get(String(body.project_id || '')).catch(() => null);
    const card = p?.card_id ? await svc.entities.TaskCard.get(p.card_id).catch(() => null) : null;
    if (!p || !cardVisibleToClient(card, auth.companyId) || !hasShare(p)) return Response.json({ error: '시제품을 찾을 수 없습니다' }, { status: 404 });
    const company = await svc.entities.Company.get(auth.companyId).catch(() => null);
    const myEmail = String(auth.user.email || '').toLowerCase();
    const by = { by: nameOf(auth.user), by_email: myEmail, at: nowIso() };
    const share = p.client_share || {};
    const review = { ...(p.client_review || {}) };
    let tell = '';

    if (action === 'comment') {
      const text = clip(body.text, 1000);
      if (!text) return Response.json({ error: '의견을 적어 주세요' }, { status: 400 });
      if (!share.model?.on) return Response.json({ error: '3D 공개가 끝났습니다. 문의 탭에 남겨 주세요' }, { status: 409 });
      const pt = Array.isArray(body.point) && body.point.length === 3 && body.point.every((x: unknown) => Number.isFinite(Number(x))) ? body.point.map((x: unknown) => Math.round(Number(x) * 10) / 10) : null;
      const parts = share.model.parts || [];
      const part = parts.find((x: any) => x?.id === body.part_id);
      const c = { id: `cm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, part_id: part ? part.id : null, part_name: part ? clip(part.name, 80) : clip(body.part_name, 80), point: pt, text, ...by };
      review.comments = [...(review.comments || []), c].slice(-500);
      tell = `3D 의견${c.part_name ? ` (${c.part_name})` : ''}: ${text.slice(0, 200)}`;
    } else {
      // 결정은 결정 권한이 있는 계정만 (재무 전용 계정 제외)
      if (!can(company, myEmail, 'decide')) return Response.json({ error: '재무 역할만 있는 계정은 결정할 수 없습니다. 실무자나 결재권자에게 요청해 주세요' }, { status: 403 });
      const note = clip(body.note, 2000);
      if (action === 'eco_decide') {
        const no = String(body.no || '');
        if (!ECO_DECISIONS.includes(body.decision)) return Response.json({ error: '승인 또는 반려를 고르세요' }, { status: 400 });
        if (!(share.ecos || []).some((e: any) => e.no === no && !e.withdrawn)) return Response.json({ error: '변경 요청서를 찾을 수 없습니다' }, { status: 404 });
        if (review.ecos?.[no]) return Response.json({ error: '이미 결정한 변경 요청서입니다' }, { status: 409 });
        if (body.decision === 'REJECTED' && !note) return Response.json({ error: '반려 이유를 적어 주세요' }, { status: 400 });
        review.ecos = { ...(review.ecos || {}), [no]: { decision: body.decision, note, ...by } };
        tell = `설계 변경 ${no} ${body.decision === 'APPROVED' ? '승인' : '반려'}${note ? ` — ${note.slice(0, 200)}` : ''}`;
      } else {
        const doc = String(body.doc || '');
        const cur = share.docs?.[doc];
        if (!DOCS[doc] || !cur) return Response.json({ error: '확인할 문서를 찾을 수 없습니다' }, { status: 404 });
        if (Number(body.version) !== cur.version) return Response.json({ error: '담당자가 새 판을 보냈습니다. 새로고침해 주세요' }, { status: 409 });
        if (!DOC_DECISIONS.includes(body.decision)) return Response.json({ error: '승인 또는 수정 요청을 고르세요' }, { status: 400 });
        if ((review.docs?.[doc] || []).some((x: any) => x.version === cur.version)) return Response.json({ error: '이 판은 이미 답했습니다' }, { status: 409 });
        if (body.decision === 'CHANGES' && !note) return Response.json({ error: '고칠 내용을 적어 주세요' }, { status: 400 });
        review.docs = { ...(review.docs || {}), [doc]: [...(review.docs?.[doc] || []), { version: cur.version, decision: body.decision, note, ...by }] };
        tell = `${DOCS[doc].ko} v${cur.version} ${body.decision === 'APPROVED' ? '승인' : '수정 요청'}${note ? ` — ${note.slice(0, 200)}` : ''}`;
      }
    }
    await svc.entities.ProtoProject.update(p.id, { client_review: review });
    await notifyUsers(svc, await internalUsersOfTenant(svc, p.tenant_id), { type: 'proto_client_reply', title: `[고객] ${p.title} ${tell.split(' — ')[0]}`, body: `${by.by}: ${tell}`, link: `/prototypes/${p.id}/develop?step=test`, task_card_id: card.id, card_title: card.title }).catch(() => 0);
    return Response.json({ ok: true, project: clientView({ ...p, client_review: review }) });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
}
