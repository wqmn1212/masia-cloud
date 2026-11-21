// 자료 신청 페이지 검산: 동의 두 가지(필수·선택)와 기록, 자료 메일과 처리 결과 통지, 캠페인 연결, 수신거부·재동의, 2년 확인 안내, 리드 광고 가져오기
import assert from 'node:assert/strict';

const L = await import(new URL('../base44/shared/leadMagnet.ts', import.meta.url).href);
const I = await import(new URL('../src/lib/leadImport.js', import.meta.url).href);
let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log(`✓ ${name}`); };

const M = L.cleanMagnet({ slug: ' Checklist 2026! ', title: '시제품→양산 체크리스트', kind: 'file', operator: { company: '이지스', email: 'hello@aegis.example', address: '서울 강남구' }, file: { file_uri: 'private://check.pdf', file_name: '체크리스트.pdf' }, ask: { company: true, phone: true } });
ok('공개 주소 정리: 소문자·숫자·- 만', () => { assert.equal(M.slug, 'checklist-2026'); assert.ok(L.SLUG.test(M.slug)); });
ok('공개 조건: 처리자·연락처·자료 파일', () => {
  assert.deepEqual(L.liveProblems(L.cleanMagnet({ slug: 'x1', title: 't' })), ['개인정보 처리자 (회사 이름)', '문의 연락처 (이메일 또는 전화)', '보낼 자료 파일']);
  assert.deepEqual(L.liveProblems(M), []);
  assert.deepEqual(L.liveProblems(L.cleanMagnet({ slug: 'rep', title: 't', kind: 'report', operator: { company: 'a', phone: '1' } })), [], '리포트는 파일이 없어도 된다');
});
ok('동의 문구: 항목·목적·보유 기간·거부 권리, 선택 동의는 따로', () => {
  const t = L.consentTexts(M);
  assert.match(t.privacy, /^\[필수\]/);
  assert.match(t.privacy, /이름, 이메일, 회사명, 전화번호/);
  assert.match(t.privacy, /2년 동안 보관/);
  assert.match(t.privacy, /거부할 수 있으나, 거부하면 자료를 받을 수 없습니다/);
  assert.match(t.marketing, /^\[선택\]/);
  assert.match(t.marketing, /동의하지 않아도 자료는 받을 수 있고/);
});
ok('공개 값에는 파일 주소·알림 메일 같은 내부 값이 없다', () => {
  const p = L.publicMagnet({ ...M, notify_email: 'staff@aegis.example', campaign_id: 'c1' });
  assert.equal(JSON.stringify(p).includes('private://'), false);
  assert.equal(JSON.stringify(p).includes('staff@'), false);
});
ok('신청 입력: 필수 동의 없으면 거절, 광고 동의는 true 일 때만', () => {
  assert.equal(L.cleanSignup({ name: '김', email: 'a@b.example' }, M).code, 'privacy');
  assert.equal(L.cleanSignup({ name: '김', email: 'a@b', privacy: true }, M).code, 'email');
  assert.equal(L.cleanSignup({ name: '김', email: 'a@b.example', privacy: true, website: 'spam' }, M).code, 'bot');
  assert.equal(L.cleanSignup({ name: '김', email: 'A@B.example', privacy: true, marketing: 'yes' }, M).value.marketing, false);
  assert.equal(L.cleanSignup({ name: '김', email: 'A@B.example', privacy: true, marketing: true }, M).value.email, 'a@b.example');
  assert.equal(L.cleanSignup({ name: '김', email: 'a@b.example', privacy: true, idea: '' }, { ...M, kind: 'report' }).code, 'idea');
});
ok('광고 동의 없는 신청자: 보낼 근거 없음, 캠페인에 넣지 않음', () => {
  const { patch, join } = L.signupPatch(null, { name: '김', email: 'a@b.example', marketing: false }, { ...M, id: 'm1', tenant_id: 't1', campaign_id: 'c1' }, { nowIso: '2026-11-23T01:00:00Z', source: 'landing:x', materialToken: 'tok' });
  assert.equal(join, false);
  assert.equal(patch.outreach.consent_basis, 'none');
  assert.equal(patch.campaign_id, undefined);
  assert.equal(patch.company, '김 (개인)');
  assert.equal(patch.source, 'lead_magnet');
});
ok('광고 동의한 신청자: 수신 동의 근거·출처·시각 기록, 연결 캠페인으로', () => {
  const { patch, join } = L.signupPatch(null, { name: '김', email: 'a@b.example', company: '루멘', marketing: true }, { ...M, id: 'm1', tenant_id: 't1', campaign_id: 'c1' }, { nowIso: '2026-11-23T01:00:00Z', source: 'landing:x', materialToken: 'tok' });
  assert.equal(join, true);
  assert.equal(patch.outreach.consent_basis, 'opt_in');
  assert.equal(patch.outreach.consent.marketing_at, '2026-11-23T01:00:00Z');
  assert.match(patch.outreach.email_source, /2026년 11월 23일 광고 수신 동의/);
  assert.equal(patch.campaign_id, 'c1');
});
ok('이미 보내는 중인 대상은 다시 신청해도 처음부터 다시 보내지 않는다', () => {
  const ex = { id: 'p1', stage: 'SENT', outreach: { status: 'SENDING', step: 1, consent_basis: 'customer' }, outreach_token: 'u' };
  const { patch, join } = L.signupPatch(ex, { name: '김', email: 'a@b.example', marketing: true }, { ...M, id: 'm1', campaign_id: 'c1' }, { nowIso: '2026-11-23T01:00:00Z', source: 'landing:x', materialToken: 't' });
  assert.equal(join, false);
  assert.equal(patch.outreach.status, 'SENDING');
  assert.equal(patch.outreach.step, 1);
});
ok('자료 메일: 받기 링크 + 수신 동의 처리 결과 통지 + 수신 거부 링크', () => {
  const m = L.deliveryMail(M, { contact_name: '김루멘' }, { materialUrl: 'https://x/d/tok', unsubUrl: 'https://x/u/u1', marketing: true, nowIso: '2026-11-23T01:00:00Z' });
  assert.match(m.subject, /\[이지스\] 요청하신 ‘시제품→양산 체크리스트’ 자료입니다/);
  assert.doesNotMatch(m.subject, /광고/);
  assert.match(m.text, /자료 받기: https:\/\/x\/d\/tok/);
  assert.match(m.text, /수신 동의 처리 결과: 이지스는 2026년 11월 23일에/);
  assert.match(m.text, /수신 거부: https:\/\/x\/u\/u1/);
  assert.match(m.html, /href="https:\/\/x\/d\/tok"/);
  const n2 = L.deliveryMail(M, {}, { materialUrl: 'https://x/d/tok', unsubUrl: 'https://x/u/u1', marketing: false, nowIso: '2026-11-23T01:00:00Z' });
  assert.match(n2.text, /광고 메일은 보내지 않습니다/);
  assert.doesNotMatch(n2.text, /수신 거부:/);
});
ok('2년 확인 안내: 동의 후 23개월이 지나면, 안내한 뒤에는 다시 23개월 뒤', () => {
  const p = { email: 'a@b.example', outreach: { consent: { marketing: true, marketing_at: '2024-12-01T00:00:00Z' } } };
  assert.equal(L.reconfirmDue(p, new Date('2026-10-31T00:00:00Z')), false);
  assert.equal(L.reconfirmDue(p, new Date('2026-11-02T00:00:00Z')), true);
  assert.equal(L.reconfirmDue({ ...p, outreach: { consent: { ...p.outreach.consent, reconfirm_sent_at: '2026-11-02T00:00:00Z' } } }, new Date('2026-12-01T00:00:00Z')), false);
  assert.equal(L.reconfirmDue({ ...p, outreach: { consent: { ...p.outreach.consent, withdrawn_at: '2025-01-01' } } }, new Date('2027-01-01')), false);
});
ok('AI 리포트 정리: 형식이 맞지 않으면 버린다', () => {
  assert.equal(L.cleanReport({ product: '' }), null);
  const r = L.cleanReport({ product: '충전식 랜턴', parts: [{ name: '배터리', note: '18650' }], steps: [{ step: '컨셉', weeks: '1~2주' }], risks: ['방수'], next: ['밝기'] });
  assert.match(L.reportText(r), /■ 주요 부품\n- 배터리 — 18650/);
  assert.match(L.reportPrompt({ idea: '랜턴' }), /비용 금액은 쓰지 말 것/);
});
ok('리드 광고(Graph): 이름·이메일·회사, 광고 동의 체크박스', () => {
  const lead = { id: '9001', created_time: '2026-11-20T03:00:00+0000', field_data: [{ name: 'email', values: ['Kim@Lumen.example'] }, { name: 'full_name', values: ['김루멘'] }, { name: 'company_name', values: ['루멘'] }, { name: '만들고_싶은_제품', values: ['랜턴'] }], custom_disclaimer_responses: [{ checkbox_key: 'privacy', is_checked: '1' }, { checkbox_key: 'marketing_optin', is_checked: '1' }] };
  const r = L.cleanImportRow(L.metaLeadToRow(lead, {}));
  assert.equal(r.email, 'kim@lumen.example');
  assert.equal(r.marketing, true);
  assert.equal(r.company, '루멘');
  assert.match(r.idea, /만들고_싶은_제품: 랜턴/);
  assert.equal(r.at, '2026-11-20T03:00:00.000Z');
  assert.equal(L.metaLeadToRow({ ...lead, custom_disclaimer_responses: [{ checkbox_key: 'marketing_optin', is_checked: '0' }] }, {}).marketing, false);
  assert.equal(L.metaLeadToRow(lead, { meta: { marketing_key: 'other' } }).marketing, false, '지정한 체크박스만 본다');
});
ok('CSV: Meta 의 UTF-16 탭 파일과 엑셀 UTF-8 쉼표 파일 모두 읽는다', () => {
  const tsv = 'id\tcreated_time\tform_name\temail\tfull_name\tcompany_name\tphone_number\t광고성 정보 수신 동의\t만들고 싶은 제품\nl:123\t2026-11-20T03:00:00+0000\t체크리스트\tkim@lumen.example\t김루멘\t루멘\tp:+821012345678\ttrue\t랜턴\n';
  const u16 = new Uint8Array(2 + tsv.length * 2); u16[0] = 0xff; u16[1] = 0xfe;
  for (let i = 0; i < tsv.length; i += 1) { u16[2 + i * 2] = tsv.charCodeAt(i) & 0xff; u16[3 + i * 2] = tsv.charCodeAt(i) >> 8; }
  const t = I.parseTable(I.decodeLeadFile(u16.buffer));
  const map = I.guessColumns(t.headers);
  const rows = I.rowsFromTable(t, map);
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].external_id, rows[0].email, rows[0].name, rows[0].phone, rows[0].marketing], ['123', 'kim@lumen.example', '김루멘', '+821012345678', true]);
  assert.match(rows[0].idea, /만들고 싶은 제품: 랜턴/);
  assert.doesNotMatch(rows[0].idea, /form_name/);
  const csv = I.parseTable('이메일,이름,"회사, 부서",마케팅 수신\n"a@b.example",박,"에이, 1팀",아니오\nnoemail,최,,예\n');
  const r2 = I.rowsFromTable(csv, I.guessColumns(csv.headers));
  assert.equal(r2.length, 1, '이메일 없는 줄은 뺀다');
  assert.equal(r2[0].marketing, false);
});

// ---------- 서버 함수 흐름 ----------
{
  const F = new URL('../base44/functions/leadMagnet/entry.ts', import.meta.url).href;
  const O = new URL('../base44/functions/outreach/entry.ts', import.meta.url).href;
  const RealDate = Date;
  let fake = RealDate.parse('2026-11-23T01:00:00Z');
  globalThis.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(fake); } static now() { return fake; } };
  const sent = [];
  let graph = null;
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(url);
    if (u.pathname.endsWith('/messages/send')) { sent.push(JSON.parse(init.body)); return { ok: true, status: 200, json: async () => ({ id: `g${sent.length}`, threadId: `t${sent.length}` }) }; }
    if (u.hostname === 'graph.facebook.com') return { ok: true, status: 200, json: async () => graph(u) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const STAFF = { id: 's1', full_name: '이호민', email: 'hm@aegis.example', account_tier: 'service', tenant_id: 't1', is_active: true };
  globalThis.__db = { SalesProspect: [{ id: 'cust', tenant_id: 't1', company: '무니스', email: 'ceo@munis.example', stage: 'WON', outreach_token: 'aa'.repeat(18) }], OutreachCampaign: [{ id: 'c1', tenant_id: 't1', name: '자료 신청자 후속', status: 'ACTIVE', sender: { company: '이지스' }, steps: [{ after_days: 3, body: '{담당자}님, 자료는 도움이 되셨나요?' }] }], EmailSuppression: [], ConsentLog: [], LeadMagnet: [] };
  const call = async (fn, body, user = STAFF, headers = {}) => { globalThis.__user = user; const m = await import(fn); const res = await m.default(new Request('https://x', { method: 'POST', body: JSON.stringify(body), headers })); return { status: res.status, data: await res.json() }; };
  const decode = (raw) => Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  const partOf = (txt, type) => { const i = txt.indexOf(`Content-Type: ${type}`); const s = txt.slice(i).split('\r\n\r\n')[1]; return Buffer.from(s.split('--aegis')[0].replace(/\s+/g, ''), 'base64').toString('utf8'); };
  const db = () => globalThis.__db;

  let x = await call(F, { action: 'save', magnet: { slug: 'checklist', title: '시제품→양산 체크리스트', status: 'LIVE' } });
  ok('함수: 처리자·자료 없이 공개 불가', () => { assert.equal(x.status, 400); assert.equal(x.data.code, 'incomplete'); });
  x = await call(F, { action: 'save', magnet: { ...M, slug: 'checklist', status: 'LIVE', campaign_id: 'c1', notify_email: 'hm@aegis.example' } });
  const mg = x.data.magnet;
  ok('함수: 공개', () => assert.equal(mg.status, 'LIVE'));
  x = await call(F, { action: 'save', magnet: { ...M, slug: 'checklist' } }, { ...STAFF, tenant_id: 't2' });
  ok('함수: 다른 팀이 같은 공개 주소를 쓰지 못한다', () => assert.equal(x.data.code, 'slug_taken'));

  x = await call(F, { action: 'page', slug: 'checklist' }, null);
  ok('공개: 페이지 — 동의 문구 포함, 조회 수', () => { assert.match(x.data.magnet.consent.privacy, /\[필수\]/); assert.equal(db().LeadMagnet[0].stats.views, 1); });
  x = await call(F, { action: 'submit', slug: 'checklist', name: '김루멘', email: 'kim@lumen.example', company: '루멘' }, null);
  ok('공개: 필수 동의 없으면 신청 불가', () => { assert.equal(x.status, 400); assert.equal(x.data.code, 'privacy'); });

  x = await call(F, { action: 'submit', slug: 'checklist', name: '김루멘', email: 'Kim@Lumen.example', company: '루멘', privacy: true, marketing: true }, null, { 'x-forwarded-for': '203.0.113.9', 'user-agent': 'UA' });
  const kim = db().SalesProspect.find((p) => p.email === 'kim@lumen.example');
  ok('공개: 광고 동의 신청 → 동의 기록 2줄(문구·시각·IP 해시) + 영업 대상 + 받기 링크', () => {
    assert.equal(x.data.ok, true);
    assert.match(x.data.material_token, /^[0-9a-f]{36}$/);
    const logs = db().ConsentLog.filter((r) => r.email === 'kim@lumen.example');
    assert.deepEqual(logs.map((r) => [r.kind, r.granted]).slice(0, 2), [['privacy', true], ['marketing', true]]);
    assert.match(logs[0].text, /\[필수\]/);
    assert.equal(logs[0].ip_hash.length, 32);
    assert.ok(!JSON.stringify(logs).includes('203.0.113.9'), 'IP 원래 값은 남기지 않는다');
    assert.equal(kim.source, 'lead_magnet');
    assert.equal(kim.outreach.consent_basis, 'opt_in');
  });
  ok('공개: 자료 메일 바로 발송 (처리 결과 통지 포함) → 캠페인 첫 메일로 쳐서 후속 메일 대기', () => {
    assert.equal(sent.length, 1);
    const raw = decode(sent[0].raw);
    assert.match(raw, /multipart\/alternative/);
    assert.match(partOf(raw, 'text/plain'), /자료 받기: https:\/\/app\.example\/d\/[0-9a-f]+/);
    assert.match(partOf(raw, 'text/plain'), /수신 동의 처리 결과/);
    assert.equal(kim.campaign_id, 'c1');
    assert.equal(kim.outreach.status, 'SENDING');
    assert.equal(kim.outreach.step, 0);
    assert.equal(kim.stage, 'SENT');
    assert.ok(db().ConsentLog.some((r) => r.kind === 'result_notice' && r.email === 'kim@lumen.example'));
    assert.equal(db().LeadMagnet[0].stats.opt_ins, 1);
  });
  x = await call(F, { action: 'submit', slug: 'checklist', name: '김루멘', email: 'kim@lumen.example', privacy: true, marketing: true }, null);
  ok('공개: 10분 안에 같은 주소로 다시 신청하면 메일을 또 보내지 않는다', () => { assert.equal(x.data.again, true); assert.equal(sent.length, 1); });

  x = await call(F, { action: 'material', token: kim.material_token }, null);
  ok('공개: 자료 받기 — 비공개 파일 임시 주소, 처음 연 시각', () => { assert.match(x.data.url, /^https:\/\/files\.example\/private:\/\/check\.pdf/); assert.ok(kim.outreach.material_opened_at); assert.equal(db().LeadMagnet[0].stats.opened, 1); });

  fake = RealDate.parse('2026-11-26T01:00:00Z'); // 3영업일 뒤
  x = await call(O, { action: 'run' }, null);
  ok('콜드메일 자동 발송이 후속 메일을 이어서 보낸다 ((광고) 제목)', () => {
    assert.equal(x.data.sent, 1, JSON.stringify(x.data));
    assert.match(decode(sent[1].raw), /Subject: =\?UTF-8\?B\?/);
    assert.equal(Buffer.from(/Subject: =\?UTF-8\?B\?(.+?)\?=/.exec(decode(sent[1].raw))[1], 'base64').toString('utf8').startsWith('(광고) '), true);
    assert.equal(kim.outreach.status, 'DONE');
  });

  x = await call(F, { action: 'submit', slug: 'checklist', name: '박', email: 'park@b.example', privacy: true }, null);
  const park = db().SalesProspect.find((p) => p.email === 'park@b.example');
  ok('공개: 광고 동의 안 한 신청자 → 자료만 보내고 캠페인·근거 없음', () => {
    assert.equal(sent.length, 3);
    assert.match(partOf(decode(sent[2].raw), 'text/plain'), /광고 메일은 보내지 않습니다/);
    assert.equal(park.campaign_id, undefined);
    assert.equal(park.outreach.consent_basis, 'none');
  });
  x = await call(F, { action: 'submit', slug: 'checklist', name: '사칭', email: 'ceo@munis.example', privacy: true, marketing: true }, null);
  ok('공개: 이미 있는 주소로 신청하면 받기 링크를 화면에 주지 않는다 (메일로만)', () => { assert.equal(x.data.material_token, ''); });

  // 수신거부 → 처리 결과 통지 → 다시 신청하면 풀림
  x = await call(O, { action: 'unsubscribe', token: kim.outreach_token }, null);
  ok('수신거부: 명단·철회 기록·처리 결과 통지 메일', () => {
    assert.ok(db().EmailSuppression.some((s) => s.email === 'kim@lumen.example' && !s.lifted_at));
    assert.ok(db().ConsentLog.some((r) => r.kind === 'withdraw' && r.email === 'kim@lumen.example'));
    assert.match(Buffer.from(/Subject: =\?UTF-8\?B\?(.+?)\?=/.exec(decode(sent.at(-1).raw))[1], 'base64').toString('utf8'), /수신 거부 처리 결과/);
    assert.equal(kim.outreach.consent.marketing, false);
  });
  fake = RealDate.parse('2026-12-01T01:00:00Z');
  x = await call(F, { action: 'submit', slug: 'checklist', name: '김루멘', email: 'kim@lumen.example', privacy: true, marketing: true }, null);
  ok('재동의: 본인이 다시 광고 수신에 동의하면 수신거부가 풀린다 (기록은 남김)', () => {
    const s = db().EmailSuppression.find((r) => r.email === 'kim@lumen.example');
    assert.ok(s.lifted_at);
    assert.equal(kim.outreach.consent.marketing, true);
    assert.equal(kim.outreach.status, 'SENDING');
  });

  // 2년 확인 안내
  fake = RealDate.parse('2028-11-15T01:00:00Z');
  const before = sent.length;
  x = await call(F, { action: 'reconfirm' }, null);
  ok('예약: 2년 수신동의 확인 안내 (한 번만)', () => {
    assert.equal(x.data.sent, 1, JSON.stringify(x.data));
    assert.match(partOf(decode(sent[before].raw), 'text/plain'), /2년마다 동의 여부를 알려 드립니다/);
    assert.ok(kim.outreach.consent.reconfirm_sent_at);
  });
  x = await call(F, { action: 'reconfirm' }, null);
  ok('예약: 같은 안내를 다시 보내지 않는다', () => assert.equal(x.data.sent, 0));
  fake = RealDate.parse('2026-11-23T01:00:00Z');

  // 리드 광고 가져오기
  x = await call(F, { action: 'import_leads', magnet_id: mg.id, label: '11월 리드', rows: [{ email: 'Lee@c.example', name: '이', marketing: true, external_id: '77', created_time: '2026-11-20T03:00:00+0000' }, { email: 'bad' }] });
  const lee = db().SalesProspect.find((p) => p.email === 'lee@c.example');
  ok('CSV 가져오기: 동의 시각은 리드 신청 시각, 메일은 고르지 않으면 안 보냄 → 승인 대기', () => {
    assert.equal(x.data.added, 1); assert.equal(x.data.skipped, 1);
    assert.equal(lee.outreach.consent.marketing_at, '2026-11-20T03:00:00.000Z');
    assert.equal(lee.outreach.status, 'READY');
  });
  x = await call(F, { action: 'import_leads', magnet_id: mg.id, label: '11월 리드', rows: [{ email: 'lee@c.example', external_id: '77' }] });
  ok('CSV 가져오기: 같은 리드는 두 번 넣지 않는다', () => { assert.equal(x.data.added, 0); assert.equal(x.data.skipped, 1); });

  await call(F, { action: 'save', magnet: { ...mg, meta: { form_ids: '1234567890', send_material: true } } });
  graph = (u) => ({ data: [{ id: '55', created_time: '2026-11-22T05:00:00+0000', field_data: [{ name: 'email', values: ['choi@d.example'] }, { name: 'full_name', values: ['최'] }], custom_disclaimer_responses: [{ checkbox_key: 'marketing', is_checked: '1' }] }], paging: {} , _u: String(u) });
  const s0 = sent.length;
  x = await call(F, { action: 'meta_pull_all' }, null);
  ok('리드 광고(Graph): 매시 가져오기 → 동의 기록·자료 메일', () => {
    assert.equal(x.data.added, 1, JSON.stringify(x.data));
    const choi = db().SalesProspect.find((p) => p.email === 'choi@d.example');
    assert.equal(choi.source, 'meta_lead');
    assert.equal(choi.outreach.consent_basis, 'opt_in');
    assert.equal(sent.length, s0 + 1);
    assert.ok(db().LeadMagnet[0].meta.last_pull_at);
  });
  x = await call(F, { action: 'meta_pull_all' }, null);
  ok('리드 광고(Graph): 같은 리드는 다시 넣지 않는다', () => assert.equal(x.data.added, 0));

  x = await call(F, { action: 'import_leads', magnet_id: mg.id, rows: [] }, { ...STAFF, account_tier: 'client' });
  ok('권한: 고객 계정은 가져오기 불가', () => assert.equal(x.status, 403));
  x = await call(F, { action: 'import_leads', magnet_id: mg.id, rows: [] }, { ...STAFF, tenant_id: 't9' });
  ok('권한: 다른 팀 페이지는 찾을 수 없다', () => assert.equal(x.status, 404));
  globalThis.Date = RealDate;
}

console.log(`\n${n}개 검산 통과`);
