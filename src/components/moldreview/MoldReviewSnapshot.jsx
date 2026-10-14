import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function MoldReviewSnapshot({ reviewId }) {
  const { user } = useAuth();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['mold-review-snapshot', user?.id, reviewId],
    enabled: !!user?.id && !!reviewId,
    queryFn: async () => {
      const response = await base44.functions.invoke('getDocumentAccess', { kind: 'mold_review', document_id: reviewId });
      if (!response.data?.url) throw new Error('캡처를 불러오지 못했습니다.');
      return response.data.url;
    },
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 240000,
    retry: false,
  });
  if (isLoading) return <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />캡처 접근 권한 확인 중...</p>;
  if (error) return <div className="space-y-2 text-xs text-destructive"><p>{error.response?.data?.error || '캡처를 불러오지 못했습니다.'}</p><Button size="sm" variant="outline" disabled={isFetching} onClick={() => refetch()}>다시 불러오기</Button></div>;
  return data ? <img src={data} alt="검토 화면" className="w-full rounded-lg border" /> : null;
}