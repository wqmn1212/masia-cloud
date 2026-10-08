import React from 'react';
import { Heart, MessageCircle, Send, PlayCircle } from 'lucide-react';

export default function PostPreview({ post }) {
  const first = (post.media || [])[0];
  const Media = () => !first ? <div className="aspect-square bg-muted" /> : first.type === 'video'
    ? <video src={first.url} className="w-full aspect-square object-cover" />
    : <img src={first.url} alt="" className="w-full aspect-square object-cover" />;

  return (
    <div className="space-y-5 lg:sticky lg:top-6 self-start">
      {post.platforms?.includes('instagram') && (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="px-4 py-3 text-sm font-semibold">aegis_trade</div>
          <Media />
          <div className="p-4 space-y-2 text-sm">
            <div className="flex gap-3"><Heart className="w-5 h-5" /><MessageCircle className="w-5 h-5" /><Send className="w-5 h-5" /></div>
            <p className="whitespace-pre-wrap break-words"><b>aegis_trade</b> {post.caption}</p>
            <p className="text-primary break-words">{(post.hashtags || []).map((t) => `#${t}`).join(' ')}</p>
          </div>
        </div>
      )}
      {post.platforms?.includes('youtube') && (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="relative"><Media /><PlayCircle className="absolute inset-0 m-auto w-12 h-12 text-white/90" /></div>
          <div className="p-4">
            <p className="font-semibold text-sm line-clamp-2">{post.youtube_title || '제목 없음'}</p>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">{post.youtube_description}</p>
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground text-center">플랫폼 미리보기</p>
    </div>
  );
}