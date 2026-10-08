import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { notifyUsers } from '../../shared/notify.ts';

// 발행된 포트폴리오 항목의 수정 요청 → 같은 팀 service + master 에게 알림
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['master', 'service', 'sub'].includes(user.account_tier)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id, message } = await req.json();
    if (!id) return Response.json({ error: 'id 가 필요합니다' }, { status: 400 });

    const svc = base44.asServiceRole;
    const item = await svc.entities.PortfolioItem.get(id);
    if (!item) return Response.json({ error: '항목을 찾을 수 없습니다' }, { status: 404 });
    if (user.account_tier !== 'master' && item.tenant_id !== user.tenant_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [services, masters] = await Promise.all([
      svc.entities.User.filter({ tenant_id: item.tenant_id, account_tier: 'service' }),
      svc.entities.User.filter({ account_tier: 'master' }),
    ]);
    const recipients = [...services, ...masters].filter((u, i, arr) => u.id !== user.id && arr.findIndex((x) => x.id === u.id) === i);

    const note = String(message || '').slice(0, 1000);
    const sent = await notifyUsers(svc, recipients, {
      type: 'portfolio_edit_request',
      title: `포트폴리오 수정 요청: ${item.title_ko}`,
      body: `${user.full_name || user.email} 님이 발행된 항목의 수정을 요청했습니다.${note ? `\n\n${note}` : ''}`,
      link: '/portfolio-admin',
    });
    return Response.json({ sent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}