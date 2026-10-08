import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { notifyUsers } from '../../shared/notify.ts';

// 매일 07:00 KST 워크플로(DailyMarketingMetrics)는 로그인 없이 호출되므로 본사 테넌트 기준으로 동작하고,
// 공개 URL 남용을 막기 위해 짧은 재실행 간격을 제한한다.
const THROTTLE_MS = 30 * 60 * 1000;

const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const SINCE = () => new Date(Date.now() - 90 * 86400 * 1000).toISOString();
const videoId = (url) => (String(url).match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/) || [])[1];
const igCode = (u) => (String(u).match(/\/(?:p|reel|tv)\/([\w-]+)/) || [])[1];
const getJson = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `API ${res.status}`);
  return json;
};

// 외부 게시물(앱에 없는 것)을 게시 완료 MarketingPost 로 가져오고, 오늘자 지표를 저장
async function syncItems(db, posts, platform, items, keyOf, tenantId) {
  const date = kstToday();
  let created = 0, updated = 0;
  for (const it of items) {
    let post = posts.find((p) => (p.published_urls || []).some((u) => u.platform === platform && keyOf(u.url) === it.key));
    if (!post) {
      post = await db.MarketingPost.create({
        tenant_id: tenantId, title: (it.title || '').split('\n')[0].slice(0, 80) || `${platform} 게시물`,
        platforms: [platform], caption: it.title, status: 'published', published_at: it.published_at,
        published_urls: [{ platform, url: it.url }], note: '계정에서 자동으로 가져온 게시물',
      });
      posts.push(post);
      created++;
    }
    const data = { tenant_id: post.tenant_id, post_id: post.id, platform, metric_date: date, ...it.stats };
    const [existing] = await db.MarketingMetric.filter({ post_id: post.id, platform, metric_date: date });
    if (existing) await db.MarketingMetric.update(existing.id, data); else await db.MarketingMetric.create(data);
    updated++;
    it.post = post;
  }
  return `최근 90일 ${updated}건 갱신 (신규 ${created}건 가져옴)`;
}

// 지난 수집 이후 달린 인스타 댓글을 대표(master) 계정에 알림·이메일
async function notifyNewComments(base44, items, since) {
  if (!since) return 0;
  const { accessToken } = await base44.asServiceRole.connectors.getConnection('instagram');
  const fresh = [];
  for (const it of items.filter((i) => i.stats.comments > 0 && i.mediaId)) {
    const json = await getJson(`https://graph.instagram.com/${it.mediaId}/comments?fields=text,username,timestamp&limit=50&access_token=${accessToken}`);
    for (const c of json.data || []) if (c.timestamp > since) fresh.push({ ...c, it });
  }
  if (!fresh.length) return 0;
  const masters = await base44.asServiceRole.entities.User.filter({ account_tier: 'master' });
  const body = fresh.slice(0, 20).map((c) => `· [${(c.it.post?.title || '').slice(0, 30)}] @${c.username || '?'}: ${c.text}\n  ${c.it.url}`).join('\n');
  await notifyUsers(base44.asServiceRole, masters, { type: 'marketing_comment', title: `인스타그램 새 댓글 ${fresh.length}개`, body, link: '/marketing' });
  return fresh.length;
}

async function instagramItems(base44) {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection('instagram');
  const since = SINCE();
  const items = [];
  let url = `https://graph.instagram.com/me/media?fields=id,permalink,caption,timestamp,like_count,comments_count&limit=100&access_token=${accessToken}`;
  while (url) {
    const json = await getJson(url);
    const page = json.data || [];
    for (const m of page) if (m.timestamp >= since) items.push({ mediaId: m.id, key: igCode(m.permalink), url: m.permalink, title: m.caption, published_at: m.timestamp, stats: { likes: Number(m.like_count || 0), comments: Number(m.comments_count || 0) } });
    url = page.length && page[page.length - 1].timestamp >= since ? json.paging?.next : null;
  }
  return items;
}

async function youtubeItems(key, accountUrl, posts) {
  const since = SINCE();
  const ids = new Set(posts.flatMap((p) => (p.published_urls || []).filter((u) => u.platform === 'youtube').map((u) => videoId(u.url))).filter(Boolean));
  const handle = (String(accountUrl || '').match(/@([\w.-]+)/) || [])[1];
  const channelId = (String(accountUrl || '').match(/channel\/(UC[\w-]+)/) || [])[1];
  if (handle || channelId) {
    const ch = await getJson(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&${channelId ? `id=${channelId}` : `forHandle=${handle}`}&key=${key}`);
    const uploads = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    let token = '';
    while (uploads) {
      const pl = await getJson(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${uploads}&pageToken=${token}&key=${key}`);
      const recent = (pl.items || []).filter((i) => i.contentDetails.videoPublishedAt >= since);
      recent.forEach((i) => ids.add(i.contentDetails.videoId));
      if (!pl.nextPageToken || recent.length < (pl.items || []).length) break;
      token = pl.nextPageToken;
    }
  }
  const all = [...ids];
  const items = [];
  for (let i = 0; i < all.length; i += 50) {
    const json = await getJson(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${all.slice(i, i + 50).join(',')}&key=${key}`);
    for (const v of json.items || []) {
      if (v.snippet.publishedAt < since) continue;
      const s = v.statistics;
      items.push({ key: v.id, url: `https://www.youtube.com/watch?v=${v.id}`, title: v.snippet.title, published_at: v.snippet.publishedAt, stats: { views: Number(s.viewCount || 0), likes: Number(s.likeCount || 0), comments: Number(s.commentCount || 0) } });
    }
  }
  return { items, noChannel: !handle && !channelId };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let user = await base44.auth.me().catch(() => null);
    const db = base44.asServiceRole.entities;
    if (!user) {
      const [hq] = await db.Tenant.filter({ is_hq: true }, 'created_date', 1);
      if (!hq) return Response.json({ error: '본사 테넌트가 없습니다.' }, { status: 400 });
      const recent = (await db.SocialConnection.filter({ tenant_id: hq.id })).some((c) => c.last_refreshed_at && Date.now() - new Date(c.last_refreshed_at).getTime() < THROTTLE_MS);
      if (recent) return Response.json({ skipped: '최근에 이미 수집했습니다.' });
      user = { account_tier: 'service', tenant_id: hq.id };
    } else if (!['master', 'service'].includes(user.account_tier)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const scope = user.account_tier === 'master' ? {} : { tenant_id: user.tenant_id };
    const posts = await db.MarketingPost.filter({ status: 'published', ...scope }, '-published_at', 500);
    const results = {};

    const connFor = async (platform) => (await db.SocialConnection.filter({ platform, ...scope }))[0]
      || await db.SocialConnection.create({ platform, tenant_id: user.tenant_id, status: 'connected' });

    for (const platform of ['instagram', 'youtube']) {
      const conn = await connFor(platform);
      try {
        if (platform === 'instagram') {
          const items = await instagramItems(base44);
          const msg = await syncItems(db, posts, 'instagram', items, igCode, user.tenant_id);
          const n = await notifyNewComments(base44, items, conn.last_refreshed_at);
          results.instagram = { ok: true, message: n ? `${msg} · 새 댓글 ${n}개 알림` : msg };
        } else {
          const key = secrets.get('YOUTUBE_API_KEY');
          if (!key) throw new Error('YouTube API 키가 설정되지 않았습니다.');
          const { items, noChannel } = await youtubeItems(key, conn.account_url, posts);
          const msg = await syncItems(db, posts, 'youtube', items, videoId, user.tenant_id);
          results.youtube = { ok: true, message: noChannel ? `${msg} · 채널 주소를 연결 설정에 입력하면 과거 영상도 가져옵니다` : msg };
        }
      } catch (e) {
        results[platform] = { ok: false, message: `갱신 실패: ${e.message}` };
      }
      await db.SocialConnection.update(conn.id, {
        status: results[platform].ok ? 'connected' : 'not_connected',
        last_refreshed_at: new Date().toISOString(),
        last_refresh_message: results[platform].message,
      });
    }
    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}