import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// 고객 포털 카드 목록. RLS 상 고객은 TaskCard 를 직접 조회할 수 없으므로 전용 함수 경로만 사용한다.
export default function useClientCards() {
  return useQuery({
    queryKey: ['client-cards'],
    queryFn: async () => {
      const res = await base44.functions.invoke('listClientCards', {});
      return res.data?.cards || [];
    },
    refetchInterval: 30000,
  });
}