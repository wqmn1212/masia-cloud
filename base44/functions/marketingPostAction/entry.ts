import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { publishPostToInstagram, igProblems } from '../../shared/instagramPublish.ts';

// 승인 대상 내용 필드 (제목 제외)
const CONTENT = ['platforms', 'post_format', 'caption', 'hashtags', 'youtube_title', 'youtube_description', 'youtube_tags', 'media', 'utm_campaign'];
const EDITABLE = ['title', 'note', 'auto_publish', ...CONTENT];
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in (o || {})).map((k) => [k, o[k]]));
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['master', 'service'].includes(user.account_tier)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const isCeo = user.account_tier === 'master';
    const { action, id, data = {} } = await req.json();
    const db = base44.asServiceRole.entities.MarketingPost;
    const fail = (msg, status = 400) => Response.json({ error: msg }, { status });

    if (action === 'save' && !id) {
      const post = await db.create({ ...pick(data, EDITABLE), tenant_id: user.tenant_id, status: 'draft' });
      return Response.json({ post });
    }

    const post = await db.get(id);
    if (!post) return fail('게시물을 찾을 수 없습니다.', 404);
    if (!isCeo && post.tenant_id !== user.tenant_id) return fail('Forbidden', 403);
    const s = post.status;
    let patch;

    if (action === 'save') {
      if (s === 'published') return fail('게시 완료된 게시물은 수정할 수 없습니다.');
      patch = pick(data, EDITABLE);
      const changed = CONTENT.some((k) => k in patch && !same(patch[k], post[k]));
      if (changed && ['approved', 'scheduled'].includes(s)) Object.assign(patch, { status: 'draft', approved_by: null, approved_at: null, scheduled_at: null, ig_container_id: null, publish_error: '', publish_attempts: 0 });
    } else if (action === 'request_approval') {
      if (s !== 'draft') return fail('초안만 승인 요청할 수 있습니다.');
      patch = { status: 'pending_approval' };
    } else if (action === 'approve' || action === 'reject') {
      if (!isCeo) return fail('승인·반려는 대표님만 가능합니다.', 403);
      if (s !== 'pending_approval') return fail('승인 대기 상태가 아닙니다.');
      patch = action === 'approve' ? { status: 'approved', approved_by: user.email, approved_at: new Date().toISOString() } : { status: 'draft' };
    } else if (action === 'schedule') {
      if (!['approved', 'scheduled'].includes(s)) return fail('승인된 게시물만 예약할 수 있습니다.');
      if (!data.scheduled_at) return fail('예약 시각이 필요합니다.');
      patch = { status: 'scheduled', scheduled_at: data.scheduled_at, publish_attempts: 0, publish_error: '' };
    } else if (action === 'mark_published') {
      if (!['approved', 'scheduled'].includes(s)) return fail('승인된 게시물만 게시 완료로 표시할 수 있습니다.');
      const urls = (data.published_urls || []).filter((u) => u?.url && u?.platform);
      if (!urls.length) return fail('게시물 URL이 필요합니다.');
      // 인스타그램이 자동으로 올라간 뒤 유튜브 주소만 넣는 경우: 이미 있는 주소는 남긴다
      const merged = [...(post.published_urls || []).filter((u) => !urls.some((x) => x.platform === u.platform)), ...urls];
      patch = { status: 'published', published_at: new Date().toISOString(), published_urls: merged };
    } else if (action === 'publish_now' || action === 'retry_publish') {
      if (!['approved', 'scheduled'].includes(s)) return fail('승인된 게시물만 올릴 수 있습니다.');
      if (!(post.platforms || []).includes('instagram')) return fail('인스타그램이 선택되지 않은 게시물입니다.');
      const problems = igProblems(post);
      if (problems.length) return fail(problems.join(' · '));
      const nowIso = new Date().toISOString();
      // 예약 상태로 두어야 영상 처리가 길어질 때 예약 게시 작업이 이어서 올린다
      const base = await db.update(id, { status: 'scheduled', scheduled_at: post.scheduled_at && post.scheduled_at < nowIso ? post.scheduled_at : nowIso, publish_attempts: 0, publish_error: '', auto_publish: true });
      let token = '';
      try { token = (await base44.asServiceRole.connectors.getConnection('instagram')).accessToken; } catch { /* 아래 */ }
      if (!token) return fail('인스타그램 연결이 끊겨 있습니다. 연결 설정에서 다시 연결해 주세요.');
      const r = await publishPostToInstagram(db, token, { ...post, ...base }, nowIso);
      const fresh = await db.get(id);
      if (r.status === 'failed') return Response.json({ post: fresh, error: r.message }, { status: 502 });
      return Response.json({ post: fresh, result: r });
    } else if (action === 'set_auto') {
      if (!['approved', 'scheduled'].includes(s)) return fail('승인된 게시물만 바꿀 수 있습니다.');
      patch = { auto_publish: !!data.auto_publish };
    } else {
      return fail('알 수 없는 작업입니다.');
    }

    const updated = await db.update(id, patch);
    return Response.json({ post: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}