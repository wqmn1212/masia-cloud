// 고객 성과 리포트 (분기·반기·연간 등 기간). 고객에게 보여 줄 '에이전시를 써서 얻은 것'을 숫자로 계산한다.
// 원가·마진·공장 이름은 결과에 넣지 않는다 (절감률·공장 수처럼 비율과 개수만).
// 화면·PDF·서버가 같은 결과를 쓴다. summarizePerformance 는 순수 함수라 검산에서 바로 부른다.
import { CARD_STATUS_LABEL, kstDateOf } from './monthlyReport.ts';

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round1 = (v: number) => Math.round(v * 10) / 10;
const DAY = 86400000;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
const avg = (xs: number[]) => (xs.length ? round1(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);
const normFactory = (s: unknown) => String(s || '').replace(/\s+/g, '').replace(/[()（）]/g, '').toLowerCase();

export const validDate = (d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));

// 기간 이름 (예: 2026년 3분기, 2026년 상반기, 2026년, 2026-07-01 ~ 2026-09-30)
export function periodLabel(start: string, end: string) {
  const [ys, ms, ds] = start.split('-').map(Number);
  const [ye, me] = end.split('-').map(Number);
  const lastDay = new Date(Date.UTC(ye, me, 0)).getUTCDate();
  const fullMonths = ds === 1 && end.endsWith(`-${String(lastDay).padStart(2, '0')}`) && ys === ye;
  if (fullMonths) {
    if (ms === 1 && me === 12) return `${ys}년`;
    if (ms === 1 && me === 6) return `${ys}년 상반기`;
    if (ms === 7 && me === 12) return `${ys}년 하반기`;
    if (me - ms === 2 && (ms - 1) % 3 === 0) return `${ys}년 ${(ms + 2) / 3}분기`;
    if (ms === me) return `${ys}년 ${ms}월`;
    return `${ys}년 ${ms}~${me}월`;
  }
  return `${start} ~ ${end}`;
}

// 공장 원가(CNY). 견적끼리 같은 기준으로 비교할 때만 쓴다 (고객에게는 비율만 보인다)
function costCNY(q: any) {
  if (num(q.factory_total_cost) > 0) return num(q.factory_total_cost);
  const opts = (q.quote_options || []).filter((o: any) => !o.optional && num(o.unit_price) > 0);
  if (!opts.length || opts.some((o: any) => (o.currency || 'CNY') !== 'CNY')) return null;
  return opts.reduce((s: number, o: any) => s + num(o.unit_price) * (num(o.quantity) || 1), 0);
}

// 카드에서 고객이 고른(또는 진행한) 견적: 수락한 견적 → 비교표에서 확정한 안의 견적 → 고객에게 보낸 견적이 하나뿐이면 그것
function chosenQuote(quotes: any[], comparison: any) {
  const accepted = quotes.filter((q) => q.client_accepted_at || q.status === 'ACCEPTED');
  if (accepted.length) return accepted.sort((a, b) => String(b.client_accepted_at || '').localeCompare(String(a.client_accepted_at || '')))[0];
  const key = comparison?.confirmed_option_key || comparison?.client_choice?.option_key;
  if (key) {
    const opt = (comparison.options || []).find((o: any) => o.key === key);
    const q = opt && quotes.find((x) => x.id === opt.quotation_id);
    if (q) return q;
  }
  const sent = quotes.filter((q) => q.client_published_at);
  return sent.length === 1 ? sent[0] : null;
}

/**
 * data: 그 고객사의 { cards, quotes, comparisons, landed, claims, qc, shipments, milestones, meetings } (고객사로 이미 좁힌 값)
 * 돌려줌: { metrics, sections, products } — 고객에게 그대로 보여도 되는 값만
 */
export function summarizePerformance(data: any, { start, end }: { start: string; end: string }) {
  const inP = (d: string) => !!d && d >= start && d <= end;
  const startOf = (c: any) => c.received_date || kstDateOf(c.created_date);
  const doneOf = (c: any) => c.completed_date || kstDateOf(c.updated_date);
  const qcDate = (r: any) => kstDateOf(r.client_published_at || r.created_date);
  const cards = (data.cards || []).filter((c: any) => c.client_visible === true && c.status !== 'CANCELLED');
  // 기간에 살아 있던 카드: 기간 끝 전에 만들어졌고, 기간 시작 전에 이미 끝난 카드는 뺀다
  const alive = cards.filter((c: any) => startOf(c) <= end && !(c.status === 'DONE' && doneOf(c) < start));
  const ids = new Set(alive.map((c: any) => c.id));
  const by = (rows: any[] = []) => rows.filter((r) => ids.has(r.card_id));
  const quotes = by(data.quotes), comparisons = by(data.comparisons), landed = by(data.landed).filter((r) => r.status === 'CONFIRMED');
  const claims = by(data.claims), qc = by(data.qc), shipments = by(data.shipments), milestones = by(data.milestones), meetings = by(data.meetings);
  const quotesOf = (id: string) => quotes.filter((q) => q.card_id === id);

  // ── 진행
  const done = alive.filter((c: any) => c.status === 'DONE' && inP(doneOf(c)));
  const ordered = alive.filter((c: any) => ['PRODUCTION', 'DONE'].includes(c.status));

  // ── 견적: 보낸 견적, 검토한 공장 수, 첫 견적까지 걸린 날
  const sentInP = quotes.filter((q) => inP(kstDateOf(q.client_published_at)));
  const quotedCards = alive.filter((c: any) => sentInP.some((q) => q.card_id === c.id));
  const factoriesPer = quotedCards.map((c: any) => new Set(quotesOf(c.id).map((q) => normFactory(q.factory_name)).filter(Boolean)).size).filter((n) => n > 0);
  const firstQuoteDays: number[] = [];
  for (const c of alive) {
    const first = quotesOf(c.id).map((q) => kstDateOf(q.client_published_at)).filter(Boolean).sort()[0];
    if (first && inP(first)) firstQuoteDays.push(Math.max(0, daysBetween(startOf(c), first)));
  }

  // ── 절감: 같은 카드에 공장 원가가 있는 견적이 2건 이상이고 고른 견적이 있을 때, 그중 가장 비싼 견적 대비 몇 % 낮은지
  const savings: number[] = [];
  for (const c of alive) {
    const qs = quotesOf(c.id).filter((q) => costCNY(q) != null);
    if (qs.length < 2) continue;
    const comp = comparisons.filter((x) => x.card_id === c.id).sort((a, b) => num(b.version) - num(a.version))[0];
    const pick = chosenQuote(qs, comp);
    if (!pick) continue;
    const decided = kstDateOf(pick.client_accepted_at) || kstDateOf(comp?.confirmed_at) || kstDateOf(pick.client_published_at);
    if (!inP(decided)) continue;
    const max = Math.max(...qs.map((q) => costCNY(q) as number));
    if (max > 0) savings.push(round1(((max - (costCNY(pick) as number)) / max) * 100));
  }

  // ── 일정: 기간에 끝낸 단계 중 기한 안에 끝낸 비율, 도착한 선적 중 예정일 안에 도착한 비율
  const stepsDone = milestones.filter((m) => m.client_visible !== false && m.status === 'done' && inP(m.actual_date));
  const withDue = stepsDone.filter((m) => m.baseline_date || m.planned_date);
  const onTime = withDue.filter((m) => m.actual_date <= (m.baseline_date || m.planned_date));
  const arrived = shipments.filter((s) => inP(s.ata));
  const arrivedOnTime = arrived.filter((s) => !s.eta || s.ata <= s.eta);
  const departed = shipments.filter((s) => inP(s.atd));

  // ── 품질: 검수, 출고 전에 잡아낸 문제, 불량 신고와 보상
  const qcIn = qc.filter((r) => inP(qcDate(r)));
  const caught = qcIn.filter((r) => ['FAIL', 'CONDITIONAL_PASS'].includes(r.qc_result));
  const claimsIn = claims.filter((c) => inP(kstDateOf(c.submitted_at || c.created_date)) && c.status !== 'REJECTED');
  const resolved = claims.filter((c) => c.status === 'RESOLVED' && inP(kstDateOf(c.resolved_at)));
  const compensation: Record<string, number> = {};
  for (const c of claims) {
    const amt = num(c.compensation?.amount);
    if (c.status === 'REJECTED' || amt <= 0) continue;
    const when = kstDateOf(c.compensation?.applied_at || c.compensation?.promised_at || c.resolved_at);
    if (!inP(when)) continue;
    const cur = c.compensation?.currency || 'KRW';
    compensation[cur] = (compensation[cur] || 0) + amt;
  }
  let defect = 0, received = 0;
  for (const c of claimsIn) if (num(c.defect_qty) > 0 && num(c.received_qty) > 0) { defect += num(c.defect_qty); received += num(c.received_qty); }

  // ── 비용: 도착 원가 확정, 같은 상품 재주문 때 개당 원가 변화, 도착지 비용 예상 정확도
  const landedIn = landed.filter((r) => inP(r.order_date));
  const trends: any[] = [];
  const byProduct = new Map<string, any[]>();
  // 재주문 비교는 기간 전 주문(이미 끝난 카드)도 기준점으로 쓴다
  const visibleIds = new Set(cards.map((c: any) => c.id));
  const landedAll = (data.landed || []).filter((r: any) => visibleIds.has(r.card_id) && r.status === 'CONFIRMED');
  for (const r of landedAll) { const k = r.product_key || r.card_id; byProduct.set(k, [...(byProduct.get(k) || []), r]); }
  for (const [, rows] of byProduct) {
    const list = rows.filter((r) => num(r.per_unit_krw) > 0 && r.order_date && r.order_date <= end).sort((a, b) => a.order_date.localeCompare(b.order_date));
    if (list.length < 2 || !inP(list.at(-1).order_date)) continue;
    const first = list[0], last = list.at(-1);
    trends.push({ product_name: last.product_name || '', first_date: first.order_date, last_date: last.order_date, first_krw: Math.round(num(first.per_unit_krw)), last_krw: Math.round(num(last.per_unit_krw)), change_pct: round1(((num(last.per_unit_krw) - num(first.per_unit_krw)) / num(first.per_unit_krw)) * 100) });
  }
  const destAcc: number[] = [];
  for (const s of shipments) {
    const est = num(s.dest_cost_estimate?.buyer_ex_vat), act = num(s.dest_cost_actual);
    if (est > 0 && act > 0 && s.dest_cost_sent_at && inP(s.ata || kstDateOf(s.dest_cost_actual_at))) destAcc.push(Math.abs(act - est) / est * 100);
  }

  const metrics = {
    projects_active: alive.length,
    projects_done: done.length,
    projects_ordered: ordered.length,
    quotes_sent: sentInP.length,
    quoted_products: quotedCards.length,
    factories_reviewed: factoriesPer.reduce((s, n) => s + n, 0),
    factories_per_product: avg(factoriesPer),
    first_quote_days_avg: avg(firstQuoteDays),
    comparisons_published: comparisons.filter((x) => inP(kstDateOf(x.published_at))).length,
    savings_products: savings.length,
    savings_pct_avg: avg(savings),
    steps_done: stepsDone.length,
    steps_on_time_pct: pct(onTime.length, withDue.length),
    shipments_departed: departed.length,
    shipments_arrived: arrived.length,
    arrival_on_time_pct: pct(arrivedOnTime.length, arrived.length),
    qc_reports: qcIn.length,
    qc_items_checked: qcIn.reduce((n, r) => n + (r.checklist || []).length, 0),
    qc_issues_caught: caught.length,
    claims: claimsIn.length,
    claims_resolved: resolved.length,
    defect_rate_pct: received > 0 ? Math.round((defect / received) * 10000) / 100 : null,
    compensation,
    landed_confirmed: landedIn.length,
    dest_cost_accuracy_pct: destAcc.length ? Math.max(0, Math.round(100 - destAcc.reduce((s, x) => s + x, 0) / destAcc.length)) : null,
    meetings: meetings.filter((m) => inP(m.meeting_date)).length,
    site_visits: meetings.filter((m) => inP(m.meeting_date) && m.meeting_type === 'OFFLINE').length,
  };

  const latestQc = (id: string) => qc.filter((r) => r.card_id === id).sort((a, b) => qcDate(b).localeCompare(qcDate(a)))[0];
  const QC_LABEL: Record<string, string> = { PASS: '합격', CONDITIONAL_PASS: '조건부 합격', FAIL: '불합격' };
  const products = alive.map((c: any) => {
    const first = quotesOf(c.id).map((q) => kstDateOf(q.client_published_at)).filter(Boolean).sort()[0] || '';
    const lq = latestQc(c.id);
    const arrivedAt = shipments.filter((s) => s.card_id === c.id && s.ata).map((s) => s.ata).sort().at(-1) || '';
    const lc = landed.filter((r) => r.card_id === c.id).sort((a, b) => String(b.order_date).localeCompare(String(a.order_date)))[0];
    return {
      card_id: c.id, title: c.title, status: (CARD_STATUS_LABEL as any)[c.status] || c.status,
      quotes_sent: quotesOf(c.id).filter((q) => q.client_published_at).length,
      first_quote_days: first ? Math.max(0, daysBetween(startOf(c), first)) : null,
      qc: lq ? QC_LABEL[lq.qc_result] || '' : '',
      arrived: arrivedAt,
      per_unit_krw: lc && num(lc.per_unit_krw) > 0 ? Math.round(num(lc.per_unit_krw)) : null,
    };
  }).sort((a: any, b: any) => (a.status === b.status ? 0 : a.status === '완료' ? 1 : -1));

  return { metrics, trends, products };
}

// 담당자가 고쳐 쓸 수 있는 주요 내용 초안 (숫자가 있는 것만)
export function draftHighlights(m: any, label: string) {
  const lines: string[] = [];
  if (m.projects_active) lines.push(`${label} 동안 ${m.projects_active}개 품목을 진행했고, ${m.projects_done}개를 마무리했습니다.`);
  if (m.quotes_sent) lines.push(`견적 ${m.quotes_sent}건을 보내 드렸습니다${m.first_quote_days_avg != null ? ` (요청부터 첫 견적까지 평균 ${m.first_quote_days_avg}일)` : ''}${m.factories_per_product ? `. 품목마다 평균 ${m.factories_per_product}곳의 공장을 검토했습니다` : ''}.`);
  if (m.savings_products) lines.push(`비교 견적을 받은 ${m.savings_products}개 품목은 가장 높은 견적보다 평균 ${m.savings_pct_avg}% 낮은 조건으로 진행했습니다.`);
  if (m.qc_reports) lines.push(`현지 검수 ${m.qc_reports}회(${m.qc_items_checked}개 항목)를 진행했고${m.qc_issues_caught ? `, 출고 전에 ${m.qc_issues_caught}건의 문제를 찾아 바로잡았습니다` : ', 모두 합격했습니다'}.`);
  if (m.steps_on_time_pct != null) lines.push(`진행 단계 ${m.steps_done}개 중 ${m.steps_on_time_pct}%를 기한 안에 마쳤습니다.`);
  if (m.claims) lines.push(`불량 신고 ${m.claims}건 중 ${m.claims_resolved}건을 처리했습니다.`);
  return lines.join('\n');
}

async function byCards(entity: any, ids: string[], sort = 'created_date') {
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    for (let skip = 0; ; skip += 1000) {
      const page = await entity.filter({ card_id: { $in: chunk } }, sort, 1000, skip);
      out.push(...page);
      if (page.length < 1000) break;
    }
  }
  const set = new Set(ids);
  return out.filter((r) => set.has(r.card_id));
}

export async function buildPerformanceReport(svc: any, { company, start, end }: { company: any; start: string; end: string }) {
  const db = svc.entities;
  const cards = (await db.TaskCard.filter({ client_id: company.id, client_visible: true }, '-created_date', 1000))
    .filter((c: any) => c.client_id === company.id && c.tenant_id === company.tenant_id);
  const ids = cards.map((c: any) => c.id);
  const load = (e: any, sort?: string) => (ids.length ? byCards(e, ids, sort) : Promise.resolve([]));
  const [quotes, comparisons, landed, claims, qc, shipments, milestones, meetings] = await Promise.all([
    load(db.Quotation), load(db.QuoteComparison), load(db.LandedCostRecord), load(db.QualityClaim),
    load(db.QCReport), load(db.Shipment), load(db.CardMilestone, 'seq'), load(db.MeetingLog, 'meeting_date'),
  ]);
  return summarizePerformance({ cards, quotes, comparisons, landed, claims, qc, shipments, milestones, meetings }, { start, end });
}
