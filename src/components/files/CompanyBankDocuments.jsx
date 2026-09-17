import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DocumentOpenButton from '@/components/files/DocumentOpenButton';
export default function CompanyBankDocuments({ companyId, onUse, busy }) {
  const qc = useQueryClient(), input = React.useRef(null);
  const query = useQuery({ queryKey: ['company-bank-documents', companyId], queryFn: () => base44.entities.Company.get(companyId), enabled: !!companyId });
  const mutate = useMutation({ mutationFn: async ({ file, removeId }) => {
    const company = await base44.entities.Company.get(companyId);
    const docs = company.remittance_documents || [];
    if (removeId) return base44.entities.Company.update(companyId, { remittance_documents: docs.filter(d => d.id !== removeId) });
    if (docs.length >= 50) throw new Error('회사별 송금계좌 자료는 최대 50개입니다.');
    const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
    return base44.entities.Company.update(companyId, { remittance_documents: [...docs, { id: crypto.randomUUID(), file_name: file.name, file_type: file.name.split('.').pop().toLowerCase(), file_uri, uploaded_at: new Date().toISOString() }] });
  }, onSuccess: () => qc.invalidateQueries({ queryKey: ['company-bank-documents', companyId] }) });
  if (!companyId) return <p className="text-xs text-muted-foreground">카드에 고객사를 연결하면 송금계좌 자료를 재사용할 수 있습니다.</p>;
  return <section className="rounded-xl border p-3 space-y-2"><div className="flex flex-wrap justify-between items-center gap-2"><h3 className="text-sm font-semibold">회사 공통 송금계좌 자료</h3><Button type="button" size="sm" variant="outline" disabled={query.isLoading || query.isError || mutate.isPending || busy} onClick={() => input.current?.click()}>{mutate.isPending ? '처리 중...' : '계좌 자료 등록'}</Button></div>
    <p className="text-xs text-muted-foreground">회사에 한 번 등록한 후 카드에 선택하여 연결합니다. 원본은 비공개이며 카드의 고객 노출 설정을 따릅니다. 보관함에서 삭제해도 이미 카드에 연결한 자료는 유지됩니다.</p>
    <Input ref={input} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={e => { const file = e.target.files?.[0]; if (file) mutate.mutate({ file }); e.target.value = ''; }} />
    {query.isLoading ? <p className="text-xs">불러오는 중...</p> : query.isError ? <p role="alert" className="text-xs text-destructive">송금계좌 자료를 불러오지 못했습니다.</p> : !(query.data?.remittance_documents || []).length ? <p className="text-xs text-muted-foreground">등록된 자료가 없습니다.</p> : query.data.remittance_documents.map(doc => <div key={doc.id} className="flex flex-wrap gap-2 items-center rounded-lg bg-muted/30 p-2"><span className="text-sm flex-1 break-all">{doc.file_name}</span><DocumentOpenButton kind="bank" document={{ ...doc, company_id: companyId }} />{onUse && <Button type="button" size="sm" disabled={busy || mutate.isPending} onClick={() => onUse(doc)}>카드에 연결</Button>}<Button type="button" size="sm" variant="ghost" disabled={mutate.isPending || busy} onClick={() => { if (window.confirm('회사 보관함에서 이 계좌 자료를 삭제할까요?')) mutate.mutate({ removeId: doc.id }); }}>삭제</Button></div>)}
    {mutate.isError && <p role="alert" className="text-xs text-destructive">{mutate.error?.response?.data?.error || mutate.error.message}</p>}
  </section>;
}