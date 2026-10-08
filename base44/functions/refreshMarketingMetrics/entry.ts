import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

const videoId = (url) => {
  const m = String(url).match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
  return m ? m[1] : null;
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['master', 'service'].includes(user.account_tier)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const db = base44.asServiceRole.entities;
    const scope = user.account_tier === 'master' ? {} : { tenant_id: user.tenant_id };
    const results = { instagram: { ok: false, message: '인스타그램 계정이 연결되지 않았습니다.' } };

    // YouTube — 공개 통계(조회·좋아요·댓글). 도달·시청시간은 채널 OAuth 필요로 미제공.
    const key = secrets.get('YOUTUBE_API_KEY');
    const conns = await db.SocialConnection.filter({ platform: 'youtube', ...scope });
    let conn = conns[0];
    if (!conn) conn = await db.SocialConnection.create({ platform: 'youtube', tenant_id: user.tenant_id, status: 'connected' });
    const since = conn.connected_at || conn.created_date;

    if (!key) {
      results.youtube = { ok: false, message: 'YouTube API 키가 설정되지 않았습니다.' };
    } else {
      const posts = await db.MarketingPost.filter({ status: 'published', ...scope }, '-published_at', 200);
      const targets = posts
        .filter((p) => p.published_at && p.published_at >= since)
        .flatMap((p) => (p.published_urls || []).filter((u) => u.platform === 'youtube').map((u) => ({ post: p, id: videoId(u.url) })))
        .filter((t) => t.id);
      let count = 0;
      if (targets.length) {
        const ids = [...new Set(targets.map((t) => t.id))].slice(0, 50).join(',');
        const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids}&key=${key}`, { signal: AbortSignal.timeout(15000) });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message || `YouTube API ${res.status}`);
        const stats = Object.fromEntries((json.items || []).map((i) => [i.id, i.statistics]));
        const date = kstToday();
        for (const t of targets) {
          const s = stats[t.id];
          if (!s) continue;
          const data = { tenant_id: t.post.tenant_id, post_id: t.post.id, platform: 'youtube', metric_date: date, views: Number(s.viewCount || 0), likes: Number(s.likeCount || 0), comments: Number(s.commentCount || 0) };
          const [existing] = await db.MarketingMetric.filter({ post_id: t.post.id, platform: 'youtube', metric_date: date });
          if (existing) await db.MarketingMetric.update(existing.id, data); else await db.MarketingMetric.create(data);
          count++;
        }
      }
      results.youtube = { ok: true, message: `영상 ${count}건 갱신` };
    }

    // Instagram — 좋아요·댓글 (도달 등 인사이트는 권한 미보유로 미제공)
    const igConns = await db.SocialConnection.filter({ platform: 'instagram', ...scope });
    const igConn = igConns[0] || await db.SocialConnection.create({ platform: 'instagram', tenant_id: user.tenant_id, status: 'connected' });
    const igSince = igConn.connected_at || igConn.created_date;
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('instagram');
      const res = await fetch(`https://graph.instagram.com/me/media?fields=id,permalink,like_count,comments_count&limit=100&access_token=${accessToken}`, { signal: AbortSignal.timeout(15000) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || `Instagram API ${res.status}`);
      const code = (u) => (String(u).match(/\/(?:p|reel|tv)\/([\w-]+)/) || [])[1];
      const byCode = Object.fromEntries((json.data || []).map((m) => [code(m.permalink), m]));
      const posts = await db.MarketingPost.filter({ status: 'published', ...scope }, '-published_at', 200);
      const date = kstToday();
      let count = 0;
      for (const p of posts.filter((x) => x.published_at && x.published_at >= igSince)) {
        for (const u of (p.published_urls || []).filter((x) => x.platform === 'instagram')) {
          const m = byCode[code(u.url)];
          if (!m) continue;
          const data = { tenant_id: p.tenant_id, post_id: p.id, platform: 'instagram', metric_date: date, likes: Number(m.like_count || 0), comments: Number(m.comments_count || 0) };
          const [existing] = await db.MarketingMetric.filter({ post_id: p.id, platform: 'instagram', metric_date: date });
          if (existing) await db.MarketingMetric.update(existing.id, data); else await db.MarketingMetric.create(data);
          count++;
        }
      }
      results.instagram = { ok: true, message: `게시물 ${count}건 갱신` };
    } catch (e) {
      results.instagram = { ok: false, message: `인스타그램 갱신 실패: ${e.message}` };
    }
    await db.SocialConnection.update(igConn.id, {
      status: results.instagram.ok ? 'connected' : 'not_connected',
      connected_at: igSince,
      last_refreshed_at: new Date().toISOString(),
      last_refresh_message: results.instagram.message,
    });

    await db.SocialConnection.update(conn.id, {
      status: results.youtube.ok ? 'connected' : 'not_connected',
      connected_at: since,
      last_refreshed_at: new Date().toISOString(),
      last_refresh_message: results.youtube.message,
    });
    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}