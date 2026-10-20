import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { notifyUsers, clientUsersOfCompany, internalUsersOfTenant } from '../../shared/notify.ts';
import { factoryAccounts, sameAccount, VERIFY_METHOD_LABEL } from '../../shared/factoryAccount.ts';

// 공장 지급 계좌: 직원(master·service·sub)은 등록·변경을 '요청'만 하고, 마스터가 확인(방법 기록)해야 확인된 계좌가 된다.
// 이미 확인된 계좌가 있는데 다른 계좌가 요청되면, 그 공장에 직접 송금하는 고객에게 '확인 전 송금 중지'를 알린다
// (공장을 사칭한 계좌 변경 사기 방지).
const STAFF = ['master', 'service', 'sub'];
const FIELDS = ['beneficiary_name', 'bank_name', 'account_no', 'swift_code', 'bank_address', 'currency'];
const clean = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// 이 공장에 고객이 직접 송금하는 공개 카드의 고객사 사용자
async function payingClients(svc: any, factory: any) {
  const cards = await svc.entities.TaskCard.filter({ factory_id: factory.id, client_pays_factory: true }, '-updated_date', 200);
  const companies = [...new Set(cards.filter((c: any) => c.client_visible && c.client_id && !['DONE', 'CANCELLED'].includes(c.status)).map((c: any) => c.client_id))];
  return (await Promise.all(companies.map((id) => clientUsersOfCompany(svc, id)))).flat();
}

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: '로그인이 필요합니다' }, { status: 401 });
    if (user.is_active === false || !STAFF.includes(user.account_tier)) return Response.json({ error: '직원만 사용할 수 있습니다' }, { status: 403 });
    const input = await req.json();
    const svc = base44.asServiceRole;
    const me = user.full_name || user.email;

    if (input.action === 'propose') {
      const factory = typeof input.factory_id === 'string' ? await svc.entities.Company.get(input.factory_id).catch(() => null) : null;
      if (!factory || factory.company_type !== 'FACTORY') return Response.json({ error: '공장을 찾을 수 없습니다' }, { status: 404 });
      if (user.account_tier !== 'master' && factory.tenant_id !== user.tenant_id) return Response.json({ error: '이 공장에 대한 권한이 없습니다' }, { status: 403 });
      // 팀 없이 만든 예전 공장은 요청한 직원의 팀으로 기록한다 (그래야 같은 팀 담당자가 계좌를 본다)
      const tenantId = factory.tenant_id || user.tenant_id;
      const data: any = Object.fromEntries(FIELDS.map((k) => [k, clean(input[k])]));
      data.account_no = data.account_no.replace(/\s/g, '');
      if (!data.beneficiary_name || !data.bank_name || !data.account_no) return Response.json({ error: '예금주·은행·계좌 번호를 입력하세요' }, { status: 400 });
      if (!['CNY', 'USD', 'KRW'].includes(data.currency)) data.currency = 'CNY';
      const { verified, pending } = await factoryAccounts(svc, factory.id);
      if (sameAccount(verified, data)) return Response.json({ error: '이미 확인된 계좌와 같습니다' }, { status: 409 });
      for (const p of pending) await svc.entities.FactoryAccount.update(p.id, { status: 'WITHDRAWN', verify_note: '새 요청으로 대체' });
      const row = await svc.entities.FactoryAccount.create({
        ...data, tenant_id: tenantId, factory_id: factory.id, factory_name: factory.company_name,
        status: 'PENDING', change_reason: clean(input.change_reason, 500), proposed_by_name: me, proposed_at: new Date().toISOString(),
      });
      const isChange = !!verified;
      try {
        const masters = (await svc.entities.User.filter({ account_tier: 'master' })).filter((u: any) => u.is_active !== false);
        await notifyUsers(svc, masters, {
          type: 'factory_account_changed',
          title: `[${isChange ? '계좌 변경 요청' : '계좌 등록 요청'}] ${factory.company_name}`,
          body: `${me}: ${data.beneficiary_name} · ${data.bank_name} · ${data.account_no}${row.change_reason ? `\n사유: ${row.change_reason}` : ''}\n공장 대표 번호로 직접 확인한 뒤 '확인'을 눌러 주세요.`,
          link: `/factories/${factory.id}/dashboard`,
        });
        if (isChange) {
          await notifyUsers(svc, await payingClients(svc, factory), {
            type: 'factory_account_changed',
            title: '[송금 주의] 공장 계좌 변경 요청이 들어왔습니다',
            body: '공장 측에서 받는 계좌를 바꾸겠다고 요청했습니다. 이지스가 공장에 직접 확인하기 전에는 새 계좌로 송금하지 마세요. 확인되면 다시 알려드립니다.',
            link: '/client/board',
          });
        }
      } catch (_e) { /* 알림 실패가 요청 저장을 막지 않는다 */ }
      return Response.json({ ok: true, id: row.id, is_change: isChange });
    }

    if (input.action === 'verify' || input.action === 'reject') {
      if (user.account_tier !== 'master') return Response.json({ error: '계좌 확인은 마스터만 할 수 있습니다' }, { status: 403 });
      const row = typeof input.account_id === 'string' ? await svc.entities.FactoryAccount.get(input.account_id).catch(() => null) : null;
      if (!row || row.status !== 'PENDING') return Response.json({ error: '확인 대기 중인 계좌가 아닙니다. 새로고침해 주세요' }, { status: 409 });
      const note = clean(input.verify_note, 500);
      const now = new Date().toISOString();
      if (input.action === 'reject') {
        await svc.entities.FactoryAccount.update(row.id, { status: 'REJECTED', verify_note: note, verified_by_name: me, verified_at: now });
        return Response.json({ ok: true });
      }
      if (!VERIFY_METHOD_LABEL[input.verify_method]) return Response.json({ error: '확인 방법을 선택하세요' }, { status: 400 });
      if (typeof input.name_matches_license !== 'boolean') return Response.json({ error: '예금주와 사업자등록증 회사명이 같은지 표시하세요' }, { status: 400 });
      const { verified } = await factoryAccounts(svc, row.factory_id);
      if (verified) await svc.entities.FactoryAccount.update(verified.id, { status: 'RETIRED', retired_at: now });
      await svc.entities.FactoryAccount.update(row.id, {
        status: 'VERIFIED', verify_method: input.verify_method, name_matches_license: input.name_matches_license,
        verify_note: note, verified_by_name: me, verified_at: now,
      });
      try {
        const factory = await svc.entities.Company.get(row.factory_id);
        await notifyUsers(svc, await internalUsersOfTenant(svc, row.tenant_id), {
          type: 'factory_account_verified',
          title: `[계좌 확인 완료] ${row.factory_name}`,
          body: `${row.beneficiary_name} · ${row.bank_name} · ${row.account_no}\n${VERIFY_METHOD_LABEL[input.verify_method]} (${me})${input.name_matches_license ? '' : '\n⚠ 예금주가 사업자등록증 회사명과 다릅니다'}`,
          link: `/factories/${row.factory_id}/dashboard`,
        });
        if (verified && factory) {
          await notifyUsers(svc, await payingClients(svc, factory), {
            type: 'factory_account_verified',
            title: '[송금 안내] 공장 계좌가 확인되었습니다',
            body: `이지스가 공장에 직접 확인한 새 계좌입니다: ${row.bank_name} · 예금주 ${row.beneficiary_name}. 고객 포털의 결제 탭에서 계좌를 확인하신 뒤 송금해 주세요.`,
            link: '/client/board',
          });
        }
      } catch (_e) { /* 알림 실패가 확인을 막지 않는다 */ }
      return Response.json({ ok: true });
    }

    return Response.json({ error: '지원하지 않는 동작입니다' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
