import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PLATFORMS, nextSlots, formatKst } from './marketingMeta';

export default function PostWorkflowActions({ post, user, errors, saving, save }) {
  const isCeo = user?.account_tier === 'master';
  const [slot, setSlot] = useState(post.scheduled_at || nextSlots(1)[0]);
  const [urls, setUrls] = useState(() => Object.fromEntries((post.platforms || []).map((pl) => [pl, ''])));
  const slots = [...new Set([post.scheduled_at, ...nextSlots(6)].filter(Boolean))];
  const ok = errors.length === 0;

  if (post.status === 'published') {
    return (
      <div className="rounded-xl bg-emerald-50 p-4 text-sm space-y-1">
        <p className="font-medium text-emerald-800">게시 완료 · {post.published_at && formatKst(post.published_at)}</p>
        {(post.published_urls || []).map((u) => (
          <a key={u.url} href={u.url} target="_blank" rel="noreferrer" className="block text-emerald-700 underline truncate">{PLATFORMS[u.platform]}: {u.url}</a>
        ))}
      </div>
    );
  }

  return (
    <div className="border-t pt-5 space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={saving} onClick={() => save()}>저장</Button>
        {post.status === 'draft' && <Button disabled={saving || !ok} onClick={() => save({ status: 'pending_approval' })}>승인 요청</Button>}
        {post.status === 'pending_approval' && isCeo && <>
          <Button disabled={saving || !ok} onClick={() => save({ status: 'approved', approved_by: user.email, approved_at: new Date().toISOString() })}>대표 승인</Button>
          <Button variant="ghost" disabled={saving} onClick={() => save({ status: 'draft' })}>반려</Button>
        </>}
        {post.status === 'pending_approval' && !isCeo && <span className="text-xs text-muted-foreground self-center">대표님 승인을 기다리는 중입니다.</span>}
      </div>
      {['approved', 'scheduled'].includes(post.status) && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <select className="h-9 rounded-md border bg-transparent px-2 text-sm" value={slot} onChange={(e) => setSlot(e.target.value)}>
              {slots.map((s) => <option key={s} value={s}>{formatKst(s)}</option>)}
            </select>
            <Button variant="outline" disabled={saving} onClick={() => save({ status: 'scheduled', scheduled_at: slot })}>예약</Button>
          </div>
          <div className="rounded-xl bg-muted/50 p-4 space-y-2">
            <p className="text-sm font-medium">수동 게시 완료 처리</p>
            {(post.platforms || []).map((pl) => (
              <Input key={pl} placeholder={`${PLATFORMS[pl]} 게시물 URL`} value={urls[pl] || ''} onChange={(e) => setUrls({ ...urls, [pl]: e.target.value })} />
            ))}
            <Button disabled={saving || !Object.values(urls).some((u) => u.trim())}
              onClick={() => save({ status: 'published', published_at: new Date().toISOString(), published_urls: Object.entries(urls).filter(([, u]) => u.trim()).map(([platform, url]) => ({ platform, url: url.trim() })) })}>
              게시 완료로 표시
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}