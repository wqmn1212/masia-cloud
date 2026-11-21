import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { appUrl } from '../../shared/emailLayout.ts';
import { sentPatch } from '../../shared/salesMail.ts';
import {
  BASIS, LIVE, validEmail, normEmail, kst, inWindow, adSubject, footer, render, dueStep, canSend, approvable, statusAfterEdit,
  mimeMail, cleanCampaign, startProblems, DISCOVER_SCHEMA, discoverPrompt, DRAFT_SCHEMA, draftPrompt, cleanCompanies, newToken,
} from '../../shared/outreach.ts';

// 콜드메일 자동화 (연결된 Gmail 로 보낸다)
//  직원:   save_campaign {campaign}            캠페인 저장 (시작은 보낸 사람 정보·제안·소개서가 있어야)
//          discover {campaign_id, count}       AI 가 인터넷에서 고객사를 찾아 영업 대상(후보)으로 넣는다 — 이메일 주소는 찾지 않는다
//          update_contact {prospect_id, ...}   담당자·이메일·주소 출처·보낼 근거
//          draft {prospect_id}                 AI 맞춤 첫 메일 초안
//          save_draft {prospect_id, subject, body}
//          approve {prospect_ids}              사람이 확인 → 자동 발송 대기
//          stop {prospect_id}                  자동 발송 멈춤
//          run {campaign_id?}                  지금 보낼 것 보내기 (보내는 시간 안에서만)
//  예약:   run (로그인 없음, 워크플로 OutreachSend)
//  공개:   unsubscribe {token}                 수신거부 (로그인 없음)
//          brochure {token}                    회사소개서 열기 (로그인 없음) — 처음 연 시각을 기록
const STAFF = ['master', 'service', 'sub'];
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const MAX_ATTACH = 4 * 1024 * 1024; // 넘으면 링크로
const json = (b: unknown, status = 200) => Response.json(b, { status });
const clip = (s: unknown, n: number) => String(s ?? '').trim().slice(0, n);

async function gmailSend(token: string, raw: string) {
  const res = await fetch(`${GMAIL}/messages/send`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ raw }), signal: AbortSignal.timeout(30000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e: any = new Error(data?.error?.message || `Gmail ${res.status}`); e.status = res.status; throw e; }
  return data;
}

function b64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export default async function (req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const action = String(body.action || '');
    const now = new Date();
    const nowIso = now.toISOString();

    // ---------- 공개 (로그인 없음) ----------
    if (action === 'unsubscribe' || action === 'brochure') {
      const token = clip(body.token, 80);
      const p = /^[0-9a-f]{20,}$/.test(token) ? (await svc.entities.SalesProspect.filter({ outreach_token: token }, '-created_date', 1))[0] : null;
      if (!p) return json({ error: '링크를 찾을 수 없습니다', code: 'not_found' }, 404);
      const c = p.campaign_id ? await svc.entities.OutreachCampaign.get(p.campaign_id).catch(() => null) : null;
      if (action === 'unsubscribe') {
        const email = normEmail(p.email);
        if (email) {
          const had = await svc.entities.EmailSuppression.filter({ tenant_id: p.tenant_id, email }, '-created_date', 1);
          if (!had.length) await svc.entities.EmailSuppression.create({ tenant_id: p.tenant_id, email, reason: 'unsubscribe', prospect_id: p.id });
        }
        if (p.outreach?.status !== 'UNSUBSCRIBED') {
          await svc.entities.SalesProspect.update(p.id, {
            outreach: { ...(p.outreach || {}), status: 'UNSUBSCRIBED' },
            touches: [...(p.touches || []), { at: nowIso, kind: 'email', direction: 'in', note: '수신거부 (링크)', by: p.contact_name || p.company || '', stage: p.stage, auto: true }],
            ...(['TARGET', 'SENT'].includes(p.stage) ? { stage: 'LOST', lost_reason: '수신거부' } : {}),
          });
        }
        return json({ ok: true, sender: c?.sender?.company || '' });
      }
      const b = c?.brochure;
      if (!b?.file_uri || b.mode === 'none') return json({ error: '회사소개서가 없습니다', code: 'no_file' }, 404);
      const { signed_url } = await svc.integrations.Core.CreateFileSignedUrl({ file_uri: b.file_uri, expires_in: 600 });
      if (!p.outreach?.brochure_opened_at) {
        await svc.entities.SalesProspect.update(p.id, {
          outreach: { ...(p.outreach || {}), brochure_opened_at: nowIso },
          touches: [...(p.touches || []), { at: nowIso, kind: 'email', direction: 'in', note: '회사소개서 열람', by: p.contact_name || p.company || '', stage: p.stage, auto: true }],
        });
      }
      return json({ url: signed_url, name: b.file_name || '회사소개서.pdf', sender: c?.sender?.company || '' });
    }

    // ---------- 직원 / 예약 ----------
    const me = await base44.auth.me().catch(() => null);
    const scheduled = !me && action === 'run';
    if (!scheduled && (!me || me.is_active === false || !STAFF.includes(me.account_tier))) return json({ error: 'Forbidden' }, 403);
    const own = (tenant: string) => scheduled || me.account_tier === 'master' || (!!tenant && tenant === me.tenant_id);
    const by = me ? (me.full_name || me.email || '') : '자동 발송';
    const loadProspect = async (id: unknown) => { const p = typeof id === 'string' && id ? await svc.entities.SalesProspect.get(id).catch(() => null) : null; return p && own(p.tenant_id) ? p : null; };
    const loadCampaign = async (id: unknown) => { const c = typeof id === 'string' && id ? await svc.entities.OutreachCampaign.get(id).catch(() => null) : null; return c && own(c.tenant_id) ? c : null; };
    const suppressedOf = async (tenant: string) => new Set((await svc.entities.EmailSuppression.filter({ tenant_id: tenant }, '-created_date', 5000)).map((s: any) => normEmail(s.email)));

    if (action === 'save_campaign') {
      const input = body.campaign || {};
      const clean = cleanCampaign(input);
      const prev = input.id ? await loadCampaign(input.id) : null;
      if (input.id && !prev) return json({ error: '캠페인을 찾을 수 없습니다' }, 404);
      if (clean.status === 'ACTIVE') {
        const miss = startProblems(clean);
        if (miss.length) return json({ error: `시작하려면 채워야 합니다: ${miss.join(', ')}`, code: 'incomplete', missing: miss }, 400);
      }
      const saved = prev ? await svc.entities.OutreachCampaign.update(prev.id, clean) : await svc.entities.OutreachCampaign.create({ ...clean, tenant_id: me.tenant_id, created_by_name: by });
      return json({ campaign: { ...(prev || {}), ...clean, ...(saved || {}) } });
    }

    if (action === 'discover') {
      const c = await loadCampaign(body.campaign_id);
      if (!c) return json({ error: '캠페인을 찾을 수 없습니다' }, 404);
      if (!clip(c.target, 10)) return json({ error: '‘찾을 고객사’ 를 먼저 적어 주세요' }, 400);
      const count = Math.min(20, Math.max(3, Math.round(Number(body.count) || 10)));
      const existing = await svc.entities.SalesProspect.filter({ tenant_id: c.tenant_id }, '-created_date', 2000);
      const known = existing.map((p: any) => p.company).filter(Boolean);
      const r = await svc.integrations.Core.InvokeLLM({ prompt: discoverPrompt(c, count, known), add_context_from_internet: true, response_json_schema: DISCOVER_SCHEMA });
      const found = cleanCompanies(r?.companies || [], known).slice(0, count);
      const created = [];
      for (const x of found) {
        created.push(await svc.entities.SalesProspect.create({
          tenant_id: c.tenant_id, company: x.company, website: x.website, industry: x.industry, product_idea: x.product_idea, source: 'cold_email', stage: 'TARGET',
          owner_name: me.full_name || '', owner_email: me.email || '', campaign_id: c.id, outreach_token: newToken(), created_by_name: by,
          notes: [x.size && `규모: ${x.size}`, x.region && `지역: ${x.region}`].filter(Boolean).join(' · '),
          outreach: { status: 'CANDIDATE', consent_basis: 'none', fit_reason: x.why_fit, contact_page: x.contact_page, region: x.region },
        }));
      }
      return json({ found: created.length, prospects: created });
    }

    if (action === 'update_contact') {
      const p = await loadProspect(body.prospect_id);
      if (!p) return json({ error: '영업 대상을 찾을 수 없습니다' }, 404);
      const email = clip(body.email ?? p.email, 160);
      if (email && !validEmail(email)) return json({ error: '이메일 형식이 맞지 않습니다' }, 400);
      const basis = body.consent_basis !== undefined ? String(body.consent_basis) : p.outreach?.consent_basis || 'none';
      if (!BASIS[basis]) return json({ error: '보낼 근거 값이 맞지 않습니다' }, 400);
      const next = {
        ...p, email, contact_name: clip(body.contact_name ?? p.contact_name, 60), contact_title: clip(body.contact_title ?? p.contact_title, 60),
        outreach: { ...(p.outreach || {}), consent_basis: basis, email_source: clip(body.email_source ?? p.outreach?.email_source, 200) },
      };
      // 주소가 바뀌면 승인을 다시 받는다 (보내는 중이던 것은 멈춤)
      if (normEmail(email) !== normEmail(p.email) && ['APPROVED', 'SENDING', 'DONE', 'STOPPED'].includes(p.outreach?.status)) {
        next.outreach.status = 'DRAFTED';
        delete next.outreach.step; delete next.outreach.last_sent_at; // 받는 사람이 바뀌면 첫 메일부터 다시
      }
      next.outreach.status = statusAfterEdit(next);
      const patch = { email: next.email, contact_name: next.contact_name, contact_title: next.contact_title, outreach: next.outreach, ...(p.outreach_token ? {} : { outreach_token: newToken() }) };
      await svc.entities.SalesProspect.update(p.id, patch);
      return json({ prospect: { ...p, ...patch } });
    }

    if (action === 'draft' || action === 'save_draft') {
      const p = await loadProspect(body.prospect_id);
      if (!p) return json({ error: '영업 대상을 찾을 수 없습니다' }, 404);
      if (LIVE.includes(p.outreach?.status) && p.outreach?.step !== undefined) return json({ error: '이미 보내기 시작한 대상입니다' }, 409);
      let draft;
      if (action === 'draft') {
        const c = await loadCampaign(p.campaign_id);
        if (!c) return json({ error: '캠페인을 찾을 수 없습니다' }, 404);
        const r = await svc.integrations.Core.InvokeLLM({ prompt: draftPrompt(c, p), response_json_schema: DRAFT_SCHEMA });
        draft = { subject: clip(r?.subject, 180).replace(/^\s*\(광고\)\s*/, ''), body: clip(r?.body, 6000) };
        if (!draft.subject || !draft.body) return json({ error: 'AI 가 초안을 만들지 못했습니다. 다시 눌러 주세요' }, 502);
      } else {
        draft = { subject: clip(body.subject, 180), body: clip(body.body, 6000) };
        if (!draft.subject || !draft.body) return json({ error: '제목과 본문을 채워 주세요' }, 400);
      }
      const o = { ...(p.outreach || {}), draft, status: ['APPROVED'].includes(p.outreach?.status) ? 'DRAFTED' : p.outreach?.status };
      o.status = statusAfterEdit({ ...p, outreach: o });
      await svc.entities.SalesProspect.update(p.id, { outreach: o });
      return json({ prospect: { ...p, outreach: o } });
    }

    if (action === 'approve') {
      const ids = (Array.isArray(body.prospect_ids) ? body.prospect_ids : []).slice(0, 200);
      const result = { approved: 0, problems: [] as { id: string; company: string; reason: string }[] };
      const supCache = new Map<string, Set<string>>();
      for (const id of ids) {
        const p = await loadProspect(id);
        if (!p) continue;
        if (!supCache.has(p.tenant_id)) supCache.set(p.tenant_id, await suppressedOf(p.tenant_id));
        const why = approvable(p, supCache.get(p.tenant_id));
        if (why) { result.problems.push({ id: p.id, company: p.company, reason: why }); continue; }
        await svc.entities.SalesProspect.update(p.id, { outreach: { ...p.outreach, status: 'APPROVED', approved_by: by, approved_at: nowIso, error: '' }, ...(p.outreach_token ? {} : { outreach_token: newToken() }) });
        result.approved += 1;
      }
      return json(result);
    }

    if (action === 'stop') {
      const p = await loadProspect(body.prospect_id);
      if (!p) return json({ error: '영업 대상을 찾을 수 없습니다' }, 404);
      const o = { ...(p.outreach || {}), status: 'STOPPED' };
      await svc.entities.SalesProspect.update(p.id, { outreach: o });
      return json({ prospect: { ...p, outreach: o } });
    }

    if (action === 'run') {
      if (!inWindow(now)) return json({ sent: 0, skipped: 0, note: '보내는 시간(평일 9~18시, 한국 시간)이 아니어서 보내지 않았습니다' });
      let token = '';
      try { token = (await svc.connectors.getConnection('gmail')).accessToken; } catch { /* 아래 */ }
      if (!token) return json({ error: 'Gmail 이 연결되어 있지 않습니다', code: 'not_connected' }, 409);
      const campaigns = body.campaign_id
        ? [await loadCampaign(body.campaign_id)].filter(Boolean)
        : (await svc.entities.OutreachCampaign.filter({ status: 'ACTIVE' }, '-updated_date', 50)).filter((c: any) => own(c.tenant_id));
      const today = kst(now).ymd;
      const total = { sent: 0, skipped: 0, errors: [] as string[] };
      for (const c of campaigns) {
        if (c.status !== 'ACTIVE') continue;
        const suppressed = await suppressedOf(c.tenant_id);
        const list = await svc.entities.SalesProspect.filter({ campaign_id: c.id }, 'created_date', 1000);
        let sentToday = list.reduce((n: number, p: any) => n + (p.touches || []).filter((t: any) => t.outreach && t.direction === 'out' && kst(new Date(t.at)).ymd === today).length, 0);
        const limit = Math.min(50, Math.max(1, Number(c.daily_limit) || 20));
        let attach: { name: string; type: string; data: string } | null | undefined;
        const out = { sent: 0, skipped: 0, errors: [] as string[] };
        for (const p of list) {
          const o = p.outreach || {};
          // 회신이 왔거나 영업이 끝났으면 자동 발송을 멈춘다 (회신 찾기는 salesMail check_replies 가 한다)
          if (LIVE.includes(o.status) && ['REPLIED', 'MEETING', 'QUOTE', 'WON', 'LOST'].includes(p.stage)) {
            await svc.entities.SalesProspect.update(p.id, { outreach: { ...o, status: p.stage === 'LOST' ? 'STOPPED' : 'REPLIED' } });
            continue;
          }
          const step = dueStep(p, c, now);
          if (step === null) continue;
          const ok = canSend(p, c, { suppressed, now });
          if (!ok.ok) { out.skipped += 1; if (o.error !== ok.reason) await svc.entities.SalesProspect.update(p.id, { outreach: { ...o, error: ok.reason } }); continue; }
          if (sentToday >= limit) { out.skipped += 1; continue; }
          const lang = c.language || 'ko';
          const tpl = step === 0 ? o.draft : c.steps[step - 1];
          const vars = { company: p.company, contact: p.contact_name || '', product: p.product_idea || '', sender: c.sender?.company || '', lang };
          const subject = adSubject(step === 0 ? tpl.subject : (render(tpl.subject, vars) || `Re: ${o.draft?.subject || ''}`), lang, c.ad_label !== false);
          const tok = p.outreach_token || newToken();
          const unsubUrl = appUrl(`/u/${tok}`);
          let text = step === 0 ? tpl.body : render(tpl.body, vars);
          const b = c.brochure || {};
          let useAttach = false;
          if (b.file_uri && b.mode !== 'none') {
            if (b.mode === 'attach' && step === 0) {
              if (attach === undefined) {
                try {
                  const { signed_url } = await svc.integrations.Core.CreateFileSignedUrl({ file_uri: b.file_uri, expires_in: 300 });
                  const res = await fetch(signed_url, { signal: AbortSignal.timeout(30000) });
                  const buf = res.ok ? await res.arrayBuffer() : null;
                  attach = buf && buf.byteLength <= MAX_ATTACH ? { name: b.file_name || '회사소개서.pdf', type: res.headers.get('content-type') || 'application/pdf', data: b64(buf) } : null;
                } catch { attach = null; }
              }
              useAttach = !!attach;
            }
            if (!useAttach) text += `\n\n${lang === 'en' ? 'Company profile' : lang === 'zh' ? '公司介绍' : '회사소개서'}: ${appUrl(`/b/${tok}`)}`;
          }
          text += `\n${footer(c, unsubUrl, lang)}`;
          try {
            const sent = await gmailSend(token, mimeMail({ to: p.email.trim(), subject, body: text, replyTo: c.sender?.email || '', attachment: useAttach ? attach : null, unsubUrl }));
            const base = sentPatch(p, { subject, by, gmailId: sent.id, threadId: sent.threadId, nowIso });
            base.touches[base.touches.length - 1] = { ...base.touches[base.touches.length - 1], outreach: true, step, note: `콜드메일 ${step === 0 ? '첫 메일' : `후속 ${step}`} — ${subject}${useAttach ? ' (소개서 첨부)' : ''}` };
            const last = step >= (c.steps || []).length;
            await svc.entities.SalesProspect.update(p.id, { ...base, outreach_token: tok, outreach: { ...o, status: last ? 'DONE' : 'SENDING', step, last_sent_at: nowIso, error: '' } });
            out.sent += 1; sentToday += 1;
          } catch (e: any) {
            const msg = e.status === 403 ? 'Gmail 보내기 권한이 없습니다 (Gmail 연결을 다시 해 주세요)' : String(e.message || e).slice(0, 200);
            out.errors.push(`${p.company}: ${msg}`);
            await svc.entities.SalesProspect.update(p.id, { outreach: { ...o, error: msg } });
            if (e.status === 403 || e.status === 401) break;
          }
        }
        await svc.entities.OutreachCampaign.update(c.id, { last_run: { at: nowIso, sent: out.sent, skipped: out.skipped, errors: out.errors.slice(0, 5) } });
        total.sent += out.sent; total.skipped += out.skipped; total.errors.push(...out.errors);
      }
      return json({ ...total, errors: total.errors.slice(0, 10) });
    }

    return json({ error: '알 수 없는 요청입니다' }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
}
