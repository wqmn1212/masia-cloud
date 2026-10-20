import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MODES, TERMS, REGIONS, DEST_AREAS, SEGMENTS } from '@/lib/landedCost';

export const EMPTY_LANDED_INPUT = {
  cargoBy: 'BOX', cartons: '', lengthCm: '', widthCm: '', heightCm: '', kgPerCarton: '', totalCbm: '', totalKg: '',
  units: '', goodsValue: '', goodsCurrency: 'USD',
  mode: 'SEA_LCL', term: 'FOB', region: 'SOUTH', destArea: 'CAPITAL',
  dutyRate: 8, fta: false, ftaRate: 0, insure: false, battery: 'NONE', storageDays: 0, usdKrw: '', actual: {},
};

const Field = ({ label, hint, children, className = '' }) => (
  <div className={className}>
    <Label className="text-xs font-semibold">{label}</Label>
    <div className="mt-1">{children}</div>
    {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
  </div>
);

const Pick = ({ value, onChange, options }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
    <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value} className="text-sm">{o.label}</SelectItem>)}</SelectContent>
  </Select>
);

const Num = ({ value, onChange, placeholder, step }) => (
  <Input type="number" inputMode="decimal" min="0" step={step} className="h-9 text-sm" value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
);

const Seg = ({ value, onChange, options }) => (
  <div className="inline-flex rounded-lg border p-0.5">
    {options.map((o) => (
      <button key={o.value} type="button" onClick={() => onChange(o.value)}
        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${value === o.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
        {o.label}
      </button>
    ))}
  </div>
);

// 계산기 입력 — 공개 페이지와 직원 견적 화면이 같이 쓴다.
export default function LandedCostForm({ value, onChange, defaultUsdKrw }) {
  const [more, setMore] = useState(false);
  const v = value;
  const set = (k) => (x) => onChange({ ...v, [k]: x });
  const setActual = (seg) => (x) => onChange({ ...v, actual: { ...(v.actual || {}), [seg]: x } });
  const term = TERMS.find((t) => t.value === v.term);
  const mode = MODES.find((m) => m.value === v.mode);

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold">1. 화물</h3>
          <Seg value={v.cargoBy} onChange={set('cargoBy')} options={[{ value: 'BOX', label: '박스 치수로' }, { value: 'TOTAL', label: '총 부피로' }]} />
        </div>
        {v.cargoBy === 'BOX' ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Field label="박스 수"><Num value={v.cartons} onChange={set('cartons')} placeholder="100" /></Field>
            <Field label="가로 (cm)"><Num value={v.lengthCm} onChange={set('lengthCm')} placeholder="50" /></Field>
            <Field label="세로 (cm)"><Num value={v.widthCm} onChange={set('widthCm')} placeholder="40" /></Field>
            <Field label="높이 (cm)"><Num value={v.heightCm} onChange={set('heightCm')} placeholder="30" /></Field>
            <Field label="박스당 무게 (kg)"><Num value={v.kgPerCarton} onChange={set('kgPerCarton')} placeholder="8" /></Field>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="총 부피 (CBM)"><Num value={v.totalCbm} onChange={set('totalCbm')} placeholder="9.5" step="0.1" /></Field>
            <Field label="총 무게 (kg)"><Num value={v.totalKg} onChange={set('totalKg')} placeholder="1200" /></Field>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="제품 개수" hint="개당 비용 계산용"><Num value={v.units} onChange={set('units')} placeholder="5000" /></Field>
          <Field label="공장 견적 금액" hint={`${term?.value || ''} 조건 기준 금액`}><Num value={v.goodsValue} onChange={set('goodsValue')} placeholder="10000" /></Field>
          <Field label="통화"><Pick value={v.goodsCurrency} onChange={set('goodsCurrency')} options={[{ value: 'USD', label: 'USD ($)' }, { value: 'KRW', label: 'KRW (원)' }]} /></Field>
          <Field label="배터리"><Pick value={v.battery} onChange={set('battery')} options={[{ value: 'NONE', label: '없음' }, { value: 'CONTAINED', label: '제품에 내장' }, { value: 'STANDALONE', label: '배터리 단독' }]} /></Field>
        </div>
        <p className="text-[11px] text-muted-foreground">포장을 마친 박스 기준으로 넣어 주세요. 운송비는 무게가 아니라 부피로 매겨지는 경우가 많습니다.</p>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-bold">2. 경로와 거래 조건</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="출발 지역"><Pick value={v.region} onChange={set('region')} options={REGIONS} /></Field>
          <Field label="도착 지역"><Pick value={v.destArea} onChange={set('destArea')} options={DEST_AREAS} /></Field>
          <Field label="운송 방식" hint={mode?.hint}><Pick value={v.mode} onChange={set('mode')} options={MODES} /></Field>
          <Field label="공장과의 거래 조건" hint={term?.hint}><Pick value={v.term} onChange={set('term')} options={TERMS} /></Field>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-bold">3. 세금</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="관세율 (%)" hint="품목(HS코드)마다 다름. 공산품 다수가 8%"><Num value={v.dutyRate} onChange={set('dutyRate')} step="0.1" /></Field>
          <Field label="한중 FTA 원산지증명서">
            <label className="flex h-9 items-center gap-2 text-sm"><input type="checkbox" checked={!!v.fta} onChange={(e) => onChange({ ...v, fta: e.target.checked })} />있음</label>
          </Field>
          {v.fta && <Field label="FTA 협정 세율 (%)"><Num value={v.ftaRate} onChange={set('ftaRate')} step="0.1" /></Field>}
        </div>
      </section>

      <button type="button" onClick={() => setMore((m) => !m)} className="flex items-center gap-1 text-xs font-semibold text-primary">
        <ChevronDown className={`h-4 w-4 transition-transform ${more ? 'rotate-180' : ''}`} />정확도 높이기 (받은 견적 금액·환율·보관 일수)
      </button>
      {more && (
        <section className="space-y-4 rounded-xl border bg-muted/30 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="환율 (원/$)" hint={defaultUsdKrw ? `비우면 오늘 환율 ${Number(defaultUsdKrw).toLocaleString('ko-KR')}원` : '비우면 1,400원'}><Num value={v.usdKrw} onChange={set('usdKrw')} placeholder={defaultUsdKrw ? String(defaultUsdKrw) : '1400'} /></Field>
            <Field label="무료 기간 초과 보관 (일)" hint="통관 지연 대비"><Num value={v.storageDays} onChange={set('storageDays')} /></Field>
            {!['CIF', 'DAP', 'DDP'].includes(v.term) && (
              <Field label="적하보험">
                <label className="flex h-9 items-center gap-2 text-sm"><input type="checkbox" checked={!!v.insure} onChange={(e) => onChange({ ...v, insure: e.target.checked })} />가입</label>
              </Field>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold">받은 견적이 있으면 구간별로 넣으세요 (원)</p>
            <p className="text-[11px] text-muted-foreground">넣은 구간은 요율 대신 이 금액으로 계산합니다. 포워더 견적이 가장 정확합니다.</p>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {SEGMENTS.filter((s) => s.key !== 'E').map((s) => (
                <Field key={s.key} label={`${s.key}. ${s.short}`}><Num value={v.actual?.[s.key]} onChange={setActual(s.key)} placeholder="자동" /></Field>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

// 폼 값 → 엔진 입력
export function toEngineInput(v, defaultUsdKrw) {
  const box = v.cargoBy === 'BOX';
  return {
    ...v,
    cartons: box ? v.cartons : 0,
    totalCbm: box ? 0 : v.totalCbm,
    totalKg: box ? 0 : v.totalKg,
    usdKrw: Number(v.usdKrw) || Number(defaultUsdKrw) || 1400,
  };
}
