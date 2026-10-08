import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// 승인 대상 내용 필드 (제목 제외)
const CONTENT = ['platforms', 'post_format', 'caption', 'hashtags', 'youtube_title', 'youtube_description', 'youtube_tags', 'media', 'utm_campaign'];
const EDITABLE = ['title', 'note', ...CONTENT];
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
      if (changed && ['approved', 'scheduled'].includes(s)) Object.assign(patch, { status: 'draft', approved_by: null, approved_at: null, scheduled_at: null });
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
      patch = { status: 'scheduled', scheduled_at: data.scheduled_at };
    } else if (action === 'mark_published') {
      if (!['approved', 'scheduled'].includes(s)) return fail('승인된 게시물만 게시 완료로 표시할 수 있습니다.');
      const urls = (data.published_urls || []).filter((u) => u?.url && u?.platform);
      if (!urls.length) return fail('게시물 URL이 필요합니다.');
      patch = { status: 'published', published_at: new Date().toISOString(), published_urls: urls };
    } else {
      return fail('알 수 없는 작업입니다.');
    }

    const updated = await db.update(id, patch);
    return Response.json({ post: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}