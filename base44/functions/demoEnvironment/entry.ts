import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { DEMO_TENANT, DEMO_COMPANY_NAME, findDemoTenant, clearDemo, seedDemo } from '../../shared/demoSeed.ts';

// 영업 미팅용 데모 환경 (대표·팀 관리자·마스터). 실제 팀과 분리된 데모 팀 안에서만 만들고 지운다.
//  'status' → 데모가 있는지, 데모 고객사 ID와 카드 수
//  'reset'  → 데모 팀 안의 데이터를 모두 지우고 오늘 기준으로 다시 만든다 (데모 팀이 없으면 만든다)
//  'remove' → 데모 팀 안의 데이터를 모두 지운다
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.is_active === false || !['master', 'service', 'sub'].includes(user.account_tier)) return Response.json({ error: '직원만 사용할 수 있습니다.' }, { status: 403 });
    const input = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole, db = svc.entities;
    let tenant = await findDemoTenant(svc);

    const status = async () => {
      if (!tenant) return { ready: false };
      const company = (await db.Company.filter({ tenant_id: tenant.id, company_type: 'CLIENT' }, '-created_date', 5)).find((c: any) => c.tenant_id === tenant.id && c.is_demo === true);
      const cards = company ? (await db.TaskCard.filter({ tenant_id: tenant.id }, '-created_date', 100)).filter((c: any) => c.tenant_id === tenant.id).length : 0;
      return { ready: !!company, tenant_id: tenant.id, company_id: company?.id || '', company_name: company?.company_name || DEMO_COMPANY_NAME, cards, reset_at: tenant.demo_reset_at || '', reset_by_name: tenant.demo_reset_by_name || '' };
    };

    if (!input.action || input.action === 'status') return Response.json(await status());

    if (!['master', 'service'].includes(user.account_tier)) return Response.json({ error: '데모 초기화는 대표·팀 관리자만 할 수 있습니다.' }, { status: 403 });
    const by = user.full_name || user.email || '';

    if (input.action === 'reset') {
      if (!tenant) tenant = await db.Tenant.create({ ...DEMO_TENANT, is_demo: true, is_active: true, is_hq: false, tenant_type: 'internal', seat_limit: 0 });
      const removed = await clearDemo(svc, tenant);
      const seeded = await seedDemo(svc, tenant);
      await db.Tenant.update(tenant.id, { demo_reset_at: new Date().toISOString(), demo_reset_by_name: by });
      tenant = { ...tenant, demo_reset_at: new Date().toISOString(), demo_reset_by_name: by };
      return Response.json({ ok: true, removed, ...seeded, ...(await status()) });
    }

    if (input.action === 'remove') {
      if (!tenant) return Response.json({ ok: true, removed: 0, ready: false });
      const removed = await clearDemo(svc, tenant);
      return Response.json({ ok: true, removed, ready: false });
    }

    return Response.json({ error: '알 수 없는 작업입니다.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
