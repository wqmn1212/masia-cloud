import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function useQuotationHistory(quotationId, leftId, rightId) {
  const history = useInfiniteQuery({
    queryKey: ['quotation-history', quotationId], initialPageParam: null,
    queryFn: async ({ pageParam }) => (await base44.functions.invoke('quotationHistory', { action: 'list', quotation_id: quotationId, before_revision: pageParam })).data,
    getNextPageParam: page => page.has_more ? page.revisions.at(-1)?.revision_no : undefined,
  });
  const snapshot = async id => {
    const { data } = await base44.functions.invoke('quotationHistory', { action: 'snapshot', quotation_id: quotationId, revision_id: id });
    const response = await fetch(data.signed_url);
    if (!response.ok) throw new Error('이전 견적 내용을 불러오지 못했습니다.');
    return response.json();
  };
  const rows = history.data?.pages.flatMap(p => p.revisions) || [];
  const selectedLeftId = leftId || rows[0]?.id || 'current';
  const left = useQuery({ queryKey: ['quotation-revision-snapshot', quotationId, selectedLeftId], queryFn: () => snapshot(selectedLeftId), enabled: selectedLeftId !== 'current', staleTime: Infinity });
  const right = useQuery({ queryKey: ['quotation-revision-snapshot', quotationId, rightId], queryFn: () => snapshot(rightId), enabled: !!rightId && rightId !== 'current', staleTime: Infinity });
  const current = history.data?.pages[0]?.current;
  return { history, rows, currentVersion: history.data?.pages[0]?.current_version, before: selectedLeftId === 'current' ? current : left.data, after: rightId === 'current' ? current : right.data, loading: (selectedLeftId !== 'current' && left.isPending) || (rightId !== 'current' && right.isPending), error: left.error || right.error, retry: () => { if (selectedLeftId !== 'current') left.refetch(); if (rightId !== 'current') right.refetch(); } };
}