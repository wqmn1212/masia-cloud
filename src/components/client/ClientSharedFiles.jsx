import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { withClientView } from '@/lib/clientView';
import { Button } from '@/components/ui/button';
import ClientFilesPanel from '@/components/client/ClientFilesPanel';
import ClientFileUploader from '@/components/client/ClientFileUploader';

export default function ClientSharedFiles({ cardId }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['client-shared-files', cardId],
    queryFn: async () => (await base44.functions.invoke('getClientCardDetail', withClientView({ card_id: cardId }))).data,
    staleTime: 0, gcTime: 0, retry: false,
  });

  let body;
  if (isLoading) body = <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  else if (error) body = <div className="text-sm space-y-2" role="alert"><p className="text-destructive">파일을 불러오지 못했습니다.</p><p className="text-xs text-muted-foreground">{error.response?.data?.error || error.message}</p><Button variant="outline" onClick={() => refetch()}>다시 불러오기</Button></div>;
  else if (!data?.attachments?.length) body = <p className="text-sm text-muted-foreground text-center py-8">아직 파일이 없습니다.</p>;
  else body = <ClientFilesPanel attachments={data.attachments} cardsById={{}} onCardClick={() => {}} />;

  return (
    <div className="space-y-3">
      <ClientFileUploader cardId={cardId} />
      <p className="text-xs text-muted-foreground">업로드한 파일과 담당자가 공개한 파일이 함께 표시됩니다.</p>
      {body}
    </div>
  );
}