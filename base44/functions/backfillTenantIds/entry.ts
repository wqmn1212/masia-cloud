import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const ENTITIES = [
  'TaskCard', 'TaskItem', 'Quotation', 'Company', 'CardAttachment', 'CardFolder', 'CardChat',
  'MeetingLog', 'AIProposal', 'ProjectAuditLog', 'CardSettlement', 'FinancialLedger',
  'ProductionTimeline', 'PaymentStage', 'QCReport', 'QCKnowledgeLog', 'ProjectRequirement',
  'ASRequest', 'TeamRole', 'PendingInvitation',
];

// 마스터 전용: tenant_id 가 비어있는 레거시 레코드를 소속 판정 후 채운다.
// { dryRun: true } (기본) 로 먼저 영향 범위를 확인한 뒤 { dryRun: false } 로 실행한다.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.account_tier !== 'master') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun !== false;
    const fallbackTenantId = body.fallbackTenantId || null;

    const svc = base44.asServiceRole.entities;
    const users = await svc.User.list();
    const tenantByEmail = {};
    users.forEach((u) => { if (u.email && u.tenant_id) tenantByEmail[u.email.toLowerCase()] = u.tenant_id; });

    const cards = await svc.TaskCard.list();
    const tenantByCardId = {};
    cards.forEach((c) => { if (c.tenant_id) tenantByCardId[c.id] = c.tenant_id; });

    const report = {};
    for (const name of ENTITIES) {
      const records = await svc[name].list();
      const missing = records.filter((r) => !r.tenant_id);
      const updates = [];
      const unresolved = [];
      for (const r of missing) {
        const resolved =
          (r.card_id && tenantByCardId[r.card_id]) ||
          (r.created_by && tenantByEmail[String(r.created_by).toLowerCase()]) ||
          fallbackTenantId;
        if (resolved) updates.push({ id: r.id, tenant_id: resolved });
        else unresolved.push(r.id);
      }
      if (!dryRun && updates.length > 0) {
        for (let i = 0; i < updates.length; i += 500) {
          await svc[name].bulkUpdate(updates.slice(i, i + 500));
        }
      }
      report[name] = { total: records.length, missing: missing.length, resolvable: updates.length, unresolved };
    }

    return Response.json({ ok: true, dryRun, report });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}