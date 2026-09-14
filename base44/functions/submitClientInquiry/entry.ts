import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireClient } from '../../shared/clientAccess.ts';
import { FROM_NAME, notifyUsers, internalUsersOfTenant } from '../../shared/notify.ts';

// 로그인한 고객사가 소싱 보드에서 신규 문의를 작성 → 새 TaskCard 자동 생성.
// tenant_id 는 본사(HQ) 테넌트로 지정하여 본사 팀 보드에도 노출되고, client_id 로 고객 보드에도 노출된다.
const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const RATE_LIMIT_MS = 5 * 60 * 1000;
const CATEGORIES = ['기계설비', '정밀가공', '전자 · 전기', '뷰티 · 의료', '리빙 · 공구', '굿즈 · 조형', '기타'];

const clean = (v, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireClient(base44);
    if (auth.error) return auth.error;

    const svc = base44.asServiceRole;
    const body = await req.json();

    const title = clean(body.title, 200);
    if (!title) return Response.json({ error: '제목을 입력해 주세요' }, { status: 400 });
    const detail = clean(body.detail, 5000);
    if (!detail) return Response.json({ error: '요구사항을 입력해 주세요' }, { status: 400 });

    const categories = Array.isArray(body.categories)
      ? body.categories.filter((c) => CATEGORIES.includes(c))
      : [];
    const quantity = clean(body.quantity, 200);
    const target_price = clean(body.target_price, 200);

    // 같은 고객사 5분 내 중복 문의 차단
    const recent = await svc.entities.TaskCard.filter(
      { client_id: auth.companyId, source: 'landing_lead' },
      '-created_date',
      5
    );
    const tooSoon = recent.find((c) => Date.now() - new Date(c.created_date).getTime() < RATE_LIMIT_MS);
    if (tooSoon) return Response.json({ error: '잠시 후 다시 시도해 주세요' }, { status: 429 });

    // 고객 테넌트 → 본사 테넌트
    const clientTenant = auth.user.tenant_id ? await svc.entities.Tenant.get(auth.user.tenant_id) : null;
    const hqTenantId = clientTenant?.hq_tenant_id || auth.user.tenant_id;
    const company = auth.companyId ? await svc.entities.Company.get(auth.companyId) : null;
    const clientName = company?.company_name || auth.user.account_label || '고객사';

    // 첨부 파일 업로드 (비공개 스토리지)
    const attachments = [];
    const incoming = Array.isArray(body.attachments) ? body.attachments.slice(0, MAX_FILES) : [];
    for (const f of incoming) {
      if (!f || typeof f.data !== 'string' || !clean(f.name, 255)) continue;
      const bytes = Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0));
      if (bytes.length === 0 || bytes.length > MAX_FILE_BYTES) continue;
      const name = clean(f.name, 255);
      let url = '';
      try {
        const file = new File([bytes], name, { type: clean(f.type, 100) || 'application/octet-stream' });
        const res = await svc.integrations.Core.UploadPrivateFile({ file });
        url = res?.file_uri || '';
      } catch (_e) {
        url = '';
      }
      attachments.push({ name, size: bytes.length, url });
    }

    const card = await svc.entities.TaskCard.create({
      tenant_id: hqTenantId,
      title: `[고객문의] ${title}`,
      status: 'TODO',
      priority: 'MEDIUM',
      source: 'landing_lead',
      client_id: auth.companyId,
      client_name: clientName,
      client_visible: true,
      hq_requirements: [
        `카테고리: ${categories.join(', ') || '-'}`,
        `수량: ${quantity || '-'} / 희망 단가: ${target_price || '-'}`,
        `첨부: ${attachments.length}건 (파일 탭에서 확인)`,
        ``,
        detail,
      ].join('\n'),
    });

    // 첨부 파일을 카드 파일 탭에 연동
    for (const a of attachments) {
      if (!a.url) continue;
      try {
        await svc.entities.CardAttachment.create({
          tenant_id: hqTenantId,
          card_id: card.id,
          file_name: a.name,
          file_type: (a.name.split('.').pop() || '').toLowerCase(),
          file_url: a.url,
          uploader_name: clientName,
          uploader_role: 'HQ',
        });
      } catch (_e) { /* 개별 파일 연동 실패는 무시 */ }
    }

    // 본사 담당자에게 알림
    try {
      const recipients = await internalUsersOfTenant(svc, hqTenantId);
      await notifyUsers(svc, recipients, {
        type: 'card_moved',
        title: `[신규 고객 문의] ${title}`,
        body: `${clientName} 에서 새 문의를 접수했습니다.\n${detail.slice(0, 120)}`,
        link: `/task-board`,
        task_card_id: card.id,
      });
    } catch (_e) { /* 알림 실패는 문의 접수를 막지 않음 */ }

    // 고객에게 접수 확인 메일
    if (auth.user.email) {
      try {
        await svc.integrations.Core.SendEmail({
          to: auth.user.email,
          from_name: FROM_NAME,
          subject: '문의가 접수되었습니다 — AEGIS',
          body: [
            `${auth.user.full_name || clientName} 님, 안녕하세요.`,
            ``,
            `접수하신 문의 "${title}" 가 정상적으로 등록되었습니다.`,
            `담당자가 검토 후 영업일 기준 1일 이내에 회신드리며, 진행 상황은 이 소싱 보드에서 확인하실 수 있습니다.`,
            ``,
            'AEGIS',
          ].join('\n'),
        });
      } catch (_e) { /* 미등록 주소 발송 실패 허용 */ }
    }

    return Response.json({ ok: true, card_id: card.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}