import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requireClient } from '../../shared/clientAccess.ts';
import { notifyUsers, internalUsersOfTenant } from '../../shared/notify.ts';

// 이미 온보딩된 고객사가 소싱 보드 안에서 추가로 접수하는 문의.
// 회사/이메일은 신뢰하지 않고 로그인된 계정 정보로 서버가 채우며, 신규 문의와 동일하게
// 담당자 승인을 거쳐야 TaskCard 가 생성된다 (승인 시 client_id 가 이미 있어 곧바로 고객 공개된다).
const CATEGORIES = ['기계 · 측정', '정밀가공', '전자 · IT액세서리', '뷰티 · 화장품', '가구 · 리빙', '반려동물용품', '부자재 · 원자재', '기타'];
const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const clean = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireClient(base44);
    if (auth.error) return auth.error;

    const body = await req.json();
    const svc = base44.asServiceRole;

    const company = await svc.entities.Company.get(auth.companyId);
    if (!company) return Response.json({ error: '고객사 정보를 찾을 수 없습니다' }, { status: 404 });

    const clientTenant = await svc.entities.Tenant.get(auth.user.tenant_id);
    const hqTenantId = clientTenant?.hq_tenant_id;
    if (!hqTenantId) return Response.json({ error: '본사 팀 정보를 찾을 수 없습니다' }, { status: 500 });

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

    const categories = Array.isArray(body.categories) ? body.categories.filter((c) => CATEGORIES.includes(c)) : [];
    const intent = body.intent === 'purchase' ? 'purchase' : 'quote';
    const productName = clean(body.product_name, 200);
    const detail = clean(body.detail, 5000);
    if (!detail) return Response.json({ error: '요청 내용을 입력해 주세요' }, { status: 400 });

    const lead = await svc.entities.ManufacturingLead.create({
      tenant_id: hqTenantId,
      company: company.company_name || auth.user.account_label || '',
      contact_name: auth.user.full_name || auth.user.account_label || auth.user.email,
      phone: clean(body.phone, 50),
      email: auth.user.email,
      categories,
      quantity: clean(body.quantity, 200),
      target_price: clean(body.target_price, 200),
      detail,
      attachments,
      lang: 'ko',
      intent,
      product_name: productName,
      source: 'client_portal',
      submitted_at: new Date().toISOString(),
      status: 'new',
      invitation_sent: true,
      client_id: auth.companyId,
      client_tenant_id: auth.user.tenant_id,
    });

    const staff = await internalUsersOfTenant(svc, hqTenantId);
    await notifyUsers(svc, staff, {
      type: 'client_inquiry',
      title: `[추가 문의] ${lead.company} · ${lead.contact_name}`,
      body: `${intent === 'purchase' ? '구매 문의' : '견적 문의'}${productName ? ` · ${productName}` : ''}\n${detail.slice(0, 300)}`,
      link: `/leads`,
    });

    return Response.json({ ok: true, lead_id: lead.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
