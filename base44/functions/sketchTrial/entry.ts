import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { SKETCH_PLAN_SCHEMA, SKETCH_VARIANTS, sketchPlanPrompt, frontPrompt, koFix } from '../../shared/protoSketch.ts';
import { imageSize, b64Bytes } from '../../shared/protoVision.ts';
import { TRIAL_SOURCE, TRIAL_MAX_BYTES, TRIAL_MIN_PX, cleanTrialInput, isToken, sketchKind, trialLimit, publicTrial } from '../../shared/sketchTrial.ts';
import { applyIntake } from '../../shared/intakeServer.ts';
import { linkCardAttachments } from '../../shared/privateAttachments.ts';
import { emailLayout, p, facts, esc, heading, textToHtml, button } from '../../shared/emailLayout.ts';
import { inquiryReceivedEmail } from '../../shared/inquiryEmail.ts';

// 메인페이지 '스케치 → 디자인 시안 3장' 체험 — 비로그인 호출. 서버가 본사 팀과 한도를 정한다.
// create : 연락처 + 스케치 한 장 → 문의 접수 목록에 '스케치 시안' 문의로 남기고 정면 시안 3장을 만든다
// get    : 화면 요청이 끊겼거나 새로 고쳤을 때 번호(token)로 결과를 다시 받는다
// inquire: 고른 시안으로 개발·양산 견적 문의 → 업무 카드 생성·배정·알림 (랜딩 문의와 같은 흐름)
const IMAGE_MODEL = 'gpt_6_astra';
const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const strList = (v, n, max) => (Array.isArray(v) ? v.map((x) => koFix(str(x, max))).filter(Boolean).slice(0, n) : []);

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const body = await req.json();
    const action = ['get', 'inquire'].includes(body?.action) ? body.action : 'create';
    const findLead = async (token) => (isToken(token) ? (await svc.entities.ManufacturingLead.filter({ sketch_token: String(token).toLowerCase() }, '-created_date', 1))[0] : null);

    if (action === 'get') {
      const lead = await findLead(body.token);
      if (!lead) return Response.json({ error: 'not found' }, { status: 404 });
      return Response.json({ trial: publicTrial(lead) });
    }

    if (action === 'inquire') {
      const lead = await findLead(body.token);
      const t = lead?.sketch_trial;
      if (!lead || t?.status !== 'READY') return Response.json({ error: 'not found' }, { status: 404 });
      // 이미 문의했으면 같은 결과를 돌려준다 (두 번 눌러도 카드가 두 장 생기지 않게)
      if (lead.task_card_id) return Response.json({ ok: true, trial: publicTrial(lead) });
      const idx = Number(body.variant);
      const pick = t.variants?.[idx];
      if (!pick?.url) return Response.json({ error: 'variant required' }, { status: 400 });
      const quantity = str(body.quantity, 200);
      const more = str(body.detail, 3000);
      const company = str(body.company, 200) || lead.company;

      // 고른 시안을 비공개 첨부로 저장 (실패해도 문의는 받는다 — 시안 주소는 문의 내용에 남는다)
      const attachments = [...(lead.attachments || [])];
      try {
        const res = await fetch(pick.url);
        if (res.ok) {
          const bytes = new Uint8Array(await res.arrayBuffer());
          const kind = sketchKind(bytes) || { ext: 'png', type: 'image/png' };
          const name = `chosen-design-${idx + 1}.${kind.ext}`;
          const up = await svc.integrations.Core.UploadPrivateFile({ file: new File([bytes], name, { type: kind.type }) });
          if (up?.file_uri) attachments.push({ name, size: bytes.length, url: up.file_uri });
        }
      } catch { /* 첨부 실패 허용 */ }

      const detail = [lead.detail, more].filter(Boolean).join('\n\n');
      const card = await svc.entities.TaskCard.create({
        tenant_id: lead.tenant_id,
        title: `[스케치 시안 문의] ${company} · ${pick.label}`,
        status: 'TODO',
        priority: 'MEDIUM',
        source: 'landing_lead',
        lead_id: lead.id,
        client_name: company,
        client_visible: false,
        hq_requirements: [
          '문의 유형: 턴키 납품 의뢰 (메인페이지 스케치 시안 체험에서 접수)',
          `담당자: ${lead.contact_name} · ${lead.phone} · ${lead.email}`,
          `고른 시안: ${pick.label} (${idx + 1}번 / ${t.variants.length}장)`,
          `수량: ${quantity || '-'}`,
          `첨부: ${attachments.length}건 (고객 스케치 · 고른 시안 — 파일 탭에서 확인)`,
          '',
          detail,
          '',
          `시안 이미지: ${t.variants.map((v, i) => `${i + 1}. ${v.label} ${v.url}`).join('\n')}`,
        ].join('\n'),
      });
      const saved = await svc.entities.ManufacturingLead.update(lead.id, {
        company, quantity, detail, attachments, task_card_id: card.id,
        sketch_trial: { ...t, chosen: idx, inquired_at: new Date().toISOString() },
      });
      try { await applyIntake(svc, card, { categories: [], summary: `${company} · ${lead.contact_name} 스케치 시안 문의\n${String(detail || '').slice(0, 120)}` }); } catch { /* 배정 실패는 접수를 막지 않음 */ }
      await linkCardAttachments(svc, { tenantId: lead.tenant_id, cardId: card.id, attachments, uploaderName: company }).catch(() => {});

      const tenant = await svc.entities.Tenant.get(lead.tenant_id).catch(() => null);
      if (tenant?.master_email) {
        try {
          await svc.integrations.Core.SendEmail({
            to: tenant.master_email, from_name: 'AEGIS',
            subject: `[문의 접수 · 스케치 시안] ${company} · ${lead.contact_name}`,
            body: emailLayout({
              kind: '새 문의', eyebrow: '스케치 시안 체험 → 견적 문의', title: `${company} · ${lead.contact_name} 문의`,
              preheader: `고른 시안 ${pick.label} · 수량 ${quantity || '-'}`,
              body: p('메인페이지에서 스케치로 시안을 만들어 본 고객이 그 시안으로 개발·양산 견적을 문의했습니다.') +
                facts([['회사명', esc(company)], ['담당자', esc(lead.contact_name)], ['연락처', esc(lead.phone)], ['이메일', esc(lead.email)], ['고른 시안', esc(pick.label)], ['수량', esc(quantity || '-')]]) +
                heading('제품 설명') + (textToHtml(detail) || p('-')) + button('문의 접수 메뉴에서 보기', '/leads'),
              footNote: 'AEGIS Cloud 자동 메일입니다. 고객에게 회신할 때는 이 메일이 아니라 고객 이메일로 보내 주세요.',
            }),
          });
        } catch { /* 알림 실패는 접수를 막지 않음 */ }
      }
      try {
        const lang = lead.lang || 'ko';
        await svc.integrations.Core.SendEmail({
          to: lead.email, from_name: 'AEGIS',
          subject: lang === 'en' ? 'We received your request — AEGIS' : lang === 'zh' ? '已收到您的询价 — AEGIS' : '문의가 접수되었습니다 — AEGIS',
          body: inquiryReceivedEmail(lang, { company, typeLabel: lang === 'en' ? 'Development & production' : lang === 'zh' ? '开发·量产' : '개발·양산 의뢰', categories: [], quantity, attachments: attachments.length }),
        });
      } catch { /* 미등록 주소 발송 실패 허용 */ }
      return Response.json({ ok: true, trial: publicTrial(saved) });
    }

    // ── create
    const input = cleanTrialInput(body);
    if (!input.value) return Response.json({ error: input.error, code: input.code }, { status: 400 });
    const v = input.value;

    const data = typeof body.image?.data === 'string' ? body.image.data : '';
    if (!data) return Response.json({ error: 'sketch image required', code: 'image' }, { status: 400 });
    if (data.length > (TRIAL_MAX_BYTES * 4) / 3 + 4) return Response.json({ error: 'image too large', code: 'image_size' }, { status: 400 });
    const bytes = b64Bytes(data);
    const kind = sketchKind(bytes);
    const px = kind ? imageSize(bytes) : null;
    if (!kind || !px) return Response.json({ error: 'PNG, JPG or WEBP only', code: 'image_type' }, { status: 400 });
    if (Math.min(px.w, px.h) < TRIAL_MIN_PX) return Response.json({ error: 'image too small', code: 'image_small' }, { status: 400 });

    const hq = await svc.entities.Tenant.filter({ is_hq: true }, 'created_date', 1);
    const tenant = hq[0] || (await svc.entities.Tenant.list('created_date', 1))[0];
    if (!tenant) return Response.json({ error: 'HQ tenant not configured' }, { status: 500 });

    // 같은 번호로 다시 부르면(화면 재시도) 새로 만들지 않고 진행 중인 결과를 돌려준다
    const existing = await findLead(v.token);
    if (existing) return Response.json({ trial: publicTrial(existing) });

    const recent = await svc.entities.ManufacturingLead.filter({ source: TRIAL_SOURCE }, '-created_date', 200);
    const limit = trialLimit(recent.filter((r) => r.sketch_trial?.status !== 'FAILED'), v.email);
    if (limit) return Response.json({ error: 'too many requests', code: limit }, { status: 429 });

    const name = `sketch.${kind.ext}`;
    const up = await svc.integrations.Core.UploadPrivateFile({ file: new File([bytes], name, { type: kind.type }) });
    if (!up?.file_uri) return Response.json({ error: 'upload failed' }, { status: 502 });

    const lead = await svc.entities.ManufacturingLead.create({
      tenant_id: tenant.id,
      company: v.company || `${v.contact_name} (개인)`,
      contact_name: v.contact_name, phone: v.phone, email: v.email,
      inquiry_type: 'turnkey', interest: 'UNDECIDED', categories: [],
      detail: v.idea,
      attachments: [{ name, size: bytes.length, url: up.file_uri }],
      lang: v.lang,
      source: TRIAL_SOURCE,
      referrer: str(body.referrer, 500), utm_source: str(body.utm_source, 100), utm_medium: str(body.utm_medium, 100),
      utm_campaign: str(body.utm_campaign, 150), utm_content: str(body.utm_content, 150), landing_path: str(body.landing_path, 300),
      submitted_at: new Date().toISOString(), status: 'new', invitation_sent: false,
      sketch_token: v.token,
      sketch_trial: { status: 'PENDING', variants: [] },
    });
    const fail = async (error, status) => {
      await svc.entities.ManufacturingLead.update(lead.id, { sketch_trial: { status: 'FAILED', variants: [], error } }).catch(() => {});
      return Response.json({ error, code: 'generate' }, { status });
    };

    try {
      const signed = await svc.integrations.Core.CreateFileSignedUrl({ file_uri: up.file_uri, expires_in: 900 });
      const srcUrls = signed?.signed_url ? [signed.signed_url] : [];
      if (!srcUrls.length) return await fail('스케치 이미지를 읽지 못했습니다.', 502);
      const plan = await svc.integrations.Core.InvokeLLM({ prompt: sketchPlanPrompt(v.idea), response_json_schema: SKETCH_PLAN_SCHEMA, model: IMAGE_MODEL, file_urls: srcUrls });
      const shape = str(plan?.shape, 1500);
      if (!shape) return await fail('스케치에서 형태를 읽지 못했습니다. 더 선명한 스케치를 올려 주세요.', 422);
      const dirs = (Array.isArray(plan?.variants) ? plan.variants : []).filter((d) => d?.style).slice(0, SKETCH_VARIANTS);
      while (dirs.length < SKETCH_VARIANTS) dirs.push({ label: `시안 ${dirs.length + 1}`, style: 'Neutral colors that suit the product, matte finish.' });
      const imgs = await Promise.allSettled(dirs.map((d) => svc.integrations.Core.GenerateImage({ prompt: frontPrompt(shape, str(d.style, 300)), existing_image_urls: srcUrls })));
      const variants = dirs.map((d, i) => ({ label: koFix(str(d.label, 30)) || `시안 ${i + 1}`, style: str(d.style, 300), url: imgs[i].status === 'fulfilled' ? imgs[i].value?.url || '' : '' })).filter((m) => m.url);
      if (!variants.length) return await fail('시안을 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요.', 502);
      const saved = await svc.entities.ManufacturingLead.update(lead.id, {
        sketch_trial: { status: 'READY', shape, variants, notes: strList(plan?.notes, 4, 200), chosen: null, generated_at: new Date().toISOString() },
      });
      return Response.json({ trial: publicTrial(saved) });
    } catch (e) {
      return await fail(String(e?.message || e).slice(0, 200), 502);
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
