import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileCheck2, Loader2, MessageSquareWarning } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { SEVERITY, SPEC_DECISION, aqlLine } from '@/lib/qualitySpec';

const when = (iso) => (iso ? new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : '');

function Photo({ url, ok }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block w-20 shrink-0 text-center">
      <img src={url} alt={ok ? '허용 예시' : '불허 예시'} loading="lazy" className={`aspect-square w-20 rounded-md border-2 object-cover ${ok ? 'border-primary/50' : 'border-destructive/50'}`} />
      <span className={`text-[10px] ${ok ? 'text-primary' : 'text-destructive'}`}>{ok ? '이 정도는 합격' : '이러면 불량'}</span>
    </a>
  );
}

// 고객 포털: 양산 전에 정한 품질 기준서를 보고 승인하거나 수정을 요청한다.
export default function ClientSpecSection({ cardId, spec, canDecide }) {
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const decide = useMutation({
    mutationFn: (decision) => base44.functions.invoke('clientCardAction', { card_id: cardId, action: 'spec_decision', spec_id: spec.id, decision, note }),
    onSuccess: (_r, decision) => {
      setNote('');
      qc.invalidateQueries({ queryKey: ['client-card-detail', cardId] });
      qc.invalidateQueries({ queryKey: ['client-todos'] });
      toast({ title: decision === 'APPROVED' ? '기준서를 승인했습니다' : '수정을 요청했습니다', description: '담당자에게 바로 알림이 갑니다.' });
    },
    onError: (e) => toast({ title: '처리하지 못했습니다', description: e?.response?.data?.error || e.message, variant: 'destructive' }),
  });
  const d = SPEC_DECISION[spec.decision] || SPEC_DECISION.PENDING;
  const approve = () => window.confirm('이 기준으로 양산 검수를 진행합니다. 승인할까요?') && decide.mutate('APPROVED');

  return (
    <article className="space-y-3 rounded-xl border border-primary/30 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <FileCheck2 className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">품질 기준서 <span className="font-normal text-muted-foreground">v{spec.version}</span></p>
        <Badge className={`${d.cls} border-0`}>{d.label}</Badge>
        {spec.factory_confirmed && <Badge variant="outline" className="text-[10px]">공장 확인 완료</Badge>}
        <span className="ml-auto text-[11px] text-muted-foreground">{when(spec.sent_at)}</span>
      </div>
      <p className="text-xs text-muted-foreground">양산 전에 합격·불량 기준을 정해 두면, 출고 전 검수와 입고 후 확인을 같은 기준으로 할 수 있습니다.</p>
      <p className="rounded-md bg-muted/50 px-3 py-2 text-xs">{aqlLine(spec)}{spec.sampling_note ? <><br />{spec.sampling_note}</> : null}</p>
      <ul className="divide-y rounded-lg border">
        {spec.items.map((i) => (
          <li key={i.key || i.label} className="flex gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Badge className={`border-0 ${SEVERITY[i.severity]?.cls}`} title={SEVERITY[i.severity]?.hint}>{SEVERITY[i.severity]?.label}</Badge>
                <p className="text-sm font-medium">{i.label}</p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{i.standard}</p>
            </div>
            <Photo url={i.ok_photo_url} ok />
            <Photo url={i.ng_photo_url} ok={false} />
          </li>
        ))}
      </ul>
      {spec.note && <p className="whitespace-pre-wrap text-xs">{spec.note}</p>}
      {spec.decision === 'APPROVED' && <p className="text-xs text-primary">{spec.decided_by_name} · {when(spec.decided_at)} 승인</p>}
      {spec.decision === 'REVISION_REQUESTED' && (
        <p className="flex gap-1.5 text-xs"><MessageSquareWarning className="h-4 w-4 shrink-0 text-destructive" /><span><b>수정 요청함</b> · {spec.comment} <span className="text-muted-foreground">({when(spec.decided_at)}) 담당자가 고쳐서 다시 보내 드립니다.</span></span></p>
      )}
      {spec.decision === 'PENDING' && (
        <div className="space-y-2 rounded-lg border border-dashed p-3">
          <p className="text-xs font-semibold">이 기준으로 검수해도 될까요?</p>
          <Textarea rows={2} maxLength={1000} value={note} disabled={!canDecide || decide.isPending} onChange={(e) => setNote(e.target.value)}
            placeholder="고칠 점이 있으면 적어 주세요 (예: 단상자 모서리 찍힘은 1mm까지 허용)" className="text-sm" />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 gap-1" disabled={!canDecide || decide.isPending} onClick={approve}>{decide.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}기준서 승인</Button>
            <Button size="sm" variant="outline" className="flex-1" disabled={!canDecide || decide.isPending || !note.trim()} onClick={() => decide.mutate('REVISION_REQUESTED')}>수정 요청</Button>
          </div>
          {!canDecide && <p className="text-[11px] text-muted-foreground">승인·수정 요청은 고객사 계정에서만 선택할 수 있습니다.</p>}
        </div>
      )}
    </article>
  );
}
