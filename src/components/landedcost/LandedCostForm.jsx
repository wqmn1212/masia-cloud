import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MODES, TERMS, REGIONS, DEST_AREAS, SEGMENTS } from '@/lib/landedCost';

export const EMPTY_LANDED_INPUT = {
  cargoBy: 'BOX', cartons: '', lengthCm: '', widthCm: '', heightCm: '', kgPerCarton: '', totalCbm: '', totalKg: '',
  units: '', goodsValue: '', goodsCurrency: 'USD',
  mode: 'SEA_LCL', term: 'FOB', region: 'SOUTH', destArea: 'CAPITAL',
  dutyRate: 8, fta: false, ftaRate: 0, insure: false, battery: 'NONE', storageDays: 0, usdKrw: '', actual: {},
};

// 공개 랜딩 디자인(InquiryField·카테고리 칩)과 같은 규칙
const inputCls = 'w-full border border-landing-line3 rounded-[9px] px-[13px] py-[11px] text-[14.5px] outline-none bg-landing-input text-landing-ink placeholder:text-landing-muted3 focus:border-landing-brand focus:bg-white transition-colors';
const labelCls = 'text-[13px] font-bold text-landing-ink2';
const hintCls = 'text-[12.5px] leading-[1.6] text-landing-muted';

const Field = ({ label, hint, children, className }) => (
  <label className={cn('lm-field flex min-w-0 flex-col gap-1.5', className)}>
    <span className={labelCls}>{label}</span>
    {children}
    {hint && <span className={hintCls}>{hint}</span>}
  </label>
);

const Num = ({ value, onChange, placeholder, step, suffix }) => (
  <div className="relative">
    <input type="number" inputMode="decimal" min="0" step={step} className={cn(inputCls, suffix && 'pr-14')} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    {suffix && <span className="pointer-events-none absolute right-[13px] top-1/2 -translate-y-1/2 text-[13px] text-landing-muted2">{suffix}</span>}
  </div>
);

const Pick = ({ value, onChange, options }) => (
  <div className="relative">
    <select className={cn(inputCls, 'appearance-none pr-9 text-[16px]')} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-landing-muted2" />
  </div>
);

// 문의 폼 카테고리 칩과 같은 선택 버튼
const Chips = ({ value, onChange, options, render }) => (
  <div className="flex flex-wrap gap-[7px]">
    {options.map((o) => {
      const on = value === o.value;
      return (
        <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(o.value)}
          className={cn('flex-none whitespace-nowrap rounded-lg border px-[13px] py-2 text-[13px] font-semibold transition-colors',
            on ? 'border-landing-brand bg-landing-tint text-landing-brand' : 'border-landing-line2 bg-white text-landing-ink2 hover:border-landing-line3')}>
          {render ? render(o) : o.label}
        </button>
      );
    })}
  </div>
);

const Step = ({ no, title, children }) => (
  <section className="border-t border-landing-line pt-6 first:border-0 first:pt-0">
    <div className="text-[11px] font-extrabold tracking-[.08em] text-landing-brand">STEP {no}</div>
    <h2 className="mt-1 text-[18px] font-extrabold tracking-[-.4px] text-landing-ink">{title}</h2>
    <div className="mt-4 space-y-4">{children}</div>
  </section>
);

const TERM_SHORT = { EXW: '공장 인도', FCA: '운송인 인도', FOB: '중국 항구 선적', CFR: '한국 항구까지 운임', CIF: '한국 항구까지 운임·보험', DAP: '문 앞 (세금 별도)', DDP: '문 앞 (세금 포함)' };
const MODE_SHORT = { SEA_LCL: '해상 LCL', SEA_FCL20: 'FCL 20ft', SEA_FCL40: 'FCL 40ft', AIR: '항공', EXPRESS: '특송' };

// 공개 물류비 계산기 입력
export default function LandedCostForm({ value, onChange, defaultUsdKrw }) {
  const [more, setMore] = useState(false);
  const v = value;
  const set = (k) => (x) => onChange({ ...v, [k]: x });
  const setActual = (seg) => (x) => onChange({ ...v, actual: { ...(v.actual || {}), [seg]: x } });
  const term = TERMS.find((t) => t.value === v.term);
  const mode = MODES.find((m) => m.value === v.mode);

  return (
    <div className="space-y-6">
      <Step no="1" title="화물">
        <Chips value={v.cargoBy} onChange={set('cargoBy')} options={[{ value: 'BOX', label: '박스 치수로 입력' }, { value: 'TOTAL', label: '총 부피로 입력' }]} />
        {v.cargoBy === 'BOX' ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="박스 수"><Num value={v.cartons} onChange={set('cartons')} placeholder="120" suffix="박스" /></Field>
            <Field label="박스당 무게"><Num value={v.kgPerCarton} onChange={set('kgPerCarton')} placeholder="8" suffix="kg" /></Field>
            <div className="hidden sm:block" />
            <Field label="가로"><Num value={v.lengthCm} onChange={set('lengthCm')} placeholder="50" suffix="cm" /></Field>
            <Field label="세로"><Num value={v.widthCm} onChange={set('widthCm')} placeholder="40" suffix="cm" /></Field>
            <Field label="높이"><Num value={v.heightCm} onChange={set('heightCm')} placeholder="30" suffix="cm" /></Field>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="총 부피"><Num value={v.totalCbm} onChange={set('totalCbm')} placeholder="9.5" step="0.1" suffix="CBM" /></Field>
            <Field label="총 무게"><Num value={v.totalKg} onChange={set('totalKg')} placeholder="1200" suffix="kg" /></Field>
          </div>
        )}
        <p className={hintCls}>포장을 마친 박스 기준으로 넣어 주세요. 운송비는 무게보다 부피로 매겨지는 경우가 많습니다.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="제품 개수" hint="개당 비용을 계산할 때 씁니다"><Num value={v.units} onChange={set('units')} placeholder="4800" suffix="개" /></Field>
          <Field label="배터리"><Pick value={v.battery} onChange={set('battery')} options={[{ value: 'NONE', label: '없음' }, { value: 'CONTAINED', label: '제품에 내장' }, { value: 'STANDALONE', label: '배터리 단독' }]} /></Field>
        </div>
      </Step>

      <Step no="2" title="공장 견적과 거래 조건">
        <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
          <Field label="공장 견적 금액"><Num value={v.goodsValue} onChange={set('goodsValue')} placeholder="9000" /></Field>
          <Field label="통화"><Pick value={v.goodsCurrency} onChange={set('goodsCurrency')} options={[{ value: 'USD', label: 'USD ($)' }, { value: 'KRW', label: 'KRW (원)' }]} /></Field>
        </div>
        <div className="flex flex-col gap-2">
          <span className={labelCls}>공장 견적서의 거래 조건</span>
          <Chips value={v.term} onChange={set('term')} options={TERMS} render={(o) => <><b className="font-extrabold">{o.value}</b> <span className="font-medium">{TERM_SHORT[o.value]}</span></>} />
          <span className={hintCls}>{term?.hint}. 견적서에 FOB·CIF 같은 조건이 적혀 있습니다.</span>
        </div>
      </Step>

      <Step no="3" title="운송">
        <div className="flex flex-col gap-2">
          <span className={labelCls}>운송 방식</span>
          <Chips value={v.mode} onChange={set('mode')} options={MODES} render={(o) => MODE_SHORT[o.value]} />
          <span className={hintCls}>{mode?.hint} · {mode?.transit}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="출발 지역"><Pick value={v.region} onChange={set('region')} options={REGIONS} /></Field>
          <Field label="도착 지역"><Pick value={v.destArea} onChange={set('destArea')} options={DEST_AREAS} /></Field>
        </div>
      </Step>

      <Step no="4" title="세금">
        <div className="grid grid-cols-2 gap-3">
          <Field label="관세율" hint="품목(HS코드)마다 다릅니다. 공산품은 8%가 많습니다"><Num value={v.dutyRate} onChange={set('dutyRate')} step="0.1" suffix="%" /></Field>
          {v.fta
            ? <Field label="한중 FTA 협정 세율"><Num value={v.ftaRate} onChange={set('ftaRate')} step="0.1" suffix="%" /></Field>
            : <div />}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[14px] text-landing-ink2">
          <input type="checkbox" className="h-4 w-4 accent-[#0066FF]" checked={!!v.fta} onChange={(e) => onChange({ ...v, fta: e.target.checked })} />
          한중 FTA 원산지증명서가 있습니다
        </label>
      </Step>

      <div className="border-t border-landing-line pt-5">
        <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="flex items-center gap-1.5 text-[14px] font-bold text-landing-brand">
          <ChevronDown className={cn('h-4 w-4 transition-transform', more && 'rotate-180')} />받은 견적이 있으면 더 정확하게
        </button>
        {more && (
          <div className="mt-4 space-y-4 rounded-[10px] border border-landing-line bg-landing-page p-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="환율" hint={defaultUsdKrw ? `비우면 오늘 환율 ${Number(defaultUsdKrw).toLocaleString('ko-KR')}원` : '비우면 1,400원'}><Num value={v.usdKrw} onChange={set('usdKrw')} placeholder={defaultUsdKrw ? String(defaultUsdKrw) : '1400'} suffix="원/$" /></Field>
              <Field label="무료 기간 초과 보관" hint="통관이 늦어질 때"><Num value={v.storageDays} onChange={set('storageDays')} suffix="일" /></Field>
            </div>
            {!['CIF', 'DAP', 'DDP'].includes(v.term) && (
              <label className="flex cursor-pointer items-center gap-2 text-[14px] text-landing-ink2">
                <input type="checkbox" className="h-4 w-4 accent-[#0066FF]" checked={!!v.insure} onChange={(e) => onChange({ ...v, insure: e.target.checked })} />적하보험에 가입합니다
              </label>
            )}
            <div>
              <p className={labelCls}>구간별로 받은 견적 금액</p>
              <p className={cn(hintCls, 'mt-1')}>넣은 구간은 이지스 요율 대신 이 금액으로 계산합니다. 포워더 견적이 가장 정확합니다.</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {SEGMENTS.filter((s) => s.key !== 'E').map((s) => (
                  <Field key={s.key} label={`${s.key}. ${s.short}`}><Num value={v.actual?.[s.key]} onChange={setActual(s.key)} placeholder="자동" suffix="원" /></Field>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
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
