// 메인페이지 스케치 시안 체험 검산: 입력 정리·파일 종류·한도, 서버(시안 생성·다시 받기·견적 문의·남용 차단)
// 실행: npm run check:sketch-trial
import assert from 'node:assert/strict';
import * as T from '../base44/shared/sketchTrial.ts';

const token = '11111111-2222-4333-8444-555555555555';
const base = { token, contact_name: '김이지', phone: '010-1234-5678', email: 'Kim@Example.com', idea: '책상용 미니 가습기', lang: 'ko' };

// 입력 정리
assert.equal(T.cleanTrialInput({ ...base, website: 'http://spam' }).code, 'bot');
assert.equal(T.cleanTrialInput({ ...base, token: 'abc' }).code, 'token');
assert.equal(T.cleanTrialInput({ ...base, phone: '' }).code, 'contact');
assert.equal(T.cleanTrialInput({ ...base, email: 'kim@' }).code, 'email');
assert.equal(T.cleanTrialInput({ ...base, phone: '12-34' }).code, 'phone');
assert.equal(T.cleanTrialInput({ ...base, idea: ' ' }).code, 'idea');
assert.equal(T.cleanTrialInput(base).value.email, 'kim@example.com');
assert.equal(T.cleanTrialInput({ ...base, lang: 'fr' }).value.lang, 'ko');

// 파일 종류는 바이트 머리말로
const png = (w, h) => { const b = new Uint8Array(64); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, (w >> 24) & 255, (w >> 16) & 255, (w >> 8) & 255, w & 255, (h >> 24) & 255, (h >> 16) & 255, (h >> 8) & 255, h & 255]); return b; };
const b64 = (bytes) => Buffer.from(bytes).toString('base64');
assert.equal(T.sketchKind(png(800, 600)).ext, 'png');
assert.equal(T.sketchKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0])).ext, 'jpg');
assert.equal(T.sketchKind(new TextEncoder().encode('%PDF-1.7 not an image')), null);

// 한도: 같은 이메일 하루 2번, 전체 하루 40번, 하루 지난 것은 세지 않는다
const now = Date.parse('2026-11-12T12:00:00Z');
const at = (h, email = 'a@x.com') => ({ email, created_date: new Date(now - h * 3600e3).toISOString() });
assert.equal(T.trialLimit([at(1)], 'a@x.com', now), null);
assert.equal(T.trialLimit([at(1), at(5)], 'a@x.com', now), 'limit_email');
assert.equal(T.trialLimit([at(1), at(30)], 'a@x.com', now), null);
assert.equal(T.trialLimit(Array.from({ length: 40 }, (_, i) => at(1, `u${i}@x.com`)), 'new@x.com', now), 'limit_daily');

// 화면에 돌려주는 값에는 형태 설명·시안 지시가 없다
const pub = T.publicTrial({ sketch_token: token, email: 'a@x.com', sketch_trial: { status: 'READY', shape: 'secret', variants: [{ label: '화이트', style: 'secret', url: 'u' }] } });
assert.deepEqual(pub.variants, [{ label: '화이트', url: 'u' }]);
assert.ok(!JSON.stringify(pub).includes('secret') && !JSON.stringify(pub).includes('a@x.com'));
console.log('sketch-trial modules ok');

// ── 서버 함수
const { default: handler } = await import('../base44/functions/sketchTrial/entry.ts');
const call = async (body) => { const r = await handler({ json: async () => body }); return { status: r.status, body: await r.json() }; };
const reset = () => { globalThis.__db = { Tenant: [{ id: 't1', is_hq: true, master_email: 'boss@aegis.kr', created_date: '2026-01-01' }], ManufacturingLead: [], TaskCard: [], CardAttachment: [], OperationSetting: [], User: [], Notification: [] }; globalThis.__emails = []; };
let imgCalls = 0;
globalThis.__llm = async () => ({ shape: 'A rounded square humidifier body with a top outlet.', parts: ['body'], variants: [{ label: '화이트 무광', style: 'matte white' }, { label: '차콜', style: 'charcoal' }, { label: '우드 포인트', style: 'wood base' }], notes: ['뒷면은 约 추정'] });
globalThis.__img = async (a) => { imgCalls++; assert.ok(a.existing_image_urls?.length === 1, '스케치를 참고 이미지로 넘긴다'); return { url: `https://img.example/v${imgCalls}.png` }; };
globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => png(1024, 1024).buffer });
const image = { name: 'doodle.png', type: 'image/png', data: b64(png(900, 700)) };

reset();
// 잘못된 요청은 이미지 생성 전에 막는다
assert.equal((await call({ ...base, image, website: 'x' })).status, 400);
assert.equal((await call({ ...base })).body.code, 'image');
assert.equal((await call({ ...base, image: { data: b64(new TextEncoder().encode('%PDF-1.7 ' + 'x'.repeat(60))) } })).body.code, 'image_type');
assert.equal((await call({ ...base, image: { data: b64(png(120, 90)) } })).body.code, 'image_small');
assert.equal(imgCalls, 0);
assert.equal(globalThis.__db.ManufacturingLead.length, 0);

// 시안 생성
let r = await call({ ...base, image, utm_source: 'instagram' });
assert.equal(r.status, 200);
assert.equal(r.body.trial.status, 'READY');
assert.equal(r.body.trial.variants.length, 3);
assert.equal(imgCalls, 3);
let lead = globalThis.__db.ManufacturingLead[0];
assert.deepEqual([lead.source, lead.status, lead.email, lead.company, lead.utm_source, lead.tenant_id], ['sketch_tool', 'new', 'kim@example.com', '김이지 (개인)', 'instagram', 't1']);
assert.equal(lead.attachments.length, 1, '스케치는 비공개 첨부로 저장');
assert.ok(lead.attachments[0].url.startsWith('private://'));
assert.equal(lead.sketch_trial.notes[0], '뒷면은 약 추정');
assert.equal(globalThis.__db.TaskCard.length, 0, '견적 문의 전에는 업무 카드를 만들지 않는다');

// 같은 번호로 다시 부르면 새로 만들지 않는다
r = await call({ ...base, image });
assert.equal(r.body.trial.variants.length, 3);
assert.equal(imgCalls, 3);
assert.equal(globalThis.__db.ManufacturingLead.length, 1);

// 다시 받기
assert.equal((await call({ action: 'get', token })).body.trial.status, 'READY');
assert.equal((await call({ action: 'get', token: '99999999-2222-4333-8444-555555555555' })).status, 404);
assert.equal((await call({ action: 'get', token: 'x' })).status, 404);

// 같은 이메일 하루 2번까지
const t2 = token.replace(/^1/, '2'), t3 = token.replace(/^1/, '3');
assert.equal((await call({ ...base, token: t2, image })).status, 200);
r = await call({ ...base, token: t3, image });
assert.deepEqual([r.status, r.body.code], [429, 'limit_email']);
assert.equal(imgCalls, 6);

// 견적 문의: 카드 생성 · 첨부(스케치 + 고른 시안) · 알림 메일 · 접수 확인 메일
assert.equal((await call({ action: 'inquire', token, variant: 9 })).status, 400);
r = await call({ action: 'inquire', token, variant: 2, quantity: '3,000개', detail: 'USB-C 전원', company: '예시상사' });
assert.equal(r.status, 200);
assert.deepEqual([r.body.trial.chosen, r.body.trial.inquired], [2, true]);
lead = globalThis.__db.ManufacturingLead[0];
const card = globalThis.__db.TaskCard[0];
assert.equal(card.title, '[스케치 시안 문의] 예시상사 · 우드 포인트');
assert.ok(card.hq_requirements.includes('010-1234-5678') && card.hq_requirements.includes('USB-C 전원') && card.hq_requirements.includes('책상용 미니 가습기'));
assert.deepEqual([lead.task_card_id, lead.company, lead.quantity, lead.attachments.length], [card.id, '예시상사', '3,000개', 2]);
assert.equal(globalThis.__db.CardAttachment.length, 2);
assert.deepEqual(globalThis.__emails.map((m) => m.to), ['boss@aegis.kr', 'kim@example.com']);
// 두 번 눌러도 카드는 하나
r = await call({ action: 'inquire', token, variant: 0 });
assert.equal(r.status, 200);
assert.equal(globalThis.__db.TaskCard.length, 1);
assert.equal(globalThis.__emails.length, 2);

// 형태를 못 읽으면 실패로 남기고 한도에서 뺀다
reset();
globalThis.__llm = async () => ({ shape: '' });
r = await call({ ...base, image });
assert.deepEqual([r.status, r.body.code], [422, 'generate']);
assert.equal(globalThis.__db.ManufacturingLead[0].sketch_trial.status, 'FAILED');
assert.equal((await call({ action: 'get', token })).body.trial.status, 'FAILED');
globalThis.__llm = async () => ({ shape: 'ok shape', variants: [] });
assert.equal((await call({ ...base, token: t2, image })).status, 200, '실패한 시도는 한도에 세지 않는다');
assert.equal((await call({ ...base, token: t3, image })).status, 200);

// 이미지 생성이 모두 실패하면 알린다
reset();
globalThis.__img = async () => { throw new Error('quota'); };
r = await call({ ...base, image });
assert.equal(r.status, 502);
console.log('sketch-trial functions ok');
