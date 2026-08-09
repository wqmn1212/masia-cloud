import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { processMessageIds } from '../../shared/clientEmailProposals.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const messageIds = body?.data?.new_message_ids ?? [];
    if (messageIds.length === 0) return Response.json({ processed: 0, reason: 'no new messages' });

    const results = await processMessageIds(base44, messageIds);
    return Response.json({ processed: results.length, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}