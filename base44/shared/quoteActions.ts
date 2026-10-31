// 견적 검토 요청 (화면의 quoteApproval · AI 비서 assistantQuote 공용).
// 초안·승인됨 견적을 '검토 중'으로 바꾸고 팀 관리자(service)·마스터에게 알림·메일, 감사 기록을 남긴다. 고객에게는 아무것도 가지 않는다.
import { notifyUsers } from './notify.ts';
import { quoteSummary, isPublished } from './quoteReview.ts';

export const quoteLabel = (q: any) => q?.quote_title || q?.product_name || q?.factory_name || '견적서';
export const money = (n: number, cur: string) => `${cur === 'KRW' ? '₩' : cur === 'CNY' ? '¥' : '$'}${Number(n).toLocaleString('en-US', { maximumFractionDigits: cur === 'KRW' ? 0 : 2 })}`;

/**
 * q: Quotation · card: 연결 카드(없을 수 있음) · checks: reviewChecks 결과 · note: 요청 메모
 * 돌려줌: { error, status } 또는 { ok, status: 'REVIEW', notified }
 */
export async function requestQuoteReview(svc: any, user: any, { q, card, checks, note = '' }: { q: any; card: any; checks: any[]; note?: string }) {
  if (isPublished(q)) return { error: '이미 고객에게 보낸 견적입니다.', status: 400 };
  if (!['DRAFT', 'APPROVED'].includes(q.status)) return { error: q.status === 'REVIEW' ? '이미 검토를 기다리는 견적입니다.' : '이 상태에서는 검토를 요청할 수 없습니다.', status: 400 };
  const db = svc.entities;
  const by = user.full_name || user.account_label || user.email || '';
  const memo = typeof note === 'string' ? note.trim().slice(0, 500) : '';
  const title = quoteLabel(q);
  const cardTitle = card?.title || title;
  await db.Quotation.update(q.id, { status: 'REVIEW', review_requested_at: new Date().toISOString(), review_requested_by_id: user.id, review_requested_by_name: by, review_note: memo, review_rejected_reason: '' });
  const s = quoteSummary(q);
  const staff = await db.User.filter({ tenant_id: q.tenant_id });
  const masters = await db.User.filter({ account_tier: 'master' });
  const approvers = [...staff.filter((u: any) => u.account_tier === 'service'), ...masters].filter((u: any, i: number, all: any[]) => u.id !== user.id && u.is_active !== false && all.findIndex((x: any) => x.id === u.id) === i);
  const notified = await notifyUsers(svc, approvers, {
    type: 'quote_review_requested',
    title: `[견적 승인 요청] ${cardTitle}`,
    body: [`${by} 님이 견적 승인을 요청했습니다: ${title}`, s.total ? `고객 금액 ${money(s.total, s.currency)}${s.margin_pct != null ? ` · 마진 ${s.margin_pct}%` : ''}` : '', memo ? `메모: ${memo}` : '', (checks || []).filter((c: any) => c.level !== 'info').map((c: any) => `· ${c.text}`).join('\n')].filter(Boolean).join('\n'),
    link: '/admin-inbox#inbox-quotes', task_card_id: card?.id || '', card_title: cardTitle,
  });
  if (card) {
    try { await db.ProjectAuditLog.create({ tenant_id: card.tenant_id, card_id: card.id, event_type: 'QUOTE_REVIEW_REQUESTED', actor_id: user.id, actor_name: by, details: `견적 승인 요청: ${title}${memo ? ` · ${memo}` : ''}` }); } catch (_e) { /* 기록 실패가 요청을 막지 않는다 */ }
  }
  return { ok: true, status: 'REVIEW', notified };
}
