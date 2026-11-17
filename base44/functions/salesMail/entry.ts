import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { notifyUsers } from '../../shared/notify.ts';
import { mimeMessage, sentPatch, replyPatch, replySince, validEmail, ACTIVE } from '../../shared/salesMail.ts';

// 영업 메일 (연결된 Gmail 계정)
//  status                       직원: Gmail 연결·보내기 권한·보내는 주소
//  send {prospect_id, subject, body}  직원: 영업 대상에게 보내고 연락 기록·단계·다음 연락일을 바꾼다
//  check_replies {prospect_id?} 직원(같은 팀) 또는 예약 실행(로그인 없음, 워크플로 SalesReplyCheck): 회신을 찾아 기록하고 담당자에게 알린다
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const STAFF = ['master', 'service', 'sub'];
const json = (b: unknown, status = 200) => Response.json(b, { status });

async function gmail(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${GMAIL}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) }, signal: AbortSignal.timeout(20000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e: any = new Error(data?.error?.message || `Gmail ${res.status}`); e.status = res.status; throw e; }
  return data;
}

async function inbound(token: string, email: string, sinceIso: string) {
  const after = Math.floor(Date.parse(sinceIso) / 1000);
  const q = `from:${email} after:${after}`;
  const list = await gmail(token, `/messages?maxResults=5&q=${encodeURIComponent(q)}`);
  const out = [];
  for (const m of list.messages || []) {
    const msg = await gmail(token, `/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`);
    const h = Object.fromEntries((msg.payload?.headers || []).map((x: any) => [x.name.toLowerCase(), x.value]));
    out.push({ id: msg.id, threadId: msg.threadId, at: new Date(Number(msg.internalDate)).toISOString(), subject: h.subject || '', snippet: msg.snippet || '' });
  }
  return out;
}

export default async function (req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const me = await base44.auth.me().catch(() => null);
    const action = String(body.action || '');
    const scheduled = !me && action === 'check_replies';
    if (!scheduled && (!me || me.is_active === false || !STAFF.includes(me.account_tier))) return json({ error: 'Forbidden' }, 403);
    const nowIso = new Date().toISOString();

    let token = '';
    try { token = (await svc.connectors.getConnection('gmail')).accessToken; } catch { /* 아래 */ }
    if (!token) return json({ error: 'Gmail 이 연결되어 있지 않습니다. 관리자에게 Gmail 연결을 요청해 주세요', code: 'not_connected' }, 409);

    if (action === 'status') {
      const info = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(token)}`).then((r) => r.json()).catch(() => ({}));
      const scope = String(info.scope || '');
      const profile = await gmail(token, '/profile').catch(() => ({}));
      return json({ connected: true, can_send: /gmail\.send|mail\.google\.com/.test(scope), can_read: /gmail\.readonly|gmail\.modify|mail\.google\.com/.test(scope), email: profile.emailAddress || info.email || '' });
    }

    const loadProspect = async (id: unknown) => {
      const p = typeof id === 'string' && id ? await svc.entities.SalesProspect.get(id).catch(() => null) : null;
      if (!p) return null;
      if (me && me.account_tier !== 'master' && p.tenant_id !== me.tenant_id) return null;
      return p;
    };

    if (action === 'send') {
      const p = await loadProspect(body.prospect_id);
      if (!p) return json({ error: '영업 대상을 찾을 수 없습니다' }, 404);
      if (!validEmail(p.email)) return json({ error: '받는 사람 이메일이 없거나 형식이 맞지 않습니다' }, 400);
      const subject = String(body.subject || '').trim().slice(0, 200);
      const text = String(body.body || '').trim().slice(0, 20000);
      if (!subject || !text) return json({ error: '제목과 본문을 채워 주세요' }, 400);
      let sent;
      try {
        sent = await gmail(token, '/messages/send', { method: 'POST', body: JSON.stringify({ raw: mimeMessage({ to: p.email, subject, body: text, replyTo: validEmail(me.email) ? me.email : '' }) }) });
      } catch (e: any) {
        if (e.status === 403) return json({ error: 'Gmail 보내기 권한이 없습니다. 관리자가 Gmail 연결을 다시 해 주면 됩니다 (보내기 권한 추가)', code: 'no_send_scope' }, 409);
        throw e;
      }
      const patch = sentPatch(p, { subject, by: me.full_name || me.email || '', gmailId: sent.id, threadId: sent.threadId, nowIso });
      const updated = await svc.entities.SalesProspect.update(p.id, patch);
      return json({ prospect: { ...p, ...patch, ...(updated || {}) }, gmail_id: sent.id });
    }

    if (action === 'check_replies') {
      let list: any[];
      if (body.prospect_id) { const p = await loadProspect(body.prospect_id); list = p ? [p] : []; }
      else {
        const scope = me && me.account_tier !== 'master' ? { tenant_id: me.tenant_id } : {};
        list = (await svc.entities.SalesProspect.filter(scope, '-updated_date', 300)).filter((p: any) => ACTIVE.includes(p.stage) && validEmail(p.email) && replySince(p));
      }
      let found = 0; const errors: string[] = [];
      for (const p of list.slice(0, 80)) {
        const since = replySince(p);
        if (!since || !validEmail(p.email)) continue;
        try {
          const r = replyPatch(p, await inbound(token, p.email.trim(), since), nowIso);
          if (!r) continue;
          await svc.entities.SalesProspect.update(p.id, r.patch);
          found += r.count;
          const owner = p.owner_email ? (await svc.entities.User.filter({ email: p.owner_email }, '-created_date', 1))[0] : null;
          if (owner) await notifyUsers(svc, [owner], { type: 'sales_reply', title: `[영업 회신] ${p.company}`, body: `${p.contact_name || p.company}님이 회신했습니다: ${r.latest.subject || ''}\n다음 연락일을 정해 주세요.`, link: `/sales?p=${p.id}` }).catch(() => 0);
        } catch (e: any) {
          if (e.status === 403) return json({ error: 'Gmail 읽기 권한이 없습니다. Gmail 연결을 다시 해 주세요', code: 'no_read_scope' }, 409);
          errors.push(`${p.company}: ${e.message}`);
        }
      }
      return json({ checked: list.length, found, errors: errors.slice(0, 5) });
    }
    return json({ error: '알 수 없는 요청입니다' }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
}
