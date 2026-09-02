import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// 랜딩 페이지 공개 문의 접수 — 비로그인 호출. 사용자 토큰을 신뢰하지 않고 서버가 tenant_id 를 결정한다.
const REQUIRED = ['company', 'contact_name', 'phone', 'email'];
const CATEGORIES = ['기계설비', '정밀가공', '전자 · 전기', '뷰티 · 의료', '리빙 · 공구', '굿즈 · 조형', '기타'];
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
      source: 'landing',
      referrer: clean(body.referrer, 500),
      submitted_at: new Date().toISOString(),
      status: 'new',
      invitation_sent: false,
    });

    // 문의 접수 즉시 본사 팀 TaskCard 자동 생성 (고객 공개는 팀 발급 후 수동 토글)
    try {
      const card = await svc.entities.TaskCard.create({
        tenant_id: tenant.id,
        title: `[문의] ${lead.company} · ${categories[0] || '미분류'}`,
        status: 'TODO',
        priority: 'MEDIUM',
        source: 'landing_lead',
        lead_id: lead.id,
        client_name: lead.company,
        client_visible: false,
        hq_requirements: [
          `담당자: ${lead.contact_name} · ${lead.phone} · ${lead.email}`,
          `카테고리: ${categories.join(', ') || '-'}`,
          `수량: ${lead.quantity || '-'} / 희망 단가: ${lead.target_price || '-'}`,
          `첨부: ${attachments.length}건 (문의 접수 메뉴에서 다운로드)`,
          ``,
          lead.detail || '',
        ].join('\n'),
      });
      await svc.entities.ManufacturingLead.update(lead.id, { task_card_id: card.id });
    } catch (_e) { /* 카드 생성 실패가 접수 자체를 막지 않음 */ }

    // 담당자 알림 (등록 사용자 → 항상 발송 가능)
    if (tenant.master_email) {
      try {
        await svc.integrations.Core.SendEmail({
          to: tenant.master_email,
          from_name: 'AEGIS',
          subject: `[문의 접수] ${lead.company} · ${lead.contact_name}`,
          body: [
            `새 제조 문의가 접수되었습니다.`,
            ``,
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
            `AEGIS Cloud → 문의 접수 메뉴에서 확인하세요.`,
          ].join('\n'),
        });
      } catch (_e) { /* 알림 실패는 접수 자체를 막지 않음 */ }
    }

    // 문의자 안내 (미등록 주소는 플랜/도메인 조건에 따라 미발송 가능)
    try {
      await svc.integrations.Core.SendEmail({
        to: email,
        from_name: 'AEGIS',
        subject: lang === 'en' ? 'We received your request — AEGIS' : lang === 'zh' ? '已收到您的询价 — AEGIS' : '문의가 접수되었습니다 — AEGIS',
        body: lang === 'en'
          ? `Hello ${lead.contact_name},\n\nWe received your manufacturing request for ${lead.company}. We will reply within one business day with next steps and your AEGIS Cloud account details.\n\nAEGIS`
          : lang === 'zh'
            ? `${lead.contact_name} 您好，\n\n我们已收到 ${lead.company} 的制造询价。我们将在一个工作日内回复后续步骤及 AEGIS Cloud 账号信息。\n\nAEGIS`
            : `${lead.contact_name} 님, 안녕하세요.\n\n${lead.company} 의 제조 문의가 접수되었습니다. 영업일 기준 1일 이내에 담당자가 회신드리며, AEGIS Cloud 계정 발급 안내도 함께 보내드립니다.\n\nAEGIS`,
      });
    } catch (_e) { /* 미등록 주소 발송 실패 허용 */ }

    return Response.json({ ok: true, lead_id: lead.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}