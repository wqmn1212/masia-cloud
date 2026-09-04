import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// 랜딩 페이지 공개 문의 접수 — 비로그인 호출. 사용자 토큰을 신뢰하지 않고 서버가 tenant_id 를 결정한다.
const REQUIRED = ['company', 'contact_name', 'phone', 'email'];
const CATEGORIES = ['기계 · 측정', '정밀가공', '전자 · IT액세서리', '뷰티 · 화장품', '가구 · 리빙', '반려동물용품', '부자재 · 원자재', '기타'];
const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const RATE_LIMIT_MS = 10 * 60 * 1000;

const clean = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    for (const key of REQUIRED) {
      if (!clean(body[key])) return Response.json({ error: `${key} is required` }, { status: 400 });
    }
    const email = clean(body.email, 200).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'invalid email' }, { status: 400 });
    }

    const svc = base44.asServiceRole;

    // 본사 테넌트 결정 (is_hq 우선, 없으면 가장 먼저 생성된 팀)
    const hq = await svc.entities.Tenant.filter({ is_hq: true }, 'created_date', 1);
    const tenant = hq[0] || (await svc.entities.Tenant.list('created_date', 1))[0];
    if (!tenant) return Response.json({ error: 'HQ tenant not configured' }, { status: 500 });

    // 간단한 rate limit: 같은 이메일 10분 내 재접수 차단
    const recent = await svc.entities.ManufacturingLead.filter({ email }, '-created_date', 1);
    if (recent[0] && Date.now() - new Date(recent[0].created_date).getTime() < RATE_LIMIT_MS) {
      return Response.json({ error: 'too many requests' }, { status: 429 });
    }

    // 첨부: base64 → 비공개 스토리지 업로드 (NNN 대상이므로 공개 버킷 사용 금지)
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

    const categories = Array.isArray(body.categories)
      ? body.categories.filter((c) => CATEGORIES.includes(c))
      : [];
    const lang = ['ko', 'en', 'zh'].includes(body.lang) ? body.lang : 'ko';
    const intent = body.intent === 'purchase' ? 'purchase' : 'quote';
    const productName = clean(body.product_name, 200);

    const lead = await svc.entities.ManufacturingLead.create({
      tenant_id: tenant.id,
      company: clean(body.company, 200),
      contact_name: clean(body.contact_name, 100),
      phone: clean(body.phone, 50),
      email,
      categories,
      quantity: clean(body.quantity, 200),
      target_price: clean(body.target_price, 200),
      detail: clean(body.detail, 5000),
      attachments,
      lang,
      intent,
      product_name: productName,
      source: 'landing',
      referrer: clean(body.referrer, 500),
      submitted_at: new Date().toISOString(),
      status: 'new',
      invitation_sent: false,
    });

    // TaskCard 는 문의 접수 시점이 아니라 담당자가 "문의 접수" 메뉴에서 승인할 때 생성된다.

    // 담당자 알림 (등록 사용자 → 항상 발송 가능)
    if (tenant.master_email) {
      try {
        await svc.integrations.Core.SendEmail({
          to: tenant.master_email,
          from_name: 'ChinaSourcing',
          subject: `[문의 접수] ${lead.company} · ${lead.contact_name}`,
          body: [
            `새 제조 문의가 접수되었습니다.`,
            ``,
            `유형: ${intent === 'purchase' ? '구매 문의' : '견적 문의'}${productName ? ` · ${productName}` : ''}`,
            `회사명: ${lead.company}`,
            `담당자: ${lead.contact_name}`,
            `연락처: ${lead.phone}`,
            `이메일: ${lead.email}`,
            `카테고리: ${categories.join(', ') || '-'}`,
            `수량: ${lead.quantity || '-'}`,
            `희망 단가: ${lead.target_price || '-'}`,
            `첨부: ${attachments.length}건`,
            ``,
            `요구사항:`,
            lead.detail || '-',
            ``,
            `ChinaSourcing Cloud → 문의 접수 메뉴에서 확인 후 승인해 주세요.`,
          ].join('\n'),
        });
      } catch (_e) { /* 알림 실패는 접수 자체를 막지 않음 */ }
    }

    // 문의자 안내 (미등록 주소는 플랜/도메인 조건에 따라 미발송 가능)
    try {
      await svc.integrations.Core.SendEmail({
        to: email,
        from_name: 'ChinaSourcing',
        subject: lang === 'en' ? 'We received your request — ChinaSourcing' : lang === 'zh' ? '已收到您的询价 — ChinaSourcing' : '문의가 접수되었습니다 — 중국소싱',
        body: lang === 'en'
          ? `Hello ${lead.contact_name},\n\nWe received your manufacturing request for ${lead.company}. We will reply within one business day with next steps and your ChinaSourcing Cloud account details.\n\nChinaSourcing`
          : lang === 'zh'
            ? `${lead.contact_name} 您好，\n\n我们已收到 ${lead.company} 的制造询价。我们将在一个工作日内回复后续步骤及 ChinaSourcing Cloud 账号信息。\n\nChinaSourcing`
            : `${lead.contact_name} 님, 안녕하세요.\n\n${lead.company} 의 제조 문의가 접수되었습니다. 영업일 기준 1일 이내에 담당자가 회신드리며, ChinaSourcing Cloud 계정 발급 안내도 함께 보내드립니다.\n\n중국소싱`,
      });
    } catch (_e) { /* 미등록 주소 발송 실패 허용 */ }

    return Response.json({ ok: true, lead_id: lead.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}