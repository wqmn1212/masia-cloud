import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { withClientView } from '@/lib/clientView';

// 고객 대시보드 데이터: 할 일 · 2주 일정 · 주문 현황판 요약과 순서 · 입고 달력. 할 일 카드와 현황판이 같은 조회를 나눠 쓴다.
export default function useClientOverview() {
  return useQuery({
    queryKey: ['client-todos'],
    queryFn: async () => (await base44.functions.invoke('listClientTodos', withClientView())).data,
    refetchInterval: 60000,
  });
}
