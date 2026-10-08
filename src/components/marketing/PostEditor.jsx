import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { PLATFORMS, FORMATS, STATUS, HASHTAG_LIMIT, validatePost, splitTags } from './marketingMeta';
import MediaManager from './MediaManager';
import PostPreview from './PostPreview';
import PostWorkflowActions from './PostWorkflowActions';

// 서버(marketingPostAction)의 CONTENT 와 동일 — 바뀌면 재승인 필요
const CONTENT_FIELDS = ['platforms', 'post_format', 'caption', 'hashtags', 'youtube_title', 'youtube_description', 'youtube_tags', 'media', 'utm_campaign'];

export default function PostEditor({ post, user, onSaved, onNew }) {
  const [p, setP] = useState({ platforms: ['instagram'], post_format: 'feed', status: 'draft', media: [], hashtags: [], youtube_tags: [], ...post });
  const [orig, setOrig] = useState(post || {});
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setP((s) => ({ ...s, [k]: v }));
  const errors = validatePost(p);
  const locked = p.status === 'published';

  // 모든 저장·상태 변경은 서버 함수에서 권한·상태를 확인한다
  const run = async (action, data = {}) => {
    setSaving(true);
    try {
      let id = p.id;
      if (action !== 'save' && !id) {
        // 새 글: 먼저 초안으로 만든 뒤 같은 작업을 이어서 실행
        const r = await base44.functions.invoke('marketingPostAction', { action: 'save', data: p });
        id = r.data.post.id;
      } else if (action !== 'save') {
        // 상태 변경 전 편집 내용을 먼저 저장 (내용이 바뀌면 서버가 초안으로 되돌림)
        const r = await base44.functions.invoke('marketingPostAction', { action: 'save', id, data: p });
        if (r.data.post.status !== p.status) { setP(r.data.post); onSaved(r.data.post); toast({ title: '내용이 바뀌어 다시 승인이 필요합니다.' }); return; }
      }
      const res = await base44.functions.invoke('marketingPostAction', { action, id, data: action === 'save' ? p : data });
      setP(res.data.post); setOrig(res.data.post); onSaved(res.data.post);
    } catch (e) {
      toast({ title: '저장하지 못했습니다', description: e.response?.data?.error || e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };
  const save = () => {
    const contentChanged = CONTENT_FIELDS.some((k) => JSON.stringify(p[k] ?? null) !== JSON.stringify(orig[k] ?? null));
    if (contentChanged && ['approved', 'scheduled'].includes(p.status) && !window.confirm('수정하면 다시 승인이 필요합니다. 저장할까요?')) return;
    run('save');
  };
  const toggle = (pl) => set('platforms')(p.platforms.includes(pl) ? p.platforms.filter((x) => x !== pl) : [...p.platforms, pl]);
  const has = (pl) => p.platforms.includes(pl);

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6">
      <div className="rounded-2xl border bg-card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <span className={cn('text-xs rounded px-2 py-1', STATUS[p.status]?.cls)}>{STATUS[p.status]?.label}</span>
          <Button variant="ghost" size="sm" onClick={onNew}>새 게시물</Button>
        </div>
        <fieldset disabled={locked} className="space-y-5">
          <div><Label>제목 (내부용)</Label><Input className="mt-1.5" value={p.title || ''} onChange={(e) => set('title')(e.target.value)} /></div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PLATFORMS).map(([k, v]) => (
              <Button key={k} type="button" size="sm" variant={has(k) ? 'default' : 'outline'} onClick={() => toggle(k)}>{v}</Button>
            ))}
            <select className="h-8 rounded-md border bg-transparent px-2 text-sm" value={p.post_format} onChange={(e) => set('post_format')(e.target.value)}>
              {Object.entries(FORMATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <MediaManager media={p.media || []} onChange={set('media')} />
          {has('instagram') && <>
            <div><Label>캡션 ({(p.caption || '').length}/2200)</Label><Textarea rows={5} className="mt-1.5" value={p.caption || ''} onChange={(e) => set('caption')(e.target.value)} /></div>
            <div><Label>해시태그 ({p.hashtags.length}/{HASHTAG_LIMIT})</Label><Input className="mt-1.5" defaultValue={p.hashtags.map((t) => `#${t}`).join(' ')} onBlur={(e) => set('hashtags')(splitTags(e.target.value))} /></div>
          </>}
          {has('youtube') && <>
            <div><Label>유튜브 제목 ({(p.youtube_title || '').length}/100)</Label><Input className="mt-1.5" value={p.youtube_title || ''} onChange={(e) => set('youtube_title')(e.target.value)} /></div>
            <div><Label>유튜브 설명</Label><Textarea rows={4} className="mt-1.5" value={p.youtube_description || ''} onChange={(e) => set('youtube_description')(e.target.value)} /></div>
            <div><Label>유튜브 태그 (쉼표 구분)</Label><Input className="mt-1.5" defaultValue={p.youtube_tags.join(', ')} onBlur={(e) => set('youtube_tags')(splitTags(e.target.value))} /></div>
          </>}
          <div><Label>UTM 캠페인 (링크 추적용)</Label><Input className="mt-1.5" placeholder="예: 2026-10-machine-case" value={p.utm_campaign || ''} onChange={(e) => set('utm_campaign')(e.target.value)} /></div>
        </fieldset>
        {errors.length > 0 && !locked && (
          <ul className="text-xs text-destructive space-y-1">{errors.map((e) => <li key={e}>· {e}</li>)}</ul>
        )}
        <PostWorkflowActions post={p} user={user} errors={errors} saving={saving} save={save} run={run} />
      </div>
      <PostPreview post={p} />
    </div>
  );
}