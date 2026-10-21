import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BatteryCharging, Plus, Loader2, Pencil } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { MODES, SHIPMENT_STATUS, daysUntil, docStatus, missingBeforeDeparture } from '@/lib/shipments';
import DestCostSection, { destCostWarning } from './DestCostSection';
import ShipmentSteps from '@/components/shipments/ShipmentSteps';
import { pendingReqs } from '@/lib/importRequirements';

const FIELDS = ['label', 'mode', 'status', 'forwarder', 'carrier', 'tracking_no', 'port_from', 'port_to', 'etd', 'eta', 'atd', 'ata', 'dangerous_goods', 'docs', 'package_note', 'client_note', 'note', 'client_visible'];
const pick = (s) => Object.fromEntries(FIELDS.map((k) => [k, s[k] ?? (k === 'docs' ? [] : k === 'dangerous_goods' ? false : k === 'client_visible' ? true : '')]));
const sel = 'mt-1 h-8 w-full rounded-md border bg-background px-2 text-xs';
const DOC_CHOICES = [['MISSING', '미비'], ['READY', '준비됨'], ['NA', '해당 없음']];

function ShipmentEditor({ shipment, card, attachmentTypes, onSaved, onClose }) {
  const [f, setF] = useState(() => pick(shipment));
  const [saving, setSaving] = useState(false);
  // 이 폼의 필드가 바뀔 때만 다시 채운다 (도착지 비용처럼 따로 저장하는 값 때문에 입력 중인 내용이 지워지지 않게)
  const saved = JSON.stringify(pick(shipment));
  useEffect(() => { setF(pick(shipment)); }, [shipment.id, saved]);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const docs = docStatus(f, attachmentTypes);
  // '미비'는 직접 표시를 지우는 것 (보관함에 파일이 있으면 계속 준비됨으로 본다)
  const setDoc = (key, status) => set('docs', [...(f.docs || []).filter((d) => d.key !== key), ...(status === 'MISSING' ? [] : [{ key, status, note: '' }])]);
  const dirty = JSON.stringify(f) !== saved;

  const save = async () => {
    setSaving(true);
    try {
      const statusChanged = f.status !== shipment.status;
      const data = { ...f, ...(statusChanged ? { status_updated_at: new Date().toISOString() } : {}) };
      await base44.entities.Shipment.update(shipment.id, data);
      // 고객에게 보이는 선적의 상태가 바뀌면 알린다 (비공개 카드는 notifyCardEvent 가 건너뜀)
      if (statusChanged && f.client_visible) {
        const eta = f.ata ? `도착 ${f.ata}` : f.eta ? `도착 예정 ${f.eta}` : '';
        base44.functions.invoke('notifyCardEvent', { card_id: card.id, type: 'shipment_updated', message: [`${f.label || '선적'}: ${SHIPMENT_STATUS[f.status]}`, eta].filter(Boolean).join(' · ') }).catch(() => {});
      }
      toast({ title: '선적 정보를 저장했습니다', description: statusChanged && f.client_visible ? '고객에게 상태 변경 알림을 보냈습니다.' : undefined });
      onSaved();
      onClose();
    } catch (e) {
      toast({ title: '저장하지 못했습니다', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input className="h-8 w-40 text-sm font-semibold" value={f.label} placeholder="1차 선적" onChange={(e) => set('label', e.target.value)} />
        <span className="text-xs text-muted-foreground">선적 정보 수정</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="text-[11px]">상태<select className={sel} value={f.status} onChange={(e) => set('status', e.target.value)}>{Object.entries(SHIPMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="text-[11px]">운송 방식<select className={sel} value={f.mode || ''} onChange={(e) => set('mode', e.target.value)}><option value="">선택</option>{Object.entries(MODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <div><Label className="text-[11px]">선사·항공사</Label><Input className="h-8 text-xs" value={f.carrier} onChange={(e) => set('carrier', e.target.value)} /></div>
        <div><Label className="text-[11px]">B/L · AWB · 운송장</Label><Input className="h-8 text-xs" value={f.tracking_no} onChange={(e) => set('tracking_no', e.target.value)} /></div>
        <div><Label className="text-[11px]">출발</Label><Input className="h-8 text-xs" value={f.port_from} placeholder="예: 선전 옌톈" onChange={(e) => set('port_from', e.target.value)} /></div>
        <div><Label className="text-[11px]">도착</Label><Input className="h-8 text-xs" value={f.port_to} placeholder="예: 부산" onChange={(e) => set('port_to', e.target.value)} /></div>
        <div><Label className="text-[11px]">출항 예정 (ETD)</Label><Input type="date" className="h-8 text-xs" value={f.etd} onChange={(e) => set('etd', e.target.value)} /></div>
        <div><Label className="text-[11px]">도착 예정 (ETA)</Label><Input type="date" className="h-8 text-xs" value={f.eta} onChange={(e) => set('eta', e.target.value)} /></div>
        <div><Label className="text-[11px]">실제 출항</Label><Input type="date" className="h-8 text-xs" value={f.atd} onChange={(e) => set('atd', e.target.value)} /></div>
        <div><Label className="text-[11px]">실제 도착</Label><Input type="date" className="h-8 text-xs" value={f.ata} onChange={(e) => set('ata', e.target.value)} /></div>
        <div><Label className="text-[11px]">포워더 (내부)</Label><Input className="h-8 text-xs" value={f.forwarder} onChange={(e) => set('forwarder', e.target.value)} /></div>
        <div><Label className="text-[11px]">박스 수·중량</Label><Input className="h-8 text-xs" value={f.package_note} placeholder="예: 42CTN · 610kg" onChange={(e) => set('package_note', e.target.value)} /></div>
      </div>
      <label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs">
        <span><b>배터리 등 위험물 포함</b><span className="block text-muted-foreground">켜면 UN38.3·MSDS·배터리 사양서·위험물 신고서가 필수 서류가 됩니다.</span></span>
        <Switch checked={!!f.dangerous_goods} onCheckedChange={(v) => set('dangerous_goods', v)} />
      </label>
      <div>
        <p className="mb-1 text-[11px] text-muted-foreground">서류 체크리스트 · 아래 보관함에 유형을 맞춰 올리면 자동으로 &lsquo;준비됨&rsquo;이 됩니다</p>
        <ul className="divide-y rounded-lg border">
          {docs.map((d) => (
            <li key={d.key} className="flex items-center gap-2 px-3 py-1.5 text-xs">
              <span className={`h-2 w-2 shrink-0 rounded-full ${d.status === 'READY' ? 'bg-primary' : d.status === 'NA' ? 'bg-muted-foreground/40' : 'bg-destructive'}`} />
              <span className="flex-1">{d.label}</span>
              {d.auto && <span className="text-[10px] text-primary">보관함에 있음</span>}
              <select aria-label={`${d.label} 상태`} className="h-7 rounded-md border bg-background px-1.5 text-[11px]" value={(f.docs || []).find((x) => x.key === d.key)?.status || (d.auto ? 'READY' : 'MISSING')} onChange={(e) => setDoc(d.key, e.target.value)}>
                {DOC_CHOICES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div><Label className="text-[11px]">고객 안내 메모 (고객에게 보임)</Label><Textarea rows={2} className="text-xs" value={f.client_note} placeholder="예: 부산항 도착 후 통관까지 2~3일 걸립니다." onChange={(e) => set('client_note', e.target.value)} /></div>
        <div><Label className="text-[11px]">내부 메모</Label><Textarea rows={2} className="text-xs" value={f.note} onChange={(e) => set('note', e.target.value)} /></div>
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs"><Switch checked={!!f.client_visible} onCheckedChange={(v) => set('client_visible', v)} />고객 포털에 보이기</label>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onClose}>닫기</Button>
          <Button size="sm" disabled={saving || !dirty} onClick={save}>{saving ? '저장 중…' : '저장'}</Button>
        </div>
      </div>
    </div>
  );
}

const fmtDay = (d) => (d ? d.slice(5).replace('-', '/') : '미정');

// 선적 요약 카드: 진행 단계·일정·서류·확인할 일·도착지 비용. '수정'을 눌러야 입력 화면이 열린다
function ShipmentCard({ shipment, card, attachmentTypes, onSaved }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <ShipmentEditor shipment={shipment} card={card} attachmentTypes={attachmentTypes} onSaved={onSaved} onClose={() => setEditing(false)} />;
  const s = shipment;
  const docs = docStatus(s, attachmentTypes);
  const ready = docs.filter((d) => d.status !== 'MISSING').length;
  const toEtd = daysUntil(s.etd);
  const beforeDeparture = ['PREPARING', 'BOOKED'].includes(s.status);
  const soon = beforeDeparture && toEtd != null && toEtd <= 30;
  const missing = soon ? missingBeforeDeparture(s, attachmentTypes) : [];
  const reqs = soon ? pendingReqs(card.import_requirements) : [];
  const destWarn = destCostWarning(s);
  const todos = [
    missing.length && `선적 서류 ${missing.length}건 없음 · ${missing.map((d) => d.label).join(', ')}`,
    reqs.length && `수입 요건 ${reqs.length}건 미완료 · ${reqs.map((r) => r.label).join(', ')} (아래 수입 요건)`,
    destWarn,
  ].filter(Boolean);
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">{s.label || '선적'}</p>
        <Badge variant="outline">{SHIPMENT_STATUS[s.status]}</Badge>
        {s.dangerous_goods && <Badge className="gap-1 border-0 bg-chart-3/15 text-chart-3"><BatteryCharging className="h-3 w-3" />위험물</Badge>}
        {!s.client_visible && <Badge variant="outline" className="text-[10px] text-muted-foreground">고객 비공개</Badge>}
        <span className="text-xs text-muted-foreground">{[MODES[s.mode], s.carrier].filter(Boolean).join(' · ')}</span>
        <Button size="sm" variant="ghost" className="ml-auto h-7 gap-1 text-xs" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" />수정</Button>
      </div>
      <ShipmentSteps status={s.status} />
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
        <div><dt className="text-muted-foreground">구간</dt><dd>{s.port_from || '-'} → {s.port_to || '-'}</dd></div>
        <div><dt className="text-muted-foreground">{s.atd ? '출항' : '출항 예정'}</dt><dd className="tabular-nums">{fmtDay(s.atd || s.etd)}{beforeDeparture && toEtd != null ? <span className="ml-1 text-muted-foreground">{toEtd >= 0 ? `D-${toEtd}` : `${-toEtd}일 지남`}</span> : null}</dd></div>
        <div><dt className="text-muted-foreground">{s.ata ? '도착' : '도착 예정'}</dt><dd className="tabular-nums">{fmtDay(s.ata || s.eta)}</dd></div>
        <div><dt className="text-muted-foreground">B/L · 운송장</dt><dd className="truncate font-mono">{s.tracking_no || '-'}</dd></div>
      </dl>
      {todos.length > 0 && (
        <ul className="space-y-1 rounded-md bg-chart-3/10 p-2 text-xs text-chart-3">
          {todos.map((t) => <li key={t} className="flex gap-1.5"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t}</li>)}
        </ul>
      )}
      <div>
        <p className="text-[11px] text-muted-foreground">선적 서류 {ready}/{docs.length} 준비 · 무역서류 보관함에 유형을 맞춰 올리면 자동으로 준비됨</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {docs.map((d) => <span key={d.key} className={`rounded px-1.5 py-0.5 text-[10px] ${d.status === 'MISSING' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>{d.status === 'MISSING' ? '' : '✓ '}{d.label}{d.status === 'NA' ? ' (해당 없음)' : ''}</span>)}
        </div>
      </div>
      <DestCostSection shipment={s} card={card} onSaved={onSaved} />
    </div>
  );
}

// 선적·통관 추적: 운송 정보, 서류 체크리스트(위험물 포함), 출항 전 서류 미비 경고, 도착지 비용 고객 사전 확인
export default function ShipmentPanel({ card }) {
  const qc = useQueryClient();
  const key = ['shipments', card.id];
  const { data: shipments = [], isLoading } = useQuery({ queryKey: key, queryFn: () => base44.entities.Shipment.filter({ card_id: card.id }, 'created_date', 20) });
  const { data: attachments = [] } = useQuery({ queryKey: ['shipment-attachments', card.id], queryFn: () => base44.entities.CardAttachment.filter({ card_id: card.id }, '-created_date', 500) });
  const types = attachments.map((a) => a.document_type).filter(Boolean);
  const [adding, setAdding] = useState(false);
  const add = async () => {
    setAdding(true);
    try {
      await base44.entities.Shipment.create({ card_id: card.id, label: `${shipments.length + 1}차 선적`, status: 'PREPARING', dangerous_goods: false, docs: [], client_visible: true });
      await qc.invalidateQueries({ queryKey: key });
    } catch (e) {
      toast({ title: '추가하지 못했습니다', description: e.message, variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">선적·통관</h3>
          <p className="text-xs text-muted-foreground">출항 전에 서류·수입 요건·도착 후 비용을 확인하고, 진행 단계는 고객 포털에도 보입니다.</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1" disabled={adding} onClick={add}>{adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}선적 추가</Button>
      </div>
      {isLoading ? null : shipments.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">출고가 가까워지면 선적을 추가하세요. 배터리가 들어간 제품은 위험물 서류를 미리 챙기도록 경고해 드립니다.</p>
      ) : shipments.map((s) => <ShipmentCard key={s.id} shipment={s} card={card} attachmentTypes={types} onSaved={() => qc.invalidateQueries({ queryKey: key })} />)}
    </section>
  );
}
