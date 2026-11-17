import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { notifyUsers, internalUsersOfTenant } from '../../shared/notify.ts';
import { publishPostToInstagram, MAX_ATTEMPTS } from '../../shared/instagramPublish.ts';

// 예약 시각이 된 마케팅 게시물을 인스타그램에 올린다 (워크플로 ScheduledMarketingPublish 가 15분마다 부름).
// 로그인 없이 불리므로 하는 일은 "예약 시각이 지난 승인된 글만 올리기" 하나뿐이다. 유튜브는 직접 올린다.
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const db = svc.entities.MarketingPost;
    const nowIso = new Date().toISOString();
    const due = (await db.filter({ status: 'scheduled' }, 'scheduled_at', 50))
      .filter((p: any) => p.scheduled_at && p.scheduled_at <= nowIso && (p.platforms || []).includes('instagram') && p.auto_publish !== false && Number(p.publish_attempts || 0) < MAX_ATTEMPTS);
    if (!due.length) return Response.json({ published: 0, checked: 0 });
    let token = '';
    try { token = (await svc.connectors.getConnection('instagram')).accessToken; } catch { /* 아래에서 알림 */ }
    const results: any[] = [];
    for (const post of due) {
      if (!token) {
        await db.update(post.id, { publish_error: '인스타그램 연결이 끊겨 있습니다. 마케팅 → 연결 설정에서 다시 연결해 주세요', publish_attempts: MAX_ATTEMPTS });
        results.push({ id: post.id, status: 'failed' });
        await notifyUsers(svc, await internalUsersOfTenant(svc, post.tenant_id), { type: 'marketing', title: `[자동 게시 실패] ${post.title}`, body: '인스타그램 연결이 끊겨 있습니다. 다시 연결한 뒤 "다시 시도"를 눌러 주세요.', link: `/marketing?post=${post.id}` }).catch(() => 0);
        continue;
      }
      const r: any = await publishPostToInstagram(db, token, post, nowIso);
      results.push({ id: post.id, ...r });
      if (r.status === 'published') {
        await notifyUsers(svc, await internalUsersOfTenant(svc, post.tenant_id), { type: 'marketing', title: `[게시 완료] ${post.title}`, body: r.allDone ? `인스타그램에 올렸습니다.${r.url ? `\n${r.url}` : ''}` : '인스타그램에 올렸습니다. 유튜브는 직접 올리고 주소를 넣어 주세요.', link: `/marketing?post=${post.id}` }).catch(() => 0);
      } else if (r.status === 'failed' && (r.attempts === undefined || r.attempts >= MAX_ATTEMPTS)) {
        await notifyUsers(svc, await internalUsersOfTenant(svc, post.tenant_id), { type: 'marketing', title: `[자동 게시 실패] ${post.title}`, body: `${r.message}\n고친 뒤 "다시 시도"를 누르거나 직접 올리고 게시 완료로 표시해 주세요.`, link: `/marketing?post=${post.id}` }).catch(() => 0);
      }
    }
    return Response.json({ checked: due.length, published: results.filter((r) => r.status === 'published').length, results });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
}
