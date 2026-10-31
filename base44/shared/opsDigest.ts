// 직원 일일 운영 요약 (4단계 ④). 매일 아침 담당자마다 자기 카드의 할 일을 묶어 한 통 보낸다.
//  오늘 마감 · 지연 위험 · 고객 대기(3일 넘게 멈춤) · 공장 대기 · 확인할 것 · 영업 기회(고객 재주문 시점 14일 이내)
// 대표·팀 관리자(service)에게는 자기 몫에 더해 팀 전체 숫자와 지연 카드를 붙인다. 중국어 설정 직원에게는 중국어로.
// 견적 단계: 견적 기한, 공장 견적서 미회신, 공장 견적 초안·반려 확인, 견적 승인 대기(관리자), 고객 견적 회신 대기, 견적 유효기간 임박·지남.
// 항목이 하나도 없으면 보내지 않는다. '내 업무' 화면 맨 위도 같은 계산을 쓴다. 검산: npm run check:ops-digest
export const STALE_DAYS = 3;
export const SOON_DAYS = 3;
export const UNOPENED_DAYS = 2;
export const REORDER_DAYS = 14;
export const CHAT_DAYS = 7;
// 견적 단계 기준: 공장 견적서 미회신 3일, 승인 대기 1일, 고객 견적 회신 대기 3일, 유효기간 3일 전부터, 지난 뒤 14일까지
export const FACTORY_QUOTE_DAYS = 3;
export const APPROVAL_WAIT_DAYS = 1;
export const QUOTE_REPLY_DAYS = 3;
export const VALIDITY_SOON_DAYS = 3;
export const VALIDITY_PAST_DAYS = 14;
export const SECTIONS = ['due_today', 'risk', 'client_wait', 'factory_wait', 'to_check', 'opportunity'];
export const SECTION_LABEL: Record<string, { ko: string; cn: string }> = {
  due_today: { ko: '오늘 마감', cn: '今日截止' },
  risk: { ko: '지연 위험', cn: '延误风险' },
  client_wait: { ko: '고객 대기 (3일 넘게 멈춤)', cn: '等待客户（超过3天）' },
  factory_wait: { ko: '공장 대기', cn: '等待工厂' },
  to_check: { ko: '확인할 것', cn: '待确认' },
  opportunity: { ko: '영업 기회 (고객 재주문 시점)', cn: '销售机会（客户返单时机）' },
};
const DAY = 86400000;
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
const kst = (iso: string) => (iso ? new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(0, 10) : '');
const dayAdd = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const md = (ymd: string) => (ymd ? `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}` : '');
const open = (m: any) => !['done', 'skipped'].includes(m.status);

// 고객이 결정할 것 (clientOverview 결과 한 고객사분) → 멈춘 날짜가 있는 줄로
export function clientWaitsFrom(overview: any) {
  const o = overview || {};
  const row = (card_id: string, card_title: string, ko: string, cn: string, since: string) => ({ card_id, card_title, ko, cn, since: kst(since) || since });
  return [
    ...(o.comparison_pending || []).map((x: any) => row(x.card_id, x.card_title, '견적 비교표 선택', '比价表选择', x.published_at)),
    ...(o.qc_pending || []).filter((x: any) => x.decision !== 'ON_HOLD').map((x: any) => row(x.card_id, x.card_title, x.inspection_type === 'SAMPLE' ? '샘플 승인' : '출고 승인', x.inspection_type === 'SAMPLE' ? '样品批准' : '出货批准', x.published_at)),
    ...(o.spec_pending || []).map((x: any) => row(x.card_id, x.card_title, '품질 기준서 확인', '质量标准书确认', x.sent_at)),
    ...(o.file_review_pending || []).map((x: any) => row(x.card_id, x.card_title, `디자인 확인 · ${x.file_name}`, `设计确认 · ${x.file_name}`, x.requested_at)),
  ].filter((x) => x.since);
}

/**
 * user: 받을 직원 · admin: 팀 관리자 여부 · today: 한국 날짜 · now: ISO
 * data: { cards, milestones, tasks, clientWaits, factoryRequests, chats, plans, signatures, quotes }
 *  - plans 는 ProductPlan (order_by·runout 을 저장해 둔 것), product_key 의 카드 책임자에게 간다
 */
export function buildOpsDigest({ user, admin = false, today, now, data }: any) {
  const d = data || {};
  const cards = (d.cards || []).filter((c: any) => !['DONE', 'CANCELLED'].includes(c.status));
  const cardById = new Map(cards.map((c: any) => [c.id, c]));
  const allCards = new Map((d.cards || []).map((c: any) => [c.id, c]));
  const title = (id: string) => (allCards.get(id) as any)?.title || '';
  const titleCn = (id: string) => (allCards.get(id) as any)?.title_cn || title(id);
  const mineCard = (id: string) => (cardById.get(id) as any)?.owner_id === user.id;
  const mineStep = (m: any) => (m.owner_ids || []).includes(user.id) || m.owner_id === user.id || mineCard(m.card_id);
  const nowIso = now || new Date().toISOString();
  const S: Record<string, any[]> = Object.fromEntries(SECTIONS.map((k) => [k, []]));
  const push = (k: string, card_id: string, ko: string, cn: string, extra: any = {}) => S[k].push({ card_id, card_title: title(card_id), card_title_cn: titleCn(card_id), ko, cn, ...extra });

  const steps = (d.milestones || []).filter((m: any) => cardById.has(m.card_id) && open(m) && m.planned_date);
  for (const m of steps.filter(mineStep)) {
    const late = dayDiff(m.planned_date, today);
    if (late === 0) push('due_today', m.card_id, `${m.label} (일정)`, `${m.label_cn || m.label}（进度）`);
    else if (late > 0) push('risk', m.card_id, `${m.label} · ${late}일 지남`, `${m.label_cn || m.label} · 已逾期${late}天`, { days: late });
    else if (-late <= SOON_DAYS) push('risk', m.card_id, `${m.label} · ${md(m.planned_date)}까지 (${-late}일 남음)`, `${m.label_cn || m.label} · ${md(m.planned_date)}截止（剩${-late}天）`);
  }
  for (const t of (d.tasks || []).filter((t: any) => t.status !== 'DONE' && t.due_date && cardById.has(t.card_id) && (t.assignee_name ? t.assignee_name === user.full_name : mineCard(t.card_id)))) {
    if (t.due_date === today) push('due_today', t.card_id, `${t.title} (업무)`, `${t.title_cn || t.title}（任务）`);
    else if (t.due_date < today) push('risk', t.card_id, `${t.title} · 업무 ${dayDiff(t.due_date, today)}일 지남`, `${t.title_cn || t.title} · 任务已逾期${dayDiff(t.due_date, today)}天`, { days: dayDiff(t.due_date, today) });
  }
  for (const c of cards.filter((c: any) => mineCard(c.id))) {
    const h = (c.holiday_conflicts || []).find((x: any) => x.end >= today);
    if (h) push('risk', c.id, `${h.name || '중국 휴무'} 겹침 (${md(h.start)}~${md(h.end)})`, `与${h.name || '中国假期'}重叠（${md(h.start)}~${md(h.end)}）`);
  }

  for (const w of (d.clientWaits || []).filter((w: any) => mineCard(w.card_id) && dayDiff(w.since, today) > STALE_DAYS)) {
    push('client_wait', w.card_id, `${w.ko} · ${dayDiff(w.since, today)}일째`, `${w.cn} · 第${dayDiff(w.since, today)}天`);
  }
  for (const s of (d.signatures || []).filter((s: any) => s.card_id && mineCard(s.card_id) && dayDiff(kst(s.sent_at || s.created_date), today) > STALE_DAYS)) {
    push('client_wait', s.card_id, `계약서 서명 · ${dayDiff(kst(s.sent_at || s.created_date), today)}일째`, `合同签名 · 第${dayDiff(kst(s.sent_at || s.created_date), today)}天`);
  }

  for (const r of (d.factoryRequests || []).filter((r: any) => mineCard(r.card_id) && r.status !== 'REVOKED' && (!r.expires_at || r.expires_at >= nowIso))) {
    const items = r.items || [];
    // 견적서 항목은 아래에서 따로 센다
    const quoteWaiting = items.some((i: any) => i.kind === 'QUOTE' && (i.status === 'WAITING' || i.status === 'REDO'));
    if (quoteWaiting) {
      const age0 = dayDiff(kst(r.created_date), today);
      const who = r.factory_name || '공장';
      if (age0 >= FACTORY_QUOTE_DAYS) push('factory_wait', r.card_id, `${who} 견적서 ${age0}일째 미회신`, `${who} 报价单${age0}天未回复`, { days: age0 });
      else push('factory_wait', r.card_id, `${who} 견적서 기다리는 중`, `等待${who}报价单`);
    }
    const waiting = items.filter((i: any) => i.kind !== 'QUOTE' && (i.status === 'WAITING' || i.status === 'REDO')).length;
    const submitted = items.filter((i: any) => i.status === 'SUBMITTED').length;
    const age = dayDiff(kst(r.created_date), today);
    if (waiting && !r.last_opened_at && age >= UNOPENED_DAYS) push('factory_wait', r.card_id, `공장이 업로드 링크를 ${age}일째 열어 보지 않음`, `工厂${age}天未打开上传链接`);
    else if (waiting) push('factory_wait', r.card_id, `공장 미제출 ${waiting}건 (기한 ${md(kst(r.expires_at))})`, `工厂未提交${waiting}项（截止${md(kst(r.expires_at))}）`);
    if (submitted) push('to_check', r.card_id, `공장 제출 ${submitted}건 확인 대기`, `工厂提交${submitted}项待确认`);
  }
  // 고객 새 메시지: 카드의 마지막 메시지가 고객 것이고 7일 안이면
  const lastChat = new Map<string, any>();
  for (const m of d.chats || []) { const p = lastChat.get(m.card_id); if (!p || (m.created_date || '') > (p.created_date || '')) lastChat.set(m.card_id, m); }
  for (const [cardId, m] of lastChat) {
    if (m.sender_role === 'CLIENT' && mineCard(cardId) && dayDiff(kst(m.created_date), today) <= CHAT_DAYS) push('to_check', cardId, `고객 새 메시지 · ${m.sender_name || ''}`, `客户新消息 · ${m.sender_name || ''}`);
  }

  // 견적 단계
  const quotes = (d.quotes || []).filter((q: any) => cardById.has(q.card_id));
  const sentOn = new Set(quotes.filter((q: any) => q.client_published_at).map((q: any) => q.card_id));
  for (const c of cards.filter((c: any) => mineCard(c.id) && /^\d{4}-\d{2}-\d{2}$/.test(c.quote_deadline || '') && !sentOn.has(c.id))) {
    const left = dayDiff(today, c.quote_deadline);
    if (left === 0) push('due_today', c.id, '견적 기한 (고객에게 보낸 견적 없음)', '报价截止（尚未发给客户）');
    else if (left < 0) push('risk', c.id, `견적 기한 ${-left}일 지남 (고객에게 보낸 견적 없음)`, `报价截止已过${-left}天（尚未发给客户）`, { days: -left });
    else if (left === 1) push('risk', c.id, `견적 기한 ${md(c.quote_deadline)} (내일)`, `报价截止${md(c.quote_deadline)}（明天）`);
  }
  const qName = (q: any) => q.quote_title || q.product_name || q.factory_name || '견적서';
  for (const q of quotes) {
    const mine = mineCard(q.card_id);
    if (q.status === 'DRAFT' && !q.client_published_at) {
      if (q.review_rejected_reason && (mine || q.review_requested_by_id === user.id)) push('to_check', q.card_id, `견적 반려됨 · ${qName(q)}: ${q.review_rejected_reason}`, `报价被退回 · ${qName(q)}：${q.review_rejected_reason}`);
      else if (q.factory_request_id && mine) push('to_check', q.card_id, `공장 견적 초안 · ${q.factory_name || qName(q)} (마진 확인 후 검토 요청)`, `工厂报价草稿 · ${q.factory_name || qName(q)}（确认利润后申请审核）`);
    }
    if (admin && q.status === 'REVIEW' && !q.client_published_at && q.review_requested_at) {
      const wait = dayDiff(kst(q.review_requested_at), today);
      if (wait >= APPROVAL_WAIT_DAYS) push('to_check', q.card_id, `견적 승인 대기 ${wait}일째 · ${qName(q)}${q.review_requested_by_name ? ` (요청 ${q.review_requested_by_name})` : ''}`, `报价待审批第${wait}天 · ${qName(q)}`, { days: wait });
    }
    if (mine && q.client_published_at && !q.client_accepted_at && ['SENT', 'APPROVED'].includes(q.status)) {
      const sent = kst(q.client_published_at);
      const ago = dayDiff(sent, today);
      const validity = Number(q.validity_days) || 0;
      const left = validity ? dayDiff(today, kst(new Date(Date.parse(q.client_published_at) + validity * DAY).toISOString())) : null;
      if (left != null && left < 0 && -left <= VALIDITY_PAST_DAYS) push('risk', q.card_id, `견적 유효기간 ${-left}일 지남 · ${qName(q)} (가격 재확인)`, `报价有效期已过${-left}天 · ${qName(q)}（重新确认价格）`, { days: -left });
      else if (left != null && left >= 0 && left <= VALIDITY_SOON_DAYS) push('risk', q.card_id, `견적 유효기간 ${md(dayAdd(sent, validity))} 만료 (${left}일 남음) · ${qName(q)}`, `报价有效期${md(dayAdd(sent, validity))}到期（剩${left}天）· ${qName(q)}`);
      // 오래전에 유효기간이 지난 견적은 더 묻지 않는다
      else if (ago > QUOTE_REPLY_DAYS && !(left != null && left < 0)) push('client_wait', q.card_id, `견적 회신 · ${ago}일째 · ${qName(q)}`, `报价回复 · 第${ago}天 · ${qName(q)}`);
    }
  }

  for (const p of (d.plans || []).filter((p: any) => p.order_by && (admin ? true : mineCard(p.product_key) || (allCards.get(p.product_key) as any)?.owner_id === user.id))) {
    const left = dayDiff(today, p.order_by);
    if (left > REORDER_DAYS) continue;
    const name = p.product_name || '상품';
    const who = p.company_name || '고객사';
    push('opportunity', p.product_key, left < 0 ? `${name} 주문 권장일 ${-left}일 지남` : `${name} ${md(p.order_by)}까지 주문 권장`, left < 0 ? `${name} 建议下单日已过${-left}天` : `${name} 建议${md(p.order_by)}前下单`, { card_title: who, card_title_cn: p.company_name || '客户' });
  }

  let team = null;
  if (admin) {
    const lateCards = new Map<string, number>();
    for (const m of steps) { const late = dayDiff(m.planned_date, today); if (late > 0) lateCards.set(m.card_id, Math.max(lateCards.get(m.card_id) || 0, late)); }
    const waitingTotal = (d.factoryRequests || []).reduce((n: number, r: any) => n + (r.items || []).filter((i: any) => i.status === 'SUBMITTED').length, 0);
    team = {
      active: cards.length,
      late: [...lateCards].sort((a, b) => b[1] - a[1]).map(([id, days]) => ({ card_id: id, card_title: title(id), card_title_cn: titleCn(id), days, owner_name: (cardById.get(id) as any)?.owner_name || '' })),
      client_waits: (d.clientWaits || []).filter((w: any) => dayDiff(w.since, today) > STALE_DAYS).length,
      factory_submissions: waitingTotal,
      no_owner: cards.filter((c: any) => !c.owner_id).length,
      // 견적 기한이 지났는데 고객에게 보낸 견적이 없는 카드
      quote_overdue: cards.filter((c: any) => /^\d{4}-\d{2}-\d{2}$/.test(c.quote_deadline || '') && c.quote_deadline < today && !sentOn.has(c.id)).length,
    };
  }
  const total = SECTIONS.reduce((n, k) => n + S[k].length, 0);
  return { today, sections: S, team, total, empty: total === 0 && !(team && (team.late.length || team.client_waits || team.factory_submissions || team.quote_overdue)) };
}

// 메일·알림 글. lang 'zh' 이면 중국어
export function digestText(digest: any, { name = '', lang = 'ko' } = {}) {
  const zh = lang === 'zh';
  const lines: string[] = [zh ? `${name}，早上好。以下是今天（${md(digest.today)}）的工作摘要。` : `${name}님, 오늘(${md(digest.today)}) 업무 요약입니다.`];
  for (const k of SECTIONS) {
    const rows = digest.sections[k] || [];
    if (!rows.length) continue;
    lines.push('', `■ ${SECTION_LABEL[k][zh ? 'cn' : 'ko']} (${rows.length})`);
    for (const r of rows.slice(0, 15)) lines.push(`- ${zh ? r.card_title_cn : r.card_title} · ${zh ? r.cn : r.ko}`);
    if (rows.length > 15) lines.push(zh ? `- 另有${rows.length - 15}项` : `- 외 ${rows.length - 15}건`);
  }
  const t = digest.team;
  if (t) {
    lines.push('', zh ? `■ 团队概况：进行中${t.active}张 · 延误${t.late.length}张 · 等待客户${t.client_waits}项 · 工厂提交待确认${t.factory_submissions}项${t.no_owner ? ` · 无负责人${t.no_owner}张` : ''}${t.quote_overdue ? ` · 报价逾期${t.quote_overdue}张` : ''}` : `■ 팀 전체: 진행 ${t.active}건 · 지연 카드 ${t.late.length}건 · 고객 대기 ${t.client_waits}건 · 공장 제출 확인 대기 ${t.factory_submissions}건${t.no_owner ? ` · 책임자 없는 카드 ${t.no_owner}건` : ''}${t.quote_overdue ? ` · 견적 기한 지남 ${t.quote_overdue}건` : ''}`);
    for (const c of t.late.slice(0, 10)) lines.push(`- ${zh ? c.card_title_cn : c.card_title} · ${zh ? `延误${c.days}天` : `${c.days}일 지연`}${c.owner_name ? ` · ${c.owner_name}` : ''}`);
  }
  const count = digest.total + (t ? t.late.length : 0);
  return {
    subject: zh ? `[今日工作] ${md(digest.today)} · ${count}项` : `[오늘 업무] ${md(digest.today)} · ${count}건`,
    body: lines.join('\n'),
  };
}

// 받을지: 직원 계정이고 활성이며 메일 설정에서 끄지 않았으면 (기본은 받음)
export const wantsDaily = (u: any) => ['service', 'sub'].includes(u?.account_tier) && u?.is_active !== false && u?.notification_prefs?.daily?.email !== false;
