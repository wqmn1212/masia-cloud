import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, FileImage, FileVideo, FileSpreadsheet, ExternalLink, Inbox } from 'lucide-react';
import { format } from 'date-fns';

const iconFor = (ext) => {
  const e = (ext || '').toLowerCase();
  if (['png','jpg','jpeg','gif','webp','svg'].includes(e)) return FileImage;
  if (['mp4','mov','webm','avi'].includes(e)) return FileVideo;
  if (['xlsx','xls','csv'].includes(e)) return FileSpreadsheet;
  return FileText;
};

export default function ClientFilesPanel({ attachments, cardsById, onCardClick }) {
  if (attachments.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Inbox className="w-12 h-12 mx-auto text-muted-foreground/40" />
        <p className="mt-4 text-lg font-semibold">저장된 파일이 없습니다</p>
        <p className="text-sm text-muted-foreground mt-1">태스크 카드의 파일 탭에서 파일을 업로드하면 여기에 모입니다</p>
      </Card>
    );
  }

  return (
    <Card className="divide-y">
      {attachments.map((file) => {
        const Icon = iconFor(file.file_type);
        const card = cardsById[file.card_id];
        return (
          <div key={file.id} className="flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors">
            <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm truncate">{file.file_name}</span>
                {file.file_type && (
                  <Badge variant="outline" className="text-[10px] uppercase">{file.file_type}</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
                {card && (
                  <button
                    onClick={() => onCardClick(card)}
                    className="hover:text-primary hover:underline truncate max-w-[200px]"
                    title={card.title}
                  >
                    📋 {card.title}
                  </button>
                )}
                {file.uploader_name && <span>· {file.uploader_name}</span>}
                {file.created_date && <span>· {format(new Date(file.created_date), 'yyyy-MM-dd')}</span>}
              </div>
            </div>
            <Button asChild size="sm" variant="ghost" className="h-8">
              <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </Button>
          </div>
        );
      })}
    </Card>
  );
}