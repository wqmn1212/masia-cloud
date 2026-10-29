import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireClient } from '../../shared/clientAccess.ts';
import { FROM_NAME, notifyUsers, internalUsersOfTenant } from '../../shared/notify.ts';
import { uploadPrivateAttachments, linkCardAttachments } from '../../shared/privateAttachments.ts';
import { cleanInquiry } from '../../shared/inquiryForm.ts';
import { kstToday } from '../../shared/chinaHoliday.ts';

// 로그인한 고객사가 소싱 보드에서 신규 문의를 작성 → 새 TaskCard 자동 생성.
// tenant_id 는 본사(HQ) 테넌트로 지정하여 본사 팀 보드에도 노출되고, client_id 로 고객 보드에도 노출된다.
// 문의 양식(카테고리별 사양 질문·희망 입고일·도착지·인증·샘플)은 inquiry_details 로 남기고 요구사항 글에도 붙인다.
// 고른 인증은 카드 수입 요건에 '필요'로 미리 넣는다.
const RATE_LIMIT_MS = 5 * 60 * 1000;

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

    const form = cleanInquiry(body, kstToday());
    // 사양 질문은 꼭 답한다 (모르면 '모름'). 양식을 거치지 않는 금형 검토 요청은 카테고리가 없어 질문이 없다
    if (form.missing.length) return Response.json({ error: `사양 질문에 답해 주세요 (모르면 '모름'): ${form.missing.join(', ')}` }, { status: 400 });

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

    // 첨부 파일은 비공개 스토리지에 저장하며 실패 시 문의자에게 즉시 알린다.
    const attachments = await uploadPrivateAttachments(svc, body.attachments);

    const card = await svc.entities.TaskCard.create({
      tenant_id: hqTenantId,
      title: `[고객문의] ${title}`,
      status: 'TODO',
      priority: 'MEDIUM',
      source: 'landing_lead',
      client_id: auth.companyId,
      client_name: clientName,
      client_visible: true,
      inquiry_details: form.details,
      ...(form.details.desired_date ? { due_date: form.details.desired_date } : {}),
      ...(form.importReqs.length ? { import_requirements: form.importReqs, import_req_updated_at: new Date().toISOString() } : {}),
      hq_requirements: [
        ...form.lines,
        `첨부: ${attachments.length}건 (파일 탭에서 확인)`,
        ``,
        detail,
      ].join('\n'),
    });

    // 첨부 파일을 카드 파일 탭에 일괄 연동
    await linkCardAttachments(svc, {
      tenantId: hqTenantId,
      cardId: card.id,
      attachments,
      uploaderName: clientName,
      clientVisible: true,
      uploaderRole: null,
    });

    // 본사 담당자에게 알림
    try {
      const recipients = await internalUsersOfTenant(svc, hqTenantId);
      await notifyUsers(svc, recipients, {
        type: 'card_moved',
        title: `[신규 고객 문의] ${title}`,
        body: `${clientName} 에서 새 문의를 접수했습니다.\n${detail.slice(0, 120)}`,
        link: `/task-board?card=${card.id}`,
        task_card_id: card.id,
        card_title: title,
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