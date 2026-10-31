import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { approvalQueue } from '../../shared/quoteReview.ts';
import { resolveMargin } from '../../shared/marginRule.ts';
import { pickOwner } from '../../shared/inquiryIntake.ts';
import { teamOf } from '../../shared/intakeServer.ts';
import { kstToday } from '../../shared/chinaHoliday.ts';

// AI 비서용 현황 조회 (읽기만): 전자서명·견적 비교표·도착 원가에서 직원이 챙길 일.
// topic: 'all' | 'signatures' | 'comparisons' | 'costs', card_query 로 카드·고객사 이름을 좁힌다.
// 견적 자동화 현황은 'quotes'(승인 대기·공개 빠짐·공장 견적 대기·초안·반려·고객 회신·유효기간), 'intake'(책임자 없는 카드·견적 기한 지남)로 따로 묻는다 ('all' 에는 넣지 않는다: 관리자 할 일 화면이 'all' 을 쓴다).
// 원가·마진은 팀 관리자(service)·마스터에게만 준다. 자기 팀 데이터만, 지문값·파일 위치 같은 내부 값은 넣지 않는다.
const STAFF = ['master', 'service', 'sub'];
const ARRIVED = ['ARRIVED', 'CUSTOMS', 'CLEARED', 'DELIVERED'];
const kstDate = (iso: string) => (iso ? new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(0, 10) : '');
const days = (iso: string) => (iso ? Math.floor((Date.now() - Date.parse(iso)) / 86400000) : null);

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!STAFF.includes(user.account_tier) || user.is_active === false) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const topic = ['signatures', 'comparisons', 'costs', 'quotes', 'intake'].includes(body.topic) ? body.topic : 'all';
    const approver = ['master', 'service'].includes(user.account_tier);
    const svc = base44.asServiceRole;
    const db = svc.entities;
    const scope = user.account_tier === 'master' ? {} : { tenant_id: user.tenant_id };
    const mine = (r: any) => !!r && (user.account_tier === 'master' || r.tenant_id === user.tenant_id);
    const q = String(body.card_query || '').trim().toLowerCase();
    const cardCache = new Map();
    const cardOf = async (id: string) => {
      if (!id) return null;
      if (!cardCache.has(id)) cardCache.set(id, await db.TaskCard.get(id).catch(() => null));
      return cardCache.get(id);
    };
    const hit = (...words: string[]) => !q || words.join(' ').toLowerCase().includes(q);
    const out: any = { as_of: new Date().toISOString() };

    if (topic === 'all' || topic === 'signatures') {
      const reqs = (await db.SignatureRequest.filter(scope, '-created_date', 200)).filter(mine);
      const latest = new Map();
      for (const r of reqs) if (!latest.has(r.contract_id)) latest.set(r.contract_id, r);
      const list = [...latest.values()];
      const view = (r: any) => {
        const s = (r.signers || [])[0] || {};
        const expired = r.status === 'OUT' && Date.parse(r.due_at) < Date.now();
        return {
          contract_id: r.contract_id, document_no: r.document_no, title: r.document_title, version: r.version, status: expired ? 'EXPIRED' : r.status,
          signer: s.name || s.email || '', signer_viewed: s.status === 'VIEWED' || !!s.viewed_at, sent_days_ago: days(r.created_date), due_date: kstDate(r.due_at),
          completed_date: kstDate(r.completed_at), decline_reason: r.decline_reason || '',
        };
      };
      out.signatures = {
        waiting: list.filter((r) => r.status === 'OUT').map(view).filter((v) => hit(v.title, v.signer)),
        declined: list.filter((r) => r.status === 'DECLINED').map(view).filter((v) => hit(v.title, v.signer)),
        expired: list.filter((r) => r.status === 'EXPIRED').map(view).filter((v) => hit(v.title, v.signer)).slice(0, 10),
        completed_recent: list.filter((r) => r.status === 'COMPLETED' && days(r.completed_at)! <= 30).map(view).filter((v) => hit(v.title, v.signer)).slice(0, 10),
      };
    }

    if (topic === 'all' || topic === 'comparisons') {
      const rows = (await db.QuoteComparison.filter(scope, '-updated_date', 200)).filter(mine).filter((r: any) => r.status !== 'CLOSED');
      const latest = new Map();
      for (const r of rows) if (!latest.has(r.card_id)) latest.set(r.card_id, r);
      const items = [];
      for (const r of latest.values()) {
        const card = await cardOf(r.card_id);
        if (!hit(card?.title || '', card?.client_name || '', r.title || '')) continue;
        const choice = r.client_choice?.option_key ? (r.options || []).find((o: any) => o.key === r.client_choice.option_key) : null;
        items.push({
          card_id: r.card_id, card_title: card?.title || '', client_name: card?.client_name || '', status: r.status, version: r.version || 0, options: (r.options || []).length,
          published_date: kstDate(r.published_at), client_choice: choice ? choice.label : '', client_note: r.client_choice?.note || '', confirmed: r.status === 'CONFIRMED',
        });
      }
      out.comparisons = {
        awaiting_confirm: items.filter((i) => i.status === 'CHOSEN'),
        awaiting_client: items.filter((i) => i.status === 'PUBLISHED'),
        drafts: items.filter((i) => i.status === 'DRAFT'),
      };
    }

    if (topic === 'all' || topic === 'costs') {
      const ships = (await db.Shipment.filter(scope, '-updated_date', 300)).filter(mine);
      const missingActual = [];
      for (const s of ships.filter((x: any) => ARRIVED.includes(x.status) && x.dest_cost_actual == null)) {
        const card = await cardOf(s.card_id);
        if (!hit(card?.title || '', card?.client_name || '', s.label || '')) continue;
        missingActual.push({ shipment_id: s.id, card_title: card?.title || '', label: s.label || '', status: s.status, tracking_no: s.tracking_no || '', estimate_ex_vat: s.dest_cost_estimate ? Math.round(Number(s.dest_cost_estimate.buyer_ex_vat) || 0) : null });
      }
      const records = (await db.LandedCostRecord.filter(scope, '-order_date', 300)).filter(mine).filter((r: any) => r.status === 'CONFIRMED');
      const byProduct = new Map();
      for (const r of [...records].sort((a: any, b: any) => String(a.order_date).localeCompare(String(b.order_date)))) {
        const k = r.product_key || r.card_id;
        if (!byProduct.has(k)) byProduct.set(k, []);
        byProduct.get(k).push(r);
      }
      const products = [...byProduct.values()].map((list: any[]) => {
        const last = list[list.length - 1], prev = list.length > 1 ? list[list.length - 2] : null;
        const change = prev && prev.per_unit_krw ? (last.per_unit_krw - prev.per_unit_krw) / prev.per_unit_krw : null;
        return { product_name: last.product_name, orders: list.length, last_order_date: last.order_date, per_unit_krw: last.per_unit_krw, unit_label: last.unit_label || '개', change_pct: change == null ? null : Math.round(change * 1000) / 10, estimated: !!last.estimated };
      }).filter((p) => hit(p.product_name));
      // 선적이 모두 도착했는데 원가를 확정하지 않은 카드
      const recorded = new Set(records.map((r: any) => r.card_id));
      const byCard = new Map();
      for (const s of ships) { if (!byCard.has(s.card_id)) byCard.set(s.card_id, []); byCard.get(s.card_id).push(s); }
      const toConfirm = [];
      for (const [cardId, list] of byCard) {
        if (recorded.has(cardId) || !list.every((s: any) => ARRIVED.includes(s.status))) continue;
        const card = await cardOf(cardId);
        if (!card?.client_id || !hit(card.title || '', card.client_name || '')) continue;
        toConfirm.push({ card_id: cardId, card_title: card.title || '', client_name: card.client_name || '', actual_missing: list.some((s: any) => s.dest_cost_actual == null) });
      }
      out.costs = { shipments_missing_actual: missingActual.slice(0, 20), cards_to_confirm: toConfirm.slice(0, 20), products: products.slice(0, 20) };
    }
    if (topic === 'quotes' || topic === 'intake') {
      const today = kstToday();
      const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
      const cards = (await db.TaskCard.filter(scope, '-updated_date', 500)).filter(mine).filter((c: any) => !['DONE', 'CANCELLED'].includes(c.status));
      const cardMap: Record<string, any> = Object.fromEntries(cards.map((c: any) => [c.id, c]));
      const quotes = (await db.Quotation.filter(scope, '-updated_date', 400)).filter(mine).filter((q: any) => cardMap[q.card_id]);
      const sentCards = new Set(quotes.filter((q: any) => q.client_published_at).map((q: any) => q.card_id));
      const cardHit = (c: any) => hit(c?.title || '', c?.client_name || '');
      const label = (q: any) => q.quote_title || q.product_name || q.factory_name || '견적서';
      if (topic === 'quotes') {
        const settings = new Map<string, any>();
        for (const t of [...new Set(cards.map((c: any) => c.tenant_id))] as string[]) settings.set(t, (await db.OperationSetting.filter({ tenant_id: t }, '-updated_date', 1).catch(() => []))[0] || null);
        const queue = approvalQueue(quotes, cardMap, today, (c: any) => resolveMargin(settings.get(c.tenant_id), c));
        const row = (r: any) => ({ quotation_id: r.id, card_title: r.card_title, client_name: r.client_name, title: r.quote_title, status: r.status, requested_by: r.requested_by_name, requested_date: kstDate(r.requested_at), waiting_days: r.requested_at ? days(r.requested_at) : null, note: r.review_note,
          ...(approver ? { client_total: r.summary.total, currency: r.summary.currency, margin_pct: r.summary.margin_pct } : {}), blocks: r.checks.filter((c: any) => c.level === 'block').map((c: any) => c.text), warnings: approver ? r.checks.filter((c: any) => c.level === 'warn').map((c: any) => c.text) : [] });
        const factoryWaiting = [];
        for (const r of (await db.FactoryRequest.filter(scope, '-created_date', 300)).filter(mine)) {
          const card = cardMap[r.card_id];
          if (!card || !cardHit(card) || r.status === 'REVOKED' || (r.expires_at && r.expires_at < new Date().toISOString())) continue;
          if (!(r.items || []).some((i: any) => i.kind === 'QUOTE' && ['WAITING', 'REDO'].includes(i.status))) continue;
          factoryWaiting.push({ card_title: card.title, factory_name: r.factory_name || '', days: days(r.created_date), opened: !!r.last_opened_at, expires_date: kstDate(r.expires_at) });
        }
        const awaiting = [], expiring = [];
        for (const q of quotes.filter((x: any) => x.client_published_at && !x.client_accepted_at && ['SENT', 'APPROVED'].includes(x.status))) {
          const card = cardMap[q.card_id];
          if (!cardHit(card)) continue;
          const sent = kstDate(q.client_published_at);
          const validity = Number(q.validity_days) || 0;
          const until = validity ? kstDate(new Date(Date.parse(q.client_published_at) + validity * 86400000).toISOString()) : '';
          const left = until ? dayDiff(today, until) : null;
          const item = { quotation_id: q.id, card_title: card.title, client_name: card.client_name || '', title: label(q), sent_date: sent, days_since_sent: dayDiff(sent, today), valid_until: until, days_left: left };
          if (left != null && left <= 3 && left >= -14) expiring.push(item);
          else if (item.days_since_sent > 3 && !(left != null && left < 0)) awaiting.push(item);
        }
        out.quotes = {
          approval_waiting: queue.review.filter((r: any) => cardHit(cardMap[r.card_id])).map(row),
          sent_but_not_published: queue.unsent.filter((r: any) => cardMap[r.card_id]?.client_id && cardHit(cardMap[r.card_id])).map(row),
          factory_quote_waiting: factoryWaiting,
          factory_drafts: quotes.filter((q: any) => q.status === 'DRAFT' && q.factory_request_id && !q.review_rejected_reason && cardHit(cardMap[q.card_id])).map((q: any) => ({ quotation_id: q.id, card_title: cardMap[q.card_id].title, factory_name: q.factory_name || '', title: label(q) })),
          rejected: quotes.filter((q: any) => q.status === 'DRAFT' && q.review_rejected_reason && cardHit(cardMap[q.card_id])).map((q: any) => ({ quotation_id: q.id, card_title: cardMap[q.card_id].title, title: label(q), reason: q.review_rejected_reason })),
          awaiting_client_reply: awaiting,
          validity_expiring_or_expired: expiring,
          costs_visible: approver,
        };
      } else {
        const team = (await teamOf(svc, user.tenant_id)).filter(Boolean);
        const setting = (await db.OperationSetting.filter({ tenant_id: user.tenant_id }, '-updated_date', 1).catch(() => []))[0] || null;
        out.intake = {
          unassigned: cards.filter((c: any) => !c.owner_id && cardHit(c)).map((c: any) => {
            const s = pickOwner(setting, c, team);
            return { card_id: c.id, card_title: c.title, client_name: c.client_name || '', status: c.status, created_date: kstDate(c.created_date), quote_deadline: c.quote_deadline || '', suggest: s ? `${s.owner_name} (${s.label})` : '' };
          }).slice(0, 30),
          quote_deadline_overdue: cards.filter((c: any) => /^\d{4}-\d{2}-\d{2}$/.test(c.quote_deadline || '') && c.quote_deadline < today && !sentCards.has(c.id) && cardHit(c))
            .map((c: any) => ({ card_id: c.id, card_title: c.title, owner_name: c.owner_name || '', quote_deadline: c.quote_deadline, days_over: dayDiff(c.quote_deadline, today) })).slice(0, 30),
          rules_set: !!(setting?.intake_default_owner_id || (setting?.intake_rules || []).length),
        };
      }
    }
    return Response.json(out);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
