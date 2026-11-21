// 콜드메일 자동화 검산: 법규 장치(근거·광고 표시·수신거부·발송 시간·자동 수집 금지)와 발송 흐름(첫 메일 → 후속 → 회신·수신거부에 멈춤)
import assert from 'node:assert/strict';

const M = await import(new URL('../base44/shared/outreach.ts', import.meta.url).href);
let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log(`✓ ${name}`); };
const at = (s) => new Date(s);

ok('보내는 시간: 평일 9~18시 (한국 시간)만', () => {
  assert.equal(M.inWindow(at('2026-11-23T01:00:00Z')), true, '월 10시');
  assert.equal(M.inWindow(at('2026-11-23T09:30:00Z')), false, '월 18시 30분');
  assert.equal(M.inWindow(at('2026-11-22T02:00:00Z')), false, '일요일');
  assert.equal(M.inWindow(at('2026-11-22T23:30:00Z')), false, '월 8시 30분');
});
ok('영업일 계산은 주말을 뺀다', () => {
  assert.equal(M.businessDaysBetween('2026-11-20T02:00:00Z', at('2026-11-23T02:00:00Z')), 1, '금 → 월');
  assert.equal(M.businessDaysBetween('2026-11-23T02:00:00Z', at('2026-11-26T02:00:00Z')), 3);
});
ok('제목 앞 (광고) — 두 번 붙지 않고, 언어별', () => {
  assert.equal(M.adSubject('제안 드립니다'), '(광고) 제안 드립니다');
  assert.equal(M.adSubject('(광고) 제안 드립니다'), '(광고) 제안 드립니다');
  assert.equal(M.adSubject('Hello', 'en'), '[Ad] Hello');
  assert.equal(M.adSubject('제안', 'ko', false), '제안');
});
ok('본문 아래 보낸 사람 정보와 무료 수신거부 링크', () => {
  const f = M.footer({ sender: { company: '이지스', name: '이호민', phone: '02-123-4567', address: '서울 강남구' } }, 'https://app.example/u/tok');
  assert.match(f, /보낸 사람: 이지스 · 이호민/);
  assert.match(f, /02-123-4567 · 서울 강남구/);
  assert.match(f, /무료 수신거부\): https:\/\/app\.example\/u\/tok/);
});
ok('AI 가 찾은 회사: 개인정보(이메일·전화)는 지우고 중복·이미 있는 회사는 뺀다', () => {
  const r = M.cleanCompanies([
    { company: '무니스', why_fit: 'x' },
    { company: '루멘랩', website: 'lumenlab.example', why_fit: '조명 신제품 출시. 연락: ceo@lumenlab.example, 010-1234-5678', product_idea: '휴대 조명' },
    { company: '루멘 랩', why_fit: '중복' },
    { company: '', why_fit: '이름 없음' },
  ], ['무니스']);
  assert.equal(r.length, 1);
  assert.equal(r[0].website, 'https://lumenlab.example');
  assert.ok(!/@|010-1234/.test(r[0].why_fit), r[0].why_fit);
});
ok('AI 에게 이메일·전화 같은 개인정보를 찾지 말라고 지시한다 (자동 수집 금지)', () => {
  assert.match(M.discoverPrompt({ target: '조명 브랜드', offer: '시제품 개발' }, 5, []), /이메일 주소·전화번호·개인 이름 같은 개인정보는 절대 적지 말 것/);
});

const C = { status: 'ACTIVE', steps: [{ after_days: 3, subject: '', body: '{담당자}님, 지난번 메일 확인하셨을까요?' }] };
const P = { email: 'a@b.example', stage: 'TARGET', outreach: { status: 'APPROVED', consent_basis: 'opt_in', email_source: '명함', draft: { subject: '제안', body: '본문' } } };
const mon10 = at('2026-11-23T01:00:00Z');
ok('보낼 근거가 없으면 보내지 않는다 (사전 동의 원칙)', () => {
  assert.equal(M.canSend({ ...P, outreach: { ...P.outreach, consent_basis: 'none' } }, C, { now: mon10 }).ok, false);
  assert.match(M.canSend({ ...P, outreach: { ...P.outreach, consent_basis: 'none' } }, C, { now: mon10 }).reason, /근거/);
  assert.equal(M.canSend(P, C, { now: mon10 }).ok, true);
});
ok('수신거부 주소·회신한 대상·발송 시간 밖·멈춘 캠페인은 보내지 않는다', () => {
  assert.equal(M.canSend(P, C, { now: mon10, suppressed: new Set(['a@b.example']) }).ok, false);
  assert.equal(M.canSend({ ...P, stage: 'REPLIED' }, C, { now: mon10 }).ok, false);
  assert.equal(M.canSend(P, C, { now: at('2026-11-23T13:00:00Z') }).ok, false);
  assert.equal(M.canSend(P, { ...C, status: 'PAUSED' }, { now: mon10 }).ok, false);
});
ok('승인 점검: 주소 출처·근거·초안이 있어야', () => {
  assert.match(M.approvable({ ...P, outreach: { ...P.outreach, email_source: '' } }), /출처/);
  assert.match(M.approvable({ ...P, outreach: { ...P.outreach, draft: null } }), /초안/);
  assert.equal(M.approvable(P), '');
});
ok('단계: 승인 → 첫 메일(0) → 영업일 3일 뒤 후속(1) → 끝', () => {
  assert.equal(M.dueStep(P, C, mon10), 0);
  const s0 = { ...P, outreach: { ...P.outreach, status: 'SENDING', step: 0, last_sent_at: '2026-11-23T01:00:00Z' } };
  assert.equal(M.dueStep(s0, C, at('2026-11-25T01:00:00Z')), null, '2영업일');
  assert.equal(M.dueStep(s0, C, at('2026-11-26T01:00:00Z')), 1, '3영업일');
  assert.equal(M.dueStep({ ...s0, outreach: { ...s0.outreach, step: 1 } }, C, at('2026-12-10T01:00:00Z')), null, '후속이 1통이면 끝');
});
ok('첨부 메일은 multipart, 한글 파일 이름·수신거부 헤더', () => {
  const raw = M.mimeMail({ to: 'a@b.example', subject: '(광고) 제안', body: '본문', unsubUrl: 'https://x/u/t', attachment: { name: '회사소개서.pdf', type: 'application/pdf', data: btoa('%PDF-1.4') } });
  const txt = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  assert.match(txt, /multipart\/mixed/);
  assert.match(txt, /List-Unsubscribe: <https:\/\/x\/u\/t>/);
  assert.match(txt, /filename="=\?UTF-8\?B\?/);
});
ok('캠페인 시작 조건: 보낸 회사·연락처·주소·제안·소개서', () => {
  assert.deepEqual(M.startProblems(M.cleanCampaign({ brochure: { mode: 'link' } })), ['보낸 회사 이름', '연락처(전화 또는 이메일)', '주소', '제안 내용', '회사소개서 파일 (또는 보내지 않음으로)']);
  assert.deepEqual(M.startProblems(M.cleanCampaign({ offer: 'x', sender: { company: 'a', phone: '1', address: 'b' }, brochure: { mode: 'none' } })), []);
});

// ---------- 서버 함수 흐름 ----------
{
  const F = new URL('../base44/functions/outreach/entry.ts', import.meta.url).href;
  const RealDate = Date;
  let fake = RealDate.parse('2026-11-23T01:00:00Z'); // 월 10시 (한국)
  globalThis.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(fake); } static now() { return fake; } };
  const sent = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(url);
    if (u.pathname.endsWith('/messages/send')) { sent.push(JSON.parse(init.body)); return { ok: true, status: 200, json: async () => ({ id: `g${sent.length}`, threadId: `t${sent.length}` }) }; }
    if (u.hostname === 'files.example') return { ok: true, status: 200, headers: new Headers({ 'content-type': 'application/pdf' }), arrayBuffer: async () => new TextEncoder().encode('%PDF-1.4 brochure').buffer };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const STAFF = { id: 's1', full_name: '이호민', email: 'hm@aegis.example', account_tier: 'service', tenant_id: 't1', is_active: true };
  globalThis.__db = { SalesProspect: [{ id: 'old', tenant_id: 't1', company: '무니스', stage: 'WON' }], OutreachCampaign: [], EmailSuppression: [], User: [STAFF] };
  const call = async (body, user = STAFF) => { globalThis.__user = user; const m = await import(F); const res = await m.default(new Request('https://x', { method: 'POST', body: JSON.stringify(body) })); return { status: res.status, data: await res.json() }; };
  const decode = (raw) => Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  const bodyOf = (txt) => { const parts = txt.split('\r\n\r\n'); return Buffer.from(parts.slice(1).join('\n').split('--aegis')[0].replace(/\s+/g, ''), 'base64').toString('utf8'); };

  let x = await call({ action: 'save_campaign', campaign: { name: '조명 브랜드', status: 'ACTIVE', target: '국내 조명·소형 가전 브랜드', offer: '시제품부터 양산까지' } });
  ok('함수: 보낸 사람 정보가 없으면 캠페인을 시작할 수 없다', () => { assert.equal(x.status, 400); assert.equal(x.data.code, 'incomplete'); });
  x = await call({ action: 'save_campaign', campaign: { name: '조명 브랜드', status: 'ACTIVE', target: '국내 조명·소형 가전 브랜드', offer: '시제품부터 양산까지', sender: { company: '이지스', name: '이호민', phone: '02-123-4567', address: '서울 강남구', email: 'hm@aegis.example' }, brochure: { mode: 'link', file_uri: 'private://brochure.pdf', file_name: '이지스_회사소개서.pdf' }, steps: [{ after_days: 3, body: '{담당자}님, 지난 메일 확인하셨을까요?' }], daily_limit: 2 } });
  const camp = x.data.campaign;
  ok('함수: 캠페인 저장', () => assert.equal(camp.status, 'ACTIVE'));

  globalThis.__llm = (a) => {
    if (a.add_context_from_internet) {
      assert.match(a.prompt, /무니스/, '이미 있는 회사는 다시 찾지 않게 알려 준다');
      return { companies: [{ company: '루멘랩', website: 'lumenlab.example', why_fit: '휴대 조명 신제품을 냈다. 문의 sales@lumenlab.example', product_idea: '충전식 랜턴' }, { company: '무니스', why_fit: '중복' }, { company: '빛담', why_fit: '무드등 브랜드' }] };
    }
    return { subject: '(광고) 루멘랩 랜턴 양산 제안', body: '안녕하세요, 루멘랩 담당자님.\n휴대 조명 신제품 소식을 보고 연락드립니다.' };
  };
  x = await call({ action: 'discover', campaign_id: camp.id, count: 5 });
  const [lumen, bitdam] = x.data.prospects;
  ok('함수: AI 가 찾은 회사는 후보로 — 이메일은 비어 있고 근거는 ‘없음’, 개인정보는 지운다', () => {
    assert.equal(x.data.found, 2);
    assert.equal(lumen.email, undefined);
    assert.equal(lumen.outreach.status, 'CANDIDATE');
    assert.equal(lumen.outreach.consent_basis, 'none');
    assert.ok(!/@/.test(lumen.outreach.fit_reason));
  });
  x = await call({ action: 'approve', prospect_ids: [lumen.id] });
  ok('함수: 주소·근거·초안 없이 승인 불가', () => { assert.equal(x.data.approved, 0); assert.match(x.data.problems[0].reason, /이메일/); });
  x = await call({ action: 'update_contact', prospect_id: lumen.id, email: 'kim@lumenlab.example', contact_name: '김루멘', email_source: '2026 조명박람회 명함', consent_basis: 'opt_in' });
  ok('함수: 주소·출처·근거를 넣으면 준비됨', () => assert.equal(x.data.prospect.outreach.status, 'READY'));
  x = await call({ action: 'draft', prospect_id: lumen.id });
  ok('함수: AI 초안 — 제목의 (광고) 는 떼어 두고 보낼 때 붙인다', () => { assert.equal(x.data.prospect.outreach.status, 'DRAFTED'); assert.equal(x.data.prospect.outreach.draft.subject, '루멘랩 랜턴 양산 제안'); });
  x = await call({ action: 'approve', prospect_ids: [lumen.id] });
  ok('함수: 승인', () => assert.equal(x.data.approved, 1));

  fake = RealDate.parse('2026-11-23T12:00:00Z'); // 월 21시
  x = await call({ action: 'run' }, null);
  ok('함수: 밤에는 보내지 않는다', () => { assert.equal(sent.length, 0); assert.match(x.data.note, /보내는 시간/); });
  fake = RealDate.parse('2026-11-23T01:00:00Z');
  x = await call({ action: 'run' }, null);
  const first = decode(sent[0].raw);
  ok('함수: 예약 실행으로 첫 메일 — (광고) 제목·소개서 링크·보낸 사람·수신거부', () => {
    assert.equal(x.data.sent, 1, JSON.stringify(x.data));
    assert.match(first, /Subject: =\?UTF-8\?B\?/);
    const subj = Buffer.from(/Subject: =\?UTF-8\?B\?(.+?)\?=/.exec(first)[1], 'base64').toString('utf8');
    assert.equal(subj, '(광고) 루멘랩 랜턴 양산 제안');
    const text = bodyOf(first);
    assert.match(text, /회사소개서: https:\/\/app\.example\/b\/[0-9a-f]+/);
    assert.match(text, /보낸 사람: 이지스 · 이호민/);
    assert.match(text, /무료 수신거부\): https:\/\/app\.example\/u\/[0-9a-f]+/);
    const p = globalThis.__db.SalesProspect.find((r) => r.id === lumen.id);
    assert.equal(p.outreach.status, 'SENDING');
    assert.equal(p.stage, 'SENT');
    assert.ok(p.touches.at(-1).outreach);
  });
  x = await call({ action: 'run' }, null);
  ok('함수: 같은 날 다시 돌려도 두 번 보내지 않는다', () => assert.equal(sent.length, 1));
  fake = RealDate.parse('2026-11-26T01:00:00Z'); // 3영업일 뒤
  x = await call({ action: 'run' }, null);
  ok('함수: 3영업일 뒤 후속 메일 ({담당자} 채움), 마지막이면 끝', () => {
    assert.equal(sent.length, 2);
    assert.match(bodyOf(decode(sent[1].raw)), /김루멘님, 지난 메일 확인하셨을까요\?/);
    assert.equal(globalThis.__db.SalesProspect.find((r) => r.id === lumen.id).outreach.status, 'DONE');
  });

  const tok = globalThis.__db.SalesProspect.find((r) => r.id === lumen.id).outreach_token;
  x = await call({ action: 'brochure', token: tok }, null);
  ok('공개: 회사소개서 링크 — 비공개 파일을 잠깐 열 수 있는 주소, 처음 연 시각 기록', () => {
    assert.match(x.data.url, /^https:\/\/files\.example\//);
    assert.ok(globalThis.__db.SalesProspect.find((r) => r.id === lumen.id).outreach.brochure_opened_at);
  });
  x = await call({ action: 'unsubscribe', token: tok }, null);
  ok('공개: 수신거부 → 명단에 넣고 영업 대상 멈춤', () => {
    assert.equal(x.data.ok, true);
    assert.ok(globalThis.__db.EmailSuppression.some((s) => s.email === 'kim@lumenlab.example' && s.reason === 'unsubscribe'));
    assert.equal(globalThis.__db.SalesProspect.find((r) => r.id === lumen.id).outreach.status, 'UNSUBSCRIBED');
  });
  x = await call({ action: 'unsubscribe', token: 'nope' }, null);
  ok('공개: 엉터리 토큰은 찾을 수 없음', () => assert.equal(x.status, 404));

  // 수신거부한 주소는 다른 영업 대상으로 넣어도 승인되지 않는다
  await call({ action: 'update_contact', prospect_id: bitdam.id, email: 'KIM@lumenlab.example', email_source: '문의 메일', consent_basis: 'inquiry' });
  await call({ action: 'draft', prospect_id: bitdam.id });
  x = await call({ action: 'approve', prospect_ids: [bitdam.id] });
  ok('함수: 수신거부한 주소는 대소문자가 달라도 승인 불가', () => { assert.equal(x.data.approved, 0); assert.match(x.data.problems[0].reason, /수신거부/); });

  x = await call({ action: 'run' }, { ...STAFF, account_tier: 'client' });
  ok('권한: 고객 계정은 발송 불가', () => assert.equal(x.status, 403));
  x = await call({ action: 'discover', campaign_id: camp.id }, { ...STAFF, tenant_id: 't9' });
  ok('권한: 다른 팀 캠페인은 볼 수 없다', () => assert.equal(x.status, 404));
  globalThis.Date = RealDate;
}

console.log(`\n${n}개 검산 통과`);
