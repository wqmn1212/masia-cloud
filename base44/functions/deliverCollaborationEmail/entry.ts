import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { sendCollaborationEmail } from '../../shared/collaborationEmail.ts';
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req), user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' || user.is_active === false) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const { change_id } = await req.json();
    if (typeof change_id !== 'string' || !change_id) return Response.json({ error: 'change_id is required' }, { status: 400 });
    const svc = base44.asServiceRole;
    const change = await svc.entities.CollaborationChange.get(change_id);
    if (!change) return Response.json({ error: 'Not found' }, { status: 404 });
    if (user.account_tier !== 'master' && (!user.tenant_id || change.tenant_id !== user.tenant_id || !['service', 'sub'].includes(user.account_tier))) return Response.json({ error: 'Forbidden' }, { status: 403 });
    return Response.json(await sendCollaborationEmail(svc, change));
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}