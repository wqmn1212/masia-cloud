import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { notifyUsers, clientUsersOfCompany } from '../../shared/notify.ts';
import { kstToday } from '../../shared/chinaHoliday.ts';
import { quoteSummary, reviewChecks, canSend, isPublished, approvalQueue } from '../../shared/quoteReview.ts';

// 견적 승인과 고객 발송.
// - preview: 보내기 전 요약(고객 금액·원가·마진)과 확인 항목 (직원)
// - request_review: 직원이 "검토 요청" → 검토 중, 팀 관리자(service)·마스터에게 알림
// - approve_send: 팀 관리자·마스터가 "승인하고 보내기" → 발송됨 + 고객 포털 공개 + 고객 알림·메일 (확인 항목에 막힘이 없을 때만)
// - reject: 사유와 함께 초안으로 돌려보내고 요청자에게 알림
// - unpublish: 고객 공개 해제 (승인됨으로 되돌림)
// - queue: 관리자 승인함 목록 (검토 요청 + 발송됨인데 공개가 빠진 견적)
const STAFF = ['master', 'service', 'sub'];
const APPROVER = ['master', 'service'];
const CARD_REVIEW_FROM = ['TODO', 'IN_PROGRESS'];
const clean = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const fmt = (n: number, cur: string) => `${cur === 'KRW' ? '₩' : cur === 'CNY' ? '¥' : '$'}${Number(n).toLocaleString('en-US', { maximumFractionDigits: cur === 'KRW' ? 0 : 2 })}`;

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!STAFF.includes(user.account_tier) || user.is_active === false) return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    const approver = APPROVER.includes(user.account_tier);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '');
    const svc = base44.asServiceRole;
    const db = svc.entities;
    const today = kstToday();
    const by = user.full_name || user.account_label || user.email || '';
    const inScope = (tenantId: string) => user.account_tier === 'master' || (!!tenantId && tenantId === user.tenant_id);

    if (action === 'queue') {
      if (!approver) return Response.json({ error: '견적 승인은 팀 관리자 전용입니다.' }, { status: 403 });
      const quotes = (await db.Quotation.filter({ status: { $in: ['REVIEW', 'APPROVED', 'SENT'] } }, '-updated_date', 300)).filter((q: any) => inScope(q.tenant_id));
      const cardIds = [...new Set(quotes.map((q: any) => q.card_id).filter(Boolean))] as string[];
      const cards: Record<string, any> = {};
      for (const id of cardIds) { const c = await db.TaskCard.get(id).catch(() => null); if (c) cards[id] = c; }
      const queue = approvalQueue(quotes, cards, today);
      // 고객사가 없는 카드의 '발송됨'은 포털 밖으로 보낸 견적이라 공개 누락이 아니다
      queue.unsent = queue.unsent.filter((r: any) => cards[r.card_id]?.client_id);
      return Response.json(queue);
    }

    const id = clean(body?.quotation_id, 100);
    if (!id) return Response.json({ error: '견적서를 지정해 주세요.' }, { status: 400 });
    const q = await db.Quotation.get(id).catch(() => null);
    if (!q || !inScope(q.tenant_id)) return Response.json({ error: '견적서를 찾을 수 없습니다.' }, { status: 404 });
    const card = q.card_id ? await db.TaskCard.get(q.card_id).catch(() => null) : null;
    const checks = reviewChecks(q, card, today);
    const audit = async (event_type: string, details: string) => {
      if (!card) return;
      try { await db.ProjectAuditLog.create({ tenant_id: card.tenant_id, card_id: card.id, event_type, actor_id: user.id, actor_name: by, details }); } catch (_e) { /* 기록 실패가 처리를 막지 않는다 */ }
    };
    const title = q.quote_title || q.product_name || q.factory_name || '견적서';
    const cardTitle = card?.title || title;
    const link = card ? `/task-board?card=${card.id}&tab=quotation` : '/quotations';

    if (action === 'preview') {
      return Response.json({ summary: quoteSummary(q), checks, can_send: canSend(checks), can_approve: approver, status: q.status, published: isPublished(q), review_note: q.review_note || '', review_rejected_reason: q.review_rejected_reason || '' });
    }

    if (action === 'request_review') {
      if (isPublished(q)) return Response.json({ error: '이미 고객에게 보낸 견적입니다.' }, { status: 400 });
      if (!['DRAFT', 'APPROVED'].includes(q.status)) return Response.json({ error: q.status === 'REVIEW' ? '이미 검토를 기다리는 견적입니다.' : '이 상태에서는 검토를 요청할 수 없습니다.' }, { status: 400 });
      const note = clean(body?.note);
      await db.Quotation.update(q.id, { status: 'REVIEW', review_requested_at: new Date().toISOString(), review_requested_by_id: user.id, review_requested_by_name: by, review_note: note, review_rejected_reason: '' });
      const s = quoteSummary(q);
      const staff = await db.User.filter({ tenant_id: q.tenant_id });
      const masters = await db.User.filter({ account_tier: 'master' });
      const approvers = [...staff.filter((u: any) => u.account_tier === 'service'), ...masters].filter((u: any, i: number, all: any[]) => u.id !== user.id && u.is_active !== false && all.findIndex((x: any) => x.id === u.id) === i);
      const sent = await notifyUsers(svc, approvers, {
        type: 'quote_review_requested',
        title: `[견적 승인 요청] ${cardTitle}`,
        body: [`${by} 님이 견적 승인을 요청했습니다: ${title}`, s.total ? `고객 금액 ${fmt(s.total, s.currency)}${s.margin_pct != null ? ` · 마진 ${s.margin_pct}%` : ''}` : '', note ? `메모: ${note}` : '', checks.filter((c) => c.level !== 'info').map((c) => `· ${c.text}`).join('\n')].filter(Boolean).join('\n'),
        link: '/admin-inbox#inbox-quotes', task_card_id: card?.id || '', card_title: cardTitle,
      });
      await audit('QUOTE_REVIEW_REQUESTED', `견적 승인 요청: ${title}${note ? ` · ${note}` : ''}`);
      return Response.json({ ok: true, status: 'REVIEW', notified: sent, checks });
    }

    if (!approver) return Response.json({ error: '견적 승인은 팀 관리자 전용입니다.' }, { status: 403 });
    const requester = q.review_requested_by_id && q.review_requested_by_id !== user.id ? await db.User.get(q.review_requested_by_id).catch(() => null) : null;

    if (action === 'approve_send') {
      if (isPublished(q)) return Response.json({ ok: true, already: true });
      if (!canSend(checks)) return Response.json({ error: checks.filter((c) => c.level === 'block').map((c) => c.text).join(' / '), checks }, { status: 400 });
      const now = new Date().toISOString();
      await db.Quotation.update(q.id, {
        status: 'SENT', client_published_at: now, client_id: card.client_id, client_name: card.client_name || q.client_name || '',
        approved_at: now, approved_by_id: user.id, approved_by_name: by, sent_at: now, review_rejected_reason: '',
      });
      // 고객이 견적을 검토하는 단계로 카드를 넘긴다 (이미 그 뒤 단계면 그대로)
      if (CARD_REVIEW_FROM.includes(card.status)) await db.TaskCard.update(card.id, { status: 'REVIEW' });
      const s = quoteSummary(q);
      const terms = [
        `견적 금액 ${fmt(s.total, s.currency)}`,
        s.lead_time_business_days ? `납기 선금 후 ${s.lead_time_business_days}영업일` : s.shipping_days ? `납기 약 ${s.shipping_days}일` : '',
        s.validity_days ? `유효기간 ${s.validity_days}일` : '',
      ].filter(Boolean).join(' · ');
      const clients = await clientUsersOfCompany(svc, card.client_id);
      const sent = await notifyUsers(svc, clients, {
        type: 'quote_published',
        title: `[견적서 발행] ${card.title}`,
        body: `${title} 견적서가 발행되었습니다.\n${terms}\n고객 포털 견적 탭에서 내용을 확인하고 PDF 로 받거나 "이 견적으로 진행"을 눌러 주세요.`,
        link: `/client/board?card=${card.id}&tab=quotation`, task_card_id: card.id, card_title: card.title,
      });
      if (requester) {
        await notifyUsers(svc, [requester], { type: 'quote_review_decided', title: `[견적 발송됨] ${cardTitle}`, body: `${by} 님이 승인하고 고객에게 보냈습니다: ${title}`, link, task_card_id: card.id, card_title: cardTitle }, { email: false });
      }
      await audit('QUOTE_APPROVED_SENT', `견적 승인·고객 발송: ${title} · ${fmt(s.total, s.currency)}${s.margin_pct != null ? ` · 마진 ${s.margin_pct}%` : ''} · 고객 ${sent}명 알림`);
      return Response.json({ ok: true, status: 'SENT', notified: sent, card_status: CARD_REVIEW_FROM.includes(card.status) ? 'REVIEW' : card.status });
    }

    if (action === 'reject') {
      const reason = clean(body?.reason);
      if (!reason) return Response.json({ error: '반려 사유를 적어 주세요.' }, { status: 400 });
      if (q.status !== 'REVIEW') return Response.json({ error: '검토를 기다리는 견적만 반려할 수 있습니다.' }, { status: 400 });
      await db.Quotation.update(q.id, { status: 'DRAFT', review_rejected_reason: reason });
      if (requester) {
        await notifyUsers(svc, [requester], { type: 'quote_review_decided', title: `[견적 반려] ${cardTitle}`, body: `${by} 님이 견적을 돌려보냈습니다: ${title}\n사유: ${reason}`, link, task_card_id: card?.id || '', card_title: cardTitle });
      }
      await audit('QUOTE_REVIEW_REJECTED', `견적 반려: ${title} · ${reason}`);
      return Response.json({ ok: true, status: 'DRAFT' });
    }

    if (action === 'unpublish') {
      if (!isPublished(q)) return Response.json({ ok: true, already: true });
      if (q.client_accepted_at) return Response.json({ error: '고객이 이미 이 견적으로 진행을 요청했습니다. 공개를 해제할 수 없습니다.' }, { status: 400 });
      await db.Quotation.update(q.id, { client_published_at: '', status: q.status === 'SENT' ? 'APPROVED' : q.status });
      await audit('QUOTE_UNPUBLISHED', `견적 고객 공개 해제: ${title}`);
      return Response.json({ ok: true });
    }

    return Response.json({ error: '지원하지 않는 작업입니다.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
