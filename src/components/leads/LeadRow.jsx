import React from 'react';
import { format } from 'date-fns';
import { Paperclip } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TableRow, TableCell } from '@/components/ui/table';
import { statusMeta } from './leadMeta';

export default function LeadRow({ lead, onClick }) {
  const s = statusMeta(lead.status);
  return (
    <TableRow onClick={onClick} className="cursor-pointer hover:bg-muted/50">
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {lead.created_date ? format(new Date(lead.created_date), 'MM.dd HH:mm') : '-'}
      </TableCell>
      <TableCell className="font-medium">{lead.company}</TableCell>
      <TableCell>{lead.contact_name}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{lead.email}</TableCell>
      <TableCell className="text-sm">
        <div className="flex flex-wrap gap-1">
          {(lead.categories || []).map((c) => <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>)}
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{lead.quantity || '-'}</TableCell>
      <TableCell>
        {lead.attachments?.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Paperclip className="w-3 h-3" />{lead.attachments.length}</span>
        )}
      </TableCell>
      <TableCell><Badge className={`${s.cls} border-0`}>{s.label}</Badge></TableCell>
    </TableRow>
  );
}