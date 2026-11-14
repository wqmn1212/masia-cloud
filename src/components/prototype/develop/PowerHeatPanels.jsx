import React from 'react';
import { Gauge, Thermometer, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/prototype/develop/DevBits';
import SimChart from '@/components/prototype/develop/SimChart';
import { SIM_PARAMS, monthlyCost } from '@/lib/devkit/thermal';
import { heaterWatts } from '@/lib/devkit/features';

const fmtW = (w) => (w >= 10 ? `${w.toFixed(1)} W` : w >= 1 ? `${w.toFixed(2)} W` : `${Math.round(w * 1000)} mW`);
const KIND_COLOR = { heater: 'hsl(var(--chart-5))', motor: 'hsl(var(--chart-2))', fet: 'hsl(var(--chart-4))', reg: 'hsl(var(--chart-3))', diode: 'hsl(var(--chart-4))' };
const colorOf = (k) => KIND_COLOR[k] || 'hsl(var(--primary))';

const Big = ({ label, value, sub }) => (
  <div className="rounded-lg bg-secondary px-3 py-2 min-w-0">
    <p className="text-micro text-muted-foreground">{label}</p>
    <p className="text-title font-semibold tabular-nums">{value}</p>
    {sub && <p className="text-micro text-muted-foreground truncate">{sub}</p>}
  </div>
);

/** 실시간 소비전력: 제품 입력·콘센트·누적 전력량·월 요금, 부품별 전력 막대 */
export function PowerPanel({ s }) {
  const pn = s.powerNow;
  const cost = monthlyCost(s);
  const total = Math.max(pn.dc, 1e-6);
  // 작은 부하(센서·버튼 등)는 한 줄로 묶는다
  const big = pn.parts.filter((x) => x.w >= 0.01).sort((a, b) => b.w - a.w);
  const small = pn.parts.filter((x) => x.w < 0.01).reduce((a, x) => a + x.w, 0);
  const rows = small > 0 ? [...big, { key: 'small', name: '센서·버튼·기타', w: small, kind: 'etc' }] : big;
  const wallSide = pn.wall > 0;
  return (
    <Card title="실시간 소비전력" icon={Gauge} tag={s.mcu.on ? '측정 중' : 'MCU 꺼짐'}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Big label="제품 입력 (DC)" value={fmtW(pn.dc)} sub={`${s.rails.vin.toFixed(2)} V × ${s.rails.i.toFixed(2)} A`} />
        <Big label={wallSide ? '콘센트에서' : '배터리에서'} value={wallSide ? fmtW(pn.wall) : fmtW(pn.dc)} sub={wallSide ? `어댑터 효율 ${s.params.adapter_eff} %` : '콘센트 0 W'} />
        <Big label="누적 전력량" value={`${(wallSide ? s.energy.wallWh : s.energy.wh).toFixed(2)} Wh`} sub={`시뮬레이션 ${Math.round(s.t / 60)}분 동안`} />
        <Big label="한 달 전기요금 (추정)" value={wallSide ? `${cost.won.toLocaleString()}원` : '—'} sub={wallSide ? `하루 ${s.params.hours_day}시간 · ${s.params.price_kwh}원/kWh` : '배터리 사용'} />
      </div>
      <div className="space-y-1.5">
        <p className="text-caption font-semibold text-muted-foreground">부품별 전력 (합계 = 제품 입력)</p>
        {rows.map((x) => (
          <div key={x.key} className="grid grid-cols-[minmax(0,1fr)_72px_44px] items-center gap-2 text-caption">
            <div className="min-w-0">
              <p className="truncate">{x.name}{x.rated ? <span className="text-muted-foreground"> · 정격 {x.rated} W</span> : null}</p>
              <div className="mt-0.5 h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, (x.w / total) * 100)}%`, background: colorOf(x.kind) }} /></div>
            </div>
            <span className="text-right tabular-nums">{fmtW(x.w)}</span>
            <span className="text-right tabular-nums text-muted-foreground">{Math.round((x.w / total) * 100)}%</span>
          </div>
        ))}
      </div>
      <SimChart history={s.history} seconds={60} rows={[
        { label: '제품 입력', get: (h) => h.pw || 0, fmt: fmtW, color: 'hsl(var(--primary))', min: 0, span: 1 },
        ...(wallSide ? [{ label: '콘센트', get: (h) => h.wall || 0, fmt: fmtW, color: 'hsl(var(--chart-3))', min: 0, span: 1 }] : []),
      ]} />
    </Card>
  );
}

const tempTone = (t, max) => (t == null || max == null ? 'bg-primary' : t > max ? 'bg-destructive' : t > max * 0.8 ? 'bg-warning' : 'bg-success');

/** 발열·온도: 부품별 발열(W)·온도(°C)와 한계, 외장 내부 공기·표면 */
export function HeatPanel({ s }) {
  const p = s.params;
  // 온도를 따로 계산하지 않는 작은 부하(센서·버튼·표시등)는 한 줄로 묶는다
  const listed = s.heat.parts.filter((x) => x.temp != null || x.heat >= 0.02).sort((a, b) => b.heat - a.heat);
  const rest = s.heat.parts.filter((x) => x.temp == null && x.heat < 0.02).reduce((a, x) => a + x.heat, 0);
  const parts = rest > 0 ? [...listed, { key: 'rest', name: '센서·버튼·표시등 등', heat: rest }] : listed;
  const amb = Number(s.power.ambient) || 25;
  return (
    <Card title="발열·온도" icon={Thermometer} tag={`주변 ${amb} °C`}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Big label="외장 안 발열 합계" value={fmtW(s.heat.internal)} sub="히터는 외장으로 새는 열만" />
        <Big label="외장 내부 공기" value={`${s.thermal.tin.toFixed(1)} °C`} sub={`한계 ${p.inside_max} °C`} />
        <Big label="외장 표면 (추정)" value={`${s.thermal.surface.toFixed(1)} °C`} sub={`손 닿는 한계 ${p.touch_max} °C`} />
        <Big label="외장 열저항" value={`${s.heat.caseRth?.toFixed(2)} °C/W`} sub={`표면적 ${Math.round((s.heat.area || 0) * 10000)} cm²`} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[440px] text-caption">
          <thead className="text-left text-muted-foreground"><tr><th className="py-1 pr-2 font-medium">부품</th><th className="py-1 pr-2 text-right font-medium">발열</th><th className="py-1 pr-2 text-right font-medium">온도</th><th className="py-1 font-medium">한계까지</th></tr></thead>
          <tbody>
            {parts.map((x) => (
              <tr key={x.key} className="border-t">
                <td className="py-1.5 pr-2">{x.name}{x.rated ? <span className="text-muted-foreground"> · 정격 {x.rated} W</span> : null}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{fmtW(x.heat)}</td>
                <td className={`py-1.5 pr-2 text-right tabular-nums ${x.temp != null && x.tmax != null && x.temp > x.tmax ? 'font-semibold text-destructive' : ''}`}>{x.temp != null ? `${Math.round(x.temp)} °C` : '—'}</td>
                <td className="py-1.5 w-32">{x.temp != null && x.tmax != null ? (
                  <div className="flex items-center gap-1.5"><div className="h-1.5 flex-1 rounded-full bg-muted"><div className={`h-1.5 rounded-full ${tempTone(x.temp, x.tmax)}`} style={{ width: `${Math.min(100, Math.max(2, ((x.temp - amb) / Math.max(1, x.tmax - amb)) * 100))}%` }} /></div><span className="w-12 text-right text-micro tabular-nums text-muted-foreground">{x.tmax} °C</span></div>
                ) : <span className="text-micro text-muted-foreground">외장 안 공기로</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SimChart history={s.history} seconds={600} rows={[
        { label: '가장 뜨거운 부품', get: (h) => h.thot ?? amb, fmt: (v) => `${v.toFixed(0)} °C`, color: 'hsl(var(--destructive))', min: amb - 5, span: 10 },
        { label: '외장 내부 공기', get: (h) => h.tin ?? amb, fmt: (v) => `${v.toFixed(1)} °C`, color: 'hsl(var(--chart-3))', min: amb - 2, span: 5, ref: p.inside_max },
      ]} />
      <p className="text-micro text-muted-foreground">부품 → (열저항) → 외장 내부 공기 → (외장 표면적 × 열전달 계수) → 주변 의 RC 근사입니다. 히터 전력은 대부분 물·공기를 데우고, 외장 안으로 새는 몫만 내부 발열로 셉니다.</p>
    </Card>
  );
}

/** 부품 값 수정: 바꾸면 다음 계산부터 바로 반영 (설정 저장 시 프로젝트에 남는다) */
export function PartParamsPanel({ params, onChange, onReset, features, onHeaterW, changed }) {
  const groups = [...new Set(SIM_PARAMS.map((p) => p.group))];
  const heaters = features.filter((f) => f.kind === 'heater');
  return (
    <Card title="부품 값 수정" icon={SlidersHorizontal} tag={changed ? `바꾼 값 ${changed}개` : '기본값'}
      actions={changed > 0 && <Button size="sm" variant="ghost" onClick={onReset}><RotateCcw className="w-4 h-4" />기본값으로</Button>}>
      <p className="text-caption text-muted-foreground">값을 바꾸면 시뮬레이션에 바로 반영됩니다. 전력·발열·설계 점검이 어떻게 바뀌는지 보고, 마음에 들면 ‘설정 저장’을 누르세요.</p>
      {heaters.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-caption font-semibold">히터</p>
          {heaters.map((f) => (
            <label key={f.id} className="grid grid-cols-[minmax(0,1fr)_96px_44px] items-center gap-2 text-caption">
              <span className="truncate">{f.name} 정격 전력</span>
              <Input type="number" min={1} max={3000} step="1" value={heaterWatts(f)} onChange={(e) => onHeaterW(f.id, Math.max(1, Number(e.target.value) || 1))} className="h-8 tabular-nums" aria-label={`${f.name} 정격 전력`} />
              <span className="text-muted-foreground">W</span>
            </label>
          ))}
        </div>
      )}
      {groups.map((g) => (
        <div key={g} className="space-y-1.5">
          <p className="text-caption font-semibold">{g}</p>
          {SIM_PARAMS.filter((p) => p.group === g).map((p) => (
            <div key={p.key} className="space-y-0.5">
              <label className="grid grid-cols-[minmax(0,1fr)_96px_44px] items-center gap-2 text-caption">
                <span className={`truncate ${params[p.key] !== p.default ? 'font-semibold text-primary' : ''}`}>{p.label}</span>
                {p.type === 'select' ? (
                  <select value={params[p.key]} onChange={(e) => onChange(p.key, e.target.value)} className="col-span-2 h-8 rounded-md border bg-background px-2 text-caption" aria-label={p.label}>
                    {p.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                ) : (
                  <>
                    <Input type="number" min={p.min} max={p.max} step={p.step} value={params[p.key]} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(p.key, Math.max(p.min, Math.min(p.max, v))); }} className="h-8 tabular-nums" aria-label={p.label} />
                    <span className="text-muted-foreground">{p.unit}</span>
                  </>
                )}
              </label>
              {p.help && <p className="text-micro text-muted-foreground">{p.help}</p>}
            </div>
          ))}
        </div>
      ))}
    </Card>
  );
}
