import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Building2, ExternalLink, FileText, FileImage, FileVideo, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';

const iconFor = (ext) => {
  const e = (ext || '').toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(e)) return FileImage;
  if (['mp4', 'mov', 'webm', 'avi'].includes(e)) return FileVideo;
  if (['xlsx', 'xls', 'csv'].includes(e)) return FileSpreadsheet;
  return FileText;
};

export default function ClientFileGroup({ clientName, files, cardsById, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors text-left">
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <Building2 className="w-4 h-4" />
        </div>
        <span className="font-semibold flex-1 truncate">{clientName}</span>
        <Badge variant="outline" className="text-[11px]">파일 {files.length}개</Badge>
      </button>

      {open && (
        <div className="divide-y border-t">
          {files.map((file) => {
            const Icon = iconFor(file.file_type);
            const card = cardsById[file.card_id];
            return (
              <div key={file.id} className="flex items-center gap-3 px-4 py-2.5">
                <Icon className="w-4 h-4 text-accent flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.file_name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {card ? `📋 ${card.title}` : '카드 없음'}
                    {file.uploader_name ? ` · ${file.uploader_name}` : ''}
                    {file.created_date ? ` · ${format(new Date(file.created_date), 'yyyy-MM-dd')}` : ''}
                  </p>
                </div>
                <Button asChild size="sm" variant="ghost" className="h-8">
                  <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}