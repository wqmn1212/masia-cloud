import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BatteryCharging, Plus, Ship, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { MODES, SHIPMENT_STATUS, daysUntil, docStatus, missingBeforeDeparture } from '@/lib/shipments';
import DestCostSection from './DestCostSection';

const FIELDS = ['label', 'mode', 'status', 'forwarder', 'carrier', 'tracking_no', 'port_from', 'port_to', 'etd', 'eta', 'atd', 'ata', 'dangerous_goods', 'docs', 'package_note', 'client_note', 'note', 'client_visible'];
const pick = (s) => Object.fromEntries(FIELDS.map((k) => [k, s[k] ?? (k === 'docs' ? [] : k === 'dangerous_goods' ? false : k === 'client_visible' ? true : '')]));
const sel = 'mt-1 h-8 w-full rounded-md border bg-background px-2 text-xs';
const DOC_CHOICES = [['MISSING', '미비'], ['READY', '준비됨'], ['NA', '해당 없음']];

function ShipmentEditor({ shipment, card, attachmentTypes, onSaved }) {
  const [f, setF] = useState(() => pick(shipment));
  const [saving, setSaving] = useState(false);
  // 이 폼의 필드가 바뀔 때만 다시 채운다 (도착지 비용처럼 따로 저장하는 값 때문에 입력 중인 내용이 지워지지 않게)
  const saved = JSON.stringify(pick(shipment));
  useEffect(() => { setF(pick(shipment)); }, [shipment.id, saved]);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const docs = docStatus(f, attachmentTypes);
  const missing = missingBeforeDeparture(f, attachmentTypes);
  const toEtd = daysUntil(f.etd);
  const warn = missing.length > 0 && ['PREPARING', 'BOOKED'].includes(f.status) && toEtd != null && toEtd <= 30;
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
    } catch (e) {
      toast({ title: '저장하지 못했습니다', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input className="h-8 w-40 text-sm font-semibold" value={f.label} placeholder="1차 선적" onChange={(e) => set('label', e.target.value)} />
        <Badge variant="outline">{SHIPMENT_STATUS[f.status]}</Badge>
        {f.dangerous_goods && <Badge className="gap-1 border-0 bg-chart-3/15 text-chart-3"><BatteryCharging className="h-3 w-3" />위험물</Badge>}
        {toEtd != null && ['PREPARING', 'BOOKED'].includes(f.status) && <span className="text-xs text-muted-foreground">출항 {toEtd >= 0 ? `D-${toEtd}` : `${-toEtd}일 지남`}</span>}
      </div>
      {warn && (
        <p className="flex gap-1.5 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />출항 {toEtd}일 전인데 서류 {missing.length}건이 없습니다: {missing.map((d) => d.label).join(', ')}
        </p>
      )}
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
      <DestCostSection shipment={shipment} card={card} onSaved={onSaved} />
      <div className="grid gap-2 sm:grid-cols-2">
        <div><Label className="text-[11px]">고객 안내 메모 (고객에게 보임)</Label><Textarea rows={2} className="text-xs" value={f.client_note} placeholder="예: 부산항 도착 후 통관까지 2~3일 걸립니다." onChange={(e) => set('client_note', e.target.value)} /></div>
        <div><Label className="text-[11px]">내부 메모</Label><Textarea rows={2} className="text-xs" value={f.note} onChange={(e) => set('note', e.target.value)} /></div>
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs"><Switch checked={!!f.client_visible} onCheckedChange={(v) => set('client_visible', v)} />고객 포털에 보이기</label>
        <Button size="sm" disabled={saving || !dirty} onClick={save}>{saving ? '저장 중…' : '저장'}</Button>
      </div>
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
      <div className="flex items-center gap-2">
        <Ship className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">선적·통관</h3>
        <Button size="sm" variant="outline" className="ml-auto h-7 gap-1 text-xs" disabled={adding} onClick={add}>{adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}선적 추가</Button>
      </div>
      {isLoading ? null : shipments.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">출고가 가까워지면 선적을 추가하세요. 배터리가 들어간 제품은 위험물 서류를 미리 챙기도록 경고해 드립니다.</p>
      ) : shipments.map((s) => <ShipmentEditor key={s.id} shipment={s} card={card} attachmentTypes={types} onSaved={() => qc.invalidateQueries({ queryKey: key })} />)}
    </section>
  );
}
