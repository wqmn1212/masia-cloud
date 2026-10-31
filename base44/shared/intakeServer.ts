// 새 문의 카드에 배정 규칙을 적용하고 알린다 (submitClientInquiry · submitInquiry · inquiryIntake 'apply').
//  - 책임자가 정해지면 그 사람에게 '[새 문의 배정]', 못 정하면 팀 관리자(service)·마스터에게 '[배정 필요]'
//  - 이미 책임자·견적 기한이 있는 카드는 그 값을 바꾸지 않는다
import { pickOwner, quoteDeadline, intakePatch } from './inquiryIntake.ts';
import { notifyUsers } from './notify.ts';
import { kstToday } from './chinaHoliday.ts';

const STAFF = ['master', 'service', 'sub'];

export async function teamOf(svc: any, tenantId: string) {
  const users = await svc.entities.User.filter({ tenant_id: tenantId });
  return users.filter((u: any) => STAFF.includes(u.account_tier) && u.is_active !== false);
}

// withDeadline: false 면 책임자만 정한다 (이미 진행 중인 카드를 나중에 배정할 때)
export async function applyIntake(svc: any, card: any, { categories = [] as string[], desiredDate = '', actor = '', summary = '', withDeadline = true } = {}) {
  const db = svc.entities;
  const setting = (await db.OperationSetting.filter({ tenant_id: card.tenant_id }, '-updated_date', 1).catch(() => []))[0] || null;
  const team = await teamOf(svc, card.tenant_id);
  const owner = card.owner_id ? null : pickOwner(setting, card, team, categories);
  const dl = quoteDeadline(kstToday(), setting, desiredDate || card.inquiry_details?.desired_date || '');
  const patch = intakePatch(card, owner, dl);
  if (!withDeadline) { delete patch.quote_deadline; delete patch.priority; }
  if (Object.keys(patch).length) await db.TaskCard.update(card.id, patch);
  const next = { ...card, ...patch };
  const deadlineText = withDeadline && next.quote_deadline ? `견적 기한 ${next.quote_deadline}${dl.rush && patch.quote_deadline ? ` (희망 입고일까지 ${dl.days_to_desired}일 · 급한 문의)` : ''}` : '';
  const link = `/task-board?card=${card.id}`;
  try {
    if (patch.owner_id) {
      const target = team.find((u: any) => u.id === patch.owner_id);
      await notifyUsers(svc, [target], {
        type: 'inquiry_assigned',
        title: `[새 문의 배정] ${card.title}`,
        body: [`${owner.label}에 따라 책임자로 배정됐습니다.`, deadlineText, summary].filter(Boolean).join('\n'),
        link, task_card_id: card.id, card_title: card.title,
      });
    } else if (!next.owner_id) {
      const masters = await db.User.filter({ account_tier: 'master' }).catch(() => []);
      const managers = [...team.filter((u: any) => u.account_tier === 'service'), ...masters.filter((u: any) => u.is_active !== false)]
        .filter((u: any, i: number, all: any[]) => all.findIndex((x: any) => x.id === u.id) === i);
      await notifyUsers(svc, managers, {
        type: 'inquiry_unassigned',
        title: `[배정 필요] ${card.title}`,
        body: ['배정 규칙에 맞는 담당자가 없어 책임자를 정하지 못했습니다. 카드에서 책임자를 지정하거나 관리자 할 일에서 배정하세요.', deadlineText, summary].filter(Boolean).join('\n'),
        link: '/admin-inbox#inbox-unassigned', task_card_id: card.id, card_title: card.title,
      });
    }
  } catch (_e) { /* 알림 실패가 접수를 막지 않는다 */ }
  if (patch.owner_id) {
    try { await db.ProjectAuditLog.create({ tenant_id: card.tenant_id, card_id: card.id, event_type: 'CARD_ASSIGNED', actor_id: '', actor_name: actor || '배정 규칙', details: `책임자 ${patch.owner_name} 자동 배정 (${owner.label})${patch.quote_deadline ? ` · 견적 기한 ${patch.quote_deadline}` : ''}` }); } catch (_e) { /* 기록 실패가 접수를 막지 않는다 */ }
  }
  return { patch, owner, deadline: dl, card: next };
}
