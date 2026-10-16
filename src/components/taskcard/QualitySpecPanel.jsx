import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Send, Languages, Copy, Factory, Loader2, ImagePlus, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { translateFieldsToCN } from '@/lib/translate';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { DEFAULT_AQL, DEFAULT_SPEC_ITEMS, SEVERITY, SPEC_DECISION, aqlLine, newItemKey } from '@/lib/qualitySpec';

const FIELDS = ['aql_level', 'aql_critical', 'aql_major', 'aql_minor', 'sampling_note', 'items', 'note'];
const pickDraft = (s) => Object.fromEntries(FIELDS.map((k) => [k, s[k] ?? (k === 'items' ? [] : '')]));

function PhotoSlot({ url, label, onChange, disabled }) {
  const [busy, setBusy] = useState(false);
  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    try { const { file_url } = await base44.integrations.Core.UploadFile({ file }); onChange(file_url); }
    catch (e) { toast({ title: '사진을 올리지 못했습니다', description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  return (
    <div className="w-20 shrink-0 text-center">
      {url ? (
        <div className="relative">
          <img src={url} alt={label} className="aspect-square w-20 rounded-md border object-cover" />
          {!disabled && <button type="button" aria-label={`${label} 사진 지우기`} onClick={() => onChange('')} className="absolute -right-1.5 -top-1.5 rounded-full border bg-background p-0.5"><X className="h-3 w-3" /></button>}
        </div>
      ) : (
        <label className={`flex aspect-square w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-[10px] text-muted-foreground ${disabled ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          <input type="file" accept="image/*" className="hidden" disabled={disabled || busy} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      )}
      <p className={`mt-0.5 text-[10px] ${label === '허용' ? 'text-primary' : 'text-destructive'}`}>{label}</p>
    </div>
  );
}

// 품질 기준서: 생산 전에 불량 기준(항목·등급·허용/불허 사진·AQL)을 정하고 고객 승인을 받는다.
// 고객에게 보낸 판본은 고치지 않고, 고칠 때는 새 버전을 만든다 (승인받은 기준을 증거로 남김).
export default function QualitySpecPanel({ card, user }) {
  const qc = useQueryClient();
  const key = ['quality-specs', card.id];
  const { data: specs = [], isLoading } = useQuery({ queryKey: key, queryFn: () => base44.entities.QualitySpec.filter({ card_id: card.id }, '-version', 20) });
  const spec = specs[0];
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState('');
  // 서버 판본이 바뀔 때만 작성 내용을 다시 불러온다 (창 포커스 재조회로 쓰던 내용이 지워지지 않게)
  useEffect(() => { setDraft(spec && spec.status !== 'SENT' ? pickDraft(spec) : null); }, [spec?.id, spec?.updated_date, spec?.status]);
  const editing = !!draft;
  const canShare = card.client_visible === true && !!card.client_id;
  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(pickDraft(spec));
  const by = user?.full_name || user?.email || '';

  const run = async (kind, fn) => {
    setBusy(kind);
    try { await fn(); await qc.invalidateQueries({ queryKey: key }); }
    catch (e) { toast({ title: '처리하지 못했습니다', description: e?.response?.data?.error || e.message, variant: 'destructive' }); }
    finally { setBusy(''); }
  };
  const create = () => run('create', () => base44.entities.QualitySpec.create({ card_id: card.id, version: 1, status: 'DRAFT', ...DEFAULT_AQL, sampling_note: '', items: DEFAULT_SPEC_ITEMS(), note: '', created_by_name: by }));
  const save = () => run('save', async () => { await base44.entities.QualitySpec.update(spec.id, draft); toast({ title: '기준서를 저장했습니다' }); });
  const revise = () => run('revise', () => base44.entities.QualitySpec.create({ card_id: card.id, version: (spec.version || 1) + 1, status: 'DRAFT', ...pickDraft(spec), created_by_name: by }));
  const confirmFactory = () => run('factory', () => base44.entities.QualitySpec.update(spec.id, { factory_confirmed_at: new Date().toISOString(), factory_confirmed_by_name: by }));
  const send = () => {
    if (!draft.items.length || draft.items.some((i) => !i.label.trim() || !i.standard.trim())) return toast({ title: '모든 항목의 이름과 합격 기준을 적어 주세요', variant: 'destructive' });
    if (!window.confirm('고객에게 기준서 승인을 요청합니다. 보낸 판본은 고칠 수 없고, 고칠 때는 새 버전을 만듭니다.\n사진에 공장 이름·간판이 보이지 않는지 확인하셨나요?')) return;
    run('send', async () => {
      await base44.entities.QualitySpec.update(spec.id, { ...draft, status: 'SENT', sent_at: new Date().toISOString(), sent_by_name: by });
      await base44.entities.ProjectAuditLog.create({ card_id: card.id, event_type: 'SPEC_SENT', actor_id: user?.id || '', actor_name: by, details: `품질 기준서 v${spec.version || 1} 고객 승인 요청 (항목 ${draft.items.length}개)` });
      await base44.functions.invoke('notifyCardEvent', { card_id: card.id, type: 'spec_sent' }).catch(() => {});
      toast({ title: '고객에게 승인 요청을 보냈습니다' });
    });
  };
  const fillChinese = () => run('translate', async () => {
    const src = {};
    draft.items.forEach((i, n) => { if (i.label && !i.label_cn) src[`l${n}`] = i.label; if (i.standard && !i.standard_cn) src[`s${n}`] = i.standard; });
    if (!Object.keys(src).length) return toast({ title: '비어 있는 중국어 칸이 없습니다' });
    const out = await translateFieldsToCN(src);
    if (out.__translation_failed) throw new Error('자동 번역을 쓸 수 없습니다. 중국어를 직접 입력해 주세요.');
    setDraft((d) => ({ ...d, items: d.items.map((i, n) => ({ ...i, label_cn: i.label_cn || out[`l${n}`] || '', standard_cn: i.standard_cn || out[`s${n}`] || '' })) }));
    toast({ title: '중국어를 채웠습니다', description: '확인 후 저장하세요.' });
  });

  const setItem = (n, patch) => setDraft((d) => ({ ...d, items: d.items.map((i, k) => (k === n ? { ...i, ...patch } : i)) }));
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  if (isLoading) return null;
  return (
    <section className="mt-5 space-y-3 border-t pt-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">품질 기준서 {spec && <span className="text-xs font-normal text-muted-foreground">v{spec.version || 1}</span>}</h3>
          <p className="text-xs text-muted-foreground">양산 전에 불량 기준을 고객·공장과 문서로 정합니다. 출고 전 검수는 이 기준으로 합니다.</p>
        </div>
        {spec?.status === 'SENT' && <Badge className={`border-0 ${(SPEC_DECISION[spec.client_decision] || SPEC_DECISION.PENDING).cls}`}>{(SPEC_DECISION[spec.client_decision] || SPEC_DECISION.PENDING).label}</Badge>}
        {spec?.factory_confirmed_at && <Badge variant="outline" className="text-[10px]">공장 확인 {new Date(spec.factory_confirmed_at).toLocaleDateString('ko-KR')}</Badge>}
        {editing && <Badge variant="outline" className="text-[10px]">작성 중</Badge>}
      </div>

      {!spec && <Button variant="outline" size="sm" disabled={!!busy} onClick={create} className="gap-1"><Plus className="h-3.5 w-3.5" />기준서 만들기 (기본 항목 6개)</Button>}

      {spec?.status === 'SENT' && (
        <div className="space-y-2">
          {spec.client_decision === 'REVISION_REQUESTED' && spec.client_comment && <p className="whitespace-pre-wrap rounded-md bg-destructive/10 p-2 text-xs"><b>고객 수정 요청</b> · {spec.client_decided_by_name}: {spec.client_comment}</p>}
          <p className="text-xs text-muted-foreground">{aqlLine(spec)}{spec.sampling_note ? ` · ${spec.sampling_note}` : ''}</p>
          <ul className="divide-y rounded-lg border text-xs">
            {spec.items.map((i) => (
              <li key={i.key} className="flex gap-2 p-2">
                <Badge className={`h-5 shrink-0 border-0 ${SEVERITY[i.severity]?.cls}`}>{SEVERITY[i.severity]?.label}</Badge>
                <div className="min-w-0 flex-1"><p className="font-medium">{i.label} {i.label_cn && <span className="font-normal text-muted-foreground">/ {i.label_cn}</span>}</p><p className="text-muted-foreground">{i.standard}</p></div>
                {[i.ok_photo_url, i.ng_photo_url].filter(Boolean).map((u) => <img key={u} src={u} alt="" className="h-10 w-10 rounded border object-cover" />)}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground">{spec.sent_by_name} · {spec.sent_at ? new Date(spec.sent_at).toLocaleString('ko-KR') : ''} 보냄{spec.client_decided_at ? ` · 고객 ${spec.client_decided_by_name} ${new Date(spec.client_decided_at).toLocaleString('ko-KR')}` : ''}</p>
          <div className="flex flex-wrap gap-2">
            {!spec.factory_confirmed_at && <Button size="sm" variant="outline" className="gap-1" disabled={!!busy} onClick={confirmFactory}><Factory className="h-3.5 w-3.5" />공장 확인 기록</Button>}
            <Button size="sm" variant="outline" className="gap-1" disabled={!!busy} onClick={revise}><Copy className="h-3.5 w-3.5" />고쳐서 새 버전 만들기</Button>
          </div>
        </div>
      )}

      {editing && (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="sm:col-span-1"><Label className="text-[11px]">검사 수준</Label><Input className="h-8 text-xs" value={draft.aql_level} onChange={(e) => set('aql_level', e.target.value)} /></div>
            {[['aql_critical', '치명 AQL'], ['aql_major', '중결함 AQL'], ['aql_minor', '경결함 AQL']].map(([k, l]) => (
              <div key={k}><Label className="text-[11px]">{l}</Label><Input className="h-8 text-xs" type="number" step="0.1" min={0} value={draft[k]} onChange={(e) => set(k, e.target.value === '' ? '' : Number(e.target.value))} /></div>
            ))}
          </div>
          <div><Label className="text-[11px]">표본·검사 방법</Label><Input className="h-8 text-xs" value={draft.sampling_note} placeholder="예: 로트 3,000개 → 표본 125개, 박스는 마스터 박스 전수 외관 확인" onChange={(e) => set('sampling_note', e.target.value)} /></div>
          <ul className="space-y-2">
            {draft.items.map((i, n) => (
              <li key={i.key} className="space-y-2 rounded-lg border p-2.5">
                <div className="grid grid-cols-[1fr_96px_32px] gap-2">
                  <Input className="h-8 text-xs" value={i.label} placeholder="항목 이름" onChange={(e) => setItem(n, { label: e.target.value })} />
                  <select aria-label="결함 등급" className="h-8 rounded-md border bg-background px-1.5 text-xs" value={i.severity} onChange={(e) => setItem(n, { severity: e.target.value })}>
                    {Object.entries(SEVERITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="항목 삭제" onClick={() => set('items', draft.items.filter((_, k) => k !== n))}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Textarea rows={2} className="text-xs" value={i.standard} placeholder="합격 기준 (고객이 읽는 문장)" onChange={(e) => setItem(n, { standard: e.target.value })} />
                    <Input className="h-7 text-[11px]" value={i.label_cn} placeholder="项目名称 (공장용 중국어)" onChange={(e) => setItem(n, { label_cn: e.target.value })} />
                    <Input className="h-7 text-[11px]" value={i.standard_cn} placeholder="合格标准 (공장용 중국어)" onChange={(e) => setItem(n, { standard_cn: e.target.value })} />
                  </div>
                  <PhotoSlot url={i.ok_photo_url} label="허용" onChange={(u) => setItem(n, { ok_photo_url: u })} disabled={!!busy} />
                  <PhotoSlot url={i.ng_photo_url} label="불허" onChange={(u) => setItem(n, { ng_photo_url: u })} disabled={!!busy} />
                </div>
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => set('items', [...draft.items, { key: newItemKey(), label: '', label_cn: '', standard: '', standard_cn: '', severity: 'MINOR', ok_photo_url: '', ng_photo_url: '' }])}><Plus className="h-3 w-3" />항목 추가</Button>
          <div><Label className="text-[11px]">기준서 메모 (고객에게 보임)</Label><Textarea rows={2} className="text-xs" value={draft.note} onChange={(e) => set('note', e.target.value)} /></div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="ghost" className="gap-1" disabled={!!busy} onClick={fillChinese}>{busy === 'translate' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}빈 중국어 채우기</Button>
            <Button size="sm" variant="outline" disabled={!!busy || !dirty} onClick={save}>저장</Button>
            <Button size="sm" className="gap-1" disabled={!!busy || !canShare} title={canShare ? '' : '고객 공개 카드에서만 보낼 수 있습니다'} onClick={send}><Send className="h-3.5 w-3.5" />고객에게 승인 요청</Button>
          </div>
          {!canShare && <p className="text-right text-[11px] text-muted-foreground">카드를 고객에게 공개해야 승인 요청을 보낼 수 있습니다.</p>}
        </div>
      )}
      {specs.length > 1 && <p className="text-[11px] text-muted-foreground">이전 버전: {specs.slice(1).map((s) => `v${s.version || 1} ${(SPEC_DECISION[s.client_decision] || { label: s.status === 'SENT' ? '확인 대기' : '작성 중' }).label}`).join(' · ')}</p>}
    </section>
  );
}
