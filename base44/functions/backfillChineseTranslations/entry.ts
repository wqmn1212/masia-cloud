import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.account_tier !== 'master') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.batch_size) || 20, 50);
    const configs = [
      { name: 'TaskCard', fields: ['title', 'hq_requirements', 'agent_meeting_notes'] },
      { name: 'TaskItem', fields: ['title', 'description'] },
      { name: 'CardChat', fields: ['message_text'] },
      { name: 'MeetingLog', fields: ['title', 'attendees', 'notes', 'decisions', 'next_steps'] },
      { name: 'DecisionLog', fields: ['topic', 'decision', 'rationale'] },
    ];
    let translated = 0;
    let skipped = 0;
    for (const config of configs) {
      const rows = await base44.asServiceRole.entities[config.name].list('-updated_date', limit);
      for (const row of rows) {
        if (row.cn_manual) { skipped += 1; continue; }
        const source = Object.fromEntries(config.fields.filter(f => row[f] && !row[`${f}_cn`]).map(f => [f, row[f]]));
        if (!Object.keys(source).length) { skipped += 1; continue; }
        const properties = Object.fromEntries(Object.keys(source).map(k => [k, { type: 'string' }]));
        const cn = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Translate this manufacturing and sourcing content into professional Simplified Chinese. Keep JSON keys unchanged. Return translated values only.\n${JSON.stringify(source)}`,
          response_json_schema: { type: 'object', properties },
        });
        const patch = Object.fromEntries(Object.entries(cn || {}).map(([k, v]) => [`${k}_cn`, v]));
        await base44.asServiceRole.entities[config.name].update(row.id, patch);
        translated += 1;
      }
    }
    return Response.json({ translated, skipped });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}