// 월간 업무 리포트 집계. 고객에게 보여 줄 숫자만 계산한다 (공개 카드·공개 단계 기준, 원가·공장명 제외).
import { kstToday } from './chinaHoliday.ts';

export const CARD_STATUS_LABEL = { TODO: '대기 중', IN_PROGRESS: '소싱 중', REVIEW: '견적 검토', PRODUCTION: '발주 · 제작', DONE: '완료', CANCELLED: '취소' };

export const validMonth = (m) => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
export const kstDateOf = (iso) => (iso ? new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10) : '');
export const monthRange = (month) => {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, '0')}` };
};
export const previousMonth = (today = kstToday()) => {
  const [y, m] = today.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};

async function byCards(entity, ids, sort = 'created_date') {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    for (let skip = 0; ; skip += 1000) {
      const page = await entity.filter({ card_id: { $in: chunk } }, sort, 1000, skip);
      out.push(...page);
      if (page.length < 1000) break;
    }
  }
  return out;
}

// 계약에 연결된 카드가 있으면 그 카드만, 없으면 다른 계약에 묶이지 않은 그 고객사의 공개 카드
export async function reportCards(svc, company, agreement, month) {
  const { start, end } = monthRange(month);
  const all = (await svc.entities.TaskCard.filter({ client_id: company.id, client_visible: true }, '-created_date', 500))
    .filter((c) => c.tenant_id === company.tenant_id && c.status !== 'CANCELLED');
  const linked = agreement ? all.filter((c) => c.agreement_id === agreement.id) : [];
  const pool = linked.length ? linked : all.filter((c) => !c.agreement_id || c.agreement_id === agreement?.id);
  // 그 달에 살아 있던 카드: 달이 끝나기 전에 만들어졌고, 달 시작 전에 이미 끝난 카드는 제외
  return pool.filter((c) => kstDateOf(c.created_date) <= end && !(c.status === 'DONE' && kstDateOf(c.updated_date) < start));
}

export async function buildMonthlyReport(svc, { company, agreement, month }) {
  const { start, end } = monthRange(month);
  const inMonth = (d) => !!d && d >= start && d <= end;
  const cards = await reportCards(svc, company, agreement, month);
  const ids = cards.map((c) => c.id);
  const [milestones, qcReports, meetings, chats, shipments] = ids.length
    ? await Promise.all([
      byCards(svc.entities.CardMilestone, ids, 'seq'),
      byCards(svc.entities.QCReport, ids),
      byCards(svc.entities.MeetingLog, ids, 'meeting_date'),
      byCards(svc.entities.CardChat, ids),
      byCards(svc.entities.Shipment, ids),
    ])
    : [[], [], [], [], []];

  const visibleSteps = milestones.filter((m) => m.client_visible !== false && m.status !== 'skipped');
  const doneSteps = visibleSteps.filter((m) => m.status === 'done' && inMonth(m.actual_date));
  const onTime = doneSteps.filter((m) => { const due = m.baseline_date || m.planned_date; return !due || m.actual_date <= due; });
  const qc = qcReports.filter((r) => inMonth(kstDateOf(r.created_date)));
  const meets = meetings.filter((m) => inMonth(m.meeting_date));
  const talk = chats.filter((c) => inMonth(kstDateOf(c.created_date)));
  const departed = shipments.filter((s) => inMonth(s.atd));

  const metrics = {
    projects: cards.length,
    steps_done: doneSteps.length,
    steps_on_time: onTime.length,
    qc_reports: qc.length,
    qc_pass: qc.filter((r) => r.qc_result === 'PASS').length,
    qc_conditional: qc.filter((r) => r.qc_result === 'CONDITIONAL_PASS').length,
    qc_fail: qc.filter((r) => r.qc_result === 'FAIL').length,
    qc_items_checked: qc.reduce((n, r) => n + (r.checklist || []).length, 0),
    site_visits: meets.filter((m) => m.meeting_type === 'OFFLINE').length,
    meetings: meets.length,
    staff_replies: talk.filter((c) => c.is_client_visible === true && c.sender_role !== 'CLIENT').length,
    client_messages: talk.filter((c) => c.sender_role === 'CLIENT').length,
    shipments_departed: departed.length,
  };

  const summaries = cards.map((c) => {
    const steps = visibleSteps.filter((m) => m.card_id === c.id).sort((a, b) => (a.seq || 0) - (b.seq || 0));
    const next = steps.find((m) => m.status !== 'done');
    return {
      card_id: c.id,
      title: c.title,
      status: CARD_STATUS_LABEL[c.status] || c.status,
      done_steps: steps.filter((m) => m.status === 'done' && inMonth(m.actual_date)).map((m) => m.label),
      next_step: next?.label || '',
      next_date: next?.planned_date || '',
    };
  });

  return { metrics, cards: summaries };
}
