import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import ClientFilesPanel from '@/components/client/ClientFilesPanel';
import CompanyFileFilters from '@/components/files/CompanyFileFilters';
export default function CompanyFilesLibrary({ companyId, onCardClick }) {
  const [filters, setFilters] = React.useState({ card_name: '', document_type: '', from_date: '', to_date: '' }), [offset, setOffset] = React.useState(0);
  const query = useQuery({ queryKey: ['company-files', companyId || 'self', filters, offset], queryFn: async () => (await base44.functions.invoke('listCompanyFiles', { company_id: companyId, ...filters, offset })).data });
  const qc = useQueryClient();
  React.useEffect(() => base44.entities.CardAttachment.subscribe(() => { qc.invalidateQueries({ queryKey: ['company-files'] }); qc.invalidateQueries({ queryKey: ['client-attachments'] }); }), [qc]);
  const cardsById = Object.fromEntries((query.data?.cards || []).map(c => [c.id, c]));
  return <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-base font-semibold">회사별 파일 보관함</h2><Button type="button" size="sm" variant="outline" disabled={query.isFetching} onClick={() => query.refetch()}>새로고침</Button></div>
    <CompanyFileFilters value={filters} onChange={next => { setFilters(next); setOffset(0); }} />
    <p className="text-xs text-muted-foreground">회사에 연결된 카드의 일반 파일과 무역서류를 함께 표시합니다. 업로드 날짜는 한국시간 기준입니다.</p>
    {query.isLoading ? <p className="text-sm py-6">파일을 불러오는 중...</p> : query.isError ? <p role="alert" className="text-sm text-destructive">{query.error?.response?.data?.error || '파일을 불러오지 못했습니다.'}</p> : <ClientFilesPanel attachments={query.data?.attachments || []} cardsById={onCardClick ? cardsById : {}} onCardClick={onCardClick} />}
    <div className="flex justify-end gap-2 items-center text-xs"><Button type="button" variant="outline" size="sm" disabled={offset === 0 || query.isFetching} onClick={() => setOffset(n => Math.max(0, n - 50))}>이전</Button><span>{Math.floor(offset / 50) + 1} 페이지</span><Button type="button" variant="outline" size="sm" disabled={!query.data?.has_more || query.isFetching} onClick={() => setOffset(n => n + 50)}>다음</Button></div>
  </section>;
}