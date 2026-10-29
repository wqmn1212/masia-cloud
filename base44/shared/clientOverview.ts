import { quotationVisibleToClient } from './clientAccess.ts';
import { clientQcReport, latestSentSpecs } from './clientQc.ts';
import { destCostState } from './destCost.ts';
import { clientCardSummary, todosByCard, paymentRequestState, calendarEvents, orderRows, sourcingProgress } from './clientSummary.ts';
import { rolesOf, hasRoleSetup, can, canApprove, normalizeRules } from './clientRoles.ts';

// 고객 대시보드 데이터 (listClientTodos 응답, 주간 요약 메일도 같은 계산을 쓴다): 고객이 할 일(서명·결제·기준서·검수·도착지 비용·견적 비교표·디자인 확인·사내 결재), 앞으로 14일 일정,
// 주문 현황판 한 줄 요약(summaries)과 보여 줄 순서(order), 입고 달력 일정(calendar).
// 공개 카드(client_visible)·공개 검수·공개 단계·공개 선적만 다루며 내부 필드는 응답에 넣지 않는다.
const UPCOMING_DAYS = 14;
const kstDate = (ms) => new Date(ms + 9 * 3600 * 1000).toISOString().slice(0, 10);
const DAY_MS = 24 * 3600 * 1000;
// 결재 요청자에게 반려·무효를 보여 주는 기간
const RETURNED_DAYS = 14;

export async function clientOverview(svc: any, { user, companyId }: { user: any; companyId: string }): Promise<any> {
  // 서명할 계약서: 이 계정이 서명자로 지정된, 기한 안의 요청 (카드 없는 구독 계약서도 포함)
  const signaturePending = user.account_tier === 'client'
    ? (await svc.entities.SignatureRequest.filter({ client_id: companyId, status: 'OUT' }, 'due_at', 50))
      .filter((r) => r.client_id === companyId && Date.parse(r.due_at) >= Date.now() && (r.signers || []).some((x) => x.user_id === user.id && x.status !== 'SIGNED'))
      .map((r) => ({ request_id: r.id, card_id: r.card_id || '', document_title: r.document_title, document_no: r.document_no, due_at: r.due_at }))
    : [];
  const cards = (await svc.entities.TaskCard.filter({ client_id: companyId, client_visible: true }, '-updated_date', 200))
    .filter((c) => !['DONE', 'CANCELLED'].includes(c.status));
  // 내 역할과 사내 결재 (역할을 정하지 않은 고객사는 비어 있다)
  const company = await svc.entities.Company.get(companyId).catch(() => null);
  const me = String(user.email || '').toLowerCase();
  const team = { has_setup: hasRoleSetup(company), my_roles: rolesOf(company, me), can_decide: can(company, me, 'decide'), can_manage: can(company, me, 'manage'), rules_on: Object.entries(normalizeRules(company?.approval_rules).kinds).filter(([, r]) => r.on).map(([k]) => k) };
  const since = new Date(Date.now() - RETURNED_DAYS * DAY_MS).toISOString();
  const approvals = team.has_setup
    ? (await svc.entities.ClientApproval.filter({ company_id: companyId }, '-requested_at', 100))
      .filter((a) => a.company_id === companyId && (a.status === 'PENDING' || (['REJECTED', 'STALE'].includes(a.status) && String(a.requested_by_email || '').toLowerCase() === me && (a.decided_at || '') >= since)))
      .map((a) => ({
        approval_id: a.id, card_id: a.card_id, card_title: a.card_title || '', kind: a.kind, target_label: a.target_label || '', status: a.status,
        requested_by_name: a.requested_by_name || '', requested_at: a.requested_at || '', request_note: a.request_note || '', amount_krw: a.amount_krw ?? null,
        decided_by_name: a.decided_by_name || '', decided_at: a.decided_at || '', reason: a.reason || '',
        mine: String(a.requested_by_email || '').toLowerCase() === me, can_approve: a.status === 'PENDING' && canApprove(company, me, a),
      }))
    : [];
  if (!cards.length) return { spec_pending: [], qc_pending: [], dest_cost_pending: [], comparison_pending: [], payment_pending: [], file_review_pending: [], signature_pending: signaturePending, approvals, team, upcoming: [], summaries: {}, order: [], calendar: [] };
  const ids = cards.map((c) => c.id);
  const titles = new Map(cards.map((c) => [c.id, c.title]));

  const reports = await svc.entities.QCReport.filter({ card_id: { $in: ids }, client_visible: true }, '-created_date', 200);
  const qcPending = reports
    .filter((r) => titles.has(r.card_id) && r.client_visible === true && r.client_decision !== 'APPROVED')
    .map(clientQcReport)
    .map((q) => ({ report_id: q.id, card_id: q.card_id, card_title: titles.get(q.card_id), inspection_type: q.inspection_type, qc_result: q.qc_result, decision: q.decision, published_at: q.published_at }));

  // 카드별 최신으로 보낸 기준서 중 고객이 아직 판단하지 않은 것 (수정 요청은 담당자 차례)
  const specs = await svc.entities.QualitySpec.filter({ card_id: { $in: ids }, status: 'SENT' }, '-version', 200);
  const specPending = [...latestSentSpecs(specs.filter((s) => titles.has(s.card_id))).values()]
    .filter((s) => !s.client_decision || s.client_decision === 'PENDING')
    .map((s) => ({ spec_id: s.id, card_id: s.card_id, card_title: titles.get(s.card_id), version: s.version || 1, sent_at: s.sent_at || '' }));

  // 계획 확정 전 초안 일정은 고객에게 보이지 않는다 (getClientCardDetail 과 같은 규칙)
  const planned = cards.filter((c) => c.plan_confirmed_at).map((c) => c.id);
  const today = kstDate(Date.now());
  const until = kstDate(Date.now() + UPCOMING_DAYS * DAY_MS);
  const milestones = planned.length ? (await svc.entities.CardMilestone.filter({ card_id: { $in: planned } }, 'planned_date', 1000)).filter((m) => planned.includes(m.card_id)) : [];
  // 공개된 선적 중 아직 도착 전인 것의 도착 예정일도 함께 보여 준다
  const shipments = (await svc.entities.Shipment.filter({ card_id: { $in: ids }, client_visible: true }, 'eta', 200)).filter((s) => titles.has(s.card_id) && s.client_visible === true);
  // 담당자가 보낸 도착지 비용 예상액 중 고객이 아직 확인하지 않은 것 (문의는 담당자 차례)
  const destCostPending = shipments
    .filter((s) => destCostState(s) === 'SENT')
    .map((s) => ({ shipment_id: s.id, card_id: s.card_id, card_title: titles.get(s.card_id), label: s.label || '선적', amount: Math.round(Number(s.dest_cost_estimate?.buyer_ex_vat) || 0), etd: s.etd || '' }));
  // 공개됐지만 고객이 아직 안을 고르지 않은 견적 비교표 (카드별 최신 1건)
  const comparisons = await svc.entities.QuoteComparison.filter({ card_id: { $in: ids } }, '-created_date', 200);
  const seenCmp = new Set();
  const comparisonPending = comparisons
    .filter((r) => { if (seenCmp.has(r.card_id) || r.status === 'CLOSED') return false; seenCmp.add(r.card_id); return true; })
    .filter((r) => titles.has(r.card_id) && r.status === 'PUBLISHED' && r.client_snapshot)
    .map((r) => ({ comparison_id: r.id, card_id: r.card_id, card_title: titles.get(r.card_id), options: (r.client_snapshot.options || []).length, published_at: r.published_at || '' }));
  // 담당자가 보낸 결제 요청 중 고객이 아직 송금했다고 알리지 않은 것 (송금 신고 뒤는 담당자 확인 차례)
  const stages = (await svc.entities.PaymentStage.filter({ card_id: { $in: ids } }, 'created_date', 500)).filter((s) => titles.has(s.card_id));
  const paymentPending = stages
    .filter((s) => paymentRequestState(s) === 'REQUESTED')
    .map((s) => ({ stage_id: s.id, card_id: s.card_id, card_title: titles.get(s.card_id), stage_type: s.stage_type, amount: s.amount ?? null, currency: s.currency || '', due_date: s.due_date || '' }))
    .sort((a, b) => (a.due_date || '9999-12-31').localeCompare(b.due_date || '9999-12-31'));
  // 담당자가 보낸 디자인·도면 확인 요청 중 고객이 아직 답하지 않은 것
  const fileReviewPending = (await svc.entities.FileReview.filter({ company_id: companyId, status: 'PENDING' }, 'due_date', 100))
    .filter((r) => titles.has(r.card_id) && r.company_id === companyId)
    .map((r) => ({ review_id: r.id, card_id: r.card_id, card_title: titles.get(r.card_id), file_name: r.file_name || '', question: r.question || '', due_date: r.due_date || '', requested_at: r.requested_at || '' }));
  const arrivals = shipments
    .filter((s) => ['BOOKED', 'DEPARTED'].includes(s.status) && s.eta >= today && s.eta <= until)
    .map((s) => ({ id: `ship-${s.id}`, card_id: s.card_id, card_title: titles.get(s.card_id), label: `${s.label || '선적'} 도착 예정`, planned_date: s.eta }));
  const upcoming = milestones
    .filter((m) => m.client_visible !== false && !['done', 'skipped'].includes(m.status) && m.planned_date >= today && m.planned_date <= until)
    .map((m) => ({ id: m.id, card_id: m.card_id, card_title: titles.get(m.card_id), label: m.label, planned_date: m.planned_date }))
    .concat(arrivals)
    .sort((a, b) => a.planned_date.localeCompare(b.planned_date))
    .slice(0, 12);

  // 주문 현황판: 견적 검토 단계 카드는 공개 견적이 있어야 고객님 차례
  const reviewIds = cards.filter((c) => c.status === 'REVIEW' && !c.plan_confirmed_at).map((c) => c.id);
  const quoted = new Set(reviewIds.length
    ? (await svc.entities.Quotation.filter({ card_id: { $in: reviewIds } }, '-created_date', 200)).filter((q) => quotationVisibleToClient(q, companyId)).map((q) => q.card_id)
    : []);
  // 소싱 진행률: 소싱 중 카드의 견적 수(공개 여부와 상관없이 개수만)와 비교표 초안 여부
  const sourcingIds = cards.filter((c) => c.status === 'IN_PROGRESS').map((c) => c.id);
  const sourcingQuotes = sourcingIds.length ? (await svc.entities.Quotation.filter({ card_id: { $in: sourcingIds } }, '-created_date', 500)).filter((q) => sourcingIds.includes(q.card_id)) : [];
  const sourcingCmp = new Set(comparisons.filter((r) => sourcingIds.includes(r.card_id) && r.status !== 'CLOSED').map((r) => r.card_id));
  const todos = todosByCard({ signature_pending: signaturePending, payment_pending: paymentPending, comparison_pending: comparisonPending, spec_pending: specPending, dest_cost_pending: destCostPending, qc_pending: qcPending, file_review_pending: fileReviewPending, approvals: approvals.filter((a) => titles.has(a.card_id)) });
  const summaries = Object.fromEntries(cards.map((c) => [c.id, clientCardSummary({
    card: c,
    milestones: milestones.filter((m) => m.card_id === c.id),
    shipments: shipments.filter((s) => s.card_id === c.id),
    stages: stages.filter((s) => s.card_id === c.id),
    todos: todos.get(c.id) || [],
    hasQuote: quoted.has(c.id),
    today,
  })]));
  for (const c of cards) {
    const sp = sourcingProgress({ card: c, quotes: sourcingQuotes.filter((q) => q.card_id === c.id).length, comparison: sourcingCmp.has(c.id) });
    if (sp && summaries[c.id]) summaries[c.id].sourcing = sp;
  }
  // 고객님 차례 → 일정 변경·보류 → 2주 안 도착 → 나머지 (같은 순위는 최근 수정 순)
  const order = orderRows(cards.map((c) => ({ card: c, summary: summaries[c.id] }))).map((r) => r.card.id);
  // 입고 달력: 지난 60일 ~ 앞으로 180일
  const calendar = calendarEvents({ cards, milestones, shipments, from: kstDate(Date.now() - 60 * DAY_MS), to: kstDate(Date.now() + 180 * DAY_MS) });

  return { spec_pending: specPending, qc_pending: qcPending, dest_cost_pending: destCostPending, comparison_pending: comparisonPending, payment_pending: paymentPending, file_review_pending: fileReviewPending, signature_pending: signaturePending, approvals, team, upcoming, summaries, order, calendar };
}
