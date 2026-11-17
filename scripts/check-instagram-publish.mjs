// 인스타그램 자동 게시 검산: 캡션·해시태그, 형식별 컨테이너(사진·캐러셀·릴스), 영상 처리 대기 후 이어서 게시,
// 두 번 올라가지 않게 잠금, 실패 횟수·멈춤, 예약 작업(시각 지난 글만, 자동 끔 제외), 유튜브 섞인 글은 인스타만 게시.
// 실행: npm run check:instagram-publish
import assert from 'node:assert/strict';
const S = await import(new URL('../base44/shared/instagramPublish.ts', import.meta.url).href);
const R = new URL('../base44/functions/', import.meta.url).href;

// 가짜 Graph API
let calls = [], status = {}, failOn = null;
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url); const method = init.method || 'GET';
  const params = method === 'POST' ? Object.fromEntries(new URLSearchParams(String(init.body))) : Object.fromEntries(u.searchParams);
  calls.push({ method, path: u.pathname, params });
  const ok = (j) => ({ ok: true, status: 200, json: async () => j });
  if (failOn && u.pathname.includes(failOn)) return { ok: false, status: 400, json: async () => ({ error: { message: 'Invalid image URL' } }) };
  if (method === 'POST' && u.pathname === '/me/media') { const id = `c${calls.length}`; status[id] = params.media_type === 'REELS' || params.media_type === 'VIDEO' ? (globalThis.__slow ? 'IN_PROGRESS' : 'FINISHED') : 'FINISHED'; return ok({ id }); }
  if (method === 'POST' && u.pathname === '/me/media_publish') return ok({ id: `m-${params.creation_id}` });
  if (method === 'GET' && u.pathname.startsWith('/m-')) return ok({ permalink: `https://www.instagram.com/p/${u.pathname.slice(1)}/` });
  if (method === 'GET') return ok({ status_code: status[u.pathname.slice(1)] || 'FINISHED' });
  return ok({});
};
const reset = () => { calls = []; status = {}; failOn = null; globalThis.__slow = false; };
const fast = { wait: { tries: 2, every: 1 } };

assert.equal(S.igCaption({ caption: ' 새 제품 ', hashtags: ['조명', '#수면'] }), '새 제품\n\n#조명 #수면');
assert.deepEqual(S.igProblems({ post_format: 'carousel', media: [{ url: 'https://a/1.jpg' }] }), ['캐러셀은 2~10개여야 합니다']);
assert.deepEqual(S.igProblems({ post_format: 'reel', media: [{ url: 'https://a/1.jpg', type: 'image' }] }), ['릴스에는 영상이 필요합니다']);
assert.ok(S.igProblems({ media: [{ url: 'blob:x' }] }).length, 'https 아닌 주소');

// 사진 한 장
reset();
let r = await S.igPublish('tok', { caption: 'hi', media: [{ url: 'https://a/1.jpg', type: 'image' }] }, fast);
assert.match(r.url, /instagram\.com\/p\//);
assert.equal(calls[0].params.image_url, 'https://a/1.jpg');
assert.equal(calls[0].params.caption, 'hi');
assert.equal(calls[0].params.access_token, 'tok');
// 캐러셀: 자식 3개 → CAROUSEL
reset();
r = await S.igPublish('tok', { post_format: 'carousel', media: [{ url: 'https://a/2.jpg', order: 1 }, { url: 'https://a/1.jpg', order: 0 }, { url: 'https://a/v.mp4', type: 'video', order: 2 }] }, fast);
const made = calls.filter((c) => c.method === 'POST' && c.path === '/me/media');
assert.equal(made.length, 4);
assert.equal(made[0].params.image_url, 'https://a/1.jpg', '순서대로');
assert.equal(made[2].params.media_type, 'VIDEO');
assert.equal(made[3].params.media_type, 'CAROUSEL');
assert.equal(made[3].params.children.split(',').length, 3);
// 릴스: 처리 중이면 pending, 다음 번에 같은 컨테이너로 게시
reset(); globalThis.__slow = true;
r = await S.igPublish('tok', { post_format: 'reel', media: [{ url: 'https://a/v.mp4', type: 'video' }] }, fast);
assert.equal(r.pending, true);
const cont = r.container;
status[cont] = 'FINISHED'; calls = [];
r = await S.igPublish('tok', { post_format: 'reel', ig_container_id: cont, media: [{ url: 'https://a/v.mp4', type: 'video' }] }, fast);
assert.ok(r.url);
assert.equal(calls.filter((c) => c.path === '/me/media').length, 0, '컨테이너를 다시 만들지 않는다');

// 예약 게시 함수
const T = '2026-11-17T01:00:00.000Z';
const posts = () => [
  { id: 'p1', tenant_id: 't1', title: '월요일 신제품', status: 'scheduled', scheduled_at: '2026-11-17T00:30:00.000Z', platforms: ['instagram'], media: [{ url: 'https://a/1.jpg', type: 'image' }], caption: 'a' },
  { id: 'p2', tenant_id: 't1', title: '아직', status: 'scheduled', scheduled_at: '2099-01-01T00:00:00.000Z', platforms: ['instagram'], media: [{ url: 'https://a/1.jpg' }] },
  { id: 'p3', tenant_id: 't1', title: '자동 끔', status: 'scheduled', scheduled_at: '2026-11-17T00:00:00.000Z', platforms: ['instagram'], auto_publish: false, media: [{ url: 'https://a/1.jpg' }] },
  { id: 'p4', tenant_id: 't1', title: '유튜브도', status: 'scheduled', scheduled_at: '2026-11-17T00:00:00.000Z', platforms: ['instagram', 'youtube'], media: [{ url: 'https://a/1.jpg' }, { url: 'https://a/v.mp4', type: 'video' }] },
  { id: 'p5', tenant_id: 't1', title: '잠김', status: 'scheduled', scheduled_at: '2026-11-17T00:00:00.000Z', platforms: ['instagram'], publish_lock_at: '2099-01-01T00:00:00.000Z', media: [{ url: 'https://a/1.jpg' }] },
];
globalThis.__db = { MarketingPost: posts(), User: [{ id: 's1', account_tier: 'service', tenant_id: 't1', is_active: true }], Notification: [] };
globalThis.__user = null;
const RealDate = Date; const fixed = RealDate.parse(T);
globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [fixed])); } static now() { return fixed; } };
reset();
const run = async () => { const m = await import(R + 'publishMarketingPosts/entry.ts'); const res = await m.default(new Request('https://x', { method: 'POST', body: '{}' })); return res.json(); };
let out = await run();
const db = globalThis.__db.MarketingPost;
const get = (id) => db.find((p) => p.id === id);
assert.equal(get('p1').status, 'published');
assert.match(get('p1').published_urls[0].url, /instagram/);
assert.equal(get('p2').status, 'scheduled', '예약 시각 전');
assert.ok(!get('p3').published_urls, '자동 끔');
assert.equal(get('p4').status, 'scheduled', '유튜브가 남아 예약 상태 유지');
assert.equal(get('p4').published_urls.length, 1);
assert.ok(!get('p5').published_urls, '다른 곳에서 게시 중이면 건드리지 않음');
assert.ok(globalThis.__db.Notification.some((n) => /게시 완료/.test(n.title)));
// 다시 돌려도 두 번 올라가지 않는다
reset(); out = await run();
assert.equal(calls.filter((c) => c.path === '/me/media_publish').length, 0, '중복 게시 없음');
// 실패 3번이면 멈추고 알림
globalThis.__db.MarketingPost = [{ ...posts()[0], id: 'p9', title: '깨진 사진' }];
for (let i = 0; i < 4; i++) { reset(); failOn = '/me/media'; await run(); }
const p9 = globalThis.__db.MarketingPost[0];
assert.equal(p9.publish_attempts, 3, '3번에서 멈춤');
assert.match(p9.publish_error, /Invalid image/);
assert.ok(globalThis.__db.Notification.some((n) => /자동 게시 실패/.test(n.title)));
globalThis.Date = RealDate;
console.log('instagram publish ok');
