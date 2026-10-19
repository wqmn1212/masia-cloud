import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireClient } from '../../shared/clientAccess.ts';
import { latestSentSpecs } from '../../shared/clientQc.ts';
import { CARD_STATUS_LABEL, kstDateOf } from '../../shared/monthlyReport.ts';
import { SHIPMENT_STATUS_LABEL } from '../../shared/shipments.ts';

// 고객 '프로젝트 현황 엑셀' 내보내기용 행. 고객 포털에 이미 공개된 값만 모은다
// (공개 카드 · 계획 확정 후 공개 단계 · 공개 검수 · 보낸 기준서 · 공개 선적). 원가·공장명 제외.
const QC_RESULT = { PASS: '합격', CONDITIONAL_PASS: '조건부 합격', FAIL: '불합격' };
const QC_DECISION = { APPROVED: '승인', ON_HOLD: '보류 요청' };
const SPEC_DECISION = { APPROVED: '승인', REVISION_REQUESTED: '수정 요청' };
const PRIORITY = { LOW: '낮음', MEDIUM: '보통', HIGH: '높음', URGENT: '긴급' };

async function byCards(entity, ids, query = {}, sort = 'created_date') {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) out.push(...await entity.filter({ ...query, card_id: { $in: ids.slice(i, i + 50) } }, sort, 1000));
  return out;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireClient(base44, req);
    if (auth.error) return auth.error;
    const svc = base44.asServiceRole, db = svc.entities;
    const cards = (await db.TaskCard.filter({ client_id: auth.companyId, client_visible: true }, '-updated_date', 500)).filter((c) => c.status !== 'CANCELLED');
    if (!cards.length) return Response.json({ rows: [] });
    const ids = cards.map((c) => c.id);
    const confirmed = cards.filter((c) => c.plan_confirmed_at).map((c) => c.id);
    const [milestones, qc, specs, shipments, categories] = await Promise.all([
      confirmed.length ? byCards(db.CardMilestone, confirmed, {}, 'seq') : [],
      byCards(db.QCReport, ids, { client_visible: true }, '-created_date'),
      byCards(db.QualitySpec, ids, { status: 'SENT' }, '-version'),
      byCards(db.Shipment, ids, { client_visible: true }, '-created_date'),
      db.MachineCategory.list('label_kr', 500),
    ]);
    const catLabel = new Map(categories.filter((c) => c.key).map((c) => [c.key, c.label_kr]));
    const sentSpecs = latestSentSpecs(specs);

    const rows = cards.map((c) => {
      const steps = milestones.filter((m) => m.card_id === c.id && m.client_visible !== false && m.status !== 'skipped').sort((a, b) => (a.seq || 0) - (b.seq || 0));
      const next = steps.find((m) => m.status !== 'done');
      const lastQc = qc.find((r) => r.card_id === c.id);
      const spec = sentSpecs.get(c.id);
      const ship = shipments.find((s) => s.card_id === c.id);
      return {
        title: c.title,
        status: CARD_STATUS_LABEL[c.status] || c.status,
        priority: PRIORITY[c.priority] || '',
        category: catLabel.get(c.target_machine_category) || '',
        delivery_date: c.delivery_date || c.due_date || '',
        progress: steps.length ? `${steps.filter((m) => m.status === 'done').length}/${steps.length}` : '',
        next_step: next?.label || '',
        next_date: next?.planned_date || '',
        quality_spec: spec ? `v${spec.version || 1} ${SPEC_DECISION[spec.client_decision] || '확인 대기'}` : '',
        last_qc: lastQc ? `${(lastQc.client_published_at || lastQc.created_date || '').slice(0, 10)} ${QC_RESULT[lastQc.qc_result] || ''} · ${QC_DECISION[lastQc.client_decision] || '확인 대기'}` : '',
        shipment: ship ? `${SHIPMENT_STATUS_LABEL[ship.status] || ship.status}${ship.ata ? ` · 도착 ${ship.ata}` : ship.eta ? ` · 도착 예정 ${ship.eta}` : ''}` : '',
        updated: kstDateOf(c.updated_date),
      };
    });
    return Response.json({ rows });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
