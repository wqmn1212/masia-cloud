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
      <TableCell className="text-caption text-muted-foreground whitespace-nowrap">
        {lead.created_date ? format(new Date(lead.created_date), 'MM.dd HH:mm') : '-'}
      </TableCell>
      <TableCell className="font-medium">
        {lead.company}
        {lead.source === 'sketch_tool' && <Badge className="ml-2 border-0 bg-primary/10 text-primary hover:bg-primary/10 text-micro">스케치 시안{lead.sketch_trial?.inquired_at ? ' · 견적 문의' : ''}</Badge>}
      </TableCell>
      <TableCell>{lead.contact_name}</TableCell>
      <TableCell className="text-body text-muted-foreground">{lead.email}</TableCell>
      <TableCell className="text-body">
        <div className="flex flex-wrap gap-1">
          {(lead.categories || []).map((c) => <Badge key={c} variant="outline" className="text-micro">{c}</Badge>)}
        </div>
      </TableCell>
      <TableCell className="text-body text-muted-foreground">{lead.quantity || '-'}</TableCell>
      <TableCell>
        {lead.attachments?.length > 0 && (
          <span className="inline-flex items-center gap-1 text-caption text-muted-foreground"><Paperclip className="w-3 h-3" />{lead.attachments.length}</span>
        )}
      </TableCell>
      <TableCell><Badge className={`${s.cls} border-0`}>{s.label}</Badge></TableCell>
    </TableRow>
  );
}