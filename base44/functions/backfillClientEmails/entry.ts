import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { processMessageIds, loadMatchingContext, findClient, header } from '../../shared/clientEmailProposals.ts';

// 과거 이메일 일괄 연동: 등록된 고객사 이메일/도메인 기준으로 검색해 배치 단위로 처리
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['master', 'service'].includes(user.account_tier)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const pageToken = body?.page_token || '';
    const batchSize = Math.min(Number(body?.batch_size) || 10, 20);

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    const { clients } = await loadMatchingContext(base44);
    const terms = [];
    for (const c of clients) {
      const email = (c.email || '').trim();
      if (email) terms.push(`from:${email}`, `to:${email}`);
      const name = (c.company_name || '').trim();
      if (name.length >= 2) terms.push(`"${name}"`);
    }
    if (terms.length === 0) {
      return Response.json({ processed: 0, done: true, reason: '등록된 고객사가 없습니다' });
    }
    const query = terms.join(' OR ');

    const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    listUrl.searchParams.set('q', query);
    listUrl.searchParams.set('maxResults', String(batchSize));
    if (pageToken) listUrl.searchParams.set('pageToken', pageToken);

    const listRes = await fetch(listUrl.toString(), { headers: authHeader });
    if (!listRes.ok) {
      return Response.json({ error: `Gmail list failed: ${listRes.status}` }, { status: 502 });
    }
    const listData = await listRes.json();
    const messageIds = (listData.messages || []).map((m) => m.id);
    const nextPageToken = listData.nextPageToken || '';

    const results = messageIds.length > 0 ? await processMessageIds(base44, messageIds) : [];
    const created = results.filter((r) => r.proposalId).length;

    return Response.json({
      scanned: messageIds.length,
      created,
      skipped: results.length - created,
      next_page_token: nextPageToken,
      done: !nextPageToken,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}