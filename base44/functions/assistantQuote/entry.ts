import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { kstToday } from '../../shared/chinaHoliday.ts';
import { reviewChecks, quoteSummary } from '../../shared/quoteReview.ts';
import { resolveMargin } from '../../shared/marginRule.ts';
import { requestQuoteReview, quoteLabel } from '../../shared/quoteActions.ts';
import { createFactoryRequest, factoryLinkUrl, quoteRequestMessage } from '../../shared/factoryRequestServer.ts';
import { inviteText } from '../../shared/factoryRequest.ts';

// AI 비서용 견적 자동화 도구. 화면과 같은 공용 코드를 쓴다. 고객에게 나가는 일(승인·발송·공개)은 하지 않는다.
//  'margin_rule'    {card_id} → 이 카드의 기준·최소 마진과 출처
//  'check'          {quotation_id} → 검토 요청 전 요약(고객 금액·마진)과 확인 항목 (원가·마진은 팀 관리자에게만)
//  'request_review' {quotation_id, note?} → 사용자가 승인한 뒤에만. 견적을 검토 중으로, 팀 관리자에게 알림
//  'factory_link'   {card_id, factory_name?, days?, message_cn?, with_photo?} → 사용자가 승인한 뒤에만. 공장 견적서 업로드 링크와 PIN, 위챗용 중국어 안내
const STAFF = ['master', 'service', 'sub'];
const APPROVER = ['master', 'service'];
const s = (v: unknown, n = 300) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!STAFF.includes(user.account_tier) || user.is_active === false) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole;
    const db = svc.entities;
    const inScope = (r: any) => !!r && (user.account_tier === 'master' || r.tenant_id === user.tenant_id);
    const settingOf = async (tenantId: string) => (await db.OperationSetting.filter({ tenant_id: tenantId }, '-updated_date', 1).catch(() => []))[0] || null;
    const cardOf = async (id: unknown) => (typeof id === 'string' && id ? await db.TaskCard.get(id).catch(() => null) : null);

    if (body.action === 'margin_rule' || body.action === 'factory_link') {
      const card = await cardOf(body.card_id);
      if (!inScope(card)) return Response.json({ error: '카드를 찾을 수 없습니다' }, { status: 404 });
      if (body.action === 'margin_rule') return Response.json({ card_title: card.title, ...resolveMargin(await settingOf(card.tenant_id), card) });
      const product = card.title_cn || card.title;
      const items = [{ kind: 'QUOTE', label_ko: '공장 견적서', label_cn: '报价单' }, ...(body.with_photo ? [{ kind: 'PHOTO', label_ko: '샘플·제품 사진', label_cn: '样品·产品照片' }] : [])];
      const by = user.full_name || user.email || '';
      const out = await createFactoryRequest(svc, { card, items, days: body.days, message_cn: s(body.message_cn, 1000) || quoteRequestMessage(product), factory_name: s(body.factory_name, 200), by: `${by} (AI 비서)`, actorId: user.id });
      if (out.error) return Response.json({ error: out.error }, { status: 400 });
      const link = factoryLinkUrl(out.token);
      return Response.json({
        ok: true, card_title: card.title, factory_name: out.request.factory_name, link, pin: out.pin, expires_date: String(out.request.expires_at).slice(0, 10),
        wechat_text: inviteText({ link, pin: out.pin, product, expires_at: out.request.expires_at, items: out.items }),
        next: '위챗 안내를 공장에 보내세요. 공장이 견적서를 올리면 자동으로 읽어 견적 초안을 만들고 책임자에게 알립니다. 링크와 PIN은 다시 볼 수 없으니 지금 복사하세요.',
      });
    }

    if (body.action === 'check' || body.action === 'request_review') {
      const q = typeof body.quotation_id === 'string' ? await db.Quotation.get(body.quotation_id).catch(() => null) : null;
      if (!inScope(q)) return Response.json({ error: '견적서를 찾을 수 없습니다' }, { status: 404 });
      const card = await cardOf(q.card_id);
      const rule = card ? resolveMargin(await settingOf(card.tenant_id), card) : null;
      const checks = reviewChecks(q, card, kstToday(), rule);
      if (body.action === 'check') {
        const sum = quoteSummary(q);
        // 원가·마진은 팀 관리자에게만 (팀원 화면에도 원가 칸은 보이지 않는다)
        const view = APPROVER.includes(user.account_tier) ? sum : { total: sum.total, currency: sum.currency, lead_time_business_days: sum.lead_time_business_days, validity_days: sum.validity_days, payment_terms_pending: sum.payment_terms_pending, optional_count: sum.optional_count };
        return Response.json({ quotation_id: q.id, title: quoteLabel(q), card_title: card?.title || '', status: q.status, published: !!q.client_published_at, summary: view, checks: APPROVER.includes(user.account_tier) ? checks : checks.filter((c) => !['loss', 'low_margin'].includes(c.code)), rejected_reason: q.review_rejected_reason || '' });
      }
      const out = await requestQuoteReview(svc, user, { q, card, checks, note: s(body.note, 500) });
      if (out.error) return Response.json({ error: out.error }, { status: out.status });
      return Response.json({ ok: true, title: quoteLabel(q), card_title: card?.title || '', status: 'REVIEW', notified: out.notified, next: '팀 관리자가 관리자 할 일의 견적 승인에서 확인하고 고객에게 보냅니다.' });
    }

    return Response.json({ error: '지원하지 않는 작업입니다' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
