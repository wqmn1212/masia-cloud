import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Calculator, ChevronDown, ChevronUp, Lock, Loader2 } from 'lucide-react';
import CostModelEditor from '@/components/bom/CostModelEditor';

const cny = (v) => `¥${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function BomEstimatePanel({ parts, unconfirmedCount }) {
  const [orderQty, setOrderQty] = useState(1000);
  const [showCoeffs, setShowCoeffs] = useState(false);
  const [model, setModel] = useState(null);
  const [result, setResult] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | denied | error
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  // 메시 데이터는 제외하고 원가 계산에 필요한 값만 전송한다
  const payloadParts = parts.map((p) => ({
    part_name: p.part_name,
    display_name: p.display_name,
    quantity: p.quantity,
    weight_g: p.weight_g,
    material: p.material,
    finish: p.finish,
    insert_count: p.insert_count,
    cavity_count: p.cavity_count,
    cycle_time_sec: p.cycle_time_sec,
    machine_class: p.machine_class,
    projected_area_cm2: p.projected_area_cm2,
    is_purchased: p.is_purchased,
  }));

  const run = async ({ patch = null, save = false } = {}) => {
    setState((s) => (s === 'ready' ? 'ready' : 'loading'));
    try {
      const res = await base44.functions.invoke('estimateInjectionCost', {
        parts: payloadParts,
        order_qty: orderQty,
        model_patch: patch,
        save_model: save,
      });
      setResult(res.data.result);
      setModel(res.data.coefficients);
      setState('ready');
    } catch (e) {
      const status = e?.response?.status;
      if (status === 403) {
        setState('denied');
      } else {
        setMessage(e?.response?.data?.error || e.message);
        setState('error');
      }
    }
  };

  useEffect(() => {
    run({ patch: model });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, orderQty]);

  const onModelChange = (next) => {
    setModel(next);
    run({ patch: next });
  };

  const onSaveModel = async () => {
    setSaving(true);
    await run({ patch: model, save: true });
    setSaving(false);
  };

  if (state === 'denied') {
    return (
      <div className="border rounded-xl bg-card p-6 text-center">
        <Lock className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">사출 원가 산정은 마스터·서비스 관리자만 조회할 수 있습니다.</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="border rounded-xl bg-destructive/10 text-destructive p-4 text-xs flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />원가 산정 실패 — {message}
      </div>
    );
  }

  return (
    <div className="border rounded-xl bg-card">
      <div className="p-4 flex flex-wrap items-end gap-4 border-b">
        <div className="flex items-center gap-2 mr-auto">
          <Calculator className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">사출 가견적 (공장 원가 기준 · 서버 산정)</h2>
          {state === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">생산 수량 (세트)</Label>
          <Input
            type="number"
            min={1}
            value={orderQty}
            onChange={(e) => setOrderQty(Number(e.target.value))}
            className="h-8 text-xs w-[110px] text-right"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowCoeffs((v) => !v)}>
          계수 수정 {showCoeffs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </Button>
      </div>

      {showCoeffs && model && (
        <div className="p-4 border-b bg-muted/30 space-y-3">
          <CostModelEditor model={model} onChange={onModelChange} />
          <div className="flex justify-end">
            <Button size="sm" className="h-8 text-xs" onClick={onSaveModel} disabled={saving}>
              {saving ? '저장 중...' : '팀 기본 계수로 저장'}
            </Button>
          </div>
        </div>
      )}

      {unconfirmedCount > 0 && (
        <div className="px-4 py-2.5 border-b bg-destructive/10 text-destructive text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          재질 미확정 {unconfirmedCount}개 — 아래 금액은 추정 재질 기준 참고값입니다
        </div>
      )}

      {!result ? (
        <p className="p-6 text-center text-xs text-muted-foreground">산정 중...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0">
            {[
              { label: '세트당 사출 원가', value: cny(result.set_cost) },
              { label: '금형비 합계 (1회성)', value: cny(result.mold_total) },
              { label: `양산 원가 (${orderQty.toLocaleString()}세트)`, value: cny(result.production_total) },
              { label: '금형 상각 포함 세트당', value: cny(result.amortized_set_cost) },
            ].map((s) => (
              <div key={s.label} className="p-4">
                <p className="text-[11px] text-muted-foreground mb-1">{s.label}</p>
                <p className="text-base font-bold tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto border-t">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="p-2 text-left font-semibold">부품</th>
                  <th className="p-2 text-right font-semibold">재료비</th>
                  <th className="p-2 text-right font-semibold">가공비</th>
                  <th className="p-2 text-right font-semibold">후처리</th>
                  <th className="p-2 text-right font-semibold">1EA 단가</th>
                  <th className="p-2 text-right font-semibold">세트당</th>
                  <th className="p-2 text-right font-semibold">금형비</th>
                </tr>
              </thead>
              <tbody>
                {result.lines.map((l, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="p-2 truncate max-w-[200px]">
                      {l.part_name}
                      {l.skipped && <span className="ml-1.5 text-[10px] text-muted-foreground">구매품</span>}
                    </td>
                    <td className="p-2 text-right tabular-nums">{l.skipped ? '-' : cny(l.material_cost)}</td>
                    <td className="p-2 text-right tabular-nums">{l.skipped ? '-' : cny(l.machine_cost)}</td>
                    <td className="p-2 text-right tabular-nums">{l.skipped ? '-' : cny(l.finish_cost)}</td>
                    <td className="p-2 text-right tabular-nums font-medium">{l.skipped ? '-' : cny(l.unit_cost)}</td>
                    <td className="p-2 text-right tabular-nums">{l.skipped ? '-' : cny(l.per_set_cost)}</td>
                    <td className="p-2 text-right tabular-nums text-muted-foreground">{l.skipped ? '-' : cny(l.mold_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}