import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { applyIntake } from '../../shared/intakeServer.ts';
import { uploadPrivateAttachments, linkCardAttachments } from '../../shared/privateAttachments.ts';
import { emailLayout, p, facts, esc, heading, textToHtml, button } from '../../shared/emailLayout.ts';
import { inquiryReceivedEmail } from '../../shared/inquiryEmail.ts';

// 랜딩 페이지 공개 문의 접수 — 비로그인 호출. 사용자 토큰을 신뢰하지 않고 서버가 tenant_id 를 결정한다.
const REQUIRED = ['company', 'contact_name', 'phone', 'email'];
const CATEGORIES = ['기계설비', '정밀가공', '전자 · 전기', '뷰티 · 의료', '리빙 · 공구', '굿즈 · 조형', '기타'];
const INTERESTS = ['AUDIT', 'INSPECTION', 'QUOTE_REVIEW', 'LITE', 'STANDARD', 'PRO', 'ENTERPRISE', 'UNDECIDED'];
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

    // 첨부는 비공개 스토리지에 저장하며 실패 시 문의자에게 즉시 알린다.
    const attachments = await uploadPrivateAttachments(svc, body.attachments);

    const categories = Array.isArray(body.categories)
      ? body.categories.filter((c) => CATEGORIES.includes(c))
      : [];
    const lang = ['ko', 'en', 'zh'].includes(body.lang) ? body.lang : 'ko';
    // 문의 유형: turnkey(턴키 납품 의뢰, 기본) · monthly(제조팀 구독 상담) · sourcing(단건 상품)
    const inquiryType = ['turnkey', 'monthly', 'sourcing'].includes(body.inquiry_type) ? body.inquiry_type : 'turnkey';
    const typeLabel = { turnkey: '턴키 납품 의뢰', monthly: '제조팀 구독 상담', sourcing: '단건 상품' }[inquiryType as 'turnkey'];
    const interest = INTERESTS.includes(body.interest) ? body.interest : 'UNDECIDED';
    const isEnt = interest === 'ENTERPRISE';
    const expectedVolume = isEnt ? clean(body.expected_volume, 200) : '';
    const linesNum = Number(body.product_lines);
    const productLines = isEnt && Number.isFinite(linesNum) && linesNum > 0 ? Math.min(Math.floor(linesNum), 10000) : null;
    const entHeader = isEnt ? [`관심: 엔터프라이즈 / 월 발주 규모: ${expectedVolume || '-'} / 제품 수: ${productLines ?? '-'}`, ``] : [];

    const lead = await svc.entities.ManufacturingLead.create({
      tenant_id: tenant.id,
      company: clean(body.company, 200),
      contact_name: clean(body.contact_name, 100),
      phone: clean(body.phone, 50),
      email,
      inquiry_type: inquiryType,
      interest,
      ...(isEnt ? { expected_volume: expectedVolume, ...(productLines ? { product_lines: productLines } : {}) } : {}),
      categories,
      quantity: clean(body.quantity, 200),
      target_price: clean(body.target_price, 200),
      detail: clean(body.detail, 5000),
      attachments,
      lang,
      source: clean(body.utm_source, 100) || 'landing',
      referrer: clean(body.referrer, 500),
      utm_source: clean(body.utm_source, 100),
      utm_medium: clean(body.utm_medium, 100),
      utm_campaign: clean(body.utm_campaign, 150),
      utm_content: clean(body.utm_content, 150),
      landing_path: clean(body.landing_path, 300),
      how_found: clean(body.how_found, 200),
      submitted_at: new Date().toISOString(),
      status: 'new',
      invitation_sent: false,
    });

    // 문의 접수 즉시 본사 팀 TaskCard 자동 생성 (고객 공개는 팀 발급 후 수동 토글)
    const card = await svc.entities.TaskCard.create({
      tenant_id: tenant.id,
      title: `[${isEnt ? '엔터프라이즈' : inquiryType === 'monthly' ? '제조팀 구독 상담' : inquiryType === 'sourcing' ? '단건 상품' : '턴키 문의'}] ${lead.company} · ${categories[0] || '미분류'}`,
      status: 'TODO',
      priority: isEnt ? 'HIGH' : 'MEDIUM',
      source: 'landing_lead',
      lead_id: lead.id,
      client_name: lead.company,
      client_visible: false,
      hq_requirements: [
        ...entHeader,
        `문의 유형: ${typeLabel}`,
        `담당자: ${lead.contact_name} · ${lead.phone} · ${lead.email}`,
        `카테고리: ${categories.join(', ') || '-'}`,
        `수량: ${lead.quantity || '-'} / 희망 단가: ${lead.target_price || '-'}`,
        `첨부: ${attachments.length}건 (파일 탭에서 확인)`,
        ``,
        lead.detail || '',
      ].join('\n'),
    });
    await svc.entities.ManufacturingLead.update(lead.id, { task_card_id: card.id });
    // 배정 규칙으로 책임자·견적 기한을 정하고 알린다 (랜딩 문의는 아직 고객사가 없어 카테고리·팀 기본 규칙만 맞는다)
    try { await applyIntake(svc, card, { categories, summary: `${lead.company} · ${lead.contact_name} 문의\n${String(lead.detail || '').slice(0, 120)}` }); } catch (_e) { /* 배정 실패는 접수를 막지 않음 */ }
    await linkCardAttachments(svc, {
      tenantId: tenant.id,
      cardId: card.id,
      attachments,
      uploaderName: lead.company,
    });

    // 담당자 알림 (등록 사용자 → 항상 발송 가능)
    if (tenant.master_email) {
      try {
        await svc.integrations.Core.SendEmail({
          to: tenant.master_email,
          from_name: 'AEGIS',
          subject: `[${isEnt ? '엔터프라이즈 ' : ''}문의 접수 · ${typeLabel}] ${lead.company} · ${lead.contact_name}`,
          body: emailLayout({
            kind: '새 문의', eyebrow: `${isEnt ? '엔터프라이즈 · ' : ''}${typeLabel}`, title: `${lead.company} · ${lead.contact_name} 문의`,
            preheader: `${categories.join(', ') || '카테고리 미선택'} · 수량 ${lead.quantity || '-'}`,
            body: p('새 제조 문의가 접수되었습니다.') +
              facts([
                ...(isEnt ? [['엔터프라이즈', esc(`월 발주 규모 ${expectedVolume || '-'} · 제품 수 ${productLines ?? '-'}`)] as [string, string]] : []),
                ['문의 유형', esc(typeLabel)], ['회사명', esc(lead.company)], ['담당자', esc(lead.contact_name)],
                ['연락처', esc(lead.phone)], ['이메일', esc(lead.email)], ['카테고리', esc(categories.join(', ') || '-')],
                ['수량', esc(lead.quantity || '-')], ['희망 단가', esc(lead.target_price || '-')], ['첨부', `${attachments.length}건`],
              ]) +
              heading('요구사항') + (textToHtml(lead.detail) || p('-')) +
              button('문의 접수 메뉴에서 보기', '/leads'),
            footNote: 'AEGIS Cloud 자동 메일입니다. 고객에게 회신할 때는 이 메일이 아니라 고객 이메일로 보내 주세요.',
          }),
        });
      } catch (_e) { /* 알림 실패는 접수 자체를 막지 않음 */ }
    }

    // 문의자 안내 (미등록 주소는 플랜/도메인 조건에 따라 미발송 가능)
    try {
      await svc.integrations.Core.SendEmail({
        to: email,
        from_name: 'AEGIS',
        subject: lang === 'en' ? 'We received your request — AEGIS' : lang === 'zh' ? '已收到您的询价 — AEGIS' : '문의가 접수되었습니다 — AEGIS',
        body: inquiryReceivedEmail(lang, { company: lead.company, typeLabel, categories, quantity: lead.quantity, attachments: attachments.length }),
      });
    } catch (_e) { /* 미등록 주소 발송 실패 허용 */ }

    return Response.json({ ok: true, lead_id: lead.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// 검산(check:email-layout)이 이 파일에서 가져다 쓴다
export { inquiryReceivedEmail };
