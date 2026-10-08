import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { PLATFORMS, FORMATS, STATUS, validatePost, splitTags } from './marketingMeta';
import MediaManager from './MediaManager';
import PostPreview from './PostPreview';
import PostWorkflowActions from './PostWorkflowActions';

export default function PostEditor({ post, user, onSaved, onNew }) {
  const [p, setP] = useState({ platforms: ['instagram'], post_format: 'feed', status: 'draft', media: [], hashtags: [], youtube_tags: [], ...post });
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setP((s) => ({ ...s, [k]: v }));
  const errors = validatePost(p);
  const locked = p.status === 'published';

  const save = async (patch = {}) => {
    setSaving(true);
    const data = { ...p, ...patch, tenant_id: p.tenant_id || user?.tenant_id };
    const { id, created_date, updated_date, created_by_id, ...body } = data;
    const saved = id ? await base44.entities.MarketingPost.update(id, body) : await base44.entities.MarketingPost.create(body);
    setP(saved); setSaving(false); onSaved(saved);
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
            <div><Label>해시태그 ({p.hashtags.length}/30)</Label><Input className="mt-1.5" defaultValue={p.hashtags.map((t) => `#${t}`).join(' ')} onBlur={(e) => set('hashtags')(splitTags(e.target.value))} /></div>
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
        <PostWorkflowActions post={p} user={user} errors={errors} saving={saving} save={save} />
      </div>
      <PostPreview post={p} />
    </div>
  );
}