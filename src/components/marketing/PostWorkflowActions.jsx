import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PLATFORMS, nextSlots, formatKst } from './marketingMeta';

export default function PostWorkflowActions({ post, user, errors, saving, save, run }) {
  const isCeo = user?.account_tier === 'master';
  const [slot, setSlot] = useState(post.scheduled_at || nextSlots(1)[0]);
  const [urls, setUrls] = useState(() => Object.fromEntries((post.platforms || []).map((pl) => [pl, ''])));
  const slots = [...new Set([post.scheduled_at, ...nextSlots(6)].filter(Boolean))];
  const ok = errors.length === 0;
  const hasIg = (post.platforms || []).includes('instagram');
  const igUrl = (post.published_urls || []).find((u) => u.platform === 'instagram')?.url;

  if (post.status === 'published') {
    return (
      <div className="rounded-xl bg-success/10 p-4 text-body space-y-1">
        <p className="font-medium text-success-text">게시 완료 · {post.published_at && formatKst(post.published_at)}</p>
        {(post.published_urls || []).map((u) => (
          <a key={u.url} href={u.url} target="_blank" rel="noreferrer" className="block text-success-text underline truncate">{PLATFORMS[u.platform]}: {u.url}</a>
        ))}
      </div>
    );
  }

  return (
    <div className="border-t pt-5 space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={saving} onClick={() => save()}>저장</Button>
        {post.status === 'draft' && <Button disabled={saving || !ok} onClick={() => run('request_approval')}>승인 요청</Button>}
        {post.status === 'pending_approval' && isCeo && <>
          <Button disabled={saving || !ok} onClick={() => run('approve')}>대표 승인</Button>
          <Button variant="ghost" disabled={saving} onClick={() => run('reject')}>반려</Button>
        </>}
        {post.status === 'pending_approval' && !isCeo && <span className="text-caption text-muted-foreground self-center">대표님 승인을 기다리는 중입니다.</span>}
      </div>
      {['approved', 'scheduled'].includes(post.status) && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <select className="h-9 rounded-md border bg-transparent px-2 text-body" value={slot} onChange={(e) => setSlot(e.target.value)}>
              {slots.map((s) => <option key={s} value={s}>{formatKst(s)}</option>)}
            </select>
            <Button variant="outline" disabled={saving} onClick={() => run('schedule', { scheduled_at: slot })}>예약</Button>
          </div>
          {hasIg && (
            <div className="space-y-2 rounded-xl border p-4">
              <p className="text-body font-medium">인스타그램 자동 게시</p>
              {igUrl ? (
                <p className="text-body text-success-text">올라갔습니다 · <a href={igUrl} target="_blank" rel="noreferrer" className="underline">게시물 보기</a></p>
              ) : (
                <>
                  <label className="flex items-center gap-2 text-body">
                    <input type="checkbox" checked={post.auto_publish !== false} disabled={saving} onChange={(e) => run('set_auto', { auto_publish: e.target.checked })} />
                    예약 시각에 자동으로 올리기 {post.status === 'scheduled' && post.scheduled_at ? `(${formatKst(post.scheduled_at)})` : '— 먼저 예약하세요'}
                  </label>
                  {post.ig_container_id && !post.publish_error?.startsWith('인스타그램 연결') && <p className="text-caption text-muted-foreground">인스타그램이 영상을 처리하는 중입니다. 15분 안에 이어서 올립니다.</p>}
                  {post.publish_error && !post.ig_container_id && (
                    <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-caption text-destructive">
                      <span className="flex-1">게시 실패{post.publish_attempts ? ` (${post.publish_attempts}회)` : ''}: {post.publish_error}</span>
                      <Button size="sm" variant="outline" disabled={saving} onClick={() => run('retry_publish')}>다시 시도</Button>
                    </div>
                  )}
                  <Button size="sm" disabled={saving || !ok} onClick={() => { if (window.confirm('지금 인스타그램에 올립니다. 올린 뒤에는 이 화면에서 지울 수 없습니다.')) run('publish_now'); }}>지금 인스타그램에 올리기</Button>
                  <p className="text-caption text-muted-foreground">15분마다 예약 시각이 지난 글을 확인해 올립니다. 올라가면 알림이 옵니다.</p>
                </>
              )}
            </div>
          )}
          <div className="rounded-xl bg-muted/50 p-4 space-y-2">
            <p className="text-body font-medium">{hasIg ? '직접 올린 경우 · 유튜브 주소 넣기' : '게시 완료 처리'}</p>
            {(post.platforms || []).filter((pl) => !(pl === 'instagram' && igUrl)).map((pl) => (
              <Input key={pl} placeholder={`${PLATFORMS[pl]} 게시물 URL`} value={urls[pl] || ''} onChange={(e) => setUrls({ ...urls, [pl]: e.target.value })} />
            ))}
            <Button disabled={saving || !Object.values(urls).some((u) => u.trim())}
              onClick={() => run('mark_published', { published_urls: Object.entries(urls).filter(([, u]) => u.trim()).map(([platform, url]) => ({ platform, url: url.trim() })) })}>
              게시 완료로 표시
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}