import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { mergeRates } from '@/lib/landedCost';

// 계산기 요율 + 최신 환율. 조회에 실패해도 엔진 기본 요율로 계산은 계속된다.
export default function useLogisticsRates() {
  const { data, isLoading } = useQuery({
    queryKey: ['logistics-rates'],
    staleTime: 1000 * 60 * 10,
    queryFn: async () => (await base44.functions.invoke('getLogisticsRates', {})).data,
    retry: 1,
  });
  const rateDate = data?.rate_date || null;
  // 환율이 일주일 넘게 갱신되지 않았으면 화면에 알린다 (일일 환율 작업이 멈춘 경우)
  const fxStale = !!rateDate && (Date.now() - Date.parse(`${rateDate}T00:00:00+09:00`)) / 864e5 > 7;
  return {
    rates: mergeRates(data?.rates || []),
    dbCount: data?.rates?.length || 0,
    usdKrw: data?.usd_krw || null,
    rateDate,
    fxStale,
    isLoading,
  };
}
