import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { sha256Hex, pinHash, validToken, validPin, checkPin, factoryView, submitPatch, fileAllowed, effectiveStatus } from '../../shared/factoryRequest.ts';
import { notifyUsers, internalUsersOfTenant } from '../../shared/notify.ts';

// 공장 업로드 링크로 항목 하나 제출 — 비로그인 호출. 매번 토큰 + PIN을 다시 확인한다.
//  { token, pin, item_key, file?: { name, type, data(base64) }, answer? }
// 파일은 비공개 저장소에 올리고, 직원이 채택하기 전에는 카드 파일·고객 화면에 나오지 않는다.
export default async function (req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!validToken(body.token) || !validPin(body.pin)) return Response.json({ error: '링크를 다시 열어 주세요 / 请重新打开链接' }, { status: 400 });
    const svc = createClientFromRequest(req).asServiceRole;
    const [request] = await svc.entities.FactoryRequest.filter({ token_hash: await sha256Hex(body.token) }, '-created_date', 1);
    if (!request) return Response.json({ error: '링크를 찾을 수 없습니다 / 找不到此链接' }, { status: 404 });
    const now = new Date();
    if (effectiveStatus(request, now.toISOString()) !== 'OPEN') return Response.json({ error: '이 링크는 더 이상 쓸 수 없습니다 / 此链接已失效', code: 'closed' }, { status: 410 });
    const pin = checkPin(request, (await pinHash(body.token, body.pin)) === request.pin_hash, now);
    if (!pin.ok) {
      if (pin.patch) await svc.entities.FactoryRequest.update(request.id, pin.patch);
      return Response.json({ error: pin.locked ? '잠겼습니다. 30분 뒤 다시 해 주세요 / 已锁定，请30分钟后再试' : '验证码错误 / PIN이 맞지 않습니다', code: pin.locked ? 'locked' : 'wrong_pin' }, { status: 403 });
    }

    let file_name = '', file_uri = '';
    if (body.file && typeof body.file === 'object') {
      const name = typeof body.file.name === 'string' ? body.file.name.trim().slice(0, 200) : '';
      const data = typeof body.file.data === 'string' ? body.file.data : '';
      const bytes = data ? Uint8Array.from(atob(data), (c) => c.charCodeAt(0)) : new Uint8Array();
      const bad = fileAllowed(name, bytes.length);
      if (bad) return Response.json({ error: bad }, { status: 400 });
      const type = typeof body.file.type === 'string' ? body.file.type.slice(0, 100) : 'application/octet-stream';
      const up = await svc.integrations.Core.UploadPrivateFile({ file: new File([bytes], name, { type }) });
      if (!up?.file_uri) return Response.json({ error: '업로드에 실패했습니다 / 上传失败' }, { status: 502 });
      file_name = name; file_uri = up.file_uri;
    }
    const out = submitPatch(request, typeof body.item_key === 'string' ? body.item_key : '', { file_name, file_uri, answer: body.answer }, now);
    if (out.error) return Response.json({ error: out.error }, { status: 400 });
    const saved = await svc.entities.FactoryRequest.update(request.id, { ...out.patch, ...(pin.patch || {}), last_opened_at: now.toISOString() });

    // 카드 책임자(없으면 팀 직원 전원)에게 알림. 메일은 같은 카드·종류 5분 규칙으로 묶인다
    const card = await svc.entities.TaskCard.get(request.card_id).catch(() => null);
    if (card) {
      try {
        const team = await internalUsersOfTenant(svc, card.tenant_id);
        const owners = team.filter((u: any) => u.id === card.owner_id);
        await notifyUsers(svc, owners.length ? owners : team, {
          type: 'factory_submission',
          title: `[공장 제출] ${card.title} · ${out.item.label_ko}`,
          body: out.item.kind === 'QUOTE'
            ? `${request.factory_name || '공장'}에서 견적서를 올렸습니다. 자동으로 읽어 견적 초안을 만들고 있습니다. 다 되면 다시 알려 드립니다.`
            : `${request.factory_name || '공장'}에서 업로드 링크로 "${out.item.label_ko}"을(를) 올렸습니다. 카드 업무 탭의 공장 요청에서 채택하거나 재요청해 주세요.`,
          link: `/task-board?card=${card.id}&tab=tasks`,
          task_card_id: card.id,
          card_title: card.title,
        });
      } catch (_e) { /* 알림 실패가 제출을 막지 않는다 */ }
    }
    return Response.json({ ok: true, request: factoryView({ ...request, ...out.patch, ...(saved || {}) }, card, now.toISOString()) });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
