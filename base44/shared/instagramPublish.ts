// 인스타그램 자동 게시 (Instagram 로그인 API, 커넥터 권한 instagram_business_content_publish)
// 1) 미디어 컨테이너 만들기 → 2) 영상이면 처리 끝날 때까지 기다리기 → 3) media_publish → 4) 게시물 주소 받기
// 같은 글이 두 번 올라가지 않게 publish_lock_at 으로 잠그고, 영상 처리가 오래 걸리면 컨테이너 id 를 남겨 다음 번에 이어서 게시한다.
const GRAPH = 'https://graph.instagram.com';
export const LOCK_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 3;

type Media = { url: string; type?: string; order?: number };
type Post = { id: string; caption?: string; hashtags?: string[]; post_format?: string; media?: Media[]; ig_container_id?: string };

export function igCaption(p: Post) {
  const tags = (p.hashtags || []).map((t) => `#${String(t).replace(/^#/, '')}`).join(' ');
  return [String(p.caption || '').trim(), tags].filter(Boolean).join('\n\n').slice(0, 2200);
}

const isVideo = (m: Media) => m.type === 'video' || /\.(mp4|mov|m4v)(\?|$)/i.test(m.url || '');

/** 게시 형식에 맞는지 미리 확인 (사람이 고칠 수 있는 말로) */
export function igProblems(p: Post) {
  const media = [...(p.media || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const out: string[] = [];
  if (!media.length) out.push('사진이나 영상이 없습니다');
  if (media.some((m) => !/^https:\/\//.test(m.url || ''))) out.push('공개 주소(https)가 아닌 파일이 있습니다');
  if (p.post_format === 'carousel' && (media.length < 2 || media.length > 10)) out.push('캐러셀은 2~10개여야 합니다');
  if (p.post_format === 'reel' && !media.some(isVideo)) out.push('릴스에는 영상이 필요합니다');
  return out;
}

async function call(token: string, method: string, path: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${GRAPH}${path}${method === 'GET' ? `?${qs}` : ''}`, {
    method,
    ...(method === 'POST' ? { body: qs, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } } : {}),
    signal: AbortSignal.timeout(30000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(json?.error?.error_user_msg || json?.error?.message || `Instagram ${res.status}`);
  return json;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 컨테이너 상태가 FINISHED 가 될 때까지 기다린다. 시간이 다 되면 false */
async function waitReady(token: string, id: string, { tries = 10, every = 3000 } = {}) {
  for (let i = 0; i < tries; i++) {
    const s = await call(token, 'GET', `/${id}`, { fields: 'status_code,status' });
    if (s.status_code === 'FINISHED') return true;
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error(`인스타그램이 파일을 처리하지 못했습니다 (${s.status || s.status_code})`);
    await sleep(every);
  }
  return false;
}

/** 게시용 컨테이너 만들기 (영상 처리는 기다리지 않음) */
export async function igCreateContainer(token: string, p: Post) {
  const media = [...(p.media || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const caption = igCaption(p);
  if (p.post_format === 'carousel' && media.length > 1) {
    const children: string[] = [];
    for (const m of media.slice(0, 10)) {
      const c = await call(token, 'POST', '/me/media', isVideo(m) ? { media_type: 'VIDEO', video_url: m.url, is_carousel_item: 'true' } : { image_url: m.url, is_carousel_item: 'true' });
      children.push(c.id);
    }
    for (const id of children) await waitReady(token, id, { tries: 20, every: 3000 });
    return (await call(token, 'POST', '/me/media', { media_type: 'CAROUSEL', children: children.join(','), caption })).id as string;
  }
  const video = media.find(isVideo);
  if (p.post_format === 'reel' || (video && !media.some((m) => !isVideo(m)))) {
    return (await call(token, 'POST', '/me/media', { media_type: 'REELS', video_url: (video || media[0]).url, caption })).id as string;
  }
  const img = media.find((m) => !isVideo(m)) || media[0];
  return (await call(token, 'POST', '/me/media', { image_url: img.url, caption })).id as string;
}

/**
 * 컨테이너를 게시한다. 처리 중이면 { pending: true, container } 를 돌려주고, 다음 번에 같은 container 로 다시 부르면 된다.
 * 성공: { url, media_id }
 */
export async function igPublish(token: string, p: Post, opts: { wait?: { tries?: number; every?: number } } = {}) {
  const container = p.ig_container_id || await igCreateContainer(token, p);
  const ready = await waitReady(token, container, opts.wait);
  if (!ready) return { pending: true, container };
  const pub = await call(token, 'POST', '/me/media_publish', { creation_id: container });
  const info = await call(token, 'GET', `/${pub.id}`, { fields: 'permalink' }).catch(() => ({}));
  return { url: info.permalink || '', media_id: pub.id as string, container };
}

/**
 * 게시물 한 건 처리 (예약 게시·즉시 게시 공용). db = MarketingPost 엔티티, now = ISO 시각.
 * 결과 { status: 'published'|'pending'|'failed'|'locked'|'skipped', message }
 */
export async function publishPostToInstagram(db: any, token: string, post: any, nowIso: string, opts: any = {}) {
  if ((post.published_urls || []).some((u: any) => u.platform === 'instagram')) return { status: 'skipped', message: '이미 인스타그램에 올라가 있습니다' };
  if (post.publish_lock_at && Date.parse(nowIso) - Date.parse(post.publish_lock_at) < LOCK_MS) return { status: 'locked', message: '다른 곳에서 게시하는 중입니다' };
  const problems = igProblems(post);
  if (problems.length) {
    await db.update(post.id, { publish_error: problems.join(' · '), publish_attempts: MAX_ATTEMPTS });
    return { status: 'failed', message: problems.join(' · ') };
  }
  await db.update(post.id, { publish_lock_at: nowIso });
  try {
    const r: any = await igPublish(token, post, opts);
    if (r.pending) {
      await db.update(post.id, { ig_container_id: r.container, publish_lock_at: null, publish_error: '인스타그램이 영상을 처리하는 중입니다. 몇 분 뒤 이어서 게시합니다' });
      return { status: 'pending', message: '영상 처리 중' };
    }
    const urls = [...(post.published_urls || []), { platform: 'instagram', url: r.url || `https://www.instagram.com/` }];
    const allDone = (post.platforms || ['instagram']).every((pl: string) => urls.some((u) => u.platform === pl));
    await db.update(post.id, {
      published_urls: urls, ig_media_id: r.media_id, ig_container_id: null, publish_lock_at: null, publish_error: '',
      ...(allDone ? { status: 'published', published_at: nowIso } : {}),
    });
    return { status: 'published', message: allDone ? '게시 완료' : '인스타그램 게시 완료 · 나머지 플랫폼은 직접 올려 주세요', url: r.url, allDone };
  } catch (e) {
    const attempts = Number(post.publish_attempts || 0) + 1;
    await db.update(post.id, { publish_lock_at: null, publish_attempts: attempts, publish_error: String((e as Error)?.message || e).slice(0, 500), ig_container_id: null });
    return { status: 'failed', message: String((e as Error)?.message || e), attempts };
  }
}
