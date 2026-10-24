import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, BookmarkPlus } from 'lucide-react';
import CaseLogDialog from '@/components/knowledge/CaseLogDialog';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const META = {
  PASS: { label: '합격', className: 'bg-accent/15 text-accent' },
  CONDITIONAL_PASS: { label: '조건부 합격', className: 'bg-chart-3/15 text-chart-3' },
  FAIL: { label: '불합격', className: 'bg-destructive/15 text-destructive' },
};

const DECISION = {
  APPROVED: { label: '고객 출고 승인', sampleLabel: '고객 샘플 승인', className: 'bg-primary/15 text-primary' },
  ON_HOLD: { label: '고객 보류 요청', sampleLabel: '고객 보류 요청', className: 'bg-destructive/15 text-destructive' },
};

const PUBLISH_CONFIRM = '고객 포털에 이 검수 결과(체크리스트·사진·의견)를 공개합니다.\n\n사진이나 의견에 공장 이름·연락처·간판이 보이지 않는지 먼저 확인하세요.\n공개할까요?';

export default function QCReportHistory({ card, user, reports }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const canShare = card?.client_visible === true && !!card?.client_id;
  // 불합격·조건부 합격은 '사례로 남기기'로 QC 사례에 쌓는다 (다음 프로젝트 사전 점검의 근거)
  const [caseFrom, setCaseFrom] = useState(null);

  const publish = useMutation({
    mutationFn: async ({ report, visible }) => {
      await base44.entities.QCReport.update(report.id, visible
        ? { client_visible: true, client_published_at: new Date().toISOString() }
        : { client_visible: false });
      await base44.entities.ProjectAuditLog.create({ card_id: card.id, event_type: 'QC_PUBLISHED', actor_id: user?.id || '', actor_name: user?.full_name || user?.email || '', details: `${report.inspection_type === 'SAMPLE' ? '샘플' : '양산품'} 검수 결과 고객 ${visible ? '공개' : '공개 취소'}` });
      if (visible) await base44.functions.invoke('notifyCardEvent', { card_id: card.id, type: 'qc_published' }).catch(() => {});
    },
    onSuccess: (_r, { visible }) => {
      queryClient.invalidateQueries({ queryKey: ['qc-reports', card.id] });
      toast({ title: visible ? '고객에게 공개하고 알림을 보냈습니다' : '고객 공개를 취소했습니다' });
    },
    onError: e => toast({ title: '변경하지 못했습니다', description: e.message, variant: 'destructive' }),
  });

  const toggle = (report) => {
    const visible = !report.client_visible;
    if (visible && !window.confirm(PUBLISH_CONFIRM)) return;
    publish.mutate({ report, visible });
  };

  if (!reports.length) return <p className="py-4 text-center text-xs text-muted-foreground">등록된 검수 이력이 없습니다</p>;
  const caseInitial = (r) => {
    const failed = (r.checklist || []).filter((c) => c.status === 'FAIL');
    return { issue_case: failed.map((c) => c.label).join(', ') || (r.inspection_type === 'SAMPLE' ? '샘플 검수 불합격' : '양산 검수 불합격'), root_cause: [r.comments, ...failed.map((c) => c.note)].filter(Boolean).join('\n'), severity: r.qc_result === 'FAIL' ? 'HIGH' : 'MEDIUM', preventable_stage: '' };
  };
  return <div className="space-y-2"><CaseLogDialog open={!!caseFrom} onOpenChange={(v) => !v && setCaseFrom(null)} initial={caseFrom || {}} tenantId={card?.tenant_id} cardId={card?.id} />{reports.map(report => {
    const decision = DECISION[report.client_decision];
    return <div key={report.id} className="rounded-lg border p-3 text-xs">
      <div className="flex items-center gap-2"><span className="font-medium">{report.inspection_type === 'SAMPLE' ? '샘플 검수' : '양산품 검수'}</span><Badge className={`${META[report.qc_result]?.className} border-0`}>{META[report.qc_result]?.label}</Badge>
        {report.client_visible && <Badge variant="outline" className="text-[10px]">고객 공개 중</Badge>}
        {report.qc_result !== 'PASS' && <Button type="button" size="sm" variant="ghost" className={`${canShare ? '' : 'ml-auto '}h-7 gap-1 text-[11px]`} onClick={() => setCaseFrom(caseInitial(report))}><BookmarkPlus className="h-3 w-3" />사례로 남기기</Button>}
        {canShare && <Button type="button" size="sm" variant={report.client_visible ? 'ghost' : 'outline'} className="ml-auto h-7 gap-1 text-[11px]" disabled={publish.isPending} onClick={() => toggle(report)}>
          {report.client_visible ? <><EyeOff className="h-3 w-3" />공개 취소</> : <><Eye className="h-3 w-3" />고객에게 공개</>}
        </Button>}
      </div>
      <p className="mt-1 text-muted-foreground">{report.inspector_name || '검수자 미지정'} · {new Date(report.created_date).toLocaleString('ko-KR')}</p>
      {report.comments && <p className="mt-2 whitespace-pre-wrap">{report.comments}</p>}
      {!!report.media_urls?.length && <div className="mt-2 flex flex-wrap gap-2">{report.media_urls.map((url, i) => <a key={url} href={url} target="_blank" rel="noreferrer" className="text-primary underline">{report.media_names?.[i] || `증빙 ${i + 1}`}</a>)}</div>}
      {decision && <div className="mt-2 rounded-md bg-muted/50 p-2">
        <Badge className={`${decision.className} border-0`}>{report.inspection_type === 'SAMPLE' ? decision.sampleLabel : decision.label}</Badge>
        <span className="ml-2 text-muted-foreground">{report.client_decided_by_name} · {report.client_decided_at ? new Date(report.client_decided_at).toLocaleString('ko-KR') : ''}</span>
        {report.client_decision_note && <p className="mt-1 whitespace-pre-wrap">{report.client_decision_note}</p>}
      </div>}
    </div>;
  })}</div>;
}
