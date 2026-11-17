// 고객 미팅 준비 브리프: 카드 한 장의 현황을 안건 네 묶음으로 모은다.
//  ask  — 고객에게 물어볼 것 (자료 요청에서 아직 안 온 항목, 고객 회신 대기 신호)
//  tell — 우리가 답하거나 보여줄 것 (열린 업무, 지난 미팅 다음 액션, 위험·확인할 신호)
//  past — 지난 결정 (확정된 결정 기록, 지난 미팅 결정 사항)
//  next — 다가오는 일정 (끝나지 않은 일정 3개)
// 화면·인쇄·미팅 기록 시작이 같은 결과를 쓴다. React 없이 계산만 한다.

const lines = (s) => String(s || '').split(/\r?\n/).map((x) => x.replace(/^\s*[-•·*\d.)]+\s*/, '').trim()).filter(Boolean);
const uniq = (list) => { const seen = new Set(); return list.filter((x) => { const k = x.text.replace(/\s+/g, ''); if (!k || seen.has(k)) return false; seen.add(k); return true; }); };

export function buildMeetingBrief({ card = {}, logs = [], tasks = [], requests = [], decisions = [], milestones = [], signals = [], today = '' } = {}) {
  const last = [...logs].sort((a, b) => String(b.meeting_date || '').localeCompare(String(a.meeting_date || '')))[0] || null;

  const ask = [];
  for (const r of requests) {
    if (r.status === 'CLOSED') continue;
    for (const it of r.items || []) {
      if (it.status === 'WAITING' || it.status === 'REDO') ask.push({ text: `${it.label}${it.status === 'REDO' ? ' (다시 요청함)' : ''}`, note: r.title + (r.due_date ? ` · ${r.due_date}까지` : ''), required: !!it.required });
    }
  }
  for (const s of signals) if (s.k === 'client_wait') ask.push({ text: s.ko, note: '회신 대기' });

  const tell = [];
  const open = tasks.filter((t) => t.status !== 'DONE').sort((a, b) => String(a.due_date || '9999').localeCompare(String(b.due_date || '9999')));
  for (const t of open.slice(0, 8)) {
    const late = t.due_date && today && t.due_date < today;
    tell.push({ text: t.title, note: [t.assignee_name, t.due_date ? `${t.due_date}${late ? ' 지남' : ''}` : ''].filter(Boolean).join(' · '), late: !!late });
  }
  if (last) for (const x of lines(last.next_steps)) tell.push({ text: x, note: `지난 미팅(${last.meeting_date}) 다음 액션` });
  for (const s of signals) if (['risk', 'to_check', 'factory_wait'].includes(s.k)) tell.push({ text: s.ko, note: s.k === 'risk' ? '위험' : s.k === 'factory_wait' ? '공장 대기' : '확인할 것', late: s.k === 'risk' });

  const past = [];
  for (const d of decisions.filter((x) => (x.status || 'CONFIRMED') === 'CONFIRMED').slice(0, 5)) past.push({ text: d.topic ? `${d.topic}: ${d.decision || ''}` : d.decision || '', note: d.decided_at ? String(d.decided_at).slice(0, 10) : '' });
  if (last) for (const x of lines(last.decisions)) past.push({ text: x, note: `지난 미팅(${last.meeting_date})` });

  const next = milestones
    .filter((m) => !['done', 'skipped'].includes(m.status))
    .sort((a, b) => String(a.planned_date || '9999').localeCompare(String(b.planned_date || '9999')))
    .slice(0, 3)
    .map((m) => ({ text: m.label, note: m.planned_date || '날짜 미정', late: !!(m.planned_date && today && m.planned_date < today) }));

  const brief = {
    title: card.title || '',
    client: card.client_name || '',
    due: card.due_date || '',
    requirements: String(card.hq_requirements || '').trim().slice(0, 400),
    last: last ? { date: last.meeting_date, title: last.title } : null,
    ask: uniq(ask), tell: uniq(tell), past: uniq(past), next,
  };
  brief.empty = !brief.ask.length && !brief.tell.length && !brief.past.length && !brief.next.length;
  return brief;
}

export const BRIEF_GROUPS = [
  { key: 'ask', label: '고객에게 물어볼 것' },
  { key: 'tell', label: '우리가 답하거나 보여줄 것' },
  { key: 'past', label: '지난 결정 다시 확인' },
  { key: 'next', label: '다가오는 일정' },
];

/** 미팅 기록 '논의 내용'에 넣을 안건 문장 */
export function briefAgenda(brief) {
  const out = [];
  for (const g of BRIEF_GROUPS) {
    const list = brief[g.key] || [];
    if (!list.length) continue;
    out.push(`[${g.label}]`);
    for (const x of list) out.push(`- ${x.text}${x.note ? ` (${x.note})` : ''}`);
    out.push('');
  }
  return out.join('\n').trim();
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** 인쇄·PDF 저장용 한 장 HTML */
export function briefHtml(brief, { date = '', by = '' } = {}) {
  const group = (g) => {
    const list = brief[g.key] || [];
    return `<h2>${esc(g.label)} <small>${list.length}</small></h2>${list.length ? `<ul>${list.map((x) => `<li${x.late ? ' class="late"' : ''}><span class="box"></span>${esc(x.text)}${x.note ? ` <em>${esc(x.note)}</em>` : ''}</li>`).join('')}</ul>` : '<p class="none">없음</p>'}`;
  };
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>미팅 준비 · ${esc(brief.title)}</title><style>
body{font-family:'Pretendard','Noto Sans KR',system-ui,sans-serif;color:#1f2937;max-width:760px;margin:32px auto;padding:0 20px;line-height:1.55;font-size:14px}
h1{font-size:22px;margin:0 0 4px}.meta{color:#6b7280;font-size:13px;margin-bottom:12px}
.req{background:#f3f4f6;border-radius:8px;padding:10px 12px;white-space:pre-wrap;font-size:13px}
h2{font-size:15px;margin:22px 0 6px;padding-bottom:4px;border-bottom:2px solid #e5e7eb}h2 small{color:#9ca3af;font-weight:500}
ul{list-style:none;padding:0;margin:0}li{padding:5px 0;border-bottom:1px solid #f3f4f6;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
li em{color:#6b7280;font-style:normal;font-size:12px}li.late{color:#b91c1c}
.box{display:inline-block;width:11px;height:11px;border:1.5px solid #9ca3af;border-radius:2px;flex:none;transform:translateY(1px)}
.none{color:#9ca3af;font-size:13px;margin:0}.memo{margin-top:24px;border:1px dashed #d1d5db;border-radius:8px;height:160px;padding:8px 12px;color:#9ca3af;font-size:12px}
@media print{body{margin:0}}
</style></head><body>
<h1>미팅 준비 · ${esc(brief.title)}</h1>
<div class="meta">${[brief.client && `고객 ${esc(brief.client)}`, brief.due && `납기 ${esc(brief.due)}`, brief.last && `지난 미팅 ${esc(brief.last.date)}`, date && `작성 ${esc(date)}`, by && esc(by)].filter(Boolean).join(' · ')}</div>
${brief.requirements ? `<div class="req">${esc(brief.requirements)}</div>` : ''}
${BRIEF_GROUPS.map(group).join('\n')}
<div class="memo">메모</div>
</body></html>`;
}
