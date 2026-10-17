import React, { useState } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { withClientView } from '@/lib/clientView';
import { downloadCsv, fileDate } from '@/lib/csv';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

const HEADERS = ['프로젝트', '단계', '우선순위', '카테고리', '예정 납품일', '진행', '다음 단계', '다음 예정일', '품질 기준서', '최근 검수', '선적', '최근 업데이트'];
const KEYS = ['title', 'status', 'priority', 'category', 'delivery_date', 'progress', 'next_step', 'next_date', 'quality_spec', 'last_qc', 'shipment', 'updated'];

// 고객 사내 보고용: 공개된 프로젝트 현황을 엑셀(CSV)로 내려받는다
export default function ClientExportButton({ size = 'sm', className = '' }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('exportClientProjects', withClientView());
      const rows = res.data?.rows || [];
      if (!rows.length) return toast({ title: '내보낼 프로젝트가 없습니다' });
      downloadCsv(`AEGIS_Projects_${fileDate()}`, HEADERS, rows.map((r) => KEYS.map((k) => r[k])));
    } catch (e) {
      toast({ title: '내보내지 못했습니다', description: e?.response?.data?.error || e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button type="button" variant="outline" size={size} className={`gap-1.5 ${className}`} disabled={busy} onClick={run}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}엑셀로 내보내기
    </Button>
  );
}
