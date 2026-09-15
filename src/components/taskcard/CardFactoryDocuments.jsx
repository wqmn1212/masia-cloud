import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import DocumentOpenButton from '@/components/files/DocumentOpenButton';

export default function CardFactoryDocuments({ card }) {
  const qc = useQueryClient();
  const { data: latest } = useQuery({ queryKey: ['document-card', card.id], queryFn: () => base44.entities.TaskCard.get(card.id) });
  const current = latest || card;
  const ids = [...new Set([current.factory_id, ...(current.candidate_factory_ids || [])].filter(Boolean))];
  const { data: documents = [], isLoading, error } = useQuery({
    queryKey: ['card-factory-documents', card.id, ids, current.tenant_id], enabled: !!ids.length && !!current.tenant_id,
    queryFn: async () => {
      const companies = await base44.entities.Company.filter({ id: { $in: ids }, company_type: 'FACTORY', tenant_id: current.tenant_id });
      if (!companies.length) return [];
      const rows = await base44.entities.FactoryDocument.filter({ company_id: { $in: companies.map(c => c.id) }, tenant_id: current.tenant_id }, 'sort_order', 1000);
      return rows.map(d => ({ ...d, factory_name: companies.find(c => c.id === d.company_id)?.company_name }));
    },
  });
  useEffect(() => {
    const a = base44.entities.FactoryDocument.subscribe(() => qc.invalidateQueries({ queryKey: ['card-factory-documents', card.id] }));
    const b = base44.entities.TaskCard.subscribe(e => { if (e.id === card.id) qc.invalidateQueries({ queryKey: ['document-card', card.id] }); });
    return () => { a(); b(); };
  }, [qc, card.id]);
  return <section className="rounded-lg border bg-card p-3 space-y-2">
    <h3 className="text-sm font-semibold">연결된 공장 소개 자료</h3>
    <p className="text-xs text-muted-foreground">후보·확정 공장의 원본을 참조합니다. 수정·공개 설정은 공장 페이지에서 관리합니다.</p>
    {!ids.length ? <p className="text-xs text-muted-foreground">오버뷰에서 후보 또는 확정 공장을 선택하세요.</p> : isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : error ? <p role="alert" className="text-xs text-destructive">자료를 불러오지 못했습니다.</p> : !documents.length ? <p className="text-xs text-muted-foreground">등록된 공장 소개 자료가 없습니다.</p> : documents.map(doc => <div key={doc.id} className="flex items-center gap-2 border-t pt-2">
      <div className="min-w-0 flex-1"><p className="text-sm truncate">{doc.file_name}</p><Link className="text-xs text-primary underline" to={`/factories?factoryId=${doc.company_id}#factory-${doc.company_id}`}>{doc.factory_name} · 원본 관리</Link></div>
      <span title={doc.client_visible ? '고객 공개' : '고객 비공개'}>{doc.client_visible ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}</span>
      <DocumentOpenButton kind="factory" document={doc} />
    </div>)}
    {!!ids.length && <Link to={`/factories?factoryId=${ids[0]}#factory-${ids[0]}`} className="inline-block text-xs text-primary underline">공장 소개 자료 관리</Link>}
  </section>;
}