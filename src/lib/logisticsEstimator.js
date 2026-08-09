// 중국 → 한국 물류비 근사치 추정 엔진 (USD 기준)
// 시장 평균 참고 단가 — 실제 포워더 견적으로 보정해서 사용

export const SHIP_MODES = [
  { value: 'SEA_LCL', label: '해상 LCL (소량 · CBM 과금)' },
  { value: 'SEA_FCL_20', label: '해상 FCL 20FT 컨테이너' },
  { value: 'SEA_FCL_40', label: '해상 FCL 40FT 컨테이너' },
  { value: 'AIR', label: '항공 (부피중량 /6000)' },
  { value: 'EXPRESS', label: '특송 (DHL/FedEx 급)' },
];

// 운송 조건 — 조건별로 어떤 비용이 우리 부담인지 결정
export const SHIP_TERMS = [
  { value: 'EXW',  label: 'EXW · 공장 인도 (중국 내륙운송부터 전부 우리 부담)', origin_inland: true, main_freight: true, insurance: false, dest_charge: true, dest_inland: false, customs: false },
  { value: 'FOB',  label: 'FOB · 본선 인도 (중국 항구까지 공장 부담)',          origin_inland: false, main_freight: true, insurance: false, dest_charge: true, dest_inland: false, customs: false },
  { value: 'CFR',  label: 'CFR · 운임 포함 (한국 항구까지 운임 포함)',           origin_inland: false, main_freight: false, insurance: false, dest_charge: true, dest_inland: false, customs: false },
  { value: 'CIF',  label: 'CIF · 운임+보험 포함',                              origin_inland: false, main_freight: false, insurance: true, dest_charge: true, dest_inland: false, customs: false },
  { value: 'DAP',  label: 'DAP · 지정 장소 인도 (통관 제외 문전 배송)',          origin_inland: true, main_freight: true, insurance: true, dest_charge: true, dest_inland: true, customs: false },
  { value: 'DDP',  label: 'DDP / D2D · 문전 인도 (통관·세금까지 전부)',          origin_inland: true, main_freight: true, insurance: true, dest_charge: true, dest_inland: true, customs: true },
];

// 시장 평균 근사 단가 (USD)
export const RATE_TABLE = {
  SEA_LCL:     { freight_per_cbm: 65, min_cbm: 1, dest_charge_per_cbm: 42, dest_charge_min: 110 },
  SEA_FCL_20:  { flat_freight: 550, cbm_capacity: 28, dest_charge: 330 },
  SEA_FCL_40:  { flat_freight: 780, cbm_capacity: 58, dest_charge: 420 },
  AIR:         { freight_per_kg: 4.5, divisor: 6000, dest_charge: 90, min_freight: 120 },
  EXPRESS:     { freight_per_kg: 8.0, divisor: 5000, dest_charge: 30, min_freight: 60 },
};

const ORIGIN_INLAND_PER_CBM = 18;   // 중국 공장 → 항구 내륙운송
const ORIGIN_INLAND_MIN = 120;
const DEST_INLAND_PER_CBM = 22;     // 한국 항구 → 문전 배송
const DEST_INLAND_MIN = 130;
const CUSTOMS_BROKER_FEE = 60;      // 관세사 통관 대행 수수료
const INSURANCE_RATE = 0.003;       // 화물가 대비 적하보험료 0.3%
const DUTY_RATE = 0.08;             // 기계류 평균 관세 8% (가정)
const VAT_RATE = 0.10;              // 부가세 10%

export function calcCbm({ lengthCm, widthCm, heightCm, quantity = 1 }) {
  const l = Number(lengthCm) || 0, w = Number(widthCm) || 0, h = Number(heightCm) || 0;
  const q = Number(quantity) || 1;
  return (l * w * h * q) / 1_000_000;
}

export function estimateLogistics({
  mode = 'SEA_LCL',
  term = 'FOB',
  lengthCm, widthCm, heightCm,
  weightKg = 0,
  quantity = 1,
  cargoValueUsd = 0,
  includeDutyVat = false,
  historicalPerCbm = null,   // 과거 견적 데이터 평균 (USD/CBM) — 있으면 운임 보정
}) {
  const t = SHIP_TERMS.find(x => x.value === term) || SHIP_TERMS[1];
  const rate = RATE_TABLE[mode] || RATE_TABLE.SEA_LCL;
  const cbm = calcCbm({ lengthCm, widthCm, heightCm, quantity });
  const actualKg = (Number(weightKg) || 0) * (Number(quantity) || 1);
  const volKg = rate.divisor ? (cbm * 1_000_000) / rate.divisor : 0;
  const chargeableKg = Math.max(actualKg, volKg);

  const lines = [];
  const add = (label, amount, note) => { if (amount > 0) lines.push({ label, amount: Math.round(amount), note }); };

  // 1) 중국 내륙운송
  if (t.origin_inland) {
    add('중국 내륙운송 (공장→항구/공항)', Math.max(cbm * ORIGIN_INLAND_PER_CBM, ORIGIN_INLAND_MIN));
  }

  // 2) 주요 운임
  let freight = 0;
  if (mode === 'SEA_LCL') {
    const billCbm = Math.max(cbm, rate.min_cbm);
    const perCbm = historicalPerCbm > 0 ? (rate.freight_per_cbm + historicalPerCbm) / 2 : rate.freight_per_cbm;
    freight = billCbm * perCbm;
  } else if (mode === 'SEA_FCL_20' || mode === 'SEA_FCL_40') {
    const containers = Math.max(1, Math.ceil(cbm / rate.cbm_capacity));
    freight = containers * rate.flat_freight;
  } else {
    freight = Math.max(chargeableKg * rate.freight_per_kg, rate.min_freight);
  }
  if (t.main_freight) add('주요 운임 (중국→한국)', freight);
  else lines.push({ label: '주요 운임', amount: 0, note: '조건상 판매자/공장 포함' });

  // 3) 적하보험
  if (t.insurance && cargoValueUsd > 0) add('적하보험료 (화물가 0.3%)', cargoValueUsd * INSURANCE_RATE);

  // 4) 도착지 항만/터미널 부대비
  if (t.dest_charge) {
    const destCharge = mode === 'SEA_LCL'
      ? Math.max(cbm * rate.dest_charge_per_cbm, rate.dest_charge_min)
      : rate.dest_charge;
    add('도착지 부대비 (THC·서류·창고)', destCharge);
  }

  // 5) 한국 내륙운송
  if (t.dest_inland) add('한국 내륙운송 (항구→문전)', Math.max(cbm * DEST_INLAND_PER_CBM, DEST_INLAND_MIN));

  // 6) 통관 + 세금
  if (t.customs) {
    add('통관 대행 수수료', CUSTOMS_BROKER_FEE);
    if (includeDutyVat && cargoValueUsd > 0) {
      const duty = cargoValueUsd * DUTY_RATE;
      add('관세 (평균 8% 가정)', duty);
      add('부가세 (10%)', (cargoValueUsd + duty) * VAT_RATE);
    }
  }

  const total = lines.reduce((s, l) => s + l.amount, 0);
  return {
    cbm: Number(cbm.toFixed(3)),
    actualKg,
    volumetricKg: Math.round(volKg),
    chargeableKg: Math.round(chargeableKg),
    lines,
    total,
    perCbm: cbm > 0 ? Math.round(total / cbm) : 0,
    usedHistorical: mode === 'SEA_LCL' && historicalPerCbm > 0,
  };
}