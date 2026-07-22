import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' || user.account_tier !== 'master') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await base44.asServiceRole.entities.Tenant.filter({ name: 'MASIA' });
    const tenant = existing[0] || await base44.asServiceRole.entities.Tenant.create({
      name: 'MASIA', slug: 'masia', is_active: true,
    });
    const tenantId = tenant.id;

    const users = await base44.asServiceRole.entities.User.filter({ account_tier: { $in: ['service', 'sub'] } });
    if (users.length) {
      await base44.asServiceRole.entities.User.bulkUpdate(users.map(item => ({ id: item.id, tenant_id: tenantId })));
    }
    const invitations = await base44.asServiceRole.entities.PendingInvitation.filter({ claimed: false });
    if (invitations.length) {
      await base44.asServiceRole.entities.PendingInvitation.bulkUpdate(invitations.map(item => ({ id: item.id, tenant_id: tenantId })));
    }

    const entityNames = [
      'TaskCard', 'TaskItem', 'CardAttachment', 'CardFolder', 'CardChat', 'CardSettlement',
      'Quotation', 'ProductionTimeline', 'FinancialLedger', 'ProjectRequirement',
      'QCKnowledgeLog', 'Company', 'MachineCategory', 'MachineTemplate', 'ASRequest', 'ExchangeRate',
    ];
    const migrated = {};
    for (const name of entityNames) {
      const rows = await base44.asServiceRole.entities[name].list('-created_date', 500);
      if (rows.length) {
        await base44.asServiceRole.entities[name].bulkUpdate(rows.map(item => ({ id: item.id, tenant_id: tenantId })));
      }
      migrated[name] = rows.length;
    }

    return Response.json({ ok: true, tenant_id: tenantId, users: users.length, invitations: invitations.length, migrated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});