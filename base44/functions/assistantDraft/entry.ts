import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// AI 비서용 초안 만들기. 고객에게는 아무것도 나가지 않는다 (공개·서명 요청은 직원이 화면에서).
//  kind 'comparison' — 카드 견적으로 견적 비교표 초안. 줄 맞추기·금액 계산은 직원이 비교표를 열 때 화면이 한다.
//  kind 'contract'   — 견적(또는 월 구독 계약)으로 계약서 초안. 본문은 계약서 화면이 양식으로 채운다.
const STAFF = ['master', 'service', 'sub'];
const KEYS = ['A', 'B', 'C', 'D', 'E'];
const PLACEHOLDER = /^(?:[\s.\-_·0-9]*|n\/?a|미기재|미정|합산|multiple\s*suppliers?|\d+\s*곳|공장|factory)$/i; // src/lib/quoteCompare.js 와 같은 규칙
const TITLE = { SUPPLY: '제품 공급 계약서', TRIPARTITE: '3자 제조위탁 및 생산관리 계약서', SERVICE: '서비스 이용 계약서' };
const APP = () => (Deno.env.get('APP_BASE_URL') || 'https://aegistrade.biz').replace(/\/$/, '');

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!STAFF.includes(user.account_tier) || user.is_active === false) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const db = base44.asServiceRole.entities;
    const mine = (r: any) => !!r && (user.account_tier === 'master' || r.tenant_id === user.tenant_id);
    const by = `${user.full_name || user.email || ''} (AI 비서)`;

    if (body.kind === 'comparison') {
      const card = body.card_id ? await db.TaskCard.get(body.card_id).catch(() => null) : null;
      if (!mine(card)) return Response.json({ error: '카드를 찾을 수 없습니다' }, { status: 404 });
      const open = (await db.QuoteComparison.filter({ card_id: card.id }, '-created_date', 10)).find((r: any) => r.status !== 'CLOSED');
      if (open) return Response.json({ ok: true, existing: true, status: open.status, options: (open.options || []).length, link: `${APP()}/task-board?card=${card.id}`, next: '이미 비교표가 있습니다. 카드 견적 탭에서 여세요.' });
      const quotes = (await db.Quotation.filter({ card_id: card.id }, '-created_date', 50)).filter((q: any) => q.card_id === card.id);
      const ids: string[] = Array.isArray(body.quotation_ids) && body.quotation_ids.length
        ? body.quotation_ids.filter((id: string) => quotes.some((q: any) => q.id === id))
        : quotes.filter((q: any) => q.status !== 'REJECTED' && !PLACEHOLDER.test(String(q.factory_name || '').trim())).map((q: any) => q.id);
      const chosen = [...new Set(ids)].slice(0, KEYS.length);
      if (chosen.length < 2) return Response.json({ error: `비교하려면 견적이 2건 이상 필요합니다 (지금 고를 수 있는 견적 ${chosen.length}건)`, quotations: quotes.map((q: any) => ({ id: q.id, factory_name: q.factory_name || '', title: q.quote_title || q.product_name || '', status: q.status })) }, { status: 400 });
      const options = chosen.map((id, i) => ({ key: KEYS.at(i), label: `${KEYS.at(i)}안`, quotation_id: id, show_factory_name: false, cargo: {}, conditions: {}, extra: {} }));
      const rec = await db.QuoteComparison.create({ tenant_id: card.tenant_id, card_id: card.id, client_id: card.client_id || '', title: card.title || '', status: 'DRAFT', version: 0, options, rows: [], created_by_name: by });
      const q = new Map(quotes.map((x: any) => [x.id, x]));
      return Response.json({
        ok: true, comparison_id: rec.id, card_title: card.title || '', link: `${APP()}/task-board?card=${card.id}`,
        options: options.map((o) => ({ label: o.label, factory_name: (q.get(o.quotation_id) as any)?.factory_name || '', title: (q.get(o.quotation_id) as any)?.quote_title || '' })),
        next: '초안입니다. 카드 견적 탭에서 비교표를 열면 품목 줄 맞추기와 도착 원가가 계산됩니다. 확인하고 직원이 고객에게 공개하세요.',
      });
    }

    if (body.kind === 'contract') {
      let q: any = null, ag: any = null, card: any = null;
      if (body.service_agreement_id) {
        ag = await db.ServiceAgreement.get(body.service_agreement_id).catch(() => null);
        if (!mine(ag)) return Response.json({ error: '월 구독 계약을 찾을 수 없습니다' }, { status: 404 });
      } else {
        q = body.quotation_id ? await db.Quotation.get(body.quotation_id).catch(() => null) : null;
        if (!mine(q)) return Response.json({ error: '견적을 찾을 수 없습니다' }, { status: 404 });
        card = q.card_id ? await db.TaskCard.get(q.card_id).catch(() => null) : null;
      }
      const type = ag ? 'SERVICE' : ['SUPPLY', 'TRIPARTITE'].includes(body.contract_type) ? body.contract_type : q.settlement_route === 'CLIENT_TO_FACTORY' ? 'TRIPARTITE' : 'SUPPLY';
      const dup = (await db.Contract.filter(ag ? { service_agreement_id: ag.id } : { quotation_id: q.id }, '-created_date', 5)).find((c: any) => mine(c) && c.status !== 'CANCELLED');
      if (dup) return Response.json({ ok: true, existing: true, contract_id: dup.id, status: dup.status, link: `${APP()}/contracts?contract=${dup.id}`, next: '이 견적으로 만든 계약서가 이미 있습니다.' });
      const clientName = ag?.company_name || q?.client_name || card?.client_name || '';
      const contract = await db.Contract.create({
        tenant_id: (ag || q).tenant_id, contract_type: type, status: 'DRAFT', body: '',
        contract_title: `${clientName} ${ag ? '' : `${q.quote_title || q.product_name || ''} `}${TITLE[type as keyof typeof TITLE]}`.replace(/\s+/g, ' ').trim(),
        client_name: clientName, client_id: ag?.company_id || q?.client_id || card?.client_id || '', card_id: card?.id || '',
        quotation_id: q?.id || '', service_agreement_id: ag?.id || '', factory_name: q?.factory_name || '',
        amount_usd: q?.final_price_usd ?? undefined, contract_date: new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10),
      });
      return Response.json({
        ok: true, contract_id: contract.id, title: contract.contract_title, contract_type: type, link: `${APP()}/contracts?contract=${contract.id}`,
        warning: type === 'TRIPARTITE' ? '고객이 공장에 직접 송금하는 견적이라 3자 계약입니다. 전자서명은 2단계부터라 PDF 로 진행합니다.' : '',
        next: '초안입니다. 계약서 화면에서 열면 양식으로 본문이 채워집니다. 빈칸을 채우고 저장한 뒤 직원이 서명 요청을 보냅니다.',
      });
    }
    return Response.json({ error: "kind 는 'comparison' 또는 'contract' 입니다" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
