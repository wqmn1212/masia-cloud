import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireClient } from '../../shared/clientAccess.ts';
import { clientQcReport, latestSentSpecs } from '../../shared/clientQc.ts';
import { destCostState } from '../../shared/destCost.ts';

// 고객 대시보드 '하실 일': 승인을 기다리는 품질 기준서·검수 결과·도착지 비용·견적 비교표 + 앞으로 14일 안의 공개 일정.
// 공개 카드(client_visible)·공개 검수·공개 단계만 다루며 내부 필드는 응답에 넣지 않는다.
const UPCOMING_DAYS = 14;
const kstDate = (ms) => new Date(ms + 9 * 3600 * 1000).toISOString().slice(0, 10);

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireClient(base44, req);
    if (auth.error) return auth.error;

    const svc = base44.asServiceRole;
    // 서명할 계약서: 이 계정이 서명자로 지정된, 기한 안의 요청 (카드 없는 구독 계약서도 포함)
    const signaturePending = auth.user.account_tier === 'client'
      ? (await svc.entities.SignatureRequest.filter({ client_id: auth.companyId, status: 'OUT' }, 'due_at', 50))
        .filter((r) => r.client_id === auth.companyId && Date.parse(r.due_at) >= Date.now() && (r.signers || []).some((x) => x.user_id === auth.user.id && x.status !== 'SIGNED'))
        .map((r) => ({ request_id: r.id, document_title: r.document_title, document_no: r.document_no, due_at: r.due_at }))
      : [];
    const cards = (await svc.entities.TaskCard.filter({ client_id: auth.companyId, client_visible: true }, '-updated_date', 200))
      .filter((c) => !['DONE', 'CANCELLED'].includes(c.status));
    if (!cards.length) return Response.json({ spec_pending: [], qc_pending: [], dest_cost_pending: [], comparison_pending: [], signature_pending: signaturePending, upcoming: [] });
    const titles = new Map(cards.map((c) => [c.id, c.title]));

    const reports = await svc.entities.QCReport.filter({ card_id: { $in: cards.map((c) => c.id) }, client_visible: true }, '-created_date', 200);
    const qcPending = reports
      .filter((r) => titles.has(r.card_id) && r.client_visible === true && r.client_decision !== 'APPROVED')
      .map(clientQcReport)
      .map((q) => ({ report_id: q.id, card_id: q.card_id, card_title: titles.get(q.card_id), inspection_type: q.inspection_type, qc_result: q.qc_result, decision: q.decision, published_at: q.published_at }));

    // 카드별 최신으로 보낸 기준서 중 고객이 아직 판단하지 않은 것 (수정 요청은 담당자 차례)
    const specs = await svc.entities.QualitySpec.filter({ card_id: { $in: cards.map((c) => c.id) }, status: 'SENT' }, '-version', 200);
    const specPending = [...latestSentSpecs(specs.filter((s) => titles.has(s.card_id))).values()]
      .filter((s) => !s.client_decision || s.client_decision === 'PENDING')
      .map((s) => ({ spec_id: s.id, card_id: s.card_id, card_title: titles.get(s.card_id), version: s.version || 1, sent_at: s.sent_at || '' }));

    // 계획 확정 전 초안 일정은 고객에게 보이지 않는다 (getClientCardDetail 과 같은 규칙)
    const planned = cards.filter((c) => c.plan_confirmed_at).map((c) => c.id);
    const today = kstDate(Date.now());
    const until = kstDate(Date.now() + UPCOMING_DAYS * 24 * 3600 * 1000);
    const milestones = planned.length ? await svc.entities.CardMilestone.filter({ card_id: { $in: planned } }, 'planned_date', 1000) : [];
    // 공개된 선적 중 아직 도착 전인 것의 도착 예정일도 함께 보여 준다
    const shipments = await svc.entities.Shipment.filter({ card_id: { $in: cards.map((c) => c.id) }, client_visible: true }, 'eta', 200);
    // 담당자가 보낸 도착지 비용 예상액 중 고객이 아직 확인하지 않은 것 (문의는 담당자 차례)
    const destCostPending = shipments
      .filter((s) => titles.has(s.card_id) && destCostState(s) === 'SENT')
      .map((s) => ({ shipment_id: s.id, card_id: s.card_id, card_title: titles.get(s.card_id), label: s.label || '선적', amount: Math.round(Number(s.dest_cost_estimate?.buyer_ex_vat) || 0), etd: s.etd || '' }));
    // 공개됐지만 고객이 아직 안을 고르지 않은 견적 비교표 (카드별 최신 1건)
    const comparisons = await svc.entities.QuoteComparison.filter({ card_id: { $in: cards.map((c) => c.id) } }, '-created_date', 200);
    const seenCmp = new Set();
    const comparisonPending = comparisons
      .filter((r) => { if (seenCmp.has(r.card_id) || r.status === 'CLOSED') return false; seenCmp.add(r.card_id); return true; })
      .filter((r) => titles.has(r.card_id) && r.status === 'PUBLISHED' && r.client_snapshot)
      .map((r) => ({ comparison_id: r.id, card_id: r.card_id, card_title: titles.get(r.card_id), options: (r.client_snapshot.options || []).length, published_at: r.published_at || '' }));
    const arrivals = shipments
      .filter((s) => titles.has(s.card_id) && ['BOOKED', 'DEPARTED'].includes(s.status) && s.eta >= today && s.eta <= until)
      .map((s) => ({ id: `ship-${s.id}`, card_id: s.card_id, card_title: titles.get(s.card_id), label: `${s.label || '선적'} 도착 예정`, planned_date: s.eta }));
    const upcoming = milestones
      .filter((m) => titles.has(m.card_id) && m.client_visible !== false && !['done', 'skipped'].includes(m.status) && m.planned_date >= today && m.planned_date <= until)
      .map((m) => ({ id: m.id, card_id: m.card_id, card_title: titles.get(m.card_id), label: m.label, planned_date: m.planned_date }))
      .concat(arrivals)
      .sort((a, b) => a.planned_date.localeCompare(b.planned_date))
      .slice(0, 12);

    return Response.json({ spec_pending: specPending, qc_pending: qcPending, dest_cost_pending: destCostPending, comparison_pending: comparisonPending, signature_pending: signaturePending, upcoming });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
