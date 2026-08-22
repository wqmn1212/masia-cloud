import React, { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Pencil, Trash2, ChevronDown } from 'lucide-react';
import { CLAUSE_CATEGORIES } from '@/lib/contractClauses';

export default function ClauseRow({ clause, checked, onToggle, onEdit, onDelete, onToggleFavorite }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start gap-2">
        <Checkbox checked={checked} onCheckedChange={() => onToggle(clause.id)} className="mt-1" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-[10px]">{CLAUSE_CATEGORIES[clause.category] || '기타'}</Badge>
            <p className="text-sm font-semibold truncate">{clause.title}</p>
          </div>
          <p className={expanded ? 'text-xs text-muted-foreground mt-1 whitespace-pre-wrap' : 'text-xs text-muted-foreground mt-1 line-clamp-1'}>
            {clause.body}
          </p>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onToggleFavorite(clause)}>
            <Star className={clause.is_favorite ? 'w-3.5 h-3.5 text-chart-3 fill-chart-3' : 'w-3.5 h-3.5'} />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(v => !v)}>
            <ChevronDown className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(clause)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(clause.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}