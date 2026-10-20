// 중국 → 한국 수입 도착 원가 계산 엔진.
// 비용을 구간 A~F 로 나눠 계산하고, 거래 조건(인코텀즈)은 각 구간을 판매자·구매자 중 누가 내는지만 정한다.
// 요율은 코드가 아니라 데이터(LogisticsRate)로 관리하고, 여기의 DEFAULT_RATES 는 DB 가 비었을 때의 기본값이다.
// 각 요율에는 verified(실제 청구서로 확인) 여부가 있어, 결과 화면이 확인된 숫자와 추정 숫자를 구분해 보여 준다.

export const SEGMENTS = [
  { key: 'A', label: '중국 내륙 운송·수출 통관', short: '중국 내륙' },
  { key: 'B', label: '출발지 터미널·선적', short: '출발지' },
  { key: 'C', label: '국제 운송', short: '국제 운송' },
  { key: 'D', label: '한국 도착지 비용', short: '도착지' },
  { key: 'E', label: '관세·부가세·통관', short: '세금·통관' },
  { key: 'F', label: '한국 내륙 운송', short: '국내 운송' },
];

export const MODES = [
  { value: 'SEA_LCL', label: '해상 LCL', hint: '여러 화주와 컨테이너를 나눠 씀 · 부피(CBM) 과금', transit: '출항 후 약 1~2주' },
  { value: 'SEA_FCL20', label: '해상 FCL 20ft', hint: '컨테이너 하나를 통째로 · 약 28CBM', transit: '출항 후 약 1주' },
  { value: 'SEA_FCL40', label: '해상 FCL 40ft', hint: '컨테이너 하나를 통째로 · 약 58CBM', transit: '출항 후 약 1주' },
  { value: 'AIR', label: '항공 화물', hint: '실중량과 부피중량(÷6,000) 중 큰 값', transit: '약 3~5일' },
  { value: 'EXPRESS', label: '특송 (DHL·FedEx 등)', hint: '문 앞까지 · 부피중량 ÷5,000', transit: '약 2~4일' },
];

// 구간별 판매자 부담 여부 (나머지는 구매자). 보험은 CIF·CIP 에서만 판매자 의무.
export const TERMS = [
  { value: 'EXW', label: 'EXW · 공장 인도', seller: [], hint: '공장 문 앞에서 넘김. 운송비 전부 별도' },
  { value: 'FCA', label: 'FCA · 운송인 인도', seller: ['A'], hint: '수출 통관 후 지정 장소에서 넘김' },
  { value: 'FOB', label: 'FOB · 중국 항구 선적', seller: ['A', 'B'], hint: '배에 실을 때까지 판매자' },
  { value: 'CFR', label: 'CFR · 한국 항구까지 운임', seller: ['A', 'B', 'C'], hint: '운임 포함, 보험·도착 후 비용 별도' },
  { value: 'CIF', label: 'CIF · 한국 항구까지 운임·보험', seller: ['A', 'B', 'C'], insuranceBySeller: true, hint: '항구 도착까지. 도착 후 비용은 별도' },
  { value: 'DAP', label: 'DAP · 문 앞 배송 (세금 별도)', seller: ['A', 'B', 'C', 'D', 'F'], hint: 'D2D 중 관세·부가세는 구매자' },
  { value: 'DDP', label: 'DDP · 문 앞 배송 (세금 포함)', seller: ['A', 'B', 'C', 'D', 'E', 'F'], hint: 'D2D 중 세금까지 판매자' },
];

export const REGIONS = [
  { value: 'SOUTH', label: '화남 (광둥·푸젠)' },
  { value: 'EAST', label: '화동 (저장·장쑤·상하이)' },
  { value: 'NORTH', label: '화북·산둥 (칭다오·톈진)' },
];

export const DEST_AREAS = [
  { value: 'CAPITAL', label: '수도권' },
  { value: 'OTHER', label: '그 외 지역' },
];

export const UNITS = {
  PER_RT: 'R/T당',
  PER_SHIPMENT: '건당',
  PER_KG: 'kg당',
  PER_CNTR: '컨테이너당',
  PER_DAY_RT: 'R/T·일당',
  PER_DAY_CNTR: '컨테이너·일당',
  TIER: '부피 구간',
  PER_RT_OVER: '초과 R/T당',
  PCT_GOODS: '물품가 대비 %',
  FACTOR: '배수',
};

const LCL_DO_SOURCE = '포워더 D/O 산정표 (인천 LCL, 2026-10)';

// 기본 요율. verified=true 는 실제 청구서로 확인한 값, 나머지는 시장 평균 추정이다(관리자 화면에서 교체).
export const DEFAULT_RATES = [
  // ── 해상 LCL ─────────────────────────────────────────────
  // A·B·C 합계는 실제 1건(화남 동관 → 위해 → 인천 9.5CBM, CIF $962)에 맞췄고 구간 배분은 추정이다.
  { mode: 'SEA_LCL', segment: 'A', code: 'ORIGIN_INLAND', label: '공장 → 출발 항구 내륙 운송·수출 통관', unit: 'PER_RT', amount: 52, currency: 'USD', region: 'SOUTH', min: 80, note: '화남은 북부 항구(위해 등) 경유가 많아 내륙 구간이 김' },
  { mode: 'SEA_LCL', segment: 'A', code: 'ORIGIN_INLAND', label: '공장 → 출발 항구 내륙 운송·수출 통관', unit: 'PER_RT', amount: 25, currency: 'USD', region: 'EAST', min: 60 },
  { mode: 'SEA_LCL', segment: 'A', code: 'ORIGIN_INLAND', label: '공장 → 출발 항구 내륙 운송·수출 통관', unit: 'PER_RT', amount: 12, currency: 'USD', region: 'NORTH', min: 50 },
  { mode: 'SEA_LCL', segment: 'B', code: 'ORIGIN_CFS', label: '출발지 창고 적입·THC', unit: 'PER_RT', amount: 18, currency: 'USD' },
  { mode: 'SEA_LCL', segment: 'B', code: 'ORIGIN_DOC', label: '출발지 서류비 (B/L)', unit: 'PER_SHIPMENT', amount: 30, currency: 'USD' },
  { mode: 'SEA_LCL', segment: 'C', code: 'OCEAN', label: '해상 운임', unit: 'PER_RT', amount: 28.1, currency: 'USD', region: 'SOUTH', note: 'A·B·C 합계를 실제 CIF $962 / 9.5CBM 에 맞춘 값' },
  { mode: 'SEA_LCL', segment: 'C', code: 'OCEAN', label: '해상 운임', unit: 'PER_RT', amount: 20, currency: 'USD', region: 'EAST' },
  { mode: 'SEA_LCL', segment: 'C', code: 'OCEAN', label: '해상 운임', unit: 'PER_RT', amount: 15, currency: 'USD', region: 'NORTH' },
  // 도착지 7항목은 포워더 D/O 산정표 그대로 (9.5CBM → 463,919원으로 검산됨)
  { mode: 'SEA_LCL', segment: 'D', code: 'WHARFAGE', label: '부두 사용료 (Wharfage)', unit: 'PER_RT', amount: 323, currency: 'KRW', verified: true, source: LCL_DO_SOURCE },
  { mode: 'SEA_LCL', segment: 'D', code: 'THC', label: '터미널 작업비 (THC)', unit: 'PER_RT', amount: 6500, currency: 'KRW', verified: true, source: LCL_DO_SOURCE },
  { mode: 'SEA_LCL', segment: 'D', code: 'DOC_FEE', label: 'D/O 서류비', unit: 'PER_SHIPMENT', amount: 40000, currency: 'KRW', verified: true, source: LCL_DO_SOURCE },
  { mode: 'SEA_LCL', segment: 'D', code: 'BAF_CAF', label: '유류·환율 할증료 (BAF·CAF)', unit: 'PER_RT', amount: 10, currency: 'USD', fx_krw: 1200, verified: true, source: LCL_DO_SOURCE, note: '한중 LCL 은 할증료를 한국 도착지에서 받는 경우가 많음. 포워더 자체 기준환율로 청구' },
  { mode: 'SEA_LCL', segment: 'D', code: 'CNTR_CLEANING', label: '컨테이너 청소비', unit: 'PER_RT', amount: 800, currency: 'KRW', verified: true, source: LCL_DO_SOURCE },
  { mode: 'SEA_LCL', segment: 'D', code: 'DRAYAGE', label: '부두 → 보세창고 운송', unit: 'PER_RT', amount: 7000, currency: 'KRW', verified: true, source: LCL_DO_SOURCE },
  { mode: 'SEA_LCL', segment: 'D', code: 'CFS', label: '보세창고 작업비 (CFS)', unit: 'PER_RT', amount: 18000, currency: 'KRW', verified: true, source: LCL_DO_SOURCE },
  { mode: 'SEA_LCL', segment: 'D', code: 'STORAGE', label: '창고 보관료 (무료 기간 초과)', unit: 'PER_DAY_RT', amount: 1500, currency: 'KRW', variable: true },

  // ── 해상 FCL ─────────────────────────────────────────────
  { mode: 'SEA_FCL20', segment: 'A', code: 'ORIGIN_TRUCK', label: '공장 적입 트럭·수출 통관', unit: 'PER_CNTR', amount: 300, currency: 'USD', region: 'SOUTH' },
  { mode: 'SEA_FCL20', segment: 'A', code: 'ORIGIN_TRUCK', label: '공장 적입 트럭·수출 통관', unit: 'PER_CNTR', amount: 200, currency: 'USD', region: 'EAST' },
  { mode: 'SEA_FCL20', segment: 'A', code: 'ORIGIN_TRUCK', label: '공장 적입 트럭·수출 통관', unit: 'PER_CNTR', amount: 150, currency: 'USD', region: 'NORTH' },
  { mode: 'SEA_FCL20', segment: 'B', code: 'ORIGIN_THC', label: '출발지 THC·서류·봉인', unit: 'PER_CNTR', amount: 130, currency: 'USD' },
  { mode: 'SEA_FCL20', segment: 'C', code: 'OCEAN', label: '해상 운임 (할증 포함)', unit: 'PER_CNTR', amount: 350, currency: 'USD', region: 'SOUTH' },
  { mode: 'SEA_FCL20', segment: 'C', code: 'OCEAN', label: '해상 운임 (할증 포함)', unit: 'PER_CNTR', amount: 250, currency: 'USD', region: 'EAST' },
  { mode: 'SEA_FCL20', segment: 'C', code: 'OCEAN', label: '해상 운임 (할증 포함)', unit: 'PER_CNTR', amount: 200, currency: 'USD', region: 'NORTH' },
  { mode: 'SEA_FCL20', segment: 'D', code: 'DEST_FCL', label: '도착지 THC·D/O·부두·세척', unit: 'PER_CNTR', amount: 330, currency: 'USD' },
  { mode: 'SEA_FCL20', segment: 'D', code: 'DEMURRAGE', label: '컨테이너 지체료 (DEM/DET)', unit: 'PER_DAY_CNTR', amount: 40, currency: 'USD', variable: true },
  { mode: 'SEA_FCL20', segment: 'F', code: 'TRAILER', label: '컨테이너 트레일러 운송', unit: 'PER_CNTR', amount: 350000, currency: 'KRW' },
  { mode: 'SEA_FCL40', segment: 'A', code: 'ORIGIN_TRUCK', label: '공장 적입 트럭·수출 통관', unit: 'PER_CNTR', amount: 400, currency: 'USD', region: 'SOUTH' },
  { mode: 'SEA_FCL40', segment: 'A', code: 'ORIGIN_TRUCK', label: '공장 적입 트럭·수출 통관', unit: 'PER_CNTR', amount: 260, currency: 'USD', region: 'EAST' },
  { mode: 'SEA_FCL40', segment: 'A', code: 'ORIGIN_TRUCK', label: '공장 적입 트럭·수출 통관', unit: 'PER_CNTR', amount: 200, currency: 'USD', region: 'NORTH' },
  { mode: 'SEA_FCL40', segment: 'B', code: 'ORIGIN_THC', label: '출발지 THC·서류·봉인', unit: 'PER_CNTR', amount: 180, currency: 'USD' },
  { mode: 'SEA_FCL40', segment: 'C', code: 'OCEAN', label: '해상 운임 (할증 포함)', unit: 'PER_CNTR', amount: 550, currency: 'USD', region: 'SOUTH' },
  { mode: 'SEA_FCL40', segment: 'C', code: 'OCEAN', label: '해상 운임 (할증 포함)', unit: 'PER_CNTR', amount: 400, currency: 'USD', region: 'EAST' },
  { mode: 'SEA_FCL40', segment: 'C', code: 'OCEAN', label: '해상 운임 (할증 포함)', unit: 'PER_CNTR', amount: 330, currency: 'USD', region: 'NORTH' },
  { mode: 'SEA_FCL40', segment: 'D', code: 'DEST_FCL', label: '도착지 THC·D/O·부두·세척', unit: 'PER_CNTR', amount: 420, currency: 'USD' },
  { mode: 'SEA_FCL40', segment: 'D', code: 'DEMURRAGE', label: '컨테이너 지체료 (DEM/DET)', unit: 'PER_DAY_CNTR', amount: 60, currency: 'USD', variable: true },
  { mode: 'SEA_FCL40', segment: 'F', code: 'TRAILER', label: '컨테이너 트레일러 운송', unit: 'PER_CNTR', amount: 420000, currency: 'KRW' },

  // ── 항공 ────────────────────────────────────────────────
  { mode: 'AIR', segment: 'A', code: 'PICKUP', label: '공장 픽업·수출 통관', unit: 'PER_KG', amount: 0.3, currency: 'USD', min: 50 },
  { mode: 'AIR', segment: 'B', code: 'ORIGIN_HANDLING', label: '출발 공항 처리·보안 검색', unit: 'PER_KG', amount: 0.25, currency: 'USD', min: 25 },
  { mode: 'AIR', segment: 'C', code: 'AIR_FREIGHT', label: '항공 운임 + 유류·보안 할증', unit: 'PER_KG', amount: 4.5, currency: 'USD', min: 120 },
  { mode: 'AIR', segment: 'D', code: 'AIR_DEST', label: '도착 공항 창고·D/O 처리', unit: 'PER_KG', amount: 150, currency: 'KRW', min: 60000 },

  // ── 특송 (운임에 문 앞 배송 포함) ─────────────────────────
  { mode: 'EXPRESS', segment: 'C', code: 'EXPRESS_FREIGHT', label: '특송 운임 (유류할증·문 앞 배송 포함)', unit: 'PER_KG', amount: 8, currency: 'USD', min: 60 },

  // ── 공통: 한국 내륙 운송 (LCL·항공) ───────────────────────
  { mode: 'ALL', segment: 'F', code: 'TRUCK', label: '창고 → 고객사 트럭', unit: 'TIER', max_cbm: 4, amount: 130000, currency: 'KRW', note: '인천항 → 서울, 팔레트 2~3개에 13만원 (고객사 통화 중 언급, 청구서 미확인)', source: '고객사 통화 (2026-10)' },
  { mode: 'ALL', segment: 'F', code: 'TRUCK', label: '창고 → 고객사 트럭', unit: 'TIER', max_cbm: 12, amount: 220000, currency: 'KRW' },
  { mode: 'ALL', segment: 'F', code: 'TRUCK_OVER', label: '창고 → 고객사 트럭 (12CBM 초과분)', unit: 'PER_RT_OVER', over_cbm: 12, amount: 15000, currency: 'KRW' },
  { mode: 'ALL', segment: 'F', code: 'DEST_AREA_FACTOR', label: '수도권 외 지역 배수', unit: 'FACTOR', amount: 1.4, currency: 'KRW' },

  // ── 공통: 통관·보험 ──────────────────────────────────────
  { mode: 'ALL', segment: 'E', code: 'BROKER_FEE', label: '관세사 통관 수수료', unit: 'PER_SHIPMENT', amount: 33000, currency: 'KRW' },
  { mode: 'ALL', segment: 'E', code: 'INSPECTION', label: '세관 검사 지정 시 추가 비용', unit: 'PER_SHIPMENT', amount: 80000, currency: 'KRW', variable: true },
  { mode: 'ALL', segment: 'C', code: 'INSURANCE', label: '적하보험료', unit: 'PCT_GOODS', amount: 0.3, currency: 'KRW' },
];

export const rateKey = (r) => [r.mode, r.segment, r.code, r.region || '', r.max_cbm ?? ''].join('|');

// DB 요율(활성)을 기본값 위에 덮어쓴다. 같은 키(방식·구간·항목·지역·구간 상한)면 DB 가 이긴다.
export function mergeRates(dbRates = []) {
  const map = new Map(DEFAULT_RATES.map((r) => [rateKey(r), { ...r, from: 'default' }]));
  for (const r of dbRates) {
    if (r.active === false) continue;
    map.set(rateKey(r), { ...r, amount: Number(r.amount), from: 'db' });
  }
  return [...map.values()];
}

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const won = (v) => Math.round(v);
export const fmtWon = (v) => `${Math.round(v).toLocaleString('ko-KR')}원`;
const fmtNum = (v, d = 2) => Number(v.toFixed(d)).toLocaleString('ko-KR');

// 화물 입력 → CBM·무게. 박스 치수×박스 수가 있으면 그것을, 없으면 직접 입력한 CBM 을 쓴다.
export function cargoMetrics({ cartons, lengthCm, widthCm, heightCm, kgPerCarton, totalCbm, totalKg }) {
  const c = n(cartons);
  const boxCbm = (n(lengthCm) * n(widthCm) * n(heightCm)) / 1_000_000;
  const cbm = c > 0 && boxCbm > 0 ? boxCbm * c : n(totalCbm);
  const kg = c > 0 && n(kgPerCarton) > 0 ? n(kgPerCarton) * c : n(totalKg);
  return { cbm: Number(cbm.toFixed(3)), kg: Number(kg.toFixed(1)), cartons: c };
}

// 박스 치수 × 수량 → CBM (견적 화면 저장용)
export const calcCbm = ({ lengthCm, widthCm, heightCm, quantity = 1 }) => (n(lengthCm) * n(widthCm) * n(heightCm) * (n(quantity) || 1)) / 1_000_000;

// 운송 방식별 과금 기준
export function chargeBasis(mode, cbm, kg) {
  if (mode === 'SEA_LCL') {
    const rt = Math.max(1, cbm, kg / 1000);
    return { rt: Number(rt.toFixed(2)), text: `${fmtNum(rt)} R/T (CBM ${fmtNum(cbm)}, 톤 ${fmtNum(kg / 1000)} 중 큰 값, 최소 1)` };
  }
  if (mode === 'SEA_FCL20' || mode === 'SEA_FCL40') {
    const cap = mode === 'SEA_FCL20' ? { cbm: 28, kg: 21000 } : { cbm: 58, kg: 26000 };
    const cntr = Math.max(1, Math.ceil(cbm / cap.cbm), Math.ceil(kg / cap.kg));
    return { cntr, rt: cbm, text: `컨테이너 ${cntr}대 (1대 약 ${cap.cbm}CBM·${cap.kg.toLocaleString()}kg)` };
  }
  const divisor = mode === 'AIR' ? 6000 : 5000;
  const volKg = (cbm * 1_000_000) / divisor;
  let ckg = Math.max(kg, volKg);
  if (mode === 'EXPRESS') ckg = Math.ceil(ckg * 2) / 2;
  return { kg: Number(ckg.toFixed(1)), rt: cbm, text: `과금 중량 ${fmtNum(ckg, 1)}kg (실중량 ${fmtNum(kg, 1)}kg, 부피중량 ${fmtNum(volKg, 1)}kg 중 큰 값)` };
}

const pickRates = (rates, mode, segment, region) => {
  const own = rates.filter((r) => (r.mode === mode || r.mode === 'ALL') && r.segment === segment);
  // 지역별 요율이 있으면 해당 지역만, 없으면 지역 없는 요율
  const codes = [...new Set(own.map((r) => r.code))];
  return codes.flatMap((code) => {
    const rows = own.filter((r) => r.code === code);
    const regional = rows.filter((r) => r.region);
    if (!regional.length) return rows;
    const hit = regional.filter((r) => r.region === region);
    return hit.length ? hit : regional.slice(0, 1);
  });
};

// 한 요율을 금액(원)으로. 반환: { amount, basis } 또는 null(해당 없음)
function applyRate(r, ctx) {
  // 포워더는 시장 환율이 아니라 자체 기준환율로 청구하는 경우가 많아, 요율에 청구 환율(fx_krw)이 있으면 그것을 쓴다
  const billFx = n(r.fx_krw) > 0 ? n(r.fx_krw) : ctx.usdKrw;
  const fx = r.currency === 'USD' ? billFx : 1;
  const money = (v) => (r.currency === 'USD' ? `$${fmtNum(v)}` : `${Math.round(v).toLocaleString('ko-KR')}원`);
  const fxNote = r.currency === 'USD' ? ` × ${n(r.fx_krw) > 0 ? '포워더 청구 환율' : '환율'} ${billFx.toLocaleString('ko-KR')}` : '';
  const withMin = (raw, basis) => {
    const min = n(r.min);
    if (min > 0 && raw < min) return { amount: min * fx, basis: `최소 ${money(min)}${fxNote} 적용 (${basis})` };
    return { amount: raw * fx, basis: `${basis}${fxNote}` };
  };
  switch (r.unit) {
    case 'PER_RT': return withMin(r.amount * ctx.basis.rt, `${fmtNum(ctx.basis.rt)} R/T × ${money(r.amount)}`);
    case 'PER_KG': return withMin(r.amount * ctx.basis.kg, `${fmtNum(ctx.basis.kg, 1)}kg × ${money(r.amount)}`);
    case 'PER_CNTR': return withMin(r.amount * ctx.basis.cntr, `${ctx.basis.cntr}대 × ${money(r.amount)}`);
    case 'PER_SHIPMENT': return withMin(r.amount, '건당');
    case 'PER_DAY_RT': return ctx.storageDays > 0 ? { amount: r.amount * ctx.basis.rt * ctx.storageDays * fx, basis: `${fmtNum(ctx.basis.rt)} R/T × ${ctx.storageDays}일 × ${money(r.amount)}${fxNote}` } : null;
    case 'PER_DAY_CNTR': return ctx.storageDays > 0 ? { amount: r.amount * ctx.basis.cntr * ctx.storageDays * fx, basis: `${ctx.basis.cntr}대 × ${ctx.storageDays}일 × ${money(r.amount)}${fxNote}` } : null;
    default: return null;
  }
}

// 한국 내륙 트럭: 부피 구간 요율 + 초과분, 지역 배수
function truckLine(rates, ctx) {
  const tiers = rates.filter((r) => r.code === 'TRUCK' && r.unit === 'TIER').sort((a, b) => n(a.max_cbm) - n(b.max_cbm));
  if (!tiers.length) return null;
  const cbm = Math.max(ctx.cbm, 0.1);
  const tier = tiers.find((t) => cbm <= n(t.max_cbm));
  const top = tiers.at(-1);
  let amount, basis, verified;
  if (tier) {
    amount = tier.amount; verified = !!tier.verified;
    basis = `${fmtNum(n(tier.max_cbm), 0)}CBM 이하 구간 ${fmtWon(tier.amount)}`;
  } else {
    const over = rates.find((r) => r.code === 'TRUCK_OVER');
    const extra = over ? (cbm - n(top.max_cbm)) * over.amount : 0;
    amount = top.amount + extra; verified = false;
    basis = `${fmtNum(n(top.max_cbm), 0)}CBM ${fmtWon(top.amount)} + 초과 ${fmtNum(cbm - n(top.max_cbm))}CBM × ${fmtWon(over?.amount || 0)}`;
  }
  if (ctx.destArea === 'OTHER') {
    const f = rates.find((r) => r.code === 'DEST_AREA_FACTOR');
    if (f) { amount *= f.amount; basis += ` × 수도권 외 ${f.amount}배`; verified = false; }
  }
  return { code: 'TRUCK', label: tier?.label || top.label, amount, basis, verified, source: tier?.source, note: tier?.note };
}

/**
 * 도착 원가 계산.
 * goodsValue: 판매자(공장) 견적 금액. 거래 조건 기준 가격이다 (CIF 견적이면 운임·보험이 이미 들어 있는 금액).
 */
export function calcLandedCost(input, rates = mergeRates()) {
  const {
    mode = 'SEA_LCL', term = 'FOB', region = 'SOUTH', destArea = 'CAPITAL',
    goodsValue = 0, goodsCurrency = 'USD', usdKrw = 1400, units = 0,
    dutyRate = 8, fta = false, ftaRate = 0, insure = false, battery = 'NONE', storageDays = 0,
  } = input;
  const { cbm, kg } = cargoMetrics(input);
  const needsCargo = !(cbm > 0) && !(kg > 0);
  const basis = chargeBasis(mode, cbm, kg);
  const t = TERMS.find((x) => x.value === term) || TERMS[2];
  const fx = n(usdKrw) || 1400;
  const goodsKrw = goodsCurrency === 'USD' ? n(goodsValue) * fx : n(goodsValue);
  const ctx = { basis, cbm, kg, usdKrw: fx, storageDays: n(storageDays), destArea };
  const payerOf = (seg) => (t.seller.includes(seg) ? 'SELLER' : 'BUYER');

  const lines = [];
  const variables = [];
  const warnings = [];
  const push = (seg, r, res, extra = {}) => {
    const line = {
      segment: seg, code: r.code, label: r.label, amount: won(res.amount), basis: res.basis,
      payer: extra.payer || payerOf(seg), verified: !!(extra.verified ?? r.verified),
      source: r.source || '', note: r.note || '', currency: r.currency, from: r.from,
    };
    (r.variable ? variables : lines).push(line);
  };

  // 포워더에게 받은 실제 견적이 있으면 그 구간은 요율 대신 그 금액을 쓴다 (가장 정확한 방법)
  const actualOf = (seg) => n(input.actual?.[seg]);
  const pushActual = (seg) => lines.push({ segment: seg, code: 'ACTUAL', label: '받은 견적 금액 (직접 입력)', amount: won(actualOf(seg)), basis: '포워더·공장 견적', payer: payerOf(seg), verified: true, currency: 'KRW' });

  for (const seg of ['A', 'B', 'C', 'D']) {
    if (actualOf(seg) > 0) { pushActual(seg); continue; }
    for (const r of pickRates(rates, mode, seg, region)) {
      if (r.code === 'INSURANCE') continue;
      const res = applyRate(r, ctx);
      if (res) push(seg, r, res);
    }
  }

  // 보험: CIF 는 판매자, 그 외에는 구매자가 선택. 문 앞 배송 조건은 판매자 위험이라 제외
  const ins = rates.find((r) => r.code === 'INSURANCE');
  const insureBySeller = !!t.insuranceBySeller;
  if (ins && goodsKrw > 0 && actualOf('C') === 0 && (insureBySeller || (insure && !['DAP', 'DDP'].includes(term)))) {
    push('C', ins, { amount: goodsKrw * (ins.amount / 100), basis: `물품가 ${fmtWon(goodsKrw)} × ${ins.amount}%` }, { payer: insureBySeller ? 'SELLER' : 'BUYER' });
  }

  // F: 한국 내륙 운송 (특송은 운임에 포함)
  if (actualOf('F') > 0) {
    pushActual('F');
  } else if (mode === 'EXPRESS') {
    lines.push({ segment: 'F', code: 'INCLUDED', label: '문 앞 배송', amount: 0, basis: '특송 운임에 포함', payer: payerOf('C'), verified: false });
  } else if (mode === 'SEA_FCL20' || mode === 'SEA_FCL40') {
    for (const r of pickRates(rates, mode, 'F', region)) {
      if (r.code !== 'TRAILER') continue;
      const res = applyRate(r, ctx);
      const f = ctx.destArea === 'OTHER' ? rates.find((x) => x.code === 'DEST_AREA_FACTOR') : null;
      if (res) push('F', r, f ? { amount: res.amount * f.amount, basis: `${res.basis} × 수도권 외 ${f.amount}배` } : res, f ? { verified: false } : {});
    }
  } else {
    const tl = truckLine(rates, ctx);
    if (tl) lines.push({ segment: 'F', ...tl, amount: won(tl.amount), payer: payerOf('F'), currency: 'KRW' });
  }

  // E: 과세가격(CIF 기준) → 관세 → 부가세
  const sumSeg = (segs, codes) => lines.filter((l) => segs.includes(l.segment) && (!codes || codes.includes(l.code))).reduce((s, l) => s + l.amount, 0);
  const insAmt = lines.filter((l) => l.code === 'INSURANCE').reduce((s, l) => s + l.amount, 0);
  const freightToPort = sumSeg(['A', 'B', 'C']) - insAmt;
  // 도착지에서 받는 할증료도 해상 운임의 일부로 보고 과세가격에 넣는다 (보수적으로 계산)
  const freightSurcharge = lines.filter((l) => l.code === 'BAF_CAF').reduce((s, l) => s + l.amount, 0);
  const broker = rates.find((r) => r.code === 'BROKER_FEE');
  const brokerAmt = broker ? broker.amount : 0;
  const d = (fta ? n(ftaRate) : n(dutyRate)) / 100;
  let customsValue;
  if (term === 'EXW') customsValue = goodsKrw + freightToPort + insAmt + freightSurcharge;
  else if (term === 'FCA') customsValue = goodsKrw + sumSeg(['B', 'C']) + freightSurcharge;
  else if (term === 'FOB') customsValue = goodsKrw + sumSeg(['C']) + freightSurcharge;
  else if (term === 'CFR') customsValue = goodsKrw + insAmt + freightSurcharge;
  else if (term === 'CIF') customsValue = goodsKrw + freightSurcharge;
  else {
    // DAP·DDP: 견적가에서 수입항 도착 이후 비용을 뺀다
    const afterArrival = sumSeg(['D', 'F']) - freightSurcharge;
    customsValue = term === 'DAP' ? goodsKrw - afterArrival : (goodsKrw - afterArrival - brokerAmt) / ((1 + d) * 1.1);
  }
  customsValue = Math.max(0, customsValue);
  const duty = customsValue * d;
  const vat = (customsValue + duty) * 0.1;
  const ePayer = payerOf('E');
  if (goodsKrw > 0) {
    lines.push({ segment: 'E', code: 'DUTY', label: fta ? `관세 (한중 FTA ${n(ftaRate)}%)` : `관세 (${n(dutyRate)}%)`, amount: won(duty), basis: `과세가격 ${fmtWon(customsValue)} × ${(d * 100).toFixed(1)}%`, payer: ePayer, verified: false, note: '세율은 HS코드로 확인하세요' });
    lines.push({ segment: 'E', code: 'VAT', label: '수입 부가세 (10%)', amount: won(vat), basis: `(과세가격 + 관세) × 10%`, payer: ePayer, verified: true, note: '사업자는 매입세액으로 공제' });
  } else {
    warnings.push('물품가를 넣으면 관세·부가세까지 계산합니다.');
  }
  if (broker) lines.push({ segment: 'E', code: 'BROKER_FEE', label: broker.label, amount: won(brokerAmt), basis: '건당', payer: ePayer, verified: !!broker.verified, source: broker.source || '' });
  const insp = rates.find((r) => r.code === 'INSPECTION');
  if (insp) variables.push({ segment: 'E', code: 'INSPECTION', label: insp.label, amount: won(insp.amount), basis: '검사 지정 시, 통관 1~2일 지연', payer: ePayer, verified: false });

  // 경고
  if (battery !== 'NONE' && (mode === 'AIR' || mode === 'EXPRESS')) warnings.push(battery === 'STANDALONE' ? '배터리 단독 운송은 항공·특송에서 대부분 거절됩니다. 해상 또는 전용 라인으로 상담이 필요합니다.' : '배터리 내장 제품은 항공·특송에서 위험물 서류(UN38.3·MSDS)와 추가 요금이 붙거나 거절될 수 있습니다.');
  if (battery !== 'NONE' && mode.startsWith('SEA')) warnings.push('배터리 제품은 위험물 서류(UN38.3·MSDS)가 필요하고 선사별 할증이 붙을 수 있습니다.');
  if (['FOB', 'CFR', 'CIF'].includes(term) && (mode === 'AIR' || mode === 'EXPRESS')) warnings.push(`${term} 는 해상 전용 조건입니다. 항공·특송은 FCA·CPT·CIP 로 계약하는 것이 맞습니다. 계산은 같은 구간 기준으로 했습니다.`);
  if (mode === 'SEA_LCL' && cbm > 0 && cbm < 1) warnings.push(`LCL 은 최소 1 R/T 로 청구됩니다. ${fmtNum(cbm)}CBM 도 1CBM 으로 계산했습니다.`);
  if (mode === 'SEA_LCL' && cbm >= 15) warnings.push('15CBM 이상이면 FCL 20ft 가 더 저렴할 수 있습니다. 비교 표를 확인하세요.');
  if (['CIF', 'CFR', 'FOB', 'FCA', 'EXW'].includes(term) && mode !== 'EXPRESS') warnings.push(`${term} 조건에서는 한국 도착 후 비용(D)이 공장 견적과 별도로 청구됩니다. 배가 출발하기 전에 이 금액을 확인해 두세요.`);
  if (term === 'CIF' && mode === 'SEA_LCL' && lines.some((l) => l.code === 'BAF_CAF')) warnings.push('CIF 운임에 유류·환율 할증료가 포함됐는지 판매자에게 확인하세요. 포함됐다면 도착지 할증료는 이중 청구입니다.');

  if (needsCargo) warnings.unshift('화물 부피나 무게를 넣어야 정확히 계산됩니다. 지금은 최소 청구 단위로만 계산했습니다.');

  // 합계와 범위: 확인된 요율 ±3%(달러 항목은 환율 ±5%), 추정 요율 ±25%
  const spread = (l) => (l.verified ? (l.currency === 'USD' ? 0.05 : 0.03) : 0.25);
  const sum = (arr) => arr.reduce((s, l) => s + l.amount, 0);
  const buyer = lines.filter((l) => l.payer === 'BUYER');
  const seller = lines.filter((l) => l.payer === 'SELLER');
  const logistics = lines.filter((l) => !['DUTY', 'VAT'].includes(l.code));
  const buyerTotal = sum(buyer);
  const range = (arr) => ({ low: won(arr.reduce((s, l) => s + l.amount * (1 - spread(l)), 0)), high: won(arr.reduce((s, l) => s + l.amount * (1 + spread(l)), 0)) });
  const landed = goodsKrw + buyerTotal;
  const vatBuyer = buyer.filter((l) => l.code === 'VAT').reduce((s, l) => s + l.amount, 0);
  const buyerExVat = buyer.filter((l) => l.code !== 'VAT');
  const u = n(units);

  const bySegment = SEGMENTS.map((s) => {
    const ls = lines.filter((l) => l.segment === s.key);
    return { ...s, amount: sum(ls), payer: payerOf(s.key), lines: ls };
  });

  return {
    input: { mode, term, region, destArea, usdKrw: fx, goodsKrw, units: u },
    needsCargo,
    cbm, kg, basis, customsValue: won(customsValue),
    lines, variables, warnings, bySegment,
    totals: {
      goods: won(goodsKrw),
      buyerExtra: buyerTotal,
      buyerExtraRange: range(buyer),
      // 수입 부가세는 사업자가 매입세액으로 돌려받으므로 '실제 부담'은 부가세를 뺀 금액으로 본다
      buyerVat: vatBuyer,
      buyerExtraExVat: sum(buyerExVat),
      buyerExtraExVatRange: range(buyerExVat),
      sellerIncluded: sum(seller),
      logisticsAll: sum(logistics),
      allCosts: sum(lines),
      landed: won(landed),
      landedExVat: won(landed - vatBuyer),
      verifiedShare: sum(logistics) > 0 ? sum(logistics.filter((l) => l.verified)) / sum(logistics) : 0,
      perUnitLanded: u > 0 ? won(landed / u) : 0,
      perUnitLogistics: u > 0 ? won(sum(logistics) / u) : 0,
      perUnitBuyerExtra: u > 0 ? won(sum(buyerExVat) / u) : 0,
    },
  };
}

// 같은 화물로 운송 방식별 비교. 누가 내든 상관없이 물류비·세금 전체로 비교한다
// (거래 조건이 같아도 방식이 바뀌면 공장 견적가도 바뀌므로, 구매자 별도 비용만 비교하면 틀린다).
export function compareModes(input, rates) {
  return MODES.map((m) => {
    const r = calcLandedCost({ ...input, mode: m.value, actual: {} }, rates);
    const u = r.input.units;
    return {
      mode: m.value, label: m.label, transit: m.transit, basis: r.basis.text,
      logisticsAll: r.totals.logisticsAll, allCosts: r.totals.allCosts,
      perUnitLogistics: r.totals.perUnitLogistics, perUnitAll: u > 0 ? Math.round(r.totals.allCosts / u) : 0,
      verifiedShare: r.totals.verifiedShare,
      blocked: r.warnings.some((w) => w.includes('거절')),
    };
  });
}

// 견적서에 붙여 넣을 "포함 구간 / 별도 청구 예상 비용" 문구
export function quoteNotice(result) {
  const t = TERMS.find((x) => x.value === result.input.term);
  const m = MODES.find((x) => x.value === result.input.mode);
  const incl = result.bySegment.filter((s) => s.payer === 'SELLER' && s.amount > 0).map((s) => s.short);
  const extra = result.bySegment.filter((s) => s.payer === 'BUYER' && s.amount > 0);
  const lines = [
    `운송 조건: ${t?.label} / ${m?.label} (${result.basis.text})`,
    `견적에 포함: ${incl.length ? incl.join(', ') : '없음 (운송비 전부 별도)'}`,
    `별도 청구 예상: ${extra.map((s) => `${s.short} 약 ${fmtWon(s.amount)}`).join(', ') || '없음'}`,
    `별도 청구 예상 합계: 약 ${fmtWon(result.totals.buyerExtraExVat)} (범위 ${fmtWon(result.totals.buyerExtraExVatRange.low)} ~ ${fmtWon(result.totals.buyerExtraExVatRange.high)}, 부가세 제외)`,
  ];
  if (result.totals.buyerVat > 0) lines.push(`수입 부가세: 약 ${fmtWon(result.totals.buyerVat)} (통관 때 납부, 사업자는 매입세액 공제)`);
  if (result.variables.length) lines.push(`변동 가능: ${result.variables.map((v) => v.label).join(', ')}`);
  lines.push(`기준: 환율 ${result.input.usdKrw.toLocaleString('ko-KR')}원/$, 실제 금액은 도착 후 실측 부피·도착일 환율·세관 검사에 따라 달라질 수 있습니다.`);
  return lines.join('\n');
}
