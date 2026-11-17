import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { sha256Hex, pinHash, newToken, newPin, validToken, validPin, checkPin } from '../../shared/factoryRequest.ts';

// 개발 미팅 공유 링크: 고객이 계정 없이 링크 + PIN 으로 미팅 내용(진행 단계·결정 사항·할 일)을 보고, 결정 사항에 확인 표시를 남긴다.
//   create  {project_id, snapshot, days}  — 직원(로그인). 돌려줌 { token, pin, expires_at }
//   list    {project_id}                  — 직원. 이 시제품의 공유 링크와 고객 확인 현황
//   revoke  {id}                          — 직원
//   open    {token, pin?}                 — 비로그인. PIN 이 맞으면 내용
//   confirm {token, pin, index, name}     — 비로그인. 결정 사항 확인
const NOT_FOUND = { error: '링크를 찾을 수 없습니다', code: 'not_found' };
const MAX_SNAPSHOT = 120000;
const clip = (s: unknown, n: number) => String(s ?? '').slice(0, n);

function cleanSnapshot(x: any) {
  const list = (a: unknown, n: number, len: number) => (Array.isArray(a) ? a.slice(0, n).map((v) => clip(v, len)).filter(Boolean) : []);
  return {
    title: clip(x?.title, 200), device: clip(x?.device, 60), date: clip(x?.date, 20), attendees: clip(x?.attendees, 300),
    steps: (Array.isArray(x?.steps) ? x.steps : []).slice(0, 12).map((s: any) => ({ label: clip(s?.label, 40), done: !!s?.done, detail: clip(s?.detail, 120) })),
    summary: list(x?.summary, 40, 300), decisions: list(x?.decisions, 40, 400), actions: list(x?.actions, 40, 400),
  };
}

export default async function (req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const now = new Date();

    if (['create', 'list', 'revoke'].includes(body.action)) {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.is_active === false || !['master', 'service', 'sub'].includes(user.account_tier)) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const own = (tenant: string) => user.account_tier === 'master' || (tenant && tenant === user.tenant_id);
      if (body.action === 'revoke') {
        const s = await svc.entities.ProtoShare.get(String(body.id || '')).catch(() => null);
        if (!s || !own(s.tenant_id)) return Response.json(NOT_FOUND, { status: 404 });
        await svc.entities.ProtoShare.update(s.id, { status: 'REVOKED' });
        return Response.json({ ok: true });
      }
      const project = await svc.entities.ProtoProject.get(String(body.project_id || '')).catch(() => null);
      if (!project || !own(project.tenant_id)) return Response.json({ error: '시제품을 찾을 수 없습니다' }, { status: 404 });
      if (body.action === 'list') {
        const rows = await svc.entities.ProtoShare.filter({ project_id: project.id }, '-created_date', 20);
        return Response.json({ shares: rows.map((s: any) => ({ id: s.id, status: s.status === 'ACTIVE' && s.expires_at < now.toISOString() ? 'EXPIRED' : s.status, expires_at: s.expires_at, created_date: s.created_date, created_by_name: s.created_by_name, last_opened_at: s.last_opened_at || '', decisions: (s.snapshot?.decisions || []).length, confirmations: s.confirmations || [] })) });
      }
      const snapshot = cleanSnapshot(body.snapshot);
      if (JSON.stringify(snapshot).length > MAX_SNAPSHOT) return Response.json({ error: '공유할 내용이 너무 깁니다' }, { status: 400 });
      const days = Math.min(60, Math.max(1, Number(body.days) || 14));
      const token = newToken(), pin = newPin();
      const expires_at = new Date(now.getTime() + days * 86400000).toISOString();
      await svc.entities.ProtoShare.create({ tenant_id: project.tenant_id, project_id: project.id, title: snapshot.title, token_hash: await sha256Hex(token), pin_hash: await pinHash(token, pin), expires_at, status: 'ACTIVE', snapshot, confirmations: [], failed_pin_count: 0, created_by_name: user.full_name || user.email || '' });
      return Response.json({ token, pin, expires_at });
    }

    if (body.action === 'open' || body.action === 'confirm') {
      if (!validToken(body.token)) return Response.json(NOT_FOUND, { status: 404 });
      const [share] = await svc.entities.ProtoShare.filter({ token_hash: await sha256Hex(body.token) }, '-created_date', 1);
      if (!share) return Response.json(NOT_FOUND, { status: 404 });
      if (share.status !== 'ACTIVE' || share.expires_at < now.toISOString()) return Response.json({ error: '기한이 지났거나 닫힌 링크입니다', code: 'expired' }, { status: 410 });
      if (body.pin === undefined) return Response.json({ needs_pin: true, title: '' });
      if (!validPin(body.pin)) return Response.json({ error: 'PIN 6자리를 넣어 주세요', code: 'bad_pin' }, { status: 400 });
      const pin = checkPin(share, (await pinHash(body.token, body.pin)) === share.pin_hash, now);
      if (!pin.ok) {
        if (pin.patch) await svc.entities.ProtoShare.update(share.id, pin.patch);
        return Response.json(pin.locked ? { error: 'PIN을 여러 번 틀려 잠겼습니다. 30분 뒤 다시 해 주세요', code: 'locked' } : { error: `PIN이 맞지 않습니다 (${pin.left}번 남음)`, code: 'wrong_pin' }, { status: 403 });
      }
      let confirmations = share.confirmations || [];
      if (body.action === 'confirm') {
        const index = Number(body.index);
        const name = clip(body.name, 40).trim();
        const text = share.snapshot?.decisions?.[index];
        if (!Number.isInteger(index) || !text) return Response.json({ error: '결정 사항을 찾을 수 없습니다' }, { status: 400 });
        if (!name) return Response.json({ error: '확인하는 분 이름을 넣어 주세요' }, { status: 400 });
        if (!confirmations.some((c: any) => c.index === index)) confirmations = [...confirmations, { index, text, name, at: now.toISOString() }];
      }
      await svc.entities.ProtoShare.update(share.id, { ...(pin.patch || {}), last_opened_at: now.toISOString(), confirmations });
      return Response.json({ ok: true, share: { ...share.snapshot, expires_at: share.expires_at, confirmations } }, { headers: { 'Cache-Control': 'no-store' } });
    }
    return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
