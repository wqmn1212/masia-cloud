import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw, Send, Trash2, TrendingUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import PerformanceReportView from '@/components/reports/PerformanceReportView';
import PdfButton from '@/components/reports/PdfButton';
import { generatePerformanceReportPDF } from '@/lib/reportPdf';
import { PERF_SECTIONS, periodPresets } from '@/lib/performanceReport';

const errorText = (e) => e?.response?.data?.error || e?.message || '처리하지 못했습니다';
const ALSO = Object.fromEntries(PERF_SECTIONS.flatMap((s) => s.metrics).map((d) => [d.key, d.hideAlso || []]));
const invoke = async (body) => (await base44.functions.invoke('performanceReportAction', body)).data;

function ReportEditor({ report, companyName, canEdit, onChanged, onDeleted }) {
  const [text, setText] = useState({ highlights: '', next_plan: '' });
  const [hidden, setHidden] = useState([]);
  const [busy, setBusy] = useState('');
  useEffect(() => { setText({ highlights: report.highlights || '', next_plan: report.next_plan || '' }); setHidden(report.hidden_metrics || []); }, [report]);
  const published = report.status === 'PUBLISHED';
  const editable = canEdit && !published;
  const dirty = text.highlights !== (report.highlights || '') || text.next_plan !== (report.next_plan || '') || JSON.stringify(hidden) !== JSON.stringify(report.hidden_metrics || []);

  const run = async (kind, fn) => {
    setBusy(kind);
    try { await fn(); } catch (e) { toast({ title: '처리하지 못했습니다', description: errorText(e), variant: 'destructive' }); } finally { setBusy(''); }
  };
  const save = async () => { const r = await invoke({ action: 'save', report_id: report.id, ...text, hidden_metrics: hidden }); onChanged(r.report); return r.report; };
  const toggle = (k) => setHidden((h) => {
    const keys = [k, ...(ALSO[k] || [])];
    return h.includes(k) ? h.filter((x) => !keys.includes(x)) : [...new Set([...h, ...keys])];
  });
  const rebuild = () => run('build', async () => {
    if (dirty) await save();
    const r = await invoke({ action: 'build', company_id: report.company_id, period_start: report.period_start, period_end: report.period_end });
    onChanged(r.report); toast({ title: '숫자를 다시 집계했습니다' });
  });
  const publish = () => window.confirm('고객에게 발행하면 고객 대시보드에 보이고 알림이 갑니다. 발행 후에는 숫자와 문구를 바꾸지 않습니다. 발행할까요?') && run('publish', async () => {
    if (dirty) await save();
    const r = await invoke({ action: 'publish', report_id: report.id });
    onChanged(r.report); toast({ title: '고객에게 발행했습니다', description: `알림 ${r.sent ?? 0}명` });
  });
  const remove = () => window.confirm('이 초안을 지울까요?') && run('delete', async () => { await invoke({ action: 'delete', report_id: report.id }); onDeleted(report.id); });

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">{report.period_label} 리포트</p>
        <Badge className={`border-0 ${published ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>{published ? '발행됨' : '초안'}</Badge>
        {report.generated_at && <span className="text-[11px] text-muted-foreground">집계 {new Date(report.generated_at).toLocaleString('ko-KR')}</span>}
        <div className="ml-auto flex flex-wrap gap-1.5">
          {editable && <Button size="sm" variant="ghost" className="h-8 gap-1 text-muted-foreground" disabled={!!busy} onClick={remove}><Trash2 className="h-3.5 w-3.5" />초안 지우기</Button>}
          {editable && <Button size="sm" variant="outline" className="h-8 gap-1" disabled={!!busy} onClick={rebuild}>{busy === 'build' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}다시 집계</Button>}
          <PdfButton generate={() => generatePerformanceReportPDF({ ...report, ...text }, companyName, hidden)} label={published ? 'PDF로 저장' : 'PDF 미리 저장'} className="h-8" />
        </div>
      </div>
      {editable && (
        <>
          <div><Label className="text-xs">주요 성과 (발행에 필요. 자동으로 쓴 초안을 고쳐 쓰세요)</Label><Textarea rows={5} value={text.highlights} onChange={(e) => setText((t) => ({ ...t, highlights: e.target.value }))} /></div>
          <div><Label className="text-xs">다음 기간 제안</Label><Textarea rows={3} value={text.next_plan} placeholder="예: 라벨기 재주문은 12월 첫 주 발주하면 설 연휴 전에 받을 수 있습니다. 포장재 단가 재협상을 제안드립니다." onChange={(e) => setText((t) => ({ ...t, next_plan: e.target.value }))} /></div>
          <p className="text-[11px] text-muted-foreground">아래 미리보기에서 눈 모양 단추로 고객에게 보이지 않을 숫자를 뺄 수 있습니다. 원가·마진·공장 이름은 처음부터 들어가지 않습니다.</p>
          {hidden.length > 0 && <p className="text-[11px] text-amber-700 dark:text-amber-400">고객 화면에서 뺀 숫자가 있습니다. 주요 성과 문장에 같은 숫자가 남아 있으면 함께 지우세요.</p>}
        </>
      )}
      <div className="rounded-lg border bg-background p-4">
        <PerformanceReportView report={{ ...report, ...text }} companyName={companyName} hidden={hidden} onToggle={editable ? toggle : undefined} />
      </div>
      {editable && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={!!busy || !dirty} onClick={() => run('save', async () => { await save(); toast({ title: '저장했습니다' }); })}>저장</Button>
          <Button className="gap-1.5" disabled={!!busy || !text.highlights.trim()} onClick={publish}>{busy === 'publish' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}고객에게 발행</Button>
        </div>
      )}
      {published && <p className="text-xs text-muted-foreground">{report.published_by_name} · {report.published_at ? new Date(report.published_at).toLocaleString('ko-KR') : ''} 발행</p>}
    </div>
  );
}

// 고객사 프로필 '성과 리포트' 탭: 기간 고르기 → 초안 → 고쳐 쓰기·숫자 빼기 → 발행·PDF
export default function ClientPerformanceReports({ companyId, companyName }) {
  const { user } = useAuth();
  const canEdit = ['master', 'service'].includes(user?.account_tier);
  const qc = useQueryClient();
  const key = ['performance-reports', companyId];
  const { data: reports = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => (await base44.entities.PerformanceReport.filter({ company_id: companyId }, '-period_end', 40)).filter((r) => r.company_id === companyId),
  });
  const presets = useMemo(() => periodPresets(), []);
  const [preset, setPreset] = useState(presets[0].key);
  const [custom, setCustom] = useState({ start: presets[0].range[0], end: presets[0].range[1] });
  const range = preset === 'custom' ? [custom.start, custom.end] : presets.find((p) => p.key === preset).range;
  const [openId, setOpenId] = useState(null);
  const [building, setBuilding] = useState(false);
  useEffect(() => { if (!openId && reports.length) setOpenId(reports[0].id); }, [reports, openId]);
  const open = reports.find((r) => r.id === openId);

  const build = async () => {
    setBuilding(true);
    try {
      const r = await invoke({ action: 'build', company_id: companyId, period_start: range[0], period_end: range[1] });
      await qc.invalidateQueries({ queryKey: key });
      setOpenId(r.report.id);
    } catch (e) {
      const id = e?.response?.data?.report_id;
      if (id) setOpenId(id);
      toast({ title: '초안을 만들지 못했습니다', description: errorText(e), variant: 'destructive' });
    } finally { setBuilding(false); }
  };
  const changed = (r) => qc.setQueryData(key, (list = []) => list.map((x) => (x.id === r.id ? { ...x, ...r } : x)));
  const deleted = (id) => { qc.setQueryData(key, (list = []) => list.filter((x) => x.id !== id)); setOpenId(null); };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4">
        <div className="flex items-start gap-2">
          <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold">고객 성과 리포트</p>
            <p className="text-xs text-muted-foreground">분기·반기·연간 단위로 진행 품목, 견적 속도, 검토한 공장 수, 비교 견적 절감률, 일정 준수, 검수·불량·보상을 숫자로 정리합니다. 재계약·추가 품목 영업 자료로 쓰세요.</p>
          </div>
        </div>
        {canEdit && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs">기간
              <select className="mt-1 block h-9 rounded-md border bg-background px-2 text-sm" value={preset} onChange={(e) => setPreset(e.target.value)}>
                {presets.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                <option value="custom">직접 고르기</option>
              </select>
            </label>
            {preset === 'custom' && (
              <>
                <label className="text-xs">시작<Input type="date" className="mt-1 h-9 w-40" value={custom.start} onChange={(e) => setCustom((c) => ({ ...c, start: e.target.value }))} /></label>
                <label className="text-xs">끝<Input type="date" className="mt-1 h-9 w-40" value={custom.end} onChange={(e) => setCustom((c) => ({ ...c, end: e.target.value }))} /></label>
              </>
            )}
            <Button variant="outline" disabled={building || !range[0] || !range[1] || range[0] > range[1]} onClick={build} className="gap-1.5">{building && <Loader2 className="h-4 w-4 animate-spin" />}초안 만들기</Button>
          </div>
        )}
      </div>
      {isLoading ? <p className="py-4 text-center text-sm text-muted-foreground">불러오는 중…</p> : (
        <div className="flex flex-wrap gap-1.5">
          {reports.map((r) => (
            <button key={r.id} type="button" onClick={() => setOpenId(r.id)} aria-pressed={openId === r.id}
              className={`rounded-full border px-3 py-1 text-xs ${openId === r.id ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
              {r.period_label} · {r.status === 'PUBLISHED' ? '발행됨' : '초안'}
            </button>
          ))}
          {!reports.length && <p className="text-sm text-muted-foreground">아직 리포트가 없습니다.{canEdit ? ' 기간을 고르고 초안을 만드세요.' : ''}</p>}
        </div>
      )}
      {open && <ReportEditor report={open} companyName={companyName} canEdit={canEdit} onChanged={changed} onDeleted={deleted} />}
    </div>
  );
}
