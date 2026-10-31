import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { cleanIntakeSetting, pickOwner, quoteDeadline, BASE_SLA_DAYS, BASE_RUSH_WINDOW_DAYS } from '../../shared/inquiryIntake.ts';
import { applyIntake, teamOf } from '../../shared/intakeServer.ts';
import { kstToday } from '../../shared/chinaHoliday.ts';

// 문의 배정 규칙 (팀 관리자·마스터).
//  'get'        → 팀 설정 값 + 팀 직원 목록 (규칙 화면)
//  'save'       {intake_default_owner_id, quote_sla_days, quote_rush_window_days, intake_rules} → 서버에서 정리해 저장
//  'unassigned' → 책임자 없는 진행 카드와 규칙상 추천 책임자 (관리자 할 일)
//  'apply'      {card_id} → 그 카드에 규칙 적용 (책임자·견적 기한이 비어 있을 때만 채움)
const APPROVER = ['master', 'service'];
const OPEN = ['TODO', 'IN_PROGRESS', 'REVIEW', 'PRODUCTION'];

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_active === false || !APPROVER.includes(user.account_tier)) return Response.json({ error: '배정 규칙은 팀 관리자만 다룰 수 있습니다.' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole;
    const db = svc.entities;
    const tenantId = user.account_tier === 'master' && typeof body.tenant_id === 'string' && body.tenant_id ? body.tenant_id : user.tenant_id;
    if (!tenantId) return Response.json({ error: '소속 팀이 없습니다.' }, { status: 403 });
    const settingOf = async () => (await db.OperationSetting.filter({ tenant_id: tenantId }, '-updated_date', 1).catch(() => []))[0] || null;
    const by = user.full_name || user.email || '';

    if (body.action === 'get') {
      const setting = await settingOf();
      const team = (await teamOf(svc, tenantId)).map((u: any) => ({ id: u.id, name: u.full_name || u.account_label || u.email || '', tier: u.account_tier }));
      return Response.json({
        intake_default_owner_id: setting?.intake_default_owner_id || '', quote_sla_days: setting?.quote_sla_days ?? null, quote_rush_window_days: setting?.quote_rush_window_days ?? null,
        intake_rules: setting?.intake_rules || [], team, base: { sla_days: BASE_SLA_DAYS, rush_window_days: BASE_RUSH_WINDOW_DAYS },
      });
    }

    if (body.action === 'save') {
      const team = await teamOf(svc, tenantId);
      const names = new Map(team.map((u: any) => [u.id, u.full_name || u.account_label || u.email || '']));
      const patch: any = cleanIntakeSetting(body);
      // 팀에 없는 사람은 담당자로 둘 수 없다
      if (patch.intake_default_owner_id && !names.has(patch.intake_default_owner_id)) return Response.json({ error: '팀 기본 담당자가 팀 직원이 아닙니다.' }, { status: 400 });
      patch.intake_default_owner_name = names.get(patch.intake_default_owner_id) || '';
      const bad = patch.intake_rules.find((r: any) => !names.has(r.owner_id));
      if (bad) return Response.json({ error: `${bad.client_name || bad.category} 규칙의 담당자가 팀 직원이 아닙니다.` }, { status: 400 });
      patch.intake_rules = patch.intake_rules.map((r: any) => ({ ...r, owner_name: names.get(r.owner_id) }));
      patch.updated_by = by;
      const current = await settingOf();
      if (current) await db.OperationSetting.update(current.id, patch);
      else await db.OperationSetting.create({ tenant_id: tenantId, ...patch });
      return Response.json({ ok: true, ...patch });
    }

    if (body.action === 'unassigned') {
      const setting = await settingOf();
      const team = await teamOf(svc, tenantId);
      const cards = (await db.TaskCard.filter({ tenant_id: tenantId, status: { $in: OPEN } }, '-created_date', 300)).filter((c: any) => !c.owner_id);
      const today = kstToday();
      const leadCats: Record<string, string[]> = {};
      for (const c of cards.filter((x: any) => x.lead_id && !x.inquiry_details?.categories)) {
        const lead = await db.ManufacturingLead.get(c.lead_id).catch(() => null);
        leadCats[c.id] = lead?.categories || [];
      }
      const rows = cards.map((c: any) => {
        const suggest = pickOwner(setting, c, team, leadCats[c.id] || []);
        return {
          id: c.id, title: c.title, status: c.status, client_name: c.client_name || '', created_date: c.created_date, quote_deadline: c.quote_deadline || '',
          quote_overdue: !!c.quote_deadline && c.quote_deadline < today, priority: c.priority || '', suggest,
        };
      }).sort((a: any, b: any) => Number(b.quote_overdue) - Number(a.quote_overdue) || String(a.quote_deadline || '9999').localeCompare(String(b.quote_deadline || '9999')) || String(b.created_date).localeCompare(String(a.created_date)));
      return Response.json({ cards: rows });
    }

    if (body.action === 'apply') {
      const card = typeof body.card_id === 'string' ? await db.TaskCard.get(body.card_id).catch(() => null) : null;
      if (!card || (user.account_tier !== 'master' && card.tenant_id !== user.tenant_id)) return Response.json({ error: '카드를 찾을 수 없습니다.' }, { status: 404 });
      const lead = !card.inquiry_details?.categories && card.lead_id ? await db.ManufacturingLead.get(card.lead_id).catch(() => null) : null;
      // 이미 진행 중인 카드는 지금 와서 견적 기한을 새로 만들지 않는다 (책임자만)
      const fresh = card.status === 'TODO' && !card.quote_deadline;
      const out = await applyIntake(svc, card, { categories: lead?.categories || [], actor: by, withDeadline: fresh });
      return Response.json({ ok: true, assigned: !!out.patch.owner_id, owner_name: out.patch.owner_name || '', rule: out.owner?.label || '', quote_deadline: out.patch.quote_deadline || '' });
    }

    if (body.action === 'preview_deadline') {
      return Response.json(quoteDeadline(kstToday(), await settingOf(), typeof body.desired_date === 'string' ? body.desired_date : ''));
    }

    return Response.json({ error: '지원하지 않는 작업입니다.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
