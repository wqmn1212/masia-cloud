import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, Minus, Loader2, ShieldCheck, PauseCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import ClientSpecSection from './ClientSpecSection';

const RESULT = {
  PASS: { label: '합격', cls: 'bg-primary/15 text-primary' },
  CONDITIONAL_PASS: { label: '조건부 합격', cls: 'bg-chart-3/15 text-chart-3' },
  FAIL: { label: '불합격', cls: 'bg-destructive/15 text-destructive' },
};
const ITEM = {
  PASS: { icon: Check, cls: 'text-primary', label: '합격' },
  FAIL: { icon: X, cls: 'text-destructive', label: '불합격' },
  PENDING: { icon: Minus, cls: 'text-muted-foreground', label: '확인 중' },
};
const IMAGE = /\.(jpe?g|png|webp|gif)(\?|$)/i;
const when = (iso) => (iso ? new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : '');
// 샘플 검수는 '샘플 승인'(양산 진행), 양산품 검수는 '출고 승인'
const approveLabel = (r) => (r.inspection_type === 'SAMPLE' ? '샘플 승인' : '출고 승인');
const errorText = (e) => e?.response?.data?.error || e?.message || '처리하지 못했습니다';

function Decision({ cardId, report, canDecide }) {
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const decide = useMutation({
    mutationFn: (decision) => base44.functions.invoke('clientCardAction', { card_id: cardId, action: 'qc_decision', report_id: report.id, decision, note }),
    onSuccess: (_res, decision) => {
      setNote('');
      qc.invalidateQueries({ queryKey: ['client-card-detail', cardId] });
      qc.invalidateQueries({ queryKey: ['client-todos'] });
      toast({ title: decision === 'APPROVED' ? `${approveLabel(report)}을 보냈습니다` : '보류를 요청했습니다', description: '담당자에게 바로 알림이 갑니다.' });
    },
    onError: (e) => toast({ title: '처리하지 못했습니다', description: errorText(e), variant: 'destructive' }),
  });

  if (report.decision === 'APPROVED') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <span className="font-semibold text-primary">{approveLabel(report)}</span>
        <span className="text-muted-foreground">{report.decided_by_name} · {when(report.decided_at)}</span>
      </div>
    );
  }

  const label = approveLabel(report);
  const approve = () => window.confirm(`${label}할까요?\n승인 후에는 바꿀 수 없으며 담당자에게 바로 알림이 갑니다.`) && decide.mutate('APPROVED');
  return (
    <div className="space-y-2 rounded-lg border border-dashed p-3">
      {report.decision === 'ON_HOLD' && (
        <div className="flex gap-2 text-xs">
          <PauseCircle className="h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p><span className="font-semibold text-destructive">보류 요청함</span> <span className="text-muted-foreground">{report.decided_by_name} · {when(report.decided_at)}</span></p>
            {report.decision_note && <p className="mt-0.5 whitespace-pre-wrap">{report.decision_note}</p>}
          </div>
        </div>
      )}
      <p className="text-xs font-semibold">
        {report.decision === 'ON_HOLD'
          ? `확인이 끝나면 ${label}을 눌러 주세요`
          : report.inspection_type === 'SAMPLE' ? '이 샘플로 양산을 진행해도 될까요?' : '이 검수 결과로 출고해도 될까요?'}
      </p>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} disabled={!canDecide || decide.isPending}
        placeholder="보류하실 때는 사유를 적어 주세요 (예: 박스 구김 사진 추가 요청)" className="text-sm" />
      <div className="flex gap-2">
        <Button size="sm" className="flex-1 gap-1" disabled={!canDecide || decide.isPending} onClick={approve}>
          {decide.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}{label}
        </Button>
        <Button size="sm" variant="outline" className="flex-1 gap-1" disabled={!canDecide || decide.isPending || !note.trim()} onClick={() => decide.mutate('ON_HOLD')}>
          <PauseCircle className="h-3.5 w-3.5" />보류 요청
        </Button>
      </div>
      {!canDecide && <p className="text-[11px] text-muted-foreground">승인·보류는 고객사 계정에서만 선택할 수 있습니다.</p>}
    </div>
  );
}

// 담당자가 공개한 검수 결과. 고객은 사진·체크리스트를 보고 승인(샘플·출고) 또는 보류를 선택한다.
export default function ClientQCPanel({ cardId, reports = [], spec = null }) {
  const { user } = useAuth();
  const canDecide = user?.account_tier === 'client';
  if (!reports.length && !spec) {
    return <p className="py-8 text-center text-sm text-muted-foreground">아직 공개된 품질 기준서·검수 결과가 없습니다.<br />양산 전에 기준서를, 출고 전 검수가 끝나면 사진과 함께 결과를 올려 드립니다.</p>;
  }
  return (
    <div className="space-y-4">
      {spec && <ClientSpecSection cardId={cardId} spec={spec} canDecide={canDecide} />}
      {!reports.length && <p className="py-4 text-center text-sm text-muted-foreground">출고 전 검수가 끝나면 사진과 함께 결과를 올려 드립니다.</p>}
      {reports.map((r) => {
        const result = RESULT[r.qc_result] || RESULT.PASS;
        const fails = r.checklist.filter((i) => i.status === 'FAIL').length;
        return (
          <article key={r.id} className="space-y-3 rounded-xl border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">{r.inspection_type === 'SAMPLE' ? '샘플 검수' : '양산품 출고 전 검수'}</p>
              <Badge className={`${result.cls} border-0`}>{result.label}</Badge>
              <span className="ml-auto text-[11px] text-muted-foreground">{r.inspector_name ? `${r.inspector_name} · ` : ''}{when(r.published_at)}</span>
            </div>
            {!!r.checklist.length && (
              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">검수 항목 {r.checklist.length}개{fails ? ` · 불합격 ${fails}개` : ''}</p>
                <ul className="divide-y rounded-lg border">
                  {r.checklist.map((item, i) => {
                    const m = ITEM[item.status] || ITEM.PENDING;
                    const Icon = m.icon;
                    return (
                      <li key={i} className="flex gap-2 px-3 py-2 text-sm">
                        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${m.cls}`} aria-label={m.label} />
                        <div className="min-w-0">
                          <p>{item.label}</p>
                          {item.note && <p className="text-xs text-muted-foreground">{item.note}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {r.comments && <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">{r.comments}</p>}
            {!!r.media.length && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {r.media.map((m) => (
                  <a key={m.url} href={m.url} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-lg border" title={m.name}>
                    {IMAGE.test(m.name) || IMAGE.test(m.url)
                      ? <img src={m.url} alt={m.name} loading="lazy" className="aspect-square w-full object-cover transition group-hover:opacity-90" />
                      : <span className="flex aspect-square items-center justify-center p-2 text-center text-[11px] text-primary underline">{m.name}</span>}
                  </a>
                ))}
              </div>
            )}
            <Decision cardId={cardId} report={r} canDecide={canDecide} />
          </article>
        );
      })}
      {reports.length > 0 && <p className="text-[11px] text-muted-foreground">* 검수는 리포트에 적힌 항목과 수량을 기준으로 합니다. 사진은 눌러서 크게 보실 수 있습니다.</p>}
    </div>
  );
}
