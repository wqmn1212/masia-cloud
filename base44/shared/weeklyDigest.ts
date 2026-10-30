// 고객 주간 요약 메일 (3단계 E2): 월요일 아침 한 통 — 이번 주 확인하실 일, 이번 주 일정·도착 예정, 지난주 바뀐 것.
// 메일 설정(User.notification_prefs.weekly.email)을 끄면 보내지 않는다 (기본은 받음). 검산: npm run check:weekly-digest
const STAGE = { DOWN_PAYMENT: '선금', INTERIM_PAYMENT: '중도금', BALANCE_PAYMENT: '잔금' } as Record<string, string>;
const md = (ymd: string) => (ymd ? `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}` : '');

export const wantsWeekly = (user: any) => user?.account_tier === 'client' && user?.is_active !== false && !!user?.email && user?.notification_prefs?.weekly?.email !== false;

// overview: clientOverview 결과 · changes: { milestones, arrivals, quotes, payments } (지난 7일) · weekEnd: 이번 주 일요일
export function digestTodos(overview: any) {
  const o = overview || {};
  return [
    ...(o.approvals || []).filter((a: any) => a.can_approve).map((a: any) => `결재 요청 · ${a.card_title} · ${a.target_label}`),
    ...(o.signature_pending || []).map((r: any) => `계약서 서명 · ${r.document_title}`),
    ...(o.payment_pending || []).map((p: any) => `${STAGE[p.stage_type] || '대금'} 결제 · ${p.card_title}${p.due_date ? ` · 기한 ${md(p.due_date)}` : ''}`),
    ...(o.comparison_pending || []).map((c: any) => `견적 비교표에서 안 고르기 · ${c.card_title}`),
    ...(o.spec_pending || []).map((s: any) => `품질 기준서 확인 · ${s.card_title}`),
    ...(o.qc_pending || []).filter((q: any) => q.decision !== 'ON_HOLD').map((q: any) => `${q.inspection_type === 'SAMPLE' ? '샘플' : '출고'} 승인 · ${q.card_title}`),
    ...(o.file_review_pending || []).map((r: any) => `디자인 확인 · ${r.card_title} · ${r.file_name}${r.due_date ? ` · 기한 ${md(r.due_date)}` : ''}`),
    ...(o.dest_cost_pending || []).map((d: any) => `도착지 비용 확인 · ${d.card_title}`),
    ...(o.reorder_pending || []).map((r: any) => `재주문 시점 · ${r.product_name} · ${r.overdue ? `주문 권장일 ${md(r.order_by)} 지남` : `${md(r.order_by)}까지 주문 권장`}`),
  ];
}

export function weeklyDigest({ name, overview, changes = {}, today, weekEnd }: any) {
  const todos = digestTodos(overview);
  const week = (overview?.upcoming || []).filter((u: any) => u.planned_date >= today && u.planned_date <= weekEnd).map((u: any) => `${md(u.planned_date)} ${u.label} · ${u.card_title}`);
  const c = changes || {};
  const done = [
    ...(c.milestones || []).map((m: any) => `${md(m.date)} ${m.label} 완료 · ${m.card_title}`),
    ...(c.arrivals || []).map((s: any) => `${md(s.date)} ${s.label} 도착 · ${s.card_title}`),
    ...(c.quotes || []).map((q: any) => `${md(q.date)} 견적서 발행 · ${q.card_title}`),
    ...(c.payments || []).map((p: any) => `${md(p.date)} ${STAGE[p.stage_type] || '대금'} 입금 확인 · ${p.card_title}`),
  ];
  if (!todos.length && !week.length && !done.length) return null;
  const section = (title: string, list: string[], empty: string) => [`■ ${title}${list.length ? ` (${list.length})` : ''}`, ...(list.length ? list.slice(0, 12).map((x) => `- ${x}`) : [`- ${empty}`]), ...(list.length > 12 ? [`- 외 ${list.length - 12}건은 포털에서 확인해 주세요`] : []), ''];
  const text = [
    `${name || '고객'}님, 이번 주 AEGIS 진행 요약입니다.`, '',
    ...section('이번 주 확인하실 일', todos, '지금 확인하실 일은 없습니다'),
    ...section('이번 주 일정·도착 예정', week, '이번 주 예정된 단계가 없습니다'),
    ...section('지난주 바뀐 것', done, '지난주에는 바뀐 것이 없습니다'),
    '메일 설정(포털 알림 종 → 메일 설정)에서 주간 요약을 끌 수 있습니다.',
  ].join('\n');
  return { subject: `[AEGIS 주간 요약] 확인하실 일 ${todos.length}건 · 이번 주 일정 ${week.length}건`, text, counts: { todos: todos.length, week: week.length, done: done.length } };
}
