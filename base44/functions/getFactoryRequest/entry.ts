import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { sha256Hex, pinHash, validToken, validPin, checkPin, factoryView, effectiveStatus } from '../../shared/factoryRequest.ts';

// 공장 업로드 링크 열기 — 비로그인 호출. 토큰만 오면 PIN이 필요한지와 상태만, 토큰 + PIN이 맞으면 항목 목록을 돌려준다.
// 고객사명·금액·다른 공장은 factoryView 가 걸러 내 응답에 넣지 않는다.
const NOT_FOUND = { error: '링크를 찾을 수 없습니다 / 找不到此链接', code: 'not_found' };

export default async function (req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!validToken(body.token)) return Response.json(NOT_FOUND, { status: 404 });
    const svc = createClientFromRequest(req).asServiceRole;
    const [request] = await svc.entities.FactoryRequest.filter({ token_hash: await sha256Hex(body.token) }, '-created_date', 1);
    if (!request) return Response.json(NOT_FOUND, { status: 404 });
    const now = new Date();
    const status = effectiveStatus(request, now.toISOString());
    if (status === 'REVOKED' || status === 'EXPIRED') return Response.json({ status, code: status.toLowerCase() }, { status: 410 });
    if (body.pin === undefined) return Response.json({ needs_pin: true, locked_until: request.locked_until && now.toISOString() < request.locked_until ? request.locked_until : '' });
    if (!validPin(body.pin)) return Response.json({ error: 'PIN 6자리를 넣어 주세요 / 请输入6位验证码', code: 'bad_pin' }, { status: 400 });
    const pin = checkPin(request, (await pinHash(body.token, body.pin)) === request.pin_hash, now);
    if (!pin.ok) {
      if (pin.patch) await svc.entities.FactoryRequest.update(request.id, pin.patch);
      return Response.json(pin.locked
        ? { error: 'PIN을 여러 번 틀려 잠겼습니다. 30분 뒤 다시 해 주세요 / 验证码错误次数过多，请30分钟后再试', code: 'locked', locked_until: pin.locked_until }
        : { error: `PIN이 맞지 않습니다 (${pin.left}번 남음) / 验证码错误（还剩${pin.left}次）`, code: 'wrong_pin', left: pin.left }, { status: 403 });
    }
    await svc.entities.FactoryRequest.update(request.id, { ...(pin.patch || {}), last_opened_at: now.toISOString() });
    const card = await svc.entities.TaskCard.get(request.card_id).catch(() => null);
    return Response.json({ ok: true, request: factoryView(request, card, now.toISOString()) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
