import { format } from 'date-fns';
import { Paperclip } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { leadStatusMeta } from './leadMeta';

export default function LeadRow({ lead, onClick }) {
  const status = leadStatusMeta(lead.status);
  return (
    <tr onClick={onClick} className="cursor-pointer hover:bg-muted/50 transition-colors border-b last:border-0">
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {lead.created_date ? format(new Date(lead.created_date), 'yy.MM.dd HH:mm') : '-'}
      </td>
      <td className="px-4 py-3">
        <div className="font-medium">{lead.company}</div>
        <div className="text-xs text-muted-foreground">{lead.contact_name} · {lead.email}</div>
      </td>
      <td className="px-4 py-3 text-sm hidden md:table-cell">
        <div className="flex flex-wrap gap-1">
          {(lead.categories || []).map((c) => <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>)}
        </div>
      </td>
      <td className="px-4 py-3 text-sm hidden lg:table-cell text-muted-foreground">{lead.quantity || '-'}</td>
      <td className="px-4 py-3 text-sm hidden lg:table-cell">
        {lead.attachments?.length ? (
          <span className="inline-flex items-center gap-1 text-muted-foreground"><Paperclip className="w-3.5 h-3.5" />{lead.attachments.length}</span>
        ) : '-'}
      </td>
      <td className="px-4 py-3 text-xs hidden md:table-cell text-muted-foreground">{lead.assignee_email || '-'}</td>
      <td className="px-4 py-3">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${status.className}`}>{status.label}</span>
      </td>
    </tr>
  );
}