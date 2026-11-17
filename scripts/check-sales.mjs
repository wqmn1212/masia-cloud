// 영업 파이프라인 계산 검산: 영업일 계산, 다음 연락일 기본값, 오늘·밀린 연락, 엑셀 붙여넣기, 메일 문안.
// 실행: npm run check:sales
import assert from 'node:assert/strict';
import * as S from '../src/lib/salesPipeline.js';

assert.equal(S.addBusinessDays('2026-11-13', 1), '2026-11-16', '금요일 다음 영업일은 월요일');
assert.equal(S.addBusinessDays('2026-11-16', 4), '2026-11-20');
assert.equal(S.defaultFollowUp('SENT', '2026-11-16'), '2026-11-20', '첫 메일 뒤 4영업일');
assert.equal(S.defaultFollowUp('MEETING', '2026-11-20'), '2026-11-24', '미팅 뒤 2영업일 (주말 건너뜀)');
assert.equal(S.defaultFollowUp('WON', '2026-11-20'), '', '끝난 단계는 다음 연락 없음');
assert.equal(S.kstToday(new Date('2026-11-15T16:00:00Z')), '2026-11-16', '한국 날짜');

assert.deepEqual(S.followUpState({ stage: 'SENT', next_follow_up: '2026-11-16' }, '2026-11-16'), { today: true });
assert.deepEqual(S.followUpState({ stage: 'REPLIED', next_follow_up: '2026-11-13' }, '2026-11-16'), { late: true, days: 3 });
assert.equal(S.followUpState({ stage: 'LOST', next_follow_up: '2026-11-13' }, '2026-11-16'), null, '보류는 알리지 않음');
assert.equal(S.followUpState({ stage: 'SENT', next_follow_up: '2026-11-20' }, '2026-11-16'), null);
assert.equal(S.outreachCount({ touches: [{ kind: 'email' }, { kind: 'note' }, { kind: 'call' }] }), 2);

const withHead = S.parseProspects('회사\t담당자\t이메일\t업종\n무니스\t길상현\tkil@example.com\t조명\n\n바이어상사\t김담당\t잘못된메일\t생활용품');
assert.deepEqual(withHead, [{ company: '무니스', contact_name: '길상현', email: 'kil@example.com', industry: '조명' }, { company: '바이어상사', contact_name: '김담당', industry: '생활용품' }], '머리글로 칸 맞춤, 잘못된 이메일은 버림');
assert.deepEqual(S.parseProspects('에이컴퍼니,박대리,a@b.co'), [{ company: '에이컴퍼니', contact_name: '박대리', email: 'a@b.co' }], '머리글 없으면 기본 순서');
assert.deepEqual(S.parseProspects('담당자\t이메일\n홍길동\th@x.co'), [], '회사명이 없으면 넣지 않음');

const t = S.mailTemplates({ company: '무니스', contact_name: '길상현', contact_title: '대표', product_idea: '수면 조명' }, { sender: '이호민', deck: 'https://deck.example' });
assert.deepEqual(t.map((x) => x.key), ['first', 'follow1', 'follow2', 'thanks']);
assert.match(t[0].subject, /무니스 수면 조명/);
assert.match(t[0].body, /^길상현 대표님, /);
assert.match(t[0].body, /https:\/\/deck\.example/);
assert.match(S.mailTemplates({ company: 'X' })[0].body, /^담당자님, .*\[보내는 사람\]/s, '빈 칸은 대괄호로 남긴다');
console.log('sales pipeline ok');

// ── Gmail 보내기·회신 찾기 ──
{
  const M = await import(new URL('../base44/shared/salesMail.ts', import.meta.url).href);
  // 한글 제목·본문 MIME
  const raw = M.mimeMessage({ to: 'kil@munice.example', subject: '수면 조명 개발 제안', body: '안녕하세요\n마시아입니다', replyTo: 'staff@aegis.example' });
  const txt = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  assert.match(txt, /^To: kil@munice\.example\r\nReply-To: staff@aegis\.example\r\nSubject: =\?UTF-8\?B\?/);
  const subj = txt.match(/Subject: =\?UTF-8\?B\?(.+)\?=/)[1];
  assert.equal(Buffer.from(subj, 'base64').toString('utf8'), '수면 조명 개발 제안');
  const bodyB64 = txt.split('\r\n\r\n')[1].replace(/\r\n/g, '');
  assert.equal(Buffer.from(bodyB64, 'base64').toString('utf8'), '안녕하세요\r\n마시아입니다');
  assert.ok(!/[+/=]/.test(raw), 'base64url');
  const inj = Buffer.from(M.mimeMessage({ to: 'a@b.co\r\nBcc: x@y.z', subject: 's\nBcc: q@q.q', body: 'b' }).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  assert.ok(!/\r\nBcc:/.test(inj), '줄바꿈으로 머리글 끼워 넣기 막기');
  assert.equal(M.validEmail('a@b.co\r\nBcc: x@y.z'), false);

  const p0 = { id: 'p1', company: '무니스', contact_name: '길상현', stage: 'TARGET', next_follow_up: '2026-11-16', touches: [] };
  const sent = M.sentPatch(p0, { subject: '제안', by: '이호민', gmailId: 'g1', threadId: 't1', nowIso: '2026-11-16T01:00:00Z' });
  assert.equal(sent.stage, 'SENT');
  assert.equal(sent.next_follow_up, '2026-11-20');
  assert.equal(sent.touches[0].gmail_id, 'g1');
  const p1 = { ...p0, ...sent };
  assert.equal(M.replySince(p0), null, '보낸 적 없으면 찾지 않음');
  assert.equal(M.replySince(p1), '2026-11-16T01:00:00Z');
  const msgs = [
    { id: 'old', threadId: 't0', at: '2026-11-10T00:00:00Z', subject: '예전 메일', snippet: '' },
    { id: 'r1', threadId: 't1', at: '2026-11-17T02:00:00Z', subject: 'Re: 제안', snippet: '관심 있습니다. 통화 가능할까요?' },
  ];
  const r = M.replyPatch(p1, msgs, '2026-11-17T03:00:00Z');
  assert.equal(r.count, 1, '보낸 뒤 온 메일만');
  assert.equal(r.patch.stage, 'REPLIED');
  assert.equal(r.patch.next_follow_up, '2026-11-19', '회신 뒤 2영업일');
  assert.match(r.patch.touches.at(-1).note, /회신 — Re: 제안: 관심 있습니다/);
  assert.equal(r.patch.touches.at(-1).direction, 'in');
  assert.equal(M.replyPatch({ ...p1, ...r.patch }, msgs, '2026-11-17T04:00:00Z'), null, '같은 메일 두 번 기록 안 함');
  assert.equal(M.replyPatch({ ...p1, stage: 'MEETING' }, msgs, '2026-11-17T03:00:00Z').patch.stage, 'MEETING', '이미 미팅 단계면 단계 유지');
  assert.equal(M.replyPatch({ ...p1, stage: 'LOST' }, msgs, '2026-11-17T03:00:00Z'), null, '보류는 건드리지 않음');

  // 함수: 보내기·회신 찾기
  const F = new URL('../base44/functions/salesMail/entry.ts', import.meta.url).href;
  const sentMail = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(url);
    const ok = (j) => ({ ok: true, status: 200, json: async () => j });
    if (u.hostname === 'www.googleapis.com') return ok({ scope: globalThis.__scope, email: 'sales@aegis.example' });
    if (u.pathname.endsWith('/profile')) return ok({ emailAddress: 'sales@aegis.example' });
    if (u.pathname.endsWith('/messages/send')) { if (!/gmail\.send/.test(globalThis.__scope)) return { ok: false, status: 403, json: async () => ({ error: { message: 'Insufficient Permission' } }) }; sentMail.push(JSON.parse(init.body)); return ok({ id: 'g9', threadId: 't9' }); }
    if (u.pathname.endsWith('/messages') && u.searchParams.get('q')) return ok({ messages: u.searchParams.get('q').includes('kil@') ? [{ id: 'r9' }] : [] });
    if (u.pathname.includes('/messages/r9')) return ok({ id: 'r9', threadId: 't9', internalDate: String(Date.parse('2099-01-01T00:00:00Z')), snippet: '좋습니다', payload: { headers: [{ name: 'Subject', value: 'Re: 제안' }] } });
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const STAFF = { id: 's1', full_name: '이호민', email: 'hm@aegis.example', account_tier: 'service', tenant_id: 't1', is_active: true };
  globalThis.__db = { SalesProspect: [{ id: 'sp1', tenant_id: 't1', company: '무니스', contact_name: '길상현', email: 'kil@munice.example', stage: 'TARGET', owner_email: 'hm@aegis.example', touches: [] }, { id: 'sp2', tenant_id: 't9', company: '남의 회사', email: 'x@y.example', stage: 'TARGET', touches: [] }], User: [STAFF], Notification: [] };
  const call = async (body, user = STAFF) => { globalThis.__user = user; const m = await import(F); const res = await m.default(new Request('https://x', { method: 'POST', body: JSON.stringify(body) })); return { status: res.status, data: await res.json() }; };
  globalThis.__scope = 'https://www.googleapis.com/auth/gmail.readonly email';
  let x = await call({ action: 'status' });
  assert.deepEqual([x.data.can_send, x.data.can_read, x.data.email], [false, true, 'sales@aegis.example']);
  x = await call({ action: 'send', prospect_id: 'sp1', subject: '제안', body: '본문' });
  assert.equal(x.data.code, 'no_send_scope', '보내기 권한 없으면 안내');
  globalThis.__scope = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send';
  x = await call({ action: 'send', prospect_id: 'sp2', subject: '제안', body: '본문' });
  assert.equal(x.status, 404, '다른 팀 영업 대상');
  x = await call({ action: 'send', prospect_id: 'sp1', subject: '제안', body: '본문' });
  assert.equal(x.status, 200, JSON.stringify(x.data));
  assert.equal(sentMail.length, 1);
  const sp1 = globalThis.__db.SalesProspect[0];
  assert.equal(sp1.stage, 'SENT');
  assert.equal(sp1.touches[0].gmail_id, 'g9');
  // 예약 실행(로그인 없음)으로 회신 찾기
  x = await call({ action: 'check_replies' }, null);
  assert.equal(x.data.found, 1, JSON.stringify(x.data));
  assert.equal(sp1.stage, 'REPLIED');
  assert.ok(globalThis.__db.Notification.some((n) => n.recipient_id === 's1' && /영업 회신/.test(n.title)), '담당자 알림');
  x = await call({ action: 'check_replies' }, null);
  assert.equal(x.data.found, 0, '두 번 기록 안 함');
  x = await call({ action: 'send', prospect_id: 'sp1', subject: 'x', body: 'y' }, null);
  assert.equal(x.status, 403, '로그인 없이는 보내기 불가');
  console.log('sales gmail ok');
}
