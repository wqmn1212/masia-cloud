import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { processMessageIds } from '../../shared/clientEmailProposals.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    // 로그인 사용자가 직접 호출하는 경우 마스터만 허용 (웹훅 워크플로 호출은 사용자 없음)
    const user = await base44.auth.me().catch(() => null);
    if (user && user.account_tier !== 'master') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json();
    const raw = body?.data?.new_message_ids;
    const messageIds = (Array.isArray(raw) ? raw : [])
      .filter((id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id))
      .slice(0, 20);
    if (messageIds.length === 0) return Response.json({ processed: 0, reason: 'no new messages' });

    const results = await processMessageIds(base44, messageIds);
    return Response.json({ processed: results.length, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}