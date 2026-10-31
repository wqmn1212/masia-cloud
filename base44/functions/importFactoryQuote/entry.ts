import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { extractQuotation } from '../../shared/quoteExtract.ts';
import { pendingQuoteSubs, markSubs, sameSub, draftQuotation, draftLine } from '../../shared/factoryQuote.ts';
import { notifyUsers, internalUsersOfTenant } from '../../shared/notify.ts';

// 공장 업로드 링크로 올라온 견적서를 읽어 견적 초안(DRAFT)을 만든다.
//  - 워크플로우(FactoryQuoteImport)가 공장 제출 직후(quote_import_pending) 로그인 없이 부른다: { request_id }
//  - 직원은 실패한 견적서를 다시 읽을 수 있다: { request_id, retry: true }
// 처리할 제출물을 먼저 '읽는 중'으로 표시해 동시에 두 번 깨어나도 초안이 하나만 생기게 한다.
const STAFF = ['master', 'service', 'sub'];

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && (user.is_active === false || !STAFF.includes(user.account_tier))) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole;
    const db = svc.entities;
    const request = typeof body.request_id === 'string' ? await db.FactoryRequest.get(body.request_id).catch(() => null) : null;
    const card = request ? await db.TaskCard.get(request.card_id).catch(() => null) : null;
    if (!request || !card || (user && user.account_tier !== 'master' && card.tenant_id !== user.tenant_id)) return Response.json({ error: '공장 요청을 찾을 수 없습니다' }, { status: 404 });

    const now = new Date();
    const targets = pendingQuoteSubs(request, now, { retry: !!user && body.retry === true });
    if (!targets.length) {
      if (request.quote_import_pending) await db.FactoryRequest.update(request.id, { quote_import_pending: false });
      return Response.json({ ok: true, created: 0 });
    }
    // 먼저 집어 간다고 표시
    await db.FactoryRequest.update(request.id, { submissions: markSubs(request, targets, { import_started_at: now.toISOString(), import_error: '' }), quote_import_pending: false });

    const rates = (await db.ExchangeRate.list('-rate_date', 1).catch(() => []))[0] || null;
    const results: { sub: any; quotation_id?: string; record?: any; error?: string }[] = [];
    for (const sub of targets) {
      try {
        const { signed_url } = await svc.integrations.Core.CreateFileSignedUrl({ file_uri: sub.file_uri, expires_in: 600 });
        const { normalized } = await extractQuotation(svc, { file_url: signed_url, file_name: sub.file_name });
        const record = draftQuotation(normalized, { card, request, sub, rates });
        if (!record.quote_options.length) throw new Error('견적 품목을 찾지 못했습니다');
        const created = await db.Quotation.create(record);
        results.push({ sub, quotation_id: created.id, record });
      } catch (e) {
        results.push({ sub, error: String((e as Error)?.message || e).slice(0, 300) });
      }
    }

    // 그 사이 다른 제출이 들어왔을 수 있으니 다시 읽어서 결과만 덧붙인다
    const fresh = (await db.FactoryRequest.get(request.id).catch(() => null)) || request;
    const at = new Date().toISOString();
    const submissions = (fresh.submissions || []).map((s: any) => {
      const r = results.find((x) => sameSub(x.sub, s));
      if (!r) return s;
      return r.quotation_id ? { ...s, quotation_id: r.quotation_id, imported_at: at, import_error: '' } : { ...s, import_error: r.error };
    });
    await db.FactoryRequest.update(request.id, { submissions });

    const ok = results.filter((r) => r.quotation_id);
    const bad = results.filter((r) => r.error);
    for (const r of ok) {
      try { await db.ProjectAuditLog.create({ tenant_id: card.tenant_id, card_id: card.id, event_type: 'FACTORY_QUOTE_IMPORTED', actor_id: user?.id || '', actor_name: user?.full_name || '공장 업로드 링크', details: `${request.factory_name || '공장'} 견적서를 읽어 초안 생성 · ${draftLine(r.record)}` }); } catch (_e) { /* 기록 실패가 처리를 막지 않는다 */ }
    }
    // 같은 카드에 공장 견적이 둘 이상이면 비교표를 권한다
    const cardQuotes = (await db.Quotation.filter({ card_id: card.id }, '-created_date', 50)).filter((q: any) => q.status !== 'REJECTED');
    const factories = new Set(cardQuotes.map((q: any) => q.factory_name).filter(Boolean));
    try {
      const team = await internalUsersOfTenant(svc, card.tenant_id);
      const owners = team.filter((u: any) => u.id === card.owner_id);
      const lines = [
        ...ok.map((r) => `견적 초안을 만들었습니다: ${r.record.quote_title} · ${draftLine(r.record)}`),
        ...bad.map((r) => `읽지 못한 견적서: ${r.sub.file_name || '파일'} (${r.error}) — 공장 업로드 링크에서 다시 읽거나 직접 입력하세요`),
        ok.length ? '견적 탭에서 마진·수수료를 넣고 "검토 요청"을 누르세요.' : '',
        ok.length && factories.size >= 2 ? `이 카드에 공장 ${factories.size}곳의 견적이 있습니다. 견적 비교표로 고객에게 보여 줄 수 있습니다.` : '',
      ].filter(Boolean);
      await notifyUsers(svc, owners.length ? owners : team, {
        type: 'factory_quote_imported',
        title: `[공장 견적 도착] ${card.title} · ${request.factory_name || '공장'}`,
        body: lines.join('\n'),
        link: `/task-board?card=${card.id}&tab=quotation`, task_card_id: card.id, card_title: card.title,
      });
    } catch (_e) { /* 알림 실패가 처리를 막지 않는다 */ }
    return Response.json({ ok: true, created: ok.length, failed: bad.length, quotation_ids: ok.map((r) => r.quotation_id), errors: bad.map((r) => r.error) });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
