import { useRef } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useFactoryDocuments from '@/components/factory/useFactoryDocuments';
import FactoryDocumentRow from '@/components/factory/FactoryDocumentRow';

export default function FactoryDocumentsPanel({ factory }) {
  const input = useRef(null);
  const { documents, mutation, canUpload, canManage, isLoading, error, refetch } = useFactoryDocuments(factory);
  return <section className="space-y-3 pt-2">
    <p className="text-xs text-muted-foreground">원본 자료를 한 곳에서 관리합니다. 교체·삭제·순서 변경은 이 공장을 참조하는 모든 카드에 반영됩니다.</p>
    <p className="text-xs text-muted-foreground">고객 공개를 켜면 이 공장이 후보·확정 공장인 모든 공개 카드에서 해당 고객사가 볼 수 있습니다.</p>
    {!canManage && <p className="text-xs text-muted-foreground">팀원은 자료 등록·열람이 가능하며 공개 설정·교체·삭제·정렬은 관리자에게 요청하세요.</p>}
    <Button size="sm" variant="outline" disabled={!canUpload || mutation.isPending} onClick={() => input.current?.click()}>{mutation.isPending ? <Loader2 className="animate-spin" /> : <Upload />}소개 자료 업로드</Button>
    <input ref={input} type="file" multiple className="hidden" onChange={e => { const files = Array.from(e.target.files || []); if (files.length) mutation.mutate({ action: 'upload', files }); e.target.value = ''; }} />
    {!factory.tenant_id && <p className="text-xs text-destructive">공장의 소속 팀 정보가 없어 업로드할 수 없습니다.</p>}
    {mutation.isError && <p role="alert" className="text-xs text-destructive">저장 실패: {mutation.error?.response?.data?.error || mutation.error.message}</p>}
    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : error ? <div role="alert"><p className="text-xs text-destructive">자료를 불러오지 못했습니다.</p><Button size="sm" variant="ghost" onClick={() => refetch()}>다시 불러오기</Button></div> : documents.length === 0 ? <p className="text-sm text-muted-foreground py-4">등록된 소개 자료가 없습니다.</p> : documents.map((doc, index) => <FactoryDocumentRow key={doc.id} doc={doc} index={index} count={documents.length} canManage={canManage} busy={mutation.isPending} onAction={mutation.mutate} />)}
  </section>;
}