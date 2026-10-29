import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertOctagon, Copy, BookmarkPlus, Clock, Gift } from 'lucide-react';
import CaseLogDialog from '@/components/knowledge/CaseLogDialog';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import DocumentOpenButton from '@/components/files/DocumentOpenButton';
import { CLAIM_RESOLUTION, CLAIM_STATUS, claimDocCn } from '@/lib/claims';
import { Input } from '@/components/ui/input';
import { factoryWait, compensationPatch, compensationState, PROMISE_KINDS, FACTORY_REPLY_DAYS } from '@/lib/claimTracking';

const sel = 'h-8 w-full rounded-md border bg-background px-2 text-xs';
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '');

// 보상 약속(재생산·다음 발주 할인)과 다음 주문 반영. 반영할 카드는 같은 고객사의 다른 카드에서 고른다
function CompensationEditor({ claim, card, user, resolution, onSaved }) {
  const c = claim.compensation || {};
  const [v, setV] = useState({ amount: c.amount ?? '', currency: c.currency || 'KRW', note: c.note || '', applied_card_id: c.applied_card_id || '', applied_note: c.applied_note || '' });
  useEffect(() => { setV({ amount: c.amount ?? '', currency: c.currency || 'KRW', note: c.note || '', applied_card_id: c.applied_card_id || '', applied_note: c.applied_note || '' }); }, [claim.id, claim.updated_date]);
  const { data: cards = [] } = useQuery({
    queryKey: ['claim-next-cards', card.client_id],
    enabled: !!card.client_id,
    queryFn: async () => (await base44.entities.TaskCard.filter({ client_id: card.client_id }, '-created_date', 50)).filter((x) => x.id !== card.id && x.status !== 'CANCELLED'),
  });
  const save = useMutation({
    mutationFn: async () => {
      const title = cards.find((x) => x.id === v.applied_card_id)?.title || '';
      const out = compensationPatch({ ...v, applied_card_title: title }, { claim: { ...claim, resolution }, by: user?.full_name || user?.email || '', now: new Date().toISOString() });
      if (out.error) throw new Error(out.error);
      await base44.entities.QualityClaim.update(claim.id, { compensation: out.compensation });
      return out.compensation;
    },
    onSuccess: (comp) => { toast({ title: comp.applied_card_id ? '보상을 다음 주문에 반영한 것으로 기록했습니다' : '보상 약속을 기록했습니다', description: '고객 화면 불량 신고와 상품 원가에도 보입니다.' }); onSaved(); },
    onError: (e) => toast({ title: '저장하지 못했습니다', description: e.message, variant: 'destructive' }),
  });
  if (!PROMISE_KINDS.includes(resolution)) return null;
  const state = compensationState({ ...claim, resolution });
  return (
    <div className="space-y-2 rounded-md border border-dashed p-2.5">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
        <Gift className="h-3.5 w-3.5 text-primary" />보상 약속 · {CLAIM_RESOLUTION[resolution]}
        <Badge variant="outline" className={state === 'APPLIED' ? 'text-primary' : 'text-warning-text'}>{state === 'APPLIED' ? `반영됨 · ${c.applied_card_title || ''}` : '다음 주문 미반영'}</Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_88px_2fr]">
        <Input className="h-8 text-xs" type="number" min={0} placeholder="금액 (선택)" value={v.amount} onChange={(e) => setV((x) => ({ ...x, amount: e.target.value }))} />
        <select className={sel} value={v.currency} onChange={(e) => setV((x) => ({ ...x, currency: e.target.value }))}>{['KRW', 'USD', 'CNY'].map((k) => <option key={k}>{k}</option>)}</select>
        <Input className="h-8 text-xs" placeholder="약속 내용 (예: 다음 발주 5% 할인, 불량 120개 재생산)" value={v.note} onChange={(e) => setV((x) => ({ ...x, note: e.target.value }))} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-[11px]"><span>반영한 다음 주문</span>
          <select className={sel} value={v.applied_card_id} onChange={(e) => setV((x) => ({ ...x, applied_card_id: e.target.value }))}>
            <option value="">아직 반영 안 함</option>
            {cards.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-[11px]"><span>반영 내용 (예: 견적 할인 줄, 도착 원가 조정)</span><Input className="h-8 text-xs" value={v.applied_note} disabled={!v.applied_card_id} onChange={(e) => setV((x) => ({ ...x, applied_note: e.target.value }))} /></label>
      </div>
      <div className="flex justify-end"><Button size="sm" variant="outline" className="h-7 text-xs" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? '저장 중…' : '보상 저장'}</Button></div>
    </div>
  );
}

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
        // 공장 회신을 처음 적으면 회신 기한 추적을 끝낸다
        ...(f.factory_response.trim() && !claim.factory_responded_at ? { factory_responded_at: now } : {}),
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
  // 문서를 복사한 때를 공장에 보낸 때로 보고 3영업일 회신 기한을 잰다 (처음 한 번만)
  const copyCn = async () => {
    await navigator.clipboard.writeText(claimDocCn({ card, claim, spec, qc, photoCount: mine.length }));
    if (!claim.factory_requested_at) { await base44.entities.QualityClaim.update(claim.id, { factory_requested_at: new Date().toISOString() }).catch(() => {}); onSaved(); }
    toast({ title: '중국어 클레임 문서를 복사했습니다', description: `위챗·이메일에 붙여 넣고 사진을 함께 보내 주세요. 공장 회신 기한은 ${FACTORY_REPLY_DAYS}영업일입니다.` });
  };
  const wait = factoryWait(claim);

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
      {claim.factory_requested_at && (
        <p className={`flex items-center gap-1 text-[11px] ${wait?.overdue ? 'font-medium text-warning-text' : 'text-muted-foreground'}`}>
          <Clock className="h-3 w-3" />공장에 보냄 {fmtDate(claim.factory_requested_at)}
          {wait ? ` · 회신 대기 ${wait.business}영업일${wait.overdue ? ` (기한 ${FACTORY_REPLY_DAYS}영업일 지남 — 고객 화면에도 '공장 회신 대기 ${wait.days}일'로 보입니다)` : ''}` : claim.factory_responded_at ? ` · 회신 기록 ${fmtDate(claim.factory_responded_at)}` : ''}
        </p>
      )}
      {!!mine.length && <div className="flex flex-wrap gap-1">{mine.map((p) => <span key={p.id} className="flex items-center rounded-md border pl-2 text-[11px]">{p.file_name}<DocumentOpenButton document={p} /></span>)}</div>}
      <div className="grid gap-2 border-t pt-2.5 sm:grid-cols-2">
        <label className="space-y-1 text-[11px]"><span>처리 단계</span><select className={sel} value={f.status} onChange={set('status')}>{Object.entries(CLAIM_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="space-y-1 text-[11px]"><span>처리 방법</span><select className={sel} value={f.resolution} onChange={set('resolution')}><option value="">미정</option>{Object.entries(CLAIM_RESOLUTION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="space-y-1 text-[11px]"><span>고객 안내 (고객에게 보임)</span><Textarea rows={2} className="text-xs" value={f.client_message} onChange={set('client_message')} placeholder="예: 공장이 원인을 확인했고, 불량 120개는 다음 선적에 재생산분으로 보냅니다." /></label>
        <label className="space-y-1 text-[11px]"><span>공장 회신 (내부)</span><Textarea rows={2} className="text-xs" value={f.factory_response} onChange={set('factory_response')} placeholder="공장 원인 분석·대책" /></label>
      </div>
      <div className="flex justify-end"><Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>{save.isPending ? '저장 중…' : '저장'}</Button></div>
      {PROMISE_KINDS.includes(claim.resolution) && <CompensationEditor claim={claim} card={card} user={user} resolution={claim.resolution} onSaved={onSaved} />}
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
