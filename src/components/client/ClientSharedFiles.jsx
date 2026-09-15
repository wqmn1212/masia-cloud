import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import ClientFilesPanel from '@/components/client/ClientFilesPanel';

export default function ClientSharedFiles({ cardId }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['client-shared-files', cardId],
    queryFn: async () => (await base44.functions.invoke('getClientCardDetail', { card_id: cardId, include_file_urls: true })).data,
    staleTime: 0, gcTime: 0, refetchInterval: 240000, retry: false,
  });
  if (isLoading) return <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (error) return <div className="text-sm space-y-2" role="alert"><p className="text-destructive">파일을 불러오지 못했습니다.</p><p className="text-xs text-muted-foreground">{error.response?.data?.error || error.message}</p><Button variant="outline" onClick={() => refetch()}>다시 불러오기</Button></div>;
  if (!data?.attachments?.length) return <p className="text-sm text-muted-foreground text-center py-10">담당자가 공개한 파일이 없습니다.</p>;
  return <div className="space-y-2"><p className="text-xs text-muted-foreground">담당자가 공개한 파일과 연결된 공장 소개 자료입니다.</p><ClientFilesPanel attachments={data.attachments} cardsById={{}} onCardClick={() => {}} /></div>;
}