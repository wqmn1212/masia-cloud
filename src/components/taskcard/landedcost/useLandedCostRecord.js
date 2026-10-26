import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { buildPrefill, fmtWon, rootCardId, summarize } from '@/lib/orderCost';

// 카드 하나의 도착 원가 확정 기록과, 확정 창 기본값을 만들 재료(승인 견적·결제 단계·선적·환율·같은 고객의 다른 상품)를 모은다.
export default function useLandedCostRecord(card) {
  const qc = useQueryClient();
  const key = ['landed-cost-record', card.id];
  const record = useQuery({ queryKey: key, queryFn: async () => (await base44.entities.LandedCostRecord.filter({ card_id: card.id }, '-updated_date', 1))[0] || null });
  const quotations = useQuery({ queryKey: ['quotations-by-card', card.id, 'landed'], queryFn: () => base44.entities.Quotation.filter({ card_id: card.id }, '-created_date', 50) });
  const stages = useQuery({ queryKey: ['payment-stages', card.id], queryFn: () => base44.entities.PaymentStage.filter({ card_id: card.id }) });
  const shipments = useQuery({ queryKey: ['shipments', card.id], queryFn: () => base44.entities.Shipment.filter({ card_id: card.id }, 'created_date', 20) });
  const rates = useQuery({ queryKey: ['exchange-rates-history'], queryFn: () => base44.entities.ExchangeRate.list('-rate_date', 1000), staleTime: 3600_000 });
  const siblings = useQuery({
    queryKey: ['landed-cost-siblings', card.client_id], enabled: !!card.client_id,
    queryFn: async () => {
      const [records, cards] = await Promise.all([
        base44.entities.LandedCostRecord.filter({ client_id: card.client_id }, '-order_date', 300),
        base44.entities.TaskCard.filter({ client_id: card.client_id }, '-created_date', 300),
      ]);
      return { records, cards };
    },
  });

  const loading = [record, quotations, stages, shipments, rates].some((q) => q.isLoading) || (!!card.client_id && siblings.isLoading);
  const qs = quotations.data || [];
  const quotation = qs.find((q) => q.status === 'ACCEPTED') || qs.find((q) => q.client_published_at) || null;

  // 상품 묶음: 재주문 체인의 처음 카드. 같은 고객의 다른 기록이 그 키를 쓰고 있으면 이름도 이어받는다.
  const cardsById = new Map((siblings.data?.cards || []).map((c) => [c.id, c]));
  if (!cardsById.has(card.id)) cardsById.set(card.id, card);
  const rootId = rootCardId(card, cardsById);
  const others = (siblings.data?.records || []).filter((r) => r.card_id !== card.id && r.status === 'CONFIRMED');
  const products = [...new Map(others.map((r) => [r.product_key || r.card_id, r.product_name || ''])).entries()].map(([k, name]) => ({ key: k, name }));
  const defaultProduct = {
    key: rootId,
    name: products.find((p) => p.key === rootId)?.name || cardsById.get(rootId)?.title || card.title || '',
  };

  const prefill = () => buildPrefill({ card, quotation, stages: stages.data || [], shipments: shipments.data || [], rates: rates.data || [] });

  const save = async (draft, { by, reason = '' }) => {
    const s = summarize({ lines: draft.lines, units: draft.units });
    const prev = record.data;
    const now = new Date().toISOString();
    const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const payload = {
      tenant_id: card.tenant_id, card_id: card.id, client_id: card.client_id || '',
      product_key: draft.product_key || card.id, product_name: draft.product_name.trim() || card.title || '',
      quotation_id: draft.quotation_id || '', order_date: draft.order_date || now.slice(0, 10),
      units: s.units, unit_label: draft.unit_label || '개',
      lines: s.lines.map((l) => ({ ...l, amount: n(l.amount), fx: l.currency === 'KRW' ? 1 : n(l.fx), label: String(l.label || '').trim() })),
      goods_krw: s.goods_krw, logistics_krw: s.logistics_krw, other_krw: s.other_krw, one_time_krw: s.one_time_krw,
      total_krw: s.total_krw, per_unit_krw: s.per_unit_krw, goods_foreign: s.goods_foreign, estimated: s.estimated,
      vat_krw: n(draft.vat_krw), client_note: draft.client_note || '', staff_note: draft.staff_note || '',
      status: 'CONFIRMED', revision: (prev?.revision || 0) + 1, confirmed_at: now, confirmed_by_name: by,
      history: prev ? [...(prev.history || []), { revision: prev.revision || 1, at: prev.confirmed_at || '', by: prev.confirmed_by_name || '', per_unit_krw: prev.per_unit_krw, total_krw: prev.total_krw, reason }] : [],
    };
    const saved = prev ? await base44.entities.LandedCostRecord.update(prev.id, payload) : await base44.entities.LandedCostRecord.create(payload);
    const unitText = `${payload.units.toLocaleString('ko-KR')}${payload.unit_label}`;
    const msg = `${payload.product_name} ${unitText} 주문의 한국 도착 원가가 ${prev ? '수정' : '확정'}됐습니다: ${payload.unit_label}당 ${fmtWon(payload.per_unit_krw)} (부가세 제외)${payload.estimated ? ', 일부 예상값 포함' : ''}.`;
    await Promise.all([
      base44.functions.invoke('notifyCardEvent', { card_id: card.id, type: 'landed_cost_confirmed', message: msg }).catch(() => {}),
      base44.entities.ProjectAuditLog.create({ tenant_id: card.tenant_id, card_id: card.id, event_type: 'LANDED_COST_CONFIRMED', actor_name: by, details: `도착 원가 ${prev ? `수정(${payload.revision}차)` : '확정'}: ${unitText}, 개당 ${fmtWon(payload.per_unit_krw)}${reason ? ` — ${reason}` : ''}` }).catch(() => {}),
    ]);
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ['landed-cost-siblings', card.client_id] });
    return saved;
  };

  const setStatus = async (status) => {
    if (!record.data) return;
    await base44.entities.LandedCostRecord.update(record.data.id, { status });
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ['landed-cost-siblings', card.client_id] });
  };

  return { loading, record: record.data || null, quotation, stages: stages.data || [], shipments: shipments.data || [], products, defaultProduct, prefill, save, setStatus };
}
