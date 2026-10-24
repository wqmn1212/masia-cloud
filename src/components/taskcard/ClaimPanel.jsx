import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertOctagon, Copy, BookmarkPlus } from 'lucide-react';
import CaseLogDialog from '@/components/knowledge/CaseLogDialog';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import DocumentOpenButton from '@/components/files/DocumentOpenButton';
import { CLAIM_RESOLUTION, CLAIM_STATUS, claimDocCn } from '@/lib/claims';

const sel = 'h-8 w-full rounded-md border bg-background px-2 text-xs';
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '');

function ClaimEditor({ claim, card, user, photos, spec, qc, onSaved }) {
  const pick = (c) => ({ status: c.status || 'SUBMITTED', resolution: c.resolution && c.resolution !== 'PENDING' ? c.resolution : '', client_message: c.client_message || '', factory_response: c.factory_response || '' });
  const [f, setF] = useState(() => pick(claim));
  const [caseOpen, setCaseOpen] = useState(false);
  useEffect(() => { setF(pick(claim)); }, [claim.id, claim.updated_date]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const dirty = JSON.stringify(f) !== JSON.stringify(pick(claim));
  const mine = photos.filter((p) => (claim.photo_ids || []).includes(p.id));
  const save = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      const by = user?.full_name || user?.email || '';
      const statusChanged = f.status !== (claim.status || 'SUBMITTED');
      const notify = statusChanged || f.client_message !== (claim.client_message || '') || f.resolution !== (claim.resolution && claim.resolution !== 'PENDING' ? claim.resolution : '');
      await base44.entities.QualityClaim.update(claim.id, {
        ...f, resolution: f.resolution || 'PENDING',
        ...(f.status === 'RESOLVED' && !claim.resolved_at ? { resolved_at: now } : {}),
        history: [...(claim.history || []), ...(notify ? [{ at: now, status: f.status, by, note: f.client_message }] : [])],
      });
      if (notify) {
        const msg = [`${claim.title}: ${CLAIM_STATUS[f.status]}${f.resolution ? ` · ${CLAIM_RESOLUTION[f.resolution]}` : ''}`, f.client_message].filter(Boolean).join('\n');
        await base44.functions.invoke('notifyCardEvent', { card_id: card.id, type: 'claim_updated', message: msg }).catch(() => {});
      }
      return notify;
    },
    onSuccess: (notified) => { toast({ title: '불량 신고 처리 내용을 저장했습니다', description: notified ? '고객에게 처리 상황을 알렸습니다.' : undefined }); onSaved(); },
    onError: (e) => toast({ title: '저장하지 못했습니다', description: e.message, variant: 'destructive' }),
  });
  const copyCn = async () => {
    await navigator.clipboard.writeText(claimDocCn({ card, claim, spec, qc, photoCount: mine.length }));
    toast({ title: '중국어 클레임 문서를 복사했습니다', description: '위챗·이메일에 붙여 넣고 사진을 함께 보내 주세요.' });
  };

  return (
    <li className="space-y-2.5 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm font-semibold">{claim.title}</p>
        <Badge variant="outline">{CLAIM_STATUS[claim.status || 'SUBMITTED']}</Badge>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={copyCn}><Copy className="h-3 w-3" />중국어 클레임 문서</Button>
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setCaseOpen(true)}><BookmarkPlus className="h-3 w-3" />사례로 남기기</Button>
      </div>
      <CaseLogDialog open={caseOpen} onOpenChange={setCaseOpen} tenantId={card.tenant_id} cardId={card.id}
        initial={{ issue_case: claim.title, root_cause: [claim.description, f.factory_response].filter(Boolean).join('\n'), solution_parameter: f.resolution ? CLAIM_RESOLUTION[f.resolution] : '', severity: 'HIGH' }} />
      <p className="whitespace-pre-wrap text-xs">{claim.description}</p>
      {claim.description_cn && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{claim.description_cn}</p>}
      <p className="text-[11px] text-muted-foreground">{fmtDate(claim.submitted_at || claim.created_date)} {claim.submitted_by_name} 접수{claim.defect_qty != null ? ` · 불량 ${claim.defect_qty}개${claim.received_qty ? ` / ${claim.received_qty}개` : ''}` : ''}{claim.lot_note ? ` · ${claim.lot_note}` : ''}</p>
      {!!mine.length && <div className="flex flex-wrap gap-1">{mine.map((p) => <span key={p.id} className="flex items-center rounded-md border pl-2 text-[11px]">{p.file_name}<DocumentOpenButton document={p} /></span>)}</div>}
      <div className="grid gap-2 border-t pt-2.5 sm:grid-cols-2">
        <label className="space-y-1 text-[11px]"><span>처리 단계</span><select className={sel} value={f.status} onChange={set('status')}>{Object.entries(CLAIM_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="space-y-1 text-[11px]"><span>처리 방법</span><select className={sel} value={f.resolution} onChange={set('resolution')}><option value="">미정</option>{Object.entries(CLAIM_RESOLUTION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="space-y-1 text-[11px]"><span>고객 안내 (고객에게 보임)</span><Textarea rows={2} className="text-xs" value={f.client_message} onChange={set('client_message')} placeholder="예: 공장이 원인을 확인했고, 불량 120개는 다음 선적에 재생산분으로 보냅니다." /></label>
        <label className="space-y-1 text-[11px]"><span>공장 회신 (내부)</span><Textarea rows={2} className="text-xs" value={f.factory_response} onChange={set('factory_response')} placeholder="공장 원인 분석·대책" /></label>
      </div>
      <div className="flex justify-end"><Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>{save.isPending ? '저장 중…' : '저장'}</Button></div>
    </li>
  );
}

// 고객 불량 신고(클레임) 처리: 단계·처리 방법·고객 안내, 기준서·검수 기록을 묶은 중국어 클레임 문서
export default function ClaimPanel({ card, user }) {
  const qc = useQueryClient();
  const key = ['quality-claims', card.id];
  const { data: claims = [] } = useQuery({ queryKey: key, queryFn: () => base44.entities.QualityClaim.filter({ card_id: card.id }, '-created_date', 50) });
  const has = claims.length > 0;
  const { data: photos = [] } = useQuery({ queryKey: ['claim-photos', card.id], queryFn: () => base44.entities.CardAttachment.filter({ card_id: card.id, document_type: 'CLAIM_PHOTO' }, '-created_date', 100), enabled: has });
  const { data: specs = [] } = useQuery({ queryKey: ['claim-spec', card.id], queryFn: () => base44.entities.QualitySpec.filter({ card_id: card.id, status: 'SENT' }, '-version', 1), enabled: has });
  const { data: reports = [] } = useQuery({ queryKey: ['claim-qc', card.id], queryFn: () => base44.entities.QCReport.filter({ card_id: card.id }, '-created_date', 5), enabled: has });
  const open = claims.filter((c) => !['RESOLVED', 'REJECTED'].includes(c.status)).length;
  return (
    <section className="mt-6 space-y-3 rounded-xl border p-3">
      <div className="flex items-center gap-2">
        <AlertOctagon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">고객 불량 신고</h3>
        {open > 0 && <Badge className="border-0 bg-destructive/10 text-destructive">처리 중 {open}</Badge>}
      </div>
      {!has ? <p className="text-xs text-muted-foreground">고객이 포털 검수 탭에서 불량을 신고하면 여기에 표시됩니다.</p> : (
        <ul className="space-y-2">
          {claims.map((c) => <ClaimEditor key={c.id} claim={c} card={card} user={user} photos={photos} spec={specs[0]} qc={reports.find((r) => r.inspection_type !== 'SAMPLE') || reports[0]} onSaved={() => qc.invalidateQueries({ queryKey: key })} />)}
        </ul>
      )}
    </section>
  );
}
