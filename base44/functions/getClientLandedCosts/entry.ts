import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireClient, cardVisibleToClient } from '../../shared/clientAccess.ts';

// 고객 '상품 원가': 공개된 주문의 확정 도착 원가 기록. 내부 메모·수정 이유·결제 단계·선적 ID 는 보내지 않는다.
// 상품별로 가장 최근 공개 카드를 함께 보내 재주문 버튼이 그 카드를 기준으로 접수하게 한다.
const KINDS = ['GOODS', 'LOGISTICS', 'DEST', 'OTHER'];
const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireClient(base44, req);
    if (auth.error) return auth.error;
    const svc = base44.asServiceRole;

    const cards = (await svc.entities.TaskCard.filter({ client_id: auth.companyId, client_visible: true }, '-created_date', 500)).filter((c: any) => cardVisibleToClient(c, auth.companyId));
    const byId = new Map(cards.map((c: any) => [c.id, c]));
    const records = cards.length
      ? (await svc.entities.LandedCostRecord.filter({ client_id: auth.companyId, status: 'CONFIRMED' }, '-order_date', 500)).filter((r: any) => byId.has(r.card_id))
      : [];

    // 상품 키별 가장 최근 공개 카드 (재주문 기준). 기록의 카드가 재주문 체인에 있으면 그 체인의 최신 카드를 쓴다.
    const rootOf = (card: any) => {
      let cur = card; const seen = new Set();
      while (cur?.reorder_of && !seen.has(cur.id)) { seen.add(cur.id); const p = byId.get(cur.reorder_of); if (!p) return cur.reorder_of; cur = p; }
      return cur?.id;
    };
    const latestByRoot = new Map();
    // 재주문은 발주 이후(PRODUCTION·DONE) 카드에서만 접수된다 (reorderCard 규칙). cards 는 최신순
    for (const c of cards) { if (!['PRODUCTION', 'DONE'].includes(c.status)) continue; const root = rootOf(c); if (!latestByRoot.has(root)) latestByRoot.set(root, c); }
    const reorderFor = (r: any) => {
      const own: any = byId.get(r.card_id);
      const c: any = latestByRoot.get(r.product_key) || latestByRoot.get(rootOf(own)) || (['PRODUCTION', 'DONE'].includes(own?.status) ? own : null);
      return c ? { id: c.id, title: c.title || '' } : null;
    };

    return Response.json({
      records: records.map((r: any) => {
        const card: any = byId.get(r.card_id);
        return {
          id: r.id, card_id: r.card_id, card_title: card?.title || '', product_key: r.product_key || r.card_id, product_name: r.product_name || card?.title || '',
          order_date: r.order_date || '', units: n(r.units) || 1, unit_label: r.unit_label || '개',
          lines: (Array.isArray(r.lines) ? r.lines : []).filter((l: any) => KINDS.includes(l.kind)).map((l: any) => ({
            kind: l.kind, label: String(l.label || '').slice(0, 120), amount: n(l.amount), currency: ['KRW', 'USD', 'CNY'].includes(l.currency) ? l.currency : 'KRW',
            fx: l.fx == null ? null : n(l.fx), fx_basis: String(l.fx_basis || '').slice(0, 40), amount_krw: n(l.amount_krw), estimated: !!l.estimated, one_time: !!l.one_time,
          })),
          goods_krw: n(r.goods_krw), logistics_krw: n(r.logistics_krw), other_krw: n(r.other_krw), one_time_krw: n(r.one_time_krw),
          total_krw: n(r.total_krw), per_unit_krw: n(r.per_unit_krw), vat_krw: n(r.vat_krw),
          goods_foreign: r.goods_foreign?.currency ? { currency: r.goods_foreign.currency, amount: n(r.goods_foreign.amount) } : null,
          estimated: !!r.estimated, client_note: r.client_note || '', revision: r.revision || 1, confirmed_at: r.confirmed_at || '',
          reorder_card: reorderFor(r),
        };
      }),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
