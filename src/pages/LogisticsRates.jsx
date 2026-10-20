import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, ExternalLink, Loader2, Pencil, RotateCcw, Ship } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { DEFAULT_RATES, MODES, REGIONS, SEGMENTS, UNITS, calcLandedCost, fmtWon, mergeRates, rateKey } from '@/lib/landedCost';

const MODE_TABS = [...MODES.map((m) => ({ value: m.value, label: m.label })), { value: 'ALL', label: '공통 (트럭·통관)' }];
const REGION_LABEL = Object.fromEntries(REGIONS.map((r) => [r.value, r.label.split(' ')[0]]));
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
const DO_ITEMS = DEFAULT_RATES.filter((r) => r.mode === 'SEA_LCL' && r.segment === 'D' && !r.variable);

function EditDialog({ rate, onClose }) {
  const qc = useQueryClient();
  const [f, setF] = useState(() => ({ amount: rate.amount, fx_krw: rate.fx_krw ?? '', min: rate.min ?? '', verified: !!rate.verified, source: rate.source || '', note: rate.note || '', valid_from: rate.valid_from || today() }));
  const save = useMutation({
    mutationFn: async () => {
      const data = { amount: Number(f.amount), fx_krw: f.fx_krw === '' ? null : Number(f.fx_krw), min: f.min === '' ? null : Number(f.min), verified: f.verified, source: f.source, note: f.note, valid_from: f.valid_from, active: true };
      if (rate.id) return base44.entities.LogisticsRate.update(rate.id, data);
      const { from: _from, id: _id, ...base } = rate;
      return base44.entities.LogisticsRate.create({ ...base, ...data });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['logistics-rate-rows'] }); qc.invalidateQueries({ queryKey: ['logistics-rates'] }); toast({ title: '요율을 저장했습니다' }); onClose(); },
    onError: (e) => toast({ title: '저장하지 못했습니다', description: e.message, variant: 'destructive' }),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{rate.label}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">{rate.segment}구간 · {UNITS[rate.unit]}{rate.region ? ` · ${REGION_LABEL[rate.region]}` : ''}{rate.max_cbm ? ` · ${rate.max_cbm}CBM 이하` : ''}</p>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">단가 ({rate.currency})</Label><Input type="number" step="any" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
          <div><Label className="text-xs">최소 청구액 ({rate.currency})</Label><Input type="number" step="any" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} placeholder="없음" /></div>
          {rate.currency === 'USD' && <div><Label className="text-xs">포워더 청구 환율 (원/$)</Label><Input type="number" value={f.fx_krw} onChange={(e) => setF({ ...f, fx_krw: e.target.value })} placeholder="비우면 시장 환율" /></div>}
          <div><Label className="text-xs">기준일</Label><Input type="date" value={f.valid_from} onChange={(e) => setF({ ...f, valid_from: e.target.value })} /></div>
          <label className="mt-6 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.verified} onChange={(e) => setF({ ...f, verified: e.target.checked })} />실제 청구서로 확인</label>
        </div>
        <div><Label className="text-xs">근거 (내부용, 고객 화면에 안 보임)</Label><Input value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} placeholder="예: OO포워더 D/O 산정표 2026-11" /></div>
        <div><Label className="text-xs">설명</Label><Textarea rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending || f.amount === ''}>{save.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}저장</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 포워더 D/O 산정표의 항목별 금액을 넣으면 R/T 당 단가를 역산해 요율로 저장한다. 저장 전에 현재 요율과의 차이를 보여 준다.
function InvoiceCalibrator({ rates }) {
  const qc = useQueryClient();
  const [rt, setRt] = useState('');
  const [fx, setFx] = useState('');
  const [src, setSrc] = useState('');
  const [amt, setAmt] = useState({});
  const r = Number(rt), x = Number(fx);
  const total = DO_ITEMS.reduce((s, i) => s + (Number(amt[i.code]) || 0), 0);
  const estimate = r > 0 && x > 0 ? calcLandedCost({ mode: 'SEA_LCL', term: 'CIF', totalCbm: r, usdKrw: x }, rates).lines.filter((l) => l.segment === 'D').reduce((s, l) => s + l.amount, 0) : 0;
  const diff = estimate && total ? (estimate - total) / total : null;
  const derived = DO_ITEMS.map((i) => {
    const a = Number(amt[i.code]) || 0;
    if (!a || !(r > 0)) return null;
    let unit = i.unit === 'PER_SHIPMENT' ? a : a / Math.max(1, r);
    if (i.currency === 'USD') unit = x > 0 ? unit / x : null;
    return unit == null ? null : { ...i, amount: Number(unit.toFixed(i.currency === 'USD' ? 2 : 0)) };
  }).filter(Boolean);

  const save = useMutation({
    mutationFn: async () => {
      const rows = await base44.entities.LogisticsRate.filter({ mode: 'SEA_LCL', segment: 'D' }, '-created_date', 100);
      for (const d of derived) {
        const data = { mode: 'SEA_LCL', segment: 'D', code: d.code, label: d.label, unit: d.unit, amount: d.amount, currency: d.currency, ...(d.currency === 'USD' ? { fx_krw: x } : {}), verified: true, source: src || 'D/O 산정표', valid_from: today(), active: true, note: d.note || '' };
        const hit = rows.find((row) => rateKey(row) === rateKey(d));
        if (hit) await base44.entities.LogisticsRate.update(hit.id, data);
        else await base44.entities.LogisticsRate.create(data);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['logistics-rate-rows'] }); qc.invalidateQueries({ queryKey: ['logistics-rates'] }); toast({ title: `요율 ${derived.length}개를 청구서 기준으로 갱신했습니다` }); setAmt({}); },
    onError: (e) => toast({ title: '저장하지 못했습니다', description: e.message, variant: 'destructive' }),
  });

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold">청구서로 검산·요율 갱신 (해상 LCL 도착지)</h2>
        <p className="mt-1 text-xs text-muted-foreground">포워더 D/O 산정표의 부피와 항목별 금액을 넣으면 지금 요율로 계산한 금액과 비교하고, 단가를 역산해 실제 청구 기준 요율로 저장합니다.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div><Label className="text-xs">청구 부피 (R/T)</Label><Input type="number" step="0.01" value={rt} onChange={(e) => setRt(e.target.value)} placeholder="9.5" /></div>
        <div><Label className="text-xs">청구서 환율 (원/$)</Label><Input type="number" value={fx} onChange={(e) => setFx(e.target.value)} placeholder="1200" /></div>
        <div><Label className="text-xs">근거 (포워더·날짜)</Label><Input value={src} onChange={(e) => setSrc(e.target.value)} placeholder="OO포워더 D/O 2026-11" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {DO_ITEMS.map((i) => (
          <div key={i.code}><Label className="text-xs">{i.label} (원)</Label><Input type="number" value={amt[i.code] ?? ''} onChange={(e) => setAmt({ ...amt, [i.code]: e.target.value })} /></div>
        ))}
      </div>
      {total > 0 && r > 0 && (
        <div className="rounded-lg bg-muted/50 p-3 text-xs">
          <p>청구서 합계 <b>{fmtWon(total)}</b> · 지금 요율로 계산 <b>{fmtWon(estimate)}</b>{diff != null && <> · 차이 <b className={Math.abs(diff) > 0.05 ? 'text-destructive' : 'text-primary'}>{(diff * 100).toFixed(1)}%</b></>}</p>
          {!!derived.length && <p className="mt-1 text-muted-foreground">역산 단가: {derived.map((d) => `${d.label.split(' (')[0]} ${d.currency === 'USD' ? `$${d.amount}` : `${d.amount.toLocaleString()}원`}`).join(' · ')}</p>}
        </div>
      )}
      <Button onClick={() => save.mutate()} disabled={!derived.length || save.isPending} className="gap-1">{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}역산 단가를 요율로 저장</Button>
    </Card>
  );
}

export default function LogisticsRates() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState('SEA_LCL');
  const [editing, setEditing] = useState(null);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['logistics-rate-rows'],
    queryFn: () => base44.entities.LogisticsRate.list('segment', 500),
  });
  const rates = useMemo(() => mergeRates(rows), [rows]);
  const shown = rates.filter((r) => r.mode === tab).sort((a, b) => a.segment.localeCompare(b.segment) || (a.region || '').localeCompare(b.region || '') || (a.max_cbm || 0) - (b.max_cbm || 0));
  const verifiedCount = rates.filter((r) => r.verified).length;
  const stale = rows.filter((r) => r.active !== false && r.valid_from && (Date.now() - Date.parse(r.valid_from)) / 864e5 > 90).length;

  const revert = useMutation({
    mutationFn: (row) => base44.entities.LogisticsRate.update(row.id, { active: false }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['logistics-rate-rows'] }); qc.invalidateQueries({ queryKey: ['logistics-rates'] }); toast({ title: '기본값으로 되돌렸습니다' }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Ship className="h-6 w-6 text-primary" />물류비 요율</h1>
          <p className="mt-1 text-sm text-muted-foreground">수입 물류비 계산기(고객 포털·견적 화면)가 쓰는 요율입니다. 실제 청구서로 확인한 요율 {verifiedCount}개 / 전체 {rates.length}개{stale ? ` · 90일 지난 요율 ${stale}개` : ''}</p>
        </div>
        {user?.account_tier === 'master' && <Button asChild variant="outline" size="sm" className="gap-1"><a href="/client/landed-cost" target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />고객 화면 미리보기</a></Button>}
      </div>

      <InvoiceCalibrator rates={rates} />

      <Card className="p-5">
        <div className="flex flex-wrap gap-1.5">
          {MODE_TABS.map((m) => (
            <button key={m.value} type="button" onClick={() => setTab(m.value)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tab === m.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>{m.label}</button>
          ))}
        </div>
        {isLoading ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b"><th className="py-2 pr-3 text-left font-medium">구간</th><th className="py-2 pr-3 text-left font-medium">항목</th><th className="py-2 pr-3 text-right font-medium">단가</th><th className="py-2 pr-3 text-left font-medium">단위</th><th className="py-2 pr-3 text-left font-medium">상태</th><th className="py-2 text-right font-medium" /></tr>
              </thead>
              <tbody className="divide-y">
                {shown.map((r) => (
                  <tr key={rateKey(r)} className="align-top">
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground">{r.segment}. {SEGMENTS.find((s) => s.key === r.segment)?.short}</td>
                    <td className="py-2.5 pr-3">
                      <p className="font-medium">{r.label}{r.region ? <span className="text-muted-foreground"> · {REGION_LABEL[r.region]}</span> : ''}{r.max_cbm ? <span className="text-muted-foreground"> · {r.max_cbm}CBM 이하</span> : ''}</p>
                      {(r.note || r.source) && <p className="text-[11px] text-muted-foreground">{[r.note, r.source && `근거: ${r.source}`, r.valid_from && `기준일 ${r.valid_from}`].filter(Boolean).join(' · ')}</p>}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{r.currency === 'USD' ? <>${r.amount}{r.fx_krw ? <p className="text-[11px] text-muted-foreground">청구 환율 {Number(r.fx_krw).toLocaleString()}원</p> : null}</> : r.unit === 'FACTOR' ? `${r.amount}배` : r.unit === 'PCT_GOODS' ? `${r.amount}%` : `${Number(r.amount).toLocaleString()}원`}{r.min ? <p className="text-[11px] text-muted-foreground">최소 {r.currency === 'USD' ? `$${r.min}` : `${r.min.toLocaleString()}원`}</p> : null}</td>
                    <td className="py-2.5 pr-3 text-xs">{UNITS[r.unit]}{r.variable && <Badge variant="outline" className="ml-1 text-[10px]">변동</Badge>}</td>
                    <td className="py-2.5 pr-3">
                      {r.verified ? <Badge className="gap-0.5 border-0 bg-primary/15 text-[10px] text-primary"><BadgeCheck className="h-3 w-3" />청구서 확인</Badge> : <Badge variant="outline" className="text-[10px]">추정</Badge>}
                      {r.from === 'db' && <Badge variant="outline" className="ml-1 text-[10px]">저장됨</Badge>}
                    </td>
                    <td className="whitespace-nowrap py-2.5 text-right">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(r)} aria-label="수정"><Pencil className="h-3.5 w-3.5" /></Button>
                      {r.from === 'db' && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => revert.mutate(r)} aria-label="기본값으로"><RotateCcw className="h-3.5 w-3.5" /></Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">‘추정’ 요율은 시장 평균 기본값입니다. 포워더 견적을 받을 때마다 고쳐 두면 계산이 실제 청구에 가까워집니다. 근거는 내부용이라 고객 화면에는 보이지 않습니다.</p>
      </Card>
      {editing && <EditDialog rate={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
