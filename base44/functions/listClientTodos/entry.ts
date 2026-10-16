import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireClient } from '../../shared/clientAccess.ts';
import { clientQcReport } from '../../shared/clientQc.ts';

// 고객 대시보드 '하실 일': 출고 판단을 기다리는 검수 결과 + 앞으로 14일 안의 공개 일정.
// 공개 카드(client_visible)·공개 검수·공개 단계만 다루며 내부 필드는 응답에 넣지 않는다.
const UPCOMING_DAYS = 14;
const kstDate = (ms) => new Date(ms + 9 * 3600 * 1000).toISOString().slice(0, 10);

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireClient(base44, req);
    if (auth.error) return auth.error;

    const svc = base44.asServiceRole;
    const cards = (await svc.entities.TaskCard.filter({ client_id: auth.companyId, client_visible: true }, '-updated_date', 200))
      .filter((c) => !['DONE', 'CANCELLED'].includes(c.status));
    if (!cards.length) return Response.json({ qc_pending: [], upcoming: [] });
    const titles = new Map(cards.map((c) => [c.id, c.title]));

    const reports = await svc.entities.QCReport.filter({ card_id: { $in: cards.map((c) => c.id) }, client_visible: true }, '-created_date', 200);
    const qcPending = reports
      .filter((r) => titles.has(r.card_id) && r.client_visible === true && r.client_decision !== 'APPROVED')
      .map(clientQcReport)
      .map((q) => ({ report_id: q.id, card_id: q.card_id, card_title: titles.get(q.card_id), inspection_type: q.inspection_type, qc_result: q.qc_result, decision: q.decision, published_at: q.published_at }));

    // 계획 확정 전 초안 일정은 고객에게 보이지 않는다 (getClientCardDetail 과 같은 규칙)
    const planned = cards.filter((c) => c.plan_confirmed_at).map((c) => c.id);
    const today = kstDate(Date.now());
    const until = kstDate(Date.now() + UPCOMING_DAYS * 24 * 3600 * 1000);
    const milestones = planned.length ? await svc.entities.CardMilestone.filter({ card_id: { $in: planned } }, 'planned_date', 1000) : [];
    const upcoming = milestones
      .filter((m) => titles.has(m.card_id) && m.client_visible !== false && !['done', 'skipped'].includes(m.status) && m.planned_date >= today && m.planned_date <= until)
      .sort((a, b) => a.planned_date.localeCompare(b.planned_date))
      .slice(0, 12)
      .map((m) => ({ id: m.id, card_id: m.card_id, card_title: titles.get(m.card_id), label: m.label, planned_date: m.planned_date }));

    return Response.json({ qc_pending: qcPending, upcoming });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
