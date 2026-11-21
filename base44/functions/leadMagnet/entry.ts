import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { appUrl } from '../../shared/emailLayout.ts';
import { sentPatch } from '../../shared/salesMail.ts';
import { normEmail, mimeMail, gmailSend, gmailToken, newToken } from '../../shared/outreach.ts';
import {
  SLUG, PER_EMAIL_MS, DAILY_CAP, cleanMagnet, liveProblems, publicMagnet, cleanSignup, signupPatch, consentRows, deliveryMail,
  reconfirmDue, reconfirmMail, REPORT_SCHEMA, reportPrompt, cleanReport, reportText, metaLeadToRow, cleanImportRow,
} from '../../shared/leadMagnet.ts';

// 자료 신청 페이지 (리드 마그넷)
//  공개:  page {slug}                        공개 페이지 내용 (/free/<slug>)
//         submit {slug, name, email, ...}    신청: 동의 기록 → 영업 대상 → 자료 메일 (광고 수신 동의한 사람은 연결 캠페인으로)
//         material {token}                   자료 받기 (/m/<token>) — 처음 연 시각 기록
//  직원:  save {magnet}                      저장 (공개하려면 liveProblems 가 비어야)
//         import_leads {magnet_id, rows, label, send_material}   인스타·페북 리드 광고 CSV 가져오기
//         meta_pull {magnet_id}              Graph API 로 리드 광고 신청자 가져오기 (비밀값 META_LEAD_TOKEN)
//         resend {prospect_id}               자료 메일 다시 보내기
//  예약:  meta_pull_all (매시) · reconfirm (매일 — 2년 수신동의 확인 안내)
const STAFF = ['master', 'service', 'sub'];
const GRAPH = 'https://graph.facebook.com/v21.0';
const json = (b: unknown, status = 200) => Response.json(b, { status });
const clip = (s: unknown, n: number) => String(s ?? '').trim().slice(0, n);
const TOKEN = /^[0-9a-f]{20,80}$/;

async function sha(s: string) {
  if (!s) return '';
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`aegis-consent:${s}`));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

export default async function (req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const db = svc.entities;
    const action = String(body.action || '');
    const nowIso = new Date().toISOString();
    const todayKst = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

    const bySlug = async (slug: unknown) => (SLUG.test(String(slug || '')) ? (await db.LeadMagnet.filter({ slug: String(slug) }, '-created_date', 1))[0] : null);
    const bump = async (m: any, patch: Record<string, number>) => {
      const fresh = await db.LeadMagnet.get(m.id).catch(() => m);
      const st = { views: 0, signups: 0, opt_ins: 0, opened: 0, ...(fresh.stats || {}) };
      for (const [k, v] of Object.entries(patch)) st[k as 'views'] = (Number(st[k as 'views']) || 0) + v;
      await db.LeadMagnet.update(m.id, { stats: st }).catch(() => null);
    };

    // 신청 한 건 넣기 (페이지·CSV·Graph 공통)
    async function ingest(m: any, input: any, { source, at = nowIso, ipHash = '', ua = '', send = true, texts = null as any }: any) {
      const existing = (await db.SalesProspect.filter({ tenant_id: m.tenant_id, email: input.email }, '-created_date', 1))[0] || null;
      const materialToken = newToken();
      const { patch, join } = signupPatch(existing, input, m, { nowIso: at, source, materialToken });
      let p = existing ? { ...existing, ...patch, ...(await db.SalesProspect.update(existing.id, patch)) } : await db.SalesProspect.create({ ...patch, created_by_name: '자료 신청' });
      p = { ...patch, ...p };
      for (const row of consentRows(m, input, { nowIso: at, source, prospectId: p.id, ipHash, userAgent: ua, texts })) await db.ConsentLog.create(row);
      // 본인이 다시 광고 수신에 동의하면 예전 수신거부를 푼다 (기록은 남긴다)
      if (input.marketing) {
        for (const s of await db.EmailSuppression.filter({ tenant_id: m.tenant_id, email: input.email }, '-created_date', 20)) {
          if (!s.lifted_at) await db.EmailSuppression.update(s.id, { lifted_at: at, note: [s.note, `재동의 (${source})`].filter(Boolean).join(' · ') });
        }
      }
      let report = null;
      if (m.kind === 'report' && input.idea) {
        try { report = cleanReport(await svc.integrations.Core.InvokeLLM({ prompt: reportPrompt(input), response_json_schema: REPORT_SCHEMA })); } catch { report = null; }
        if (report) await db.SalesProspect.update(p.id, { notes: [p.notes, `[양산 진단 리포트 ${todayKst}]\n${reportText(report)}`].filter(Boolean).join('\n\n') });
      }
      let sent = false;
      let mailErr = '';
      if (send) {
        const r = await sendMaterial(m, p, { report, marketing: input.marketing, join });
        sent = r.sent; mailErr = r.error;
      } else if (join) {
        // 메일을 보내지 않고 가져온 동의 신청자: 첫 메일 초안이 있어야 자동 발송된다 → 승인 대기로
        await db.SalesProspect.update(p.id, { outreach: { ...p.outreach, status: 'READY' } });
      }
      return { prospect: p, sent, report, materialToken, mailErr, created: !existing };
    }

    // 자료 메일 (Gmail → 안 되면 기본 메일)
    async function sendMaterial(m: any, p: any, { report = null as any, marketing = false, join = false }) {
      const mail = deliveryMail(m, p, { materialUrl: m.kind === 'file' ? appUrl(`/d/${p.material_token}`) : '', report, unsubUrl: appUrl(`/u/${p.outreach_token}`), marketing, nowIso });
      const tok = await gmailToken(svc);
      let gmail: any = null; let error = '';
      if (tok) {
        try { gmail = await gmailSend(tok, mimeMail({ to: p.email, subject: mail.subject, body: mail.text, html: mail.html, replyTo: m.operator?.email || '', unsubUrl: marketing ? appUrl(`/u/${p.outreach_token}`) : '' })); }
        catch (e: any) { error = String(e?.message || e).slice(0, 200); }
      }
      if (!gmail) {
        try { await svc.integrations.Core.SendEmail({ to: p.email, from_name: m.operator?.company || 'AEGIS', subject: mail.subject, body: mail.html }); gmail = { id: '', threadId: '' }; error = ''; }
        catch (e: any) { error = error || String(e?.message || e).slice(0, 200); }
      }
      const fresh = await db.SalesProspect.get(p.id).catch(() => p);
      const o = { ...(fresh.outreach || {}) };
      if (gmail) {
        const base = sentPatch(fresh, { subject: mail.subject, by: '자료 신청 자동 발송', gmailId: gmail.id, threadId: gmail.threadId, nowIso });
        base.touches[base.touches.length - 1] = { ...base.touches[base.touches.length - 1], outreach: !!join, step: join ? 0 : undefined, note: `자료 보냄 — ${mail.subject}` };
        o.material_sent_at = nowIso;
        if (join) Object.assign(o, { status: 'SENDING', step: 0, last_sent_at: nowIso, draft: { subject: mail.subject, body: mail.text.split('\n—\n')[0] }, error: '' });
        await db.SalesProspect.update(p.id, { ...base, outreach: o });
        if (marketing) await db.ConsentLog.create({ tenant_id: m.tenant_id, email: p.email, prospect_id: p.id, magnet_id: m.id, kind: 'result_notice', granted: true, source: 'material_mail', text: mail.text.split('\n').filter((l: string) => /수신 동의 처리 결과/.test(l)).join(' '), at: nowIso });
      } else {
        // 못 보냈으면 승인 대기 초안으로 남긴다 (캠페인 자동 발송이 보내거나, 직원이 다시 보내기)
        if (join) Object.assign(o, { status: 'APPROVED', draft: { subject: mail.subject, body: mail.text.split('\n—\n')[0] } });
        o.error = `자료 메일을 보내지 못했습니다: ${error || 'Gmail 연결 필요'}`;
        await db.SalesProspect.update(p.id, { outreach: o });
      }
      return { sent: !!gmail, error };
    }

    // ---------- 공개 ----------
    if (action === 'page') {
      const m = await bySlug(body.slug);
      if (!m || m.status !== 'LIVE') return json({ error: '페이지를 찾을 수 없습니다', code: 'not_found' }, 404);
      await bump(m, { views: 1 });
      return json({ magnet: publicMagnet(m) });
    }

    if (action === 'submit') {
      const m = await bySlug(body.slug);
      if (!m || m.status !== 'LIVE') return json({ error: '마감되었거나 없는 페이지입니다', code: 'not_found' }, 404);
      const c = cleanSignup(body, m);
      if (!c.value) return json({ error: c.error, code: c.code }, 400);
      const input = c.value;
      const recentLogs = await db.ConsentLog.filter({ magnet_id: m.id, kind: 'privacy' }, '-at', DAILY_CAP[m.kind] || 500);
      const mine = recentLogs.find((r: any) => r.email === input.email);
      if (mine && Date.now() - Date.parse(mine.at) < PER_EMAIL_MS) return json({ ok: true, again: true, email_sent: true });
      if (recentLogs.filter((r: any) => new Date(Date.parse(r.at) + 9 * 3600000).toISOString().slice(0, 10) === todayKst).length >= (DAILY_CAP[m.kind] || 500)) return json({ error: '오늘 신청이 많아 잠시 마감했습니다. 내일 다시 신청해 주세요', code: 'limit' }, 429);
      const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
      const r = await ingest(m, input, { source: `landing:${m.slug}${input.ref ? `:${input.ref}` : ''}`, ipHash: await sha(ip), ua: req.headers.get('user-agent') || '' });
      await bump(m, { signups: 1, opt_ins: input.marketing ? 1 : 0 });
      if (m.notify_email) {
        svc.integrations.Core.SendEmail({ to: m.notify_email, from_name: 'AEGIS', subject: `[자료 신청] ${input.name}${input.company ? ` · ${input.company}` : ''} — ${m.title}`, body: `<p>${[`이름: ${input.name}`, `회사: ${input.company || '-'}`, `이메일: ${input.email}`, `전화: ${input.phone || '-'}`, `광고 수신 동의: ${input.marketing ? '예' : '아니오'}`, input.idea ? `아이디어: ${input.idea}` : ''].filter(Boolean).map((l) => l.replace(/[<>&]/g, '')).join('<br>')}</p><p><a href="${appUrl(`/outreach?tab=leads&m=${m.id}`)}">신청자 보기</a></p>` }).catch(() => null);
      }
      // 처음 신청한 주소에만 바로 받기 링크를 돌려준다 (남의 주소로 신청해 남의 기록을 보는 것을 막는다)
      return json({ ok: true, email_sent: r.sent, material_token: r.created && m.kind === 'file' ? r.materialToken : '', report: r.created ? r.report : null });
    }

    if (action === 'material') {
      const token = clip(body.token, 80);
      const p = TOKEN.test(token) ? (await db.SalesProspect.filter({ material_token: token }, '-created_date', 1))[0] : null;
      const m = p?.outreach?.magnet_id ? await db.LeadMagnet.get(p.outreach.magnet_id).catch(() => null) : null;
      if (!p || !m?.file?.file_uri) return json({ error: '링크를 찾을 수 없습니다', code: 'not_found' }, 404);
      const { signed_url } = await svc.integrations.Core.CreateFileSignedUrl({ file_uri: m.file.file_uri, expires_in: 600 });
      if (!p.outreach?.material_opened_at) {
        await db.SalesProspect.update(p.id, {
          outreach: { ...p.outreach, material_opened_at: nowIso },
          touches: [...(p.touches || []), { at: nowIso, kind: 'email', direction: 'in', note: `자료 열람 — ${m.title}`, by: p.contact_name || p.email, stage: p.stage, auto: true }],
        });
        await bump(m, { opened: 1 });
      }
      return json({ url: signed_url, name: m.file.file_name || '자료.pdf', sender: m.operator?.company || '' });
    }

    // ---------- 직원 / 예약 ----------
    const me = await base44.auth.me().catch(() => null);
    const scheduled = !me && ['meta_pull_all', 'reconfirm'].includes(action);
    if (!scheduled && (!me || me.is_active === false || !STAFF.includes(me.account_tier))) return json({ error: 'Forbidden' }, 403);
    const own = (tenant: string) => scheduled || me.account_tier === 'master' || (!!tenant && tenant === me.tenant_id);
    const loadMagnet = async (id: unknown) => { const m = typeof id === 'string' && id ? await db.LeadMagnet.get(id).catch(() => null) : null; return m && own(m.tenant_id) ? m : null; };

    async function metaPull(m: any) {
      const token = Deno.env.get('META_LEAD_TOKEN') || '';
      if (!token) return { error: 'META_LEAD_TOKEN 비밀값이 설정되지 않았습니다 (Meta 페이지 액세스 토큰, leads_retrieval 권한)', added: 0 };
      const since = m.meta?.last_pull_at ? Math.floor(Date.parse(m.meta.last_pull_at) / 1000) - 300 : Math.floor(Date.now() / 1000) - 90 * 86400;
      let added = 0; let error = '';
      for (const form of m.meta?.form_ids || []) {
        let url = `${GRAPH}/${form}/leads?fields=id,created_time,field_data,custom_disclaimer_responses,ad_name,platform&limit=100&filtering=${encodeURIComponent(JSON.stringify([{ field: 'time_created', operator: 'GREATER_THAN', value: since }]))}&access_token=${encodeURIComponent(token)}`;
        for (let page = 0; url && page < 10; page += 1) {
          const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) { error = `Meta ${res.status}: ${String(data?.error?.message || '').slice(0, 160)}`; break; }
          for (const lead of data.data || []) {
            const row = cleanImportRow(metaLeadToRow(lead, m));
            if (!row) continue;
            const source = `meta:${form}:${row.external_id}`;
            if ((await db.ConsentLog.filter({ tenant_id: m.tenant_id, source }, '-at', 1)).length) continue;
            const texts = { privacy: `인스타그램·페이스북 리드 양식(${form})에서 받은 개인정보 수집·이용 동의 (문구는 Meta 양식 참고)`, marketing: `리드 양식의 광고 수신 동의 체크박스${m.meta?.marketing_key ? ` (${m.meta.marketing_key})` : ''}` };
            await ingest(m, row, { source, at: row.at || nowIso, send: !!m.meta?.send_material, texts });
            added += 1;
          }
          url = data?.paging?.next || '';
        }
        if (error) break;
      }
      await db.LeadMagnet.update(m.id, { meta: { ...(m.meta || {}), last_pull_at: error ? m.meta?.last_pull_at || '' : nowIso, last_error: error, pulled: (Number(m.meta?.pulled) || 0) + added } });
      if (added) await bump(m, { signups: added });
      return { added, error };
    }

    if (action === 'save') {
      const input = body.magnet || {};
      const clean: any = cleanMagnet(input);
      const prev = input.id ? await loadMagnet(input.id) : null;
      if (input.id && !prev) return json({ error: '자료 신청 페이지를 찾을 수 없습니다' }, 404);
      if (!SLUG.test(clean.slug)) return json({ error: '공개 주소는 영문 소문자·숫자·- 로 2~40자입니다', code: 'slug' }, 400);
      const same = (await db.LeadMagnet.filter({ slug: clean.slug }, '-created_date', 2)).filter((x: any) => x.id !== prev?.id);
      if (same.length) return json({ error: '이미 쓰는 공개 주소입니다. 다른 주소를 적어 주세요', code: 'slug_taken' }, 409);
      if (clean.campaign_id) {
        const c = await db.OutreachCampaign.get(clean.campaign_id).catch(() => null);
        if (!c || !own(c.tenant_id)) return json({ error: '연결할 캠페인을 찾을 수 없습니다' }, 404);
      }
      if (clean.status === 'LIVE') {
        const miss = liveProblems(clean);
        if (miss.length) return json({ error: `공개하려면 채워야 합니다: ${miss.join(', ')}`, code: 'incomplete', missing: miss }, 400);
      }
      clean.meta = { ...(prev?.meta || {}), ...clean.meta };
      const saved = prev ? await db.LeadMagnet.update(prev.id, clean) : await db.LeadMagnet.create({ ...clean, tenant_id: me.tenant_id, stats: { views: 0, signups: 0, opt_ins: 0, opened: 0 }, created_by_name: me.full_name || me.email || '' });
      return json({ magnet: { ...(prev || {}), ...clean, ...(saved || {}) } });
    }

    if (action === 'import_leads') {
      const m = await loadMagnet(body.magnet_id);
      if (!m) return json({ error: '자료 신청 페이지를 찾을 수 없습니다' }, 404);
      const rows = (Array.isArray(body.rows) ? body.rows : []).slice(0, 500).map(cleanImportRow).filter(Boolean);
      const label = clip(body.label, 60) || 'csv';
      const out = { added: 0, skipped: 0, opt_ins: 0, sent: 0 };
      for (const row of rows as any[]) {
        const source = `csv:${label}:${row.external_id || row.email}`;
        if ((await db.ConsentLog.filter({ tenant_id: m.tenant_id, source }, '-at', 1)).length) { out.skipped += 1; continue; }
        const texts = { privacy: `리드 광고 양식(${label})에서 받은 개인정보 수집·이용 동의 (CSV 가져오기 — 문구는 양식 참고)`, marketing: `리드 광고 양식(${label})의 광고 수신 동의 항목` };
        const r = await ingest(m, row, { source, at: row.at || nowIso, send: !!body.send_material, texts });
        out.added += 1; if (row.marketing) out.opt_ins += 1; if (r.sent) out.sent += 1;
      }
      out.skipped += (Array.isArray(body.rows) ? body.rows.length : 0) - rows.length;
      if (out.added) await bump(m, { signups: out.added, opt_ins: out.opt_ins });
      return json(out);
    }

    if (action === 'meta_pull') {
      const m = await loadMagnet(body.magnet_id);
      if (!m) return json({ error: '자료 신청 페이지를 찾을 수 없습니다' }, 404);
      if (!m.meta?.form_ids?.length) return json({ error: '리드 양식 ID 를 먼저 넣어 주세요' }, 400);
      const r = await metaPull(m);
      return r.error && !r.added ? json({ error: r.error }, 502) : json(r);
    }

    if (action === 'resend') {
      const p = typeof body.prospect_id === 'string' ? await db.SalesProspect.get(body.prospect_id).catch(() => null) : null;
      if (!p || !own(p.tenant_id)) return json({ error: '신청자를 찾을 수 없습니다' }, 404);
      const m = p.outreach?.magnet_id ? await db.LeadMagnet.get(p.outreach.magnet_id).catch(() => null) : null;
      if (!m) return json({ error: '자료 신청 페이지가 없습니다' }, 404);
      const fresh = p.material_token ? p : { ...p, ...(await db.SalesProspect.update(p.id, { material_token: newToken() })) };
      const r = await sendMaterial(m, fresh, { marketing: !!p.outreach?.consent?.marketing, join: false });
      return r.sent ? json({ ok: true }) : json({ error: r.error || '보내지 못했습니다' }, 502);
    }

    if (action === 'meta_pull_all') {
      const list = (await db.LeadMagnet.filter({ status: 'LIVE' }, '-updated_date', 100)).filter((m: any) => own(m.tenant_id) && m.meta?.form_ids?.length);
      const out = { magnets: 0, added: 0, errors: [] as string[] };
      for (const m of list) { const r = await metaPull(m); out.magnets += 1; out.added += r.added; if (r.error) out.errors.push(`${m.title}: ${r.error}`); }
      return json(out);
    }

    if (action === 'reconfirm') {
      const tok = await gmailToken(svc);
      if (!tok) return json({ error: 'Gmail 이 연결되어 있지 않습니다', code: 'not_connected' }, 409);
      const list = (await db.SalesProspect.filter({ source: { $in: ['lead_magnet', 'meta_lead'] } }, 'created_date', 5000)).filter((p: any) => own(p.tenant_id) && reconfirmDue(p));
      const magnets = new Map<string, any>();
      let sent = 0;
      for (const p of list.slice(0, 100)) {
        const id = p.outreach?.magnet_id || '';
        if (!magnets.has(id)) magnets.set(id, id ? await db.LeadMagnet.get(id).catch(() => null) : null);
        const m = magnets.get(id);
        if (!m?.operator?.company) continue;
        const mail = reconfirmMail(m, p, { unsubUrl: appUrl(`/u/${p.outreach_token}`), nowIso });
        try {
          await gmailSend(tok, mimeMail({ to: p.email, subject: mail.subject, body: mail.text, html: mail.html, replyTo: m.operator?.email || '', unsubUrl: appUrl(`/u/${p.outreach_token}`) }));
          await db.SalesProspect.update(p.id, { outreach: { ...p.outreach, consent: { ...p.outreach.consent, reconfirm_sent_at: nowIso } } });
          await db.ConsentLog.create({ tenant_id: p.tenant_id, email: normEmail(p.email), prospect_id: p.id, magnet_id: m.id, kind: 'reconfirm_notice', granted: true, source: 'reconfirm', text: mail.text, at: nowIso });
          sent += 1;
        } catch (e: any) { if (e.status === 401 || e.status === 403) break; }
      }
      return json({ due: list.length, sent });
    }

    return json({ error: '알 수 없는 요청입니다' }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
}
