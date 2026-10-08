import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { isWorkday, shiftDate } from '../../shared/chinaHoliday.ts';

// 마일스톤 수정 단일 경로. 권한:
// - 단계 완료·지연 사유: 그 단계 담당자 또는 master·service
// - 계획일·담당 변경, 카드 책임자 지정: master·service
const addWorkdays = (d: string, n: number, hs: any[]) => { let x = d, c = 0; while (c < n) { x = shiftDate(x, 1); if (isWorkday(x, hs)) c++; } return x; };
const countWorkdays = (a: string, b: string, hs: any[]) => { let x = a, c = 0; while (x < b) { x = shiftDate(x, 1); if (isWorkday(x, hs)) c++; } return c; };
const validDate = (s: any) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.is_active === false || !['master', 'service', 'sub'].includes(user.account_tier)) return Response.json({ error: '직원만 변경할 수 있습니다.' }, { status: 403 });
    const input = await req.json();
    const db = base44.asServiceRole.entities;
    const card = await db.TaskCard.get(input.card_id).catch(() => null);
    if (!card || (user.account_tier !== 'master' && card.tenant_id !== user.tenant_id)) return Response.json({ error: '카드 접근 권한이 없습니다.' }, { status: 403 });
    const manager = ['master', 'service'].includes(user.account_tier);
    const deny = (msg: string) => Response.json({ error: msg }, { status: 403 });
    const team = async () => (await db.User.filter({ tenant_id: card.tenant_id })).filter((u) => ['service', 'sub'].includes(u.account_tier) && u.is_active !== false);

    if (input.action === 'team') return Response.json({ users: (await team()).map((u) => ({ id: u.id, name: u.full_name || u.email, tier: u.account_tier })) });

    if (input.action === 'set_card_owner') {
      if (!manager) return deny('책임자는 대표·팀 관리자만 지정할 수 있습니다.');
      const owner = input.owner_id ? (await team()).find((u) => u.id === input.owner_id) : null;
      if (input.owner_id && !owner) return Response.json({ error: '팀 사용자가 아닙니다.' }, { status: 400 });
      await db.TaskCard.update(card.id, { owner_id: owner?.id || null, owner_name: owner ? owner.full_name || owner.email : null });
      return Response.json({ saved: true });
    }

    const list = await db.CardMilestone.filter({ card_id: card.id }, 'seq', 200);
    const m = list.find((x) => x.id === input.milestone_id);
    if (!m) return Response.json({ error: '단계를 찾을 수 없습니다.' }, { status: 404 });
    const isOwner = m.owner_id && m.owner_id === user.id;

    if (input.action === 'update') {
      const p = input.patch || {}, patch: any = {};
      if ('planned_date' in p || 'owner_id' in p) { if (!manager) return deny('계획일·담당 변경은 대표·팀 관리자만 할 수 있습니다.'); }
      else if (!manager && !isOwner) return deny('이 단계의 담당자가 아닙니다.');
      if ('planned_date' in p) { if (!validDate(p.planned_date) || m.status === 'done') return Response.json({ error: '계획일을 확인하세요.' }, { status: 400 }); patch.planned_date = p.planned_date; }
      if ('owner_id' in p) {
        const owner = p.owner_id ? (await team()).find((u) => u.id === p.owner_id) : null;
        if (p.owner_id && !owner) return Response.json({ error: '팀 사용자가 아닙니다.' }, { status: 400 });
        patch.owner_id = owner?.id || null; patch.owner_name = owner ? owner.full_name || owner.email : null;
      }
      if ('delay_reason' in p) patch.delay_reason = String(p.delay_reason || '').slice(0, 500);
      if ('delay_reason_public' in p) patch.delay_reason_public = !!p.delay_reason_public;
      await db.CardMilestone.update(m.id, patch);
      return Response.json({ list: list.map((x) => (x.id === m.id ? { ...x, ...patch } : x)) });
    }

    if (input.action === 'complete') {
      if (!manager && !isOwner) return deny('이 단계의 담당자 또는 대표·팀 관리자만 완료할 수 있습니다.');
      if (m.status === 'done') return Response.json({ error: '이미 완료된 단계입니다.' }, { status: 400 });
      if (!validDate(input.actual_date)) return Response.json({ error: '실제 완료일을 입력하세요.' }, { status: 400 });
      let qcId = m.qc_report_id || null;
      if (m.needs_qc_report) {
        const qc = input.qc_report_id ? await db.QCReport.get(input.qc_report_id).catch(() => null) : null;
        if (!qc || qc.card_id !== card.id) return Response.json({ error: '이 카드의 QC 보고서를 연결해야 완료할 수 있습니다.' }, { status: 400 });
        if (qc.qc_result === 'FAIL') return Response.json({ error: '불합격 보고서로는 완료할 수 없습니다.' }, { status: 400 });
        qcId = qc.id;
      }
      const holidays = await db.ChinaHoliday.list('-start_date', 500);
      const late = m.planned_date && input.actual_date > m.planned_date ? countWorkdays(m.planned_date, input.actual_date, holidays) : 0;
      const next = list.map((x) => {
        if (x.id === m.id) return { ...x, status: 'done', actual_date: input.actual_date, qc_report_id: qcId };
        if (input.shift && late && x.seq > m.seq && x.status !== 'done' && x.status !== 'skipped' && x.planned_date) return { ...x, planned_date: addWorkdays(x.planned_date, late, holidays) };
        return x;
      });
      const changed = next.filter((x, i) => x.id === m.id || x.planned_date !== list[i].planned_date);
      await db.CardMilestone.bulkUpdate(changed.map((x) => ({ id: x.id, status: x.status, actual_date: x.actual_date || null, planned_date: x.planned_date, qc_report_id: x.qc_report_id || null })));
      return Response.json({ list: next, late });
    }
    return Response.json({ error: '알 수 없는 작업입니다.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});