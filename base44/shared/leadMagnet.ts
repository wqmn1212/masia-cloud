// 자료 신청 페이지 (리드 마그넷): 무료 자료를 미끼로 이메일과 동의를 받고 → 자료를 보내고 → 광고 수신에 동의한 사람만 후속 메일
//
// 법규 (개인정보 보호법·정보통신망법) 를 코드로 지킨다:
//  - 개인정보 수집·이용 동의(필수)와 광고성 정보 수신 동의(선택)를 따로 받는다. 선택 동의는 미리 체크하지 않는다 (화면).
//    동의 문구에는 수집 항목·목적·보유 기간·거부할 권리와 거부 시 불이익을 적는다 (consentTexts).
//  - 동의한 시각·경로·그때 문구를 ConsentLog 에 쌓는다. 접속 주소는 해시만 남긴다.
//  - 수신 동의·철회를 처리하면 그 결과(보낸 곳·날짜·내용)를 받는 사람에게 알린다 (정보통신망법 제50조 ⑧).
//  - 수신 동의는 2년마다 확인 안내를 보낸다 (시행령 제62조의3) → reconfirmDue.
//  - 광고 수신에 동의하지 않은 신청자에게는 자료만 보내고 캠페인에 넣지 않는다.
import { validEmail, normEmail, newToken } from './outreach.ts';

const clip = (s: unknown, n: number) => String(s ?? '').trim().slice(0, n);
export const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
export const RETENTION_DEFAULT = 24;
export const RECONFIRM_MONTHS = 23; // 2년이 되기 한 달 전에 안내
export const PER_EMAIL_MS = 10 * 60 * 1000;
export const DAILY_CAP = { file: 500, report: 60 } as Record<string, number>;

export function cleanSlug(s: unknown) {
  return clip(s, 60).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

export function cleanMagnet(x: any) {
  const o = x?.operator || {};
  const f = x?.file || {};
  const ask = x?.ask || {};
  const meta = x?.meta || {};
  const kind = x?.kind === 'report' ? 'report' : 'file';
  return {
    slug: cleanSlug(x?.slug),
    status: ['DRAFT', 'LIVE', 'CLOSED'].includes(x?.status) ? x.status : 'DRAFT',
    kind,
    title: clip(x?.title, 80),
    subtitle: clip(x?.subtitle, 240),
    bullets: (Array.isArray(x?.bullets) ? x.bullets : []).map((b: unknown) => clip(b, 120)).filter(Boolean).slice(0, 6),
    button_label: clip(x?.button_label, 30),
    file: { file_uri: clip(f.file_uri, 400), file_name: clip(f.file_name, 120), size: Number(f.size) > 0 ? Math.round(Number(f.size)) : 0 },
    campaign_id: clip(x?.campaign_id, 80),
    ask: { company: ask.company !== false, phone: !!ask.phone, idea: kind === 'report' || !!ask.idea },
    operator: { company: clip(o.company, 80), email: validEmail(o.email) ? clip(o.email, 120) : '', phone: clip(o.phone, 40), address: clip(o.address, 160), privacy_url: /^https?:\/\//.test(String(o.privacy_url || '')) ? clip(o.privacy_url, 300) : '' },
    retention_months: Math.min(60, Math.max(1, Math.round(Number(x?.retention_months) || RETENTION_DEFAULT))),
    thanks: clip(x?.thanks, 400),
    notify_email: validEmail(x?.notify_email) ? clip(x.notify_email, 120) : '',
    meta: {
      form_ids: (Array.isArray(meta.form_ids) ? meta.form_ids : String(meta.form_ids || '').split(/[\s,]+/)).map((s: unknown) => clip(s, 40)).filter((s: string) => /^\d{5,30}$/.test(s)).slice(0, 10),
      marketing_key: clip(meta.marketing_key, 80),
      send_material: !!meta.send_material,
    },
  };
}

/** 공개하려면 채워야 하는 것 */
export function liveProblems(m: any) {
  const out = [];
  if (!SLUG.test(m?.slug || '')) out.push('공개 주소 (영문 소문자·숫자·-)');
  if (!m?.title) out.push('제목');
  if (!m?.operator?.company) out.push('개인정보 처리자 (회사 이름)');
  if (!m?.operator?.email && !m?.operator?.phone) out.push('문의 연락처 (이메일 또는 전화)');
  if (m?.kind !== 'report' && !m?.file?.file_uri) out.push('보낼 자료 파일');
  return out;
}

/** 수집 항목 (화면 칸과 같게) */
export function fieldsOf(m: any) {
  const a = m?.ask || {};
  return ['이름', '이메일', ...(a.company ? ['회사명'] : []), ...(a.phone ? ['전화번호'] : []), ...(a.idea || m?.kind === 'report' ? ['만들고 싶은 제품 설명'] : [])];
}

/** 동의 문구 (화면·기록·메일이 같은 문구를 쓴다) */
export function consentTexts(m: any) {
  const who = m?.operator?.company || '회사';
  const months = Number(m?.retention_months) || RETENTION_DEFAULT;
  const keep = months % 12 === 0 ? `${months / 12}년` : `${months}개월`;
  const what = m?.kind === 'report' ? '요청하신 양산 진단 리포트 발송' : `요청하신 자료(${m?.title || '자료'}) 발송`;
  return {
    privacy: `[필수] 개인정보 수집·이용 동의 — ${who}는 ${what}과 문의 응대를 위해 ${fieldsOf(m).join(', ')}을(를) 수집하며, 신청일로부터 ${keep} 동안 보관한 뒤 파기합니다 (동의를 철회하면 바로 파기). 동의를 거부할 수 있으나, 거부하면 자료를 받을 수 없습니다.`,
    marketing: `[선택] 광고성 정보 수신 동의 — ${who}의 제품·서비스·행사 소식을 이메일로 받습니다. 동의하지 않아도 자료는 받을 수 있고, 받은 메일 아래 링크로 언제든 무료로 그만 받을 수 있습니다.`,
  };
}

/** 공개 페이지에 보낼 값만 */
export function publicMagnet(m: any) {
  return {
    slug: m.slug, kind: m.kind || 'file', title: m.title || '', subtitle: m.subtitle || '', bullets: m.bullets || [],
    button_label: m.button_label || (m.kind === 'report' ? '무료 진단 받기' : '무료로 받기'),
    ask: { company: m.ask?.company !== false, phone: !!m.ask?.phone, idea: m.kind === 'report' || !!m.ask?.idea },
    operator: { company: m.operator?.company || '', email: m.operator?.email || '', phone: m.operator?.phone || '', privacy_url: m.operator?.privacy_url || '' },
    consent: consentTexts(m), thanks: m.thanks || '', status: m.status,
  };
}

/** 신청 입력 정리. 문제가 있으면 { error, code } */
export function cleanSignup(body: any, m: any) {
  if (clip(body?.website, 10)) return { error: '잘못된 요청입니다', code: 'bot' }; // 사람 눈에 안 보이는 칸
  const name = clip(body?.name, 60);
  const email = normEmail(clip(body?.email, 160));
  if (!name) return { error: '이름을 적어 주세요', code: 'name' };
  if (!validEmail(email)) return { error: '이메일 주소를 확인해 주세요', code: 'email' };
  if (body?.privacy !== true) return { error: '개인정보 수집·이용에 동의해야 자료를 보낼 수 있습니다', code: 'privacy' };
  const a = publicMagnet(m).ask;
  const company = clip(body?.company, 80);
  const phone = clip(body?.phone, 40);
  const idea = clip(body?.idea, 1200);
  if (a.phone && phone && phone.replace(/\D/g, '').length < 8) return { error: '전화번호를 확인해 주세요', code: 'phone' };
  if (m?.kind === 'report' && idea.length < 5) return { error: '만들고 싶은 제품을 한 줄 이상 적어 주세요', code: 'idea' };
  return { value: { name, email, company: a.company ? company : '', phone: a.phone ? phone : '', idea: a.idea ? idea : '', marketing: body?.marketing === true, ref: clip(body?.ref, 120) } };
}

const ymdKo = (iso: string) => { const d = new Date(new Date(iso).getTime() + 9 * 3600000); return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`; };
export { ymdKo };

/**
 * 신청 → 영업 대상 값 (새로 만들기 또는 이미 있는 대상 고치기)
 * existing 이 있으면 바꿀 값만 돌려준다. 광고 수신 동의가 없으면 캠페인·보낼 근거를 건드리지 않는다.
 * join: 연결 캠페인에 들어감 → 자료 메일을 보낸 뒤 '보내는 중(첫 메일 보냄)' 으로 바꿔 후속 메일이 이어지게 한다
 */
export function signupPatch(existing: any, input: any, m: any, { nowIso, source, materialToken }: { nowIso: string; source: string; materialToken: string }) {
  const o = { ...(existing?.outreach || {}) };
  const consent = { ...(o.consent || {}), privacy_at: nowIso, source };
  if (input.marketing) {
    Object.assign(consent, { marketing: true, marketing_at: nowIso });
    delete consent.withdrawn_at; delete consent.reconfirm_sent_at;
    o.consent_basis = 'opt_in';
    o.email_source = `${source.startsWith('meta') ? '인스타·페북 리드 광고' : '자료 신청 페이지'} '${m.title}' — ${ymdKo(nowIso)} 광고 수신 동의`;
  } else if (!existing) {
    Object.assign(consent, { marketing: false });
    o.consent_basis = 'none';
    o.email_source = `${source.startsWith('meta') ? '인스타·페북 리드 광고' : '자료 신청 페이지'} '${m.title}' — 광고 수신 동의 안 함`;
  }
  o.consent = consent;
  o.magnet_id = m.id;
  // 동의한 신청자는 연결 캠페인의 후속 메일로 이어진다 (자료 메일이 첫 메일 역할). 이미 보내는 중이거나 끝난 대상은 건드리지 않는다
  const joinCampaign = input.marketing && m.campaign_id && (!o.status || ['CANDIDATE', 'READY', 'DRAFTED', 'STOPPED', 'UNSUBSCRIBED', 'DONE'].includes(o.status));
  if (joinCampaign) { o.status = 'APPROVED'; delete o.step; delete o.last_sent_at; o.error = ''; }
  else if (!existing) o.status = input.marketing ? 'READY' : 'STOPPED';
  const note = `자료 신청 — ${m.title} (광고 수신 동의 ${input.marketing ? 'O' : 'X'})${input.idea ? ` · ${input.idea.slice(0, 80)}` : ''}`;
  const touch = { at: nowIso, kind: 'email', direction: 'in', note, by: input.name || input.email, stage: existing?.stage || 'TARGET', auto: true };
  const base: any = {
    outreach: o,
    material_token: materialToken,
    touches: [...(existing?.touches || []), touch],
    ...(joinCampaign ? { campaign_id: m.campaign_id } : {}),
    ...(existing?.outreach_token ? {} : { outreach_token: newToken() }),
  };
  if (!existing) {
    Object.assign(base, {
      tenant_id: m.tenant_id, company: input.company || `${input.name} (개인)`, contact_name: input.name, email: input.email, phone: input.phone || '',
      product_idea: input.idea || '', source: source.startsWith('meta') ? 'meta_lead' : 'lead_magnet', stage: 'TARGET',
      ...(m.campaign_id && input.marketing ? { campaign_id: m.campaign_id } : {}),
    });
  } else {
    if (!existing.contact_name && input.name) base.contact_name = input.name;
    if (!existing.phone && input.phone) base.phone = input.phone;
    if (!existing.product_idea && input.idea) base.product_idea = input.idea;
    if (/\(개인\)$/.test(existing.company || '') && input.company) base.company = input.company;
  }
  return { patch: base, join: !!joinCampaign };
}

/** ConsentLog 에 넣을 줄 (필수 동의 1줄 + 광고 수신 동의 여부 1줄) */
export function consentRows(m: any, input: any, { nowIso, source, prospectId, ipHash = '', userAgent = '', texts = null as any }: any) {
  const t = texts || consentTexts(m);
  const base = { tenant_id: m.tenant_id, email: input.email, prospect_id: prospectId, magnet_id: m.id, source, at: nowIso, ip_hash: ipHash, user_agent: clip(userAgent, 200) };
  return [{ ...base, kind: 'privacy', granted: true, text: t.privacy }, { ...base, kind: 'marketing', granted: !!input.marketing, text: t.marketing }];
}

/** 2년 수신동의 확인 안내를 보낼 때인지 */
export function reconfirmDue(p: any, now = new Date()) {
  const c = p?.outreach?.consent || {};
  if (!c.marketing || c.withdrawn_at || !c.marketing_at || !validEmail(p?.email)) return false;
  if (p?.outreach?.status === 'UNSUBSCRIBED') return false;
  const last = [c.marketing_at, c.reconfirm_sent_at].filter(Boolean).sort().pop() as string;
  const due = new Date(last); due.setUTCMonth(due.getUTCMonth() + RECONFIRM_MONTHS);
  return now >= due;
}

// ---------- 메일 ----------
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const para = (t: string) => `<p style="margin:0 0 12px;font-size:15px;line-height:24px;color:#3a3a40">${esc(t).replace(/\n/g, '<br>')}</p>`;
const btn = (label: string, href: string) => `<p style="margin:18px 0"><a href="${esc(href)}" style="display:inline-block;padding:12px 22px;border-radius:8px;background:#2f5bea;color:#ffffff;font-weight:600;text-decoration:none">${esc(label)}</a></p>`;
const small = (t: string) => `<p style="margin:16px 0 0;font-size:12.5px;line-height:19px;color:#77777f">${esc(t).replace(/\n/g, '<br>')}</p>`;
const wrapHtml = (inner: string) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f4f4f6"><div style="max-width:560px;margin:0 auto;padding:24px 14px;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif"><div style="background:#ffffff;border:1px solid #e6e6ea;border-radius:14px;padding:26px 24px">${inner}</div></div></body></html>`;

function senderLines(m: any) {
  const o = m?.operator || {};
  return [o.company, [o.phone, o.email].filter(Boolean).join(' · '), o.address].filter(Boolean).join('\n');
}

/** 신청한 자료 메일 + 수신 동의 처리 결과 통지 */
export function deliveryMail(m: any, p: any, { materialUrl = '', report = null as any, unsubUrl = '', marketing = false, nowIso }: any) {
  const who = m?.operator?.company || '';
  const name = p?.contact_name || '';
  const subject = m?.kind === 'report' ? `[${who}] 요청하신 양산 진단 리포트입니다` : `[${who}] 요청하신 ‘${m?.title}’ 자료입니다`;
  const intro = `${name ? `${name}님, ` : ''}${who}입니다. 신청해 주셔서 감사합니다.`;
  const result = marketing
    ? `수신 동의 처리 결과: ${who}는 ${ymdKo(nowIso)}에 광고성 정보(이메일) 수신 동의를 처리했습니다. 원하지 않으시면 아래 링크로 언제든 무료로 철회할 수 있습니다.`
    : `광고성 정보 수신에는 동의하지 않으셨으므로 광고 메일은 보내지 않습니다. 이 메일은 요청하신 자료를 보내 드리는 안내입니다.`;
  const reportTxt = report ? reportText(report) : '';
  const lead = m?.kind === 'report'
    ? (report ? '말씀해 주신 아이디어로 정리한 1차 양산 진단입니다. AI 가 만든 초안이라 실제 견적·일정은 사양을 확인한 뒤 달라질 수 있습니다.' : '리포트를 자동으로 만들지 못해 담당자가 확인한 뒤 2영업일 안에 직접 보내 드리겠습니다.')
    : '요청하신 자료는 아래 링크에서 받을 수 있습니다 (링크는 신청하신 분 전용입니다).';
  const text = [
    intro, '',
    lead,
    materialUrl ? `자료 받기: ${materialUrl}` : '',
    reportTxt ? `\n${reportTxt}` : '',
    '', '궁금한 점은 이 메일에 회신해 주시면 담당자가 답해 드립니다.',
    '', '—', senderLines(m), '', result,
    marketing && unsubUrl ? `수신 거부: ${unsubUrl}` : '',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
  const html = wrapHtml([
    para(intro),
    para(lead),
    materialUrl ? btn('자료 받기', materialUrl) : '',
    report ? reportHtml(report) : '',
    para('궁금한 점은 이 메일에 회신해 주시면 담당자가 답해 드립니다.'),
    small(senderLines(m)),
    small(result),
    marketing && unsubUrl ? `<p style="margin:6px 0 0;font-size:12.5px"><a href="${esc(unsubUrl)}" style="color:#77777f">수신 거부 (무료)</a></p>` : '',
  ].join(''));
  return { subject, text, html };
}

/** 2년 수신동의 확인 안내 (광고 아님 — 법정 안내) */
export function reconfirmMail(m: any, p: any, { unsubUrl, nowIso }: any) {
  const who = m?.operator?.company || p?.outreach?.consent?.source || '';
  const at = p?.outreach?.consent?.marketing_at || nowIso;
  const subject = `[${who}] 광고성 정보 수신 동의 확인 안내`;
  const body = [
    `${p?.contact_name ? `${p.contact_name}님, ` : ''}${who}입니다.`,
    `고객님은 ${ymdKo(at)}에 ${who}의 광고성 정보(이메일) 수신에 동의하셨습니다. 법에 따라 2년마다 동의 여부를 알려 드립니다.`,
    '계속 받으시려면 아무것도 하지 않으셔도 됩니다. 그만 받으시려면 아래 링크를 눌러 주세요 (무료).',
    `수신 거부: ${unsubUrl}`, '', '—', senderLines(m),
  ].join('\n');
  return { subject, text: body, html: wrapHtml([para(body.split('\n—')[0]), btn('수신 거부', unsubUrl), small(senderLines(m))].join('')) };
}

/** 수신 거부 처리 결과 통지 */
export function withdrawMail(senderCompany: string, { nowIso }: { nowIso: string }) {
  const subject = `[${senderCompany}] 광고성 정보 수신 거부 처리 결과`;
  const text = `${senderCompany}는 ${ymdKo(nowIso)}에 고객님의 광고성 정보(이메일) 수신 거부를 처리했습니다. 앞으로 광고 메일을 보내지 않습니다.\n\n이 메일은 법에 따른 처리 결과 안내이며 광고가 아닙니다.`;
  return { subject, text, html: wrapHtml(para(text)) };
}

// ---------- AI 양산 진단 리포트 ----------
export const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    product: { type: 'string', description: '제품을 한 문장으로' },
    users: { type: 'string', description: '누가 어디서 쓰는지' },
    parts: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, note: { type: 'string' } } }, description: '주요 부품 4~8개' },
    molds: { type: 'string', description: '사출 금형 개수 추정과 근거 (예: 상·하 케이스, 버튼 — 3벌 추정)' },
    certs: { type: 'array', items: { type: 'string' }, description: '국내 판매에 필요할 수 있는 인증 (KC 전기안전·전자파, 전파 인증 등) — 확인 필요 표시' },
    steps: { type: 'array', items: { type: 'object', properties: { step: { type: 'string' }, weeks: { type: 'string' } } }, description: '컨셉 → 설계 → 시제품 → 금형 → 양산 단계와 대략 주 수' },
    risks: { type: 'array', items: { type: 'string' }, description: '양산에서 문제가 되기 쉬운 점 3~5개' },
    next: { type: 'array', items: { type: 'string' }, description: '지금 바로 정하면 좋은 것 3개' },
  },
  required: ['product', 'parts', 'steps', 'risks', 'next'],
};

export function reportPrompt(input: any) {
  return [
    '너는 하드웨어 제품 개발·양산 컨설턴트다. 아래 아이디어로 1차 양산 진단을 한국어로 써라.',
    `아이디어: ${clip(input?.idea, 1200)}`,
    input?.company ? `회사: ${clip(input.company, 80)}` : '',
    '규칙:',
    '- 모르는 것은 추정이라고 밝히고, 확인되지 않은 숫자(가격·판매량·실적)를 지어내지 말 것.',
    '- 금형 개수·일정은 범위로 (예: 2~3벌, 4~6주). 비용 금액은 쓰지 말 것.',
    '- 인증은 “해당될 수 있음 — 확인 필요” 로. 단정하지 말 것.',
    '- 각 항목은 짧게, 전문 용어는 쉬운 말로 풀어서.',
  ].filter(Boolean).join('\n');
}

const sList = (v: unknown, n: number, len = 200) => (Array.isArray(v) ? v : []).map((x) => clip(x, len)).filter(Boolean).slice(0, n);
export function cleanReport(r: any) {
  if (!r || typeof r !== 'object') return null;
  const out = {
    product: clip(r.product, 300), users: clip(r.users, 300), molds: clip(r.molds, 300),
    parts: (Array.isArray(r.parts) ? r.parts : []).map((x: any) => ({ name: clip(x?.name, 60), note: clip(x?.note, 160) })).filter((x: any) => x.name).slice(0, 10),
    certs: sList(r.certs, 6), risks: sList(r.risks, 6), next: sList(r.next, 4),
    steps: (Array.isArray(r.steps) ? r.steps : []).map((x: any) => ({ step: clip(x?.step, 80), weeks: clip(x?.weeks, 30) })).filter((x: any) => x.step).slice(0, 8),
  };
  return out.product && out.steps.length ? out : null;
}

export function reportText(r: any) {
  const L = (t: string, xs: string[]) => (xs.length ? `■ ${t}\n${xs.map((x) => `- ${x}`).join('\n')}` : '');
  return [
    `■ 제품\n${r.product}${r.users ? `\n${r.users}` : ''}`,
    L('주요 부품', r.parts.map((x: any) => `${x.name}${x.note ? ` — ${x.note}` : ''}`)),
    r.molds ? `■ 금형 (추정)\n${r.molds}` : '',
    L('필요할 수 있는 인증 (확인 필요)', r.certs),
    L('개발 단계', r.steps.map((x: any) => `${x.step}${x.weeks ? ` · ${x.weeks}` : ''}`)),
    L('양산에서 조심할 점', r.risks),
    L('지금 정하면 좋은 것', r.next),
  ].filter(Boolean).join('\n\n');
}
function reportHtml(r: any) {
  const h = (t: string) => `<div style="margin:18px 0 6px;font-size:14px;font-weight:700;color:#161618">${esc(t)}</div>`;
  const ul = (xs: string[]) => `<ul style="margin:0 0 6px;padding-left:18px;font-size:14px;line-height:22px;color:#3a3a40">${xs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  return [
    h('제품'), para([r.product, r.users].filter(Boolean).join('\n')),
    r.parts.length ? h('주요 부품') + ul(r.parts.map((x: any) => `${x.name}${x.note ? ` — ${x.note}` : ''}`)) : '',
    r.molds ? h('금형 (추정)') + para(r.molds) : '',
    r.certs.length ? h('필요할 수 있는 인증 (확인 필요)') + ul(r.certs) : '',
    h('개발 단계') + ul(r.steps.map((x: any) => `${x.step}${x.weeks ? ` · ${x.weeks}` : ''}`)),
    r.risks.length ? h('양산에서 조심할 점') + ul(r.risks) : '',
    r.next.length ? h('지금 정하면 좋은 것') + ul(r.next) : '',
  ].join('');
}

// ---------- 인스타그램·페이스북 리드 광고 ----------
const MARKETING_KEY = /market|광고|마케팅|promo|newsletter|소식|advert/i;
const pick = (fd: Record<string, string>, ...keys: string[]) => { for (const k of keys) if (fd[k]) return fd[k]; return ''; };

/** Graph API 리드 한 건 → 가져오기 줄 */
export function metaLeadToRow(lead: any, m: any) {
  const fd: Record<string, string> = {};
  for (const f of Array.isArray(lead?.field_data) ? lead.field_data : []) fd[String(f?.name || '').toLowerCase()] = clip(Array.isArray(f?.values) ? f.values[0] : f?.values, 300);
  const boxes = Array.isArray(lead?.custom_disclaimer_responses) ? lead.custom_disclaimer_responses : [];
  const key = m?.meta?.marketing_key || '';
  const checked = (b: any) => b?.is_checked === true || b?.is_checked === '1' || b?.is_checked === 1 || b?.is_checked === 'true';
  const marketing = boxes.some((b: any) => checked(b) && (key ? b.checkbox_key === key : MARKETING_KEY.test(String(b?.checkbox_key || ''))));
  const name = pick(fd, 'full_name', '이름', 'name') || [pick(fd, 'first_name'), pick(fd, 'last_name')].filter(Boolean).join(' ');
  return {
    external_id: clip(lead?.id, 40), created_time: clip(lead?.created_time, 40),
    email: normEmail(pick(fd, 'email', '이메일', 'work_email')), name: clip(name, 60),
    company: clip(pick(fd, 'company_name', '회사명', 'company'), 80), phone: clip(pick(fd, 'phone_number', '전화번호', 'phone'), 40),
    idea: clip(Object.entries(fd).filter(([k]) => !['email', 'full_name', 'first_name', 'last_name', 'company_name', 'phone_number', 'work_email', '이메일', '이름', '회사명', '전화번호'].includes(k)).map(([k, v]) => `${k}: ${v}`).join(' / '), 600),
    marketing, platform: clip(lead?.platform, 10), ad: clip(lead?.ad_name, 80),
  };
}

/** 가져오기 줄 정리 (CSV·Graph 공통). 쓸 수 없으면 null */
export function cleanImportRow(r: any) {
  const email = normEmail(clip(r?.email, 160));
  if (!validEmail(email)) return null;
  const at = r?.created_time && !Number.isNaN(Date.parse(r.created_time)) ? new Date(r.created_time).toISOString() : '';
  return { email, name: clip(r?.name, 60) || email.split('@')[0], company: clip(r?.company, 80), phone: clip(r?.phone, 40), idea: clip(r?.idea, 600), marketing: r?.marketing === true, external_id: clip(r?.external_id, 60), at };
}

export { newToken };
