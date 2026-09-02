import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { generateQuotationPDF } from '@/lib/generateQuotationPDF';

// 고객 전용 견적 탭 — 화면에 금액 내역을 그리지 않고 PDF 다운로드만 제공한다.
// (원가·마진·수수료 분기를 어드민 탭에 흩어놓지 않기 위해 별도 컴포넌트로 분리)
export default function ClientQuotationTab({ cardId }) {
  const [busyId, setBusyId] = useState(null);

  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ['client-quotations', cardId],
    queryFn: async () => {
      const res = await base44.functions.invoke('listClientQuotations', { card_id: cardId });
      return res.data?.quotations || [];
    },
  });

  const download = async (q) => {
    setBusyId(q.id);
    try {
      await generateQuotationPDF(q.id);
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  if (quotations.length === 0) {
    return (
      <div className="py-10 text-center">
        <FileText className="w-9 h-9 mx-auto text-muted-foreground/40" />
        <p className="mt-3 text-sm text-muted-foreground">아직 발행된 견적서가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {quotations.map((q) => (
        <div key={q.id} className="flex items-center gap-3 border rounded-lg px-4 py-3">
          <FileText className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{q.quote_title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {q.published_at ? format(new Date(q.published_at), 'yyyy.MM.dd') : ''} · {q.final_currency}
              {q.model_name ? ` · ${q.model_name}` : ''}
            </p>
          </div>
          <Button size="sm" variant="outline" disabled={busyId === q.id} onClick={() => download(q)} className="gap-1.5">
            {busyId === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            PDF
          </Button>
        </div>
      ))}
    </div>
  );
}