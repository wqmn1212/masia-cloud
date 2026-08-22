import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileSignature, Trash2 } from 'lucide-react';
import { STATUS_LABELS } from './ContractEditor';

export default function ContractList({ contracts, onSelect, onDelete }) {
  if (contracts.length === 0) {
    return (
      <Card className="p-8 text-center">
        <FileSignature className="w-10 h-10 mx-auto text-muted-foreground/40" />
        <p className="mt-3 text-sm text-muted-foreground">저장된 계약서가 없습니다.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {contracts.map(c => (
        <Card key={c.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelect(c)}>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">{STATUS_LABELS[c.status] || '초안'}</Badge>
                <p className="text-sm font-semibold truncate">{c.contract_title}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {c.client_name || '-'} · {c.contract_date || '-'}
                {c.amount_usd ? ` · $${Number(c.amount_usd).toLocaleString()}` : ''}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(c.id)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}