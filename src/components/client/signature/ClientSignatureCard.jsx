import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, FileSearch, FileSignature } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { withClientView } from '@/lib/clientView';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import VerifyDocumentDialog from '@/components/signature/VerifyDocumentDialog';

const STATUS = {
  OUT: { label: '서명 대기', cls: 'bg-primary/10 text-primary' },
  COMPLETED: { label: '체결', cls: 'bg-muted text-foreground' },
  DECLINED: { label: '수정 요청함', cls: 'bg-warning/10 text-warning-text' },
  EXPIRED: { label: '기한 지남', cls: 'bg-muted text-muted-foreground' },
};
const kstDate = (iso) => (iso ? new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(0, 10).replaceAll('-', '.') : '');

// 고객 대시보드: 전자 계약서 목록(서명 대기·체결)과 문서 확인
export default function ClientSignatureCard({ onOpen }) {
  const [verify, setVerify] = useState(false);
  const { data } = useQuery({
    queryKey: ['client-signatures'],
    queryFn: async () => (await base44.functions.invoke('getSignatureRequest', withClientView({ list: true }))).data,
  });
  const list = data?.requests || [];
  if (!list.length) return null;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-body font-semibold"><FileSignature className="h-4 w-4 text-primary" />전자 계약서</h2>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-label" onClick={() => setVerify(true)}><FileSearch className="h-3.5 w-3.5" />문서 확인</Button>
      </div>
      <ul className="mt-2 space-y-0.5">
        {list.map((r) => {
          const st = STATUS[r.status] || STATUS.OUT;
          return (
            <li key={r.id}>
              <button type="button" onClick={() => onOpen(r.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-body hover:bg-muted">
                <Badge className={`${st.cls} shrink-0 border-0 text-micro`}>{st.label}</Badge>
                <span className="min-w-0 truncate">{r.document_title}</span>
                <span className="ml-auto shrink-0 text-label text-muted-foreground">
                  {r.status === 'COMPLETED' ? `${kstDate(r.completed_at)} 체결` : r.status === 'OUT' ? (r.is_signer ? `기한 ${kstDate(r.due_at)}` : `${r.signer_name}님 서명 대기`) : kstDate(r.created_date)}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          );
        })}
      </ul>
      <VerifyDocumentDialog open={verify} onOpenChange={setVerify} client />
    </Card>
  );
}
