import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Star, ExternalLink, MessageSquare } from 'lucide-react';
import { categoryLabel, PORTFOLIO_REGIONS, statusOf } from '@/lib/portfolioMeta';
import PortfolioStatusActions from './PortfolioStatusActions';
import PortfolioConsent from './PortfolioConsent';

export default function PortfolioRow({ item, onEdit, onDelete, canPublish, onSetStatus, onToggleFeature, onPatch, onRequestEdit }) {
  const region = PORTFOLIO_REGIONS.find((r) => r.value === item.region)?.label;
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
          {!item.consent_confirmed && <Badge variant="outline" className="border-amber-300 text-amber-700">동의 미확인</Badge>}
        </div>
        <div className="text-xs text-muted-foreground truncate">/{item.slug}{region ? ` · ${region}` : ''}{item.project_year ? ` · ${item.project_year}` : ''} · {item.summary_ko}</div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {canPublish && statusOf(item) !== 'draft' && <PortfolioConsent item={item} onPatch={onPatch} />}
        <PortfolioStatusActions item={item} canPublish={canPublish} onSetStatus={onSetStatus} />
        <Button variant="ghost" size="icon" title="추천 전환" onClick={() => onToggleFeature(item, !item.is_featured)}>
          <Star className={item.is_featured ? 'text-amber-500' : ''} />
        </Button>
        {item.slug ? (
          <Button variant="ghost" size="icon" title="공개 페이지" asChild>
            <a href={`/portfolio/${item.slug}`} target="_blank" rel="noreferrer"><ExternalLink /></a>
          </Button>
        ) : (
          <Button variant="ghost" size="icon" title="주소가 없습니다" disabled><ExternalLink /></Button>
        )}
        {!canPublish && statusOf(item) === 'published' ? (
          <Button variant="outline" size="sm" onClick={() => onRequestEdit(item)}><MessageSquare /> 수정 요청</Button>
        ) : (
          <Button variant="outline" size="icon" onClick={() => onEdit(item)}><Pencil /></Button>
        )}
        <Button variant="ghost" size="icon" onClick={() => onDelete(item)}><Trash2 className="text-destructive" /></Button>
      </div>
    </div>
  );
}