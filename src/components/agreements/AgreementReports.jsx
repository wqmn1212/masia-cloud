import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw, Send, Eye, Pencil } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import MonthlyReportView from '@/components/reports/MonthlyReportView';
import PdfButton from '@/components/reports/PdfButton';
import { generateMonthlyReportPDF } from '@/lib/reportPdf';
import { kstMonth, monthLabel, monthsBetween, shiftMonth } from '@/lib/agreements';

const errorText = (e) => e?.response?.data?.error || e?.message || '처리하지 못했습니다';

function ReportEditor({ report, companyName, onChanged }) {
  const [text, setText] = useState({ highlights: '', next_plan: '' });
  const [busy, setBusy] = useState('');
  const [preview, setPreview] = useState(false);
  useEffect(() => { setText({ highlights: report.highlights || '', next_plan: report.next_plan || '' }); setPreview(report.status === 'PUBLISHED'); }, [report]);
  const published = report.status === 'PUBLISHED';
  const dirty = text.highlights !== (report.highlights || '') || text.next_plan !== (report.next_plan || '');

  const run = async (kind, fn) => {
    setBusy(kind);
    try { await fn(); } catch (e) { toast({ title: '처리하지 못했습니다', description: errorText(e), variant: 'destructive' }); } finally { setBusy(''); }
  };
  const saveText = () => run('save', async () => { const r = await base44.entities.MonthlyReport.update(report.id, text); onChanged({ ...report, ...text, ...r }); toast({ title: '저장했습니다' }); });
  // 쓰던 문구를 먼저 저장한 뒤 숫자만 다시 집계한다 (서버는 문구를 건드리지 않음)
  const rebuild = () => run('build', async () => {
    if (dirty) await base44.entities.MonthlyReport.update(report.id, text);
    const res = await base44.functions.invoke('monthlyReportAction', { action: 'build', company_id: report.company_id, agreement_id: report.agreement_id || undefined, month: report.month });
    onChanged({ ...res.data.report, ...text }); toast({ title: '숫자를 다시 집계했습니다' });
  });
  const publish = () => window.confirm('고객에게 발행하면 고객 대시보드에 보이고 알림이 갑니다. 발행 후에는 숫자를 바꾸지 않습니다. 발행할까요?') && run('publish', async () => {
    if (dirty) await base44.entities.MonthlyReport.update(report.id, text);
    const res = await base44.functions.invoke('monthlyReportAction', { action: 'publish', report_id: report.id });
    onChanged(res.data.report); toast({ title: '고객에게 발행했습니다', description: `알림 ${res.data.sent ?? 0}명` });
  });

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">{monthLabel(report.month)} 리포트</p>
        <Badge className={`border-0 ${published ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>{published ? '발행됨' : '초안'}</Badge>
        <div className="ml-auto flex gap-1.5">
          {!published && <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => setPreview((p) => !p)}>{preview ? <><Pencil className="h-3.5 w-3.5" />편집</> : <><Eye className="h-3.5 w-3.5" />고객 화면 미리보기</>}</Button>}
          {!published && <Button size="sm" variant="outline" className="h-8 gap-1" disabled={!!busy} onClick={rebuild}>{busy === 'build' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}다시 집계</Button>}
        </div>
      </div>
      {preview ? (
        <MonthlyReportView report={{ ...report, ...text }} companyName={companyName} />
      ) : (
        <>
          <MonthlyReportView report={{ ...report, highlights: '', next_plan: '' }} companyName={companyName} />
          <div><Label className="text-xs">이번 달 주요 내용 (발행에 필요)</Label><Textarea rows={4} value={text.highlights} placeholder="예: 샘플 2차 수정 완료, 양산 금형 T1 시사출. 박스 구김 재발 방지를 위해 5겹 골판지로 변경했습니다." onChange={(e) => setText((t) => ({ ...t, highlights: e.target.value }))} /></div>
          <div><Label className="text-xs">다음 달 계획</Label><Textarea rows={3} value={text.next_plan} placeholder="예: 11/18 양산 시작, 11/25 출고 전 검수, 12/2 선적 예정" onChange={(e) => setText((t) => ({ ...t, next_plan: e.target.value }))} /></div>
        </>
      )}
      {!published && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={!!busy || !dirty} onClick={saveText}>저장</Button>
          <Button className="gap-1.5" disabled={!!busy || !text.highlights.trim()} onClick={publish}>{busy === 'publish' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}고객에게 발행</Button>
        </div>
      )}
      {published && <div className="flex items-center gap-2"><p className="flex-1 text-xs text-muted-foreground">{report.published_by_name} · {report.published_at ? new Date(report.published_at).toLocaleString('ko-KR') : ''} 발행</p><PdfButton generate={() => generateMonthlyReportPDF(report, companyName)} /></div>}
    </div>
  );
}

// 계약별 월간 리포트: 초안 만들기(지난 달 기본) · 편집 · 발행
export default function AgreementReports({ agreement }) {
  const qc = useQueryClient();
  const key = ['agreement-reports', agreement.id];
  const { data: reports = [], isLoading } = useQuery({ queryKey: key, queryFn: () => base44.entities.MonthlyReport.filter({ agreement_id: agreement.id }, '-month', 36) });
  const months = agreement.start_date ? monthsBetween(agreement.start_date.slice(0, 7), [kstMonth(), (agreement.end_date || '').slice(0, 7)].filter(Boolean).sort()[0]).reverse() : [];
  const [month, setMonth] = useState('');
  const [openId, setOpenId] = useState(null);
  const [building, setBuilding] = useState(false);
  useEffect(() => { if (!month && months.length) setMonth(months.includes(shiftMonth(kstMonth(), -1)) ? shiftMonth(kstMonth(), -1) : months[0]); }, [months, month]);
  const open = reports.find((r) => r.id === openId);

  const build = async () => {
    setBuilding(true);
    try {
      const res = await base44.functions.invoke('monthlyReportAction', { action: 'build', company_id: agreement.company_id, agreement_id: agreement.id, month });
      await qc.invalidateQueries({ queryKey: key });
      setOpenId(res.data.report.id);
    } catch (e) {
      const id = e?.response?.data?.report_id;
      if (id) setOpenId(id);
      toast({ title: '초안을 만들지 못했습니다', description: errorText(e), variant: 'destructive' });
    } finally {
      setBuilding(false);
    }
  };
  const changed = (r) => { qc.setQueryData(key, (list = []) => list.map((x) => (x.id === r.id ? { ...x, ...r } : x))); };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs">대상 월
          <select className="mt-1 block h-9 rounded-md border bg-background px-2 text-sm" value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </label>
        <Button variant="outline" disabled={!month || building} onClick={build} className="gap-1.5">{building && <Loader2 className="h-4 w-4 animate-spin" />}초안 만들기</Button>
        <p className="text-[11px] text-muted-foreground">매월 1일 지난달 초안이 자동으로 만들어집니다.</p>
      </div>
      {isLoading ? <p className="py-4 text-center text-sm text-muted-foreground">불러오는 중…</p> : (
        <div className="flex flex-wrap gap-1.5">
          {reports.map((r) => (
            <button key={r.id} type="button" onClick={() => setOpenId(r.id)} aria-pressed={openId === r.id}
              className={`rounded-full border px-3 py-1 text-xs ${openId === r.id ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
              {monthLabel(r.month)} · {r.status === 'PUBLISHED' ? '발행됨' : '초안'}
            </button>
          ))}
          {!reports.length && <p className="text-sm text-muted-foreground">아직 리포트가 없습니다.</p>}
        </div>
      )}
      {open && <ReportEditor report={open} companyName={agreement.company_name} onChanged={changed} />}
    </div>
  );
}
