import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Pencil, Trash2, Star, ExternalLink } from 'lucide-react';
import { categoryLabel } from '@/lib/portfolioMeta';

export default function PortfolioRow({ item, onEdit, onDelete, onTogglePublish, onToggleFeature }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-3 p-3 border border-border rounded-lg bg-card">
      <div className="w-full md:w-20 h-14 rounded-md bg-muted overflow-hidden flex-none">
        {item.thumbnail_url ? (
          <img src={item.thumbnail_url} alt={item.title_ko} className="w-full h-full object-cover" />
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold truncate">{item.title_ko}</span>
          <Badge variant="secondary">{categoryLabel(item.category)}</Badge>
          {item.is_featured && <Star className="w-4 h-4 text-amber-500" />}
        </div>
        <div className="text-xs text-muted-foreground truncate">/{item.slug} · {item.summary_ko}</div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          공개
          <Switch checked={!!item.is_published} onCheckedChange={(v) => onTogglePublish(item, v)} />
        </label>
        <Button variant="ghost" size="icon" title="추천 전환" onClick={() => onToggleFeature(item, !item.is_featured)}>
          <Star className={item.is_featured ? 'text-amber-500' : ''} />
        </Button>
        <Button variant="ghost" size="icon" title="공개 페이지" asChild>
          <a href={`/portfolio/${item.slug}`} target="_blank" rel="noreferrer"><ExternalLink /></a>
        </Button>
        <Button variant="outline" size="icon" onClick={() => onEdit(item)}><Pencil /></Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(item)}><Trash2 className="text-destructive" /></Button>
      </div>
    </div>
  );
}