// 영업 미팅용 데모 환경. 실제 팀과 분리된 데모 팀(Tenant.is_demo) 안에 예시 고객사와
// 문의 → 견적 → 발주 → 검수 → 선적 → 도착 원가 → 불량 보상 → 성과 리포트까지 한 바퀴 돈 데이터를 만든다.
// 날짜는 모두 '오늘' 기준이라 언제 초기화해도 지금 진행 중인 것처럼 보인다.
// 실제 고객 계정이 없으니 알림·메일은 아무에게도 가지 않는다.
import { kstToday } from './chinaHoliday.ts';
import { buildPerformanceReport, draftHighlights, periodLabel } from './performanceReport.ts';

export const DEMO_TENANT = { name: 'AEGIS 데모 (영업 시연용)', slug: 'aegis-demo' };
export const DEMO_COMPANY_NAME = '데모상사 (시연용)';
// 데모 팀에서 지우고 다시 만드는 엔티티 (tenant_id 로 찾는다)
export const DEMO_ENTITIES = ['PerformanceReport', 'MeetingLog', 'QualityClaim', 'LandedCostRecord', 'PaymentStage', 'Shipment', 'QCReport', 'CardMilestone', 'Quotation', 'TaskCard', 'Company'];

const USD_CNY = 7.2, USD_KRW = 1400;
const DAY = 86400000;

export function demoDates(today = kstToday()) {
  const base = Date.parse(`${today}T00:00:00Z`);
  const d = (n: number) => new Date(base + n * DAY).toISOString().slice(0, 10);
  const iso = (n: number, h = 2) => new Date(base + n * DAY + h * 3600000).toISOString();
  return { today, d, iso };
}

// 공장 원가 품목 → 고객 견적 줄·합계 (마진 포함, 달러 올림)
function priced(options: any[], margin: number) {
  const lines = options.filter((o) => !o.optional).map((o) => {
    const unit = Math.ceil((o.unit_price / USD_CNY) * (1 + margin / 100) * 100) / 100;
    return { option_name: o.option_name, specification: o.specification || '', quantity: o.quantity, unit_label: o.unit_label || '개', unit_price: unit, total: Math.round(unit * o.quantity * 100) / 100 };
  });
  const total = Math.ceil(lines.reduce((s, l) => s + l.total, 0));
  const cost = options.filter((o) => !o.optional).reduce((s, o) => s + o.unit_price * o.quantity, 0);
  return { price_lines: lines, final_total: total, auto_total: total, factory_total_cost: Math.round(cost), quote_options: options.map((o) => ({ currency: 'CNY', unit_label: '개', margin_percent: margin, ...o })) };
}

/** 예시 데이터. ref 는 만들 때 실제 ID 로 바꾼다 ('$card:fan' 처럼). */
export function demoDataset(today = kstToday()) {
  const { d, iso } = demoDates(today);
  const factories = [
    { ref: 'f:fan', company_name: '선전 하이테크 전자 (예시)', factory_address: '광둥성 선전시 바오안구' },
    { ref: 'f:fan2', company_name: '둥관 리치 전자 (예시)', factory_address: '광둥성 둥관시 창안진' },
    { ref: 'f:fan3', company_name: '중산 그린 가전 (예시)', factory_address: '광둥성 중산시' },
    { ref: 'f:sil', company_name: '둥관 실리콘 제품 (예시)', factory_address: '광둥성 둥관시 탕샤진' },
    { ref: 'f:led', company_name: '광저우 라이팅 (예시)', factory_address: '광둥성 광저우시 판위구' },
    { ref: 'f:spk', company_name: '선전 사운드 테크 (예시)', factory_address: '광둥성 선전시 룽강구' },
  ];
  const card = (ref: string, o: any) => ({ ref, client_visible: true, priority: 'MEDIUM', source: 'DEMO', ...o });
  const cards = [
    card('c:fan0', { title: '휴대용 미니 선풍기 2,000개 (첫 주문)', title_cn: '便携迷你风扇 2000个', status: 'DONE', factory: 'f:fan', created: -330, updated: -240, delivery_date: d(-245) }),
    card('c:fan', { title: '휴대용 미니 선풍기 3,000개', title_cn: '便携迷你风扇 3000个', status: 'DONE', reorder_of: '$card:c:fan0', factory: 'f:fan', created: -145, updated: -40, delivery_date: d(-56) }),
    card('c:spk', { title: '블루투스 스피커 1,000개', title_cn: '蓝牙音箱 1000个', status: 'DONE', factory: 'f:spk', created: -193, updated: -95, delivery_date: d(-100) }),
    card('c:sil', { title: '실리콘 주방 집게 5,000개', title_cn: '硅胶厨房夹 5000个', status: 'PRODUCTION', factory: 'f:sil', created: -53, updated: -2, delivery_date: d(18), priority: 'HIGH', current_milestone_label: '양산' }),
    card('c:led', { title: 'LED 무드등 2종 샘플', title_cn: 'LED氛围灯 2款样品', status: 'REVIEW', created: -9, updated: -5, quote_deadline: d(-6) }),
    card('c:box', { title: '텀블러 인쇄 박스 10,000장', title_cn: '保温杯印刷盒 10000个', status: 'IN_PROGRESS', created: -3, updated: -1, quote_deadline: d(2), quote_deadline_client_visible: true }),
  ];

  const q = (ref: string, cardRef: string, factory: string, title: string, options: any[], margin: number, o: any = {}) => ({
    ref, card: cardRef, factory, quote_title: title, product_name: title, incoterms: 'FOB Shenzhen', rounding_version: 2, final_currency: 'USD',
    exchange_rate_usd: USD_KRW, exchange_rate_usd_cny: USD_CNY, exchange_rate_date: d(o.created ?? -10), lead_time_business_days: 25, validity_days: 30,
    advance_payment_percent: 30, balance_payment_percent: 70, status: 'DRAFT', ...priced(options, margin), ...o,
  });
  const fanOpts = (unit: number) => [{ option_name: '휴대용 미니 선풍기 본체', specification: 'USB-C 충전 · 3단 풍량 · 1,200mAh', quantity: 3000, unit_price: unit }, { option_name: '컬러 박스 포장', specification: '4도 인쇄 · 개별 포장', quantity: 3000, unit_price: 1.2 }];
  const quotes = [
    q('q:fan0', 'c:fan0', 'f:fan', '휴대용 미니 선풍기 2,000개', [{ option_name: '휴대용 미니 선풍기 본체', specification: 'USB-C 충전 · 3단 풍량', quantity: 2000, unit_price: 9.6 }, { option_name: '컬러 박스 포장', quantity: 2000, unit_price: 1.3 }], 18, { status: 'ACCEPTED', created: -320, client_published_at: iso(-318), client_accepted_at: iso(-315), client_accepted_by_name: '데모 담당자' }),
    q('q:fanA', 'c:fan', 'f:fan', '휴대용 미니 선풍기 3,000개 · A안', fanOpts(8.4), 16, { status: 'ACCEPTED', created: -142, client_published_at: iso(-140), client_accepted_at: iso(-136), client_accepted_by_name: '데모 담당자', client_accept_note: 'A안으로 진행합니다.' }),
    q('q:fanB', 'c:fan', 'f:fan2', '휴대용 미니 선풍기 3,000개 · B안', fanOpts(9.8), 16, { status: 'SENT', created: -142, client_published_at: iso(-140) }),
    q('q:fanC', 'c:fan', 'f:fan3', '휴대용 미니 선풍기 3,000개 · C안', fanOpts(10.6), 16, { status: 'DRAFT', created: -143 }),
    q('q:spk', 'c:spk', 'f:spk', '블루투스 스피커 1,000개', [{ option_name: '블루투스 스피커', specification: 'BT 5.3 · 5W · IPX5', quantity: 1000, unit_price: 46 }, { option_name: '선물 박스', quantity: 1000, unit_price: 3.5 }], 15, { status: 'ACCEPTED', created: -190, client_published_at: iso(-188), client_accepted_at: iso(-185), client_accepted_by_name: '데모 담당자' }),
    q('q:spk2', 'c:spk', 'f:fan2', '블루투스 스피커 1,000개 (비교)', [{ option_name: '블루투스 스피커', specification: 'BT 5.3 · 5W', quantity: 1000, unit_price: 52 }, { option_name: '선물 박스', quantity: 1000, unit_price: 3.5 }], 15, { status: 'DRAFT', created: -191 }),
    q('q:sil', 'c:sil', 'f:sil', '실리콘 주방 집게 5,000개', [{ option_name: '실리콘 주방 집게 9인치', specification: '식품용 실리콘 · 스테인리스 손잡이', quantity: 5000, unit_price: 6.3 }, { option_name: '헤더 카드 포장', quantity: 5000, unit_price: 0.4 }, { option_name: '로고 금형', specification: '1회성', quantity: 1, unit_price: 1800 }], 17, { status: 'ACCEPTED', created: -50, client_published_at: iso(-48), client_accepted_at: iso(-45), client_accepted_by_name: '데모 담당자' }),
    q('q:sil2', 'c:sil', 'f:fan3', '실리콘 주방 집게 5,000개 (비교)', [{ option_name: '실리콘 주방 집게 9인치', quantity: 5000, unit_price: 7.4 }, { option_name: '헤더 카드 포장', quantity: 5000, unit_price: 0.4 }], 17, { status: 'DRAFT', created: -51 }),
    q('q:ledA', 'c:led', 'f:led', 'LED 무드등 · 원통형', [{ option_name: 'LED 무드등 원통형 샘플', specification: '3색 터치 · USB 충전', quantity: 20, unit_price: 38 }], 20, { status: 'SENT', created: -6, client_published_at: iso(-5), lead_time_business_days: 7 }),
    q('q:ledB', 'c:led', 'f:fan2', 'LED 무드등 · 구형', [{ option_name: 'LED 무드등 구형 샘플', specification: '16색 리모컨 · 충전식', quantity: 20, unit_price: 45 }], 20, { status: 'SENT', created: -6, client_published_at: iso(-5), lead_time_business_days: 7 }),
  ];

  // 진행 단계: [라벨, 계획(오늘 기준 일), 실제(없으면 미완료), 기준일]
  const steps = (cardRef: string, list: any[]) => list.map(([label, plan, actual, baseline, reason], i) => ({
    card: cardRef, seq: i + 1, key: `s${i + 1}`, label, planned_date: d(plan), baseline_date: baseline != null ? d(baseline) : d(plan),
    ...(reason ? { delay_reason: reason, delay_reason_public: true } : {}),
    actual_date: actual != null ? d(actual) : null, status: actual != null ? 'done' : i > 0 && list[i - 1][2] != null ? 'in_progress' : 'pending', client_visible: true,
  }));
  const milestones = [
    ...steps('c:fan0', [['샘플 확인', -310, -311], ['발주 · 선금', -300, -300], ['양산', -270, -268], ['출고 전 검수', -262, -262], ['선적', -258, -257], ['한국 도착', -248, -246]]),
    ...steps('c:fan', [['샘플 확인', -130, -131], ['발주 · 선금', -125, -125], ['양산', -95, -96], ['출고 전 검수', -78, -77, null, '마스터 박스 재포장 확인으로 하루 늦어짐'], ['선적', -66, -66], ['한국 도착', -58, -58]]),
    ...steps('c:spk', [['샘플 확인', -175, -176], ['발주 · 선금', -170, -170], ['양산', -140, -141], ['출고 전 검수', -126, -122, null, '페어링 버튼 불량으로 전량 재검 후 출고'], ['선적', -116, -117], ['한국 도착', -106, -107]]),
    ...steps('c:sil', [['샘플 확인', -38, -39], ['금형 수정', -30, -31], ['발주 · 선금', -28, -28], ['양산', 4, null], ['출고 전 검수', 8, null], ['선적', 12, null], ['한국 도착', 18, null]]),
  ];

  const checks = (fail = '') => [
    { label: '외관 스크래치·이물', status: 'PASS', note: '표본 80개 중 0개' },
    { label: '작동 테스트', status: 'PASS', note: '표본 전수 작동 확인' },
    { label: '색상 (한도견본 대비)', status: 'PASS', note: '' },
    { label: '포장 · 라벨 · 바코드', status: fail ? 'FAIL' : 'PASS', note: fail },
    { label: '낙하 테스트 (1.2m)', status: 'PASS', note: '마스터 박스 6면 1회씩' },
  ];
  const qc = (cardRef: string, type: string, result: string, day: number, o: any = {}) => ({ card: cardRef, inspection_type: type, qc_result: result, inspector_name: '광둥 현지 QC (예시)', checklist: checks(o.fail), comments: o.comments || '', client_visible: true, client_published_at: iso(day, 9), client_decision: o.decision || 'APPROVED', client_decided_at: iso(day + 1), client_decided_by_name: '데모 담당자', media_urls: [], media_names: [] });
  const qcReports = [
    qc('c:fan0', 'MASS_PRODUCTION', 'PASS', -262, { comments: '기준 이내입니다.' }),
    qc('c:fan', 'SAMPLE', 'PASS', -131, { comments: '샘플 3개 모두 기준 이내입니다.' }),
    qc('c:fan', 'MASS_PRODUCTION', 'CONDITIONAL_PASS', -77, { fail: '마스터 박스 4개 모서리 찍힘 → 재포장', comments: '본품은 기준 이내. 마스터 박스 4개는 공장에서 재포장했습니다.' }),
    qc('c:fan', 'MASS_PRODUCTION', 'PASS', -75, { comments: '재포장분 확인 완료. 출고 승인 드립니다.' }),
    qc('c:spk', 'MASS_PRODUCTION', 'FAIL', -125, { fail: '페어링 버튼 복귀 불량 3% → 전량 재검 요청', comments: '페어링 버튼 불량률이 기준(1%)을 넘어 출고를 보류하고 공장에 전량 재검을 요청했습니다.', decision: 'ON_HOLD' }),
    qc('c:spk', 'MASS_PRODUCTION', 'PASS', -122, { comments: '전량 재검 후 불량품 교체 완료. 표본 125개 이상 없음.' }),
    qc('c:sil', 'SAMPLE', 'PASS', -39, { comments: '식품용 실리콘 성적서 확인. 손잡이 각인 위치만 2mm 조정 요청.' }),
  ];

  const ship = (cardRef: string, o: any) => ({ card: cardRef, label: '1차 선적', mode: 'SEA_LCL', carrier: 'SITC (예시)', port_from: '선전 셔커우', port_to: '인천', client_visible: true, docs: [], ...o });
  const shipments = [
    ship('c:fan0', { status: 'DELIVERED', etd: d(-258), eta: d(-249), atd: d(-257), ata: d(-246), tracking_no: 'DEMO0001' }),
    ship('c:fan', { status: 'DELIVERED', etd: d(-66), eta: d(-58), atd: d(-65), ata: d(-58), tracking_no: 'DEMO0002', dest_cost_estimate: { buyer_ex_vat: 1650000, buyer_vat: 1420000 }, dest_cost_sent_at: iso(-70), dest_cost_decision: 'ACKNOWLEDGED', dest_cost_actual: 1710000, dest_cost_actual_vat: 1430000, dest_cost_actual_at: iso(-55) }),
    ship('c:spk', { status: 'DELIVERED', etd: d(-116), eta: d(-106), atd: d(-117), ata: d(-107), tracking_no: 'DEMO0003' }),
    ship('c:sil', { status: 'PREPARING', etd: d(12), eta: d(16), client_note: '양산 완료 후 출고 전 검수를 거쳐 선적합니다.' }),
  ];

  const stage = (cardRef: string, type: string, pct: number, amount: number, o: any = {}) => ({ card: cardRef, stage_type: type, percentage: pct, amount, currency: 'USD', payee: 'AEGIS', approval_status: 'APPROVED', ...o });
  const amount = (ref: string) => quotes.find((x) => x.ref === ref)!.final_total;
  const stages = [
    stage('c:fan0', 'DOWN_PAYMENT', 30, Math.round(amount('q:fan0') * 0.3), { paid_date: d(-300) }), stage('c:fan0', 'BALANCE_PAYMENT', 70, Math.round(amount('q:fan0') * 0.7), { paid_date: d(-262) }),
    stage('c:fan', 'DOWN_PAYMENT', 30, Math.round(amount('q:fanA') * 0.3), { paid_date: d(-125) }), stage('c:fan', 'BALANCE_PAYMENT', 70, Math.round(amount('q:fanA') * 0.7), { paid_date: d(-75) }),
    stage('c:spk', 'DOWN_PAYMENT', 30, Math.round(amount('q:spk') * 0.3), { paid_date: d(-169) }), stage('c:spk', 'BALANCE_PAYMENT', 70, Math.round(amount('q:spk') * 0.7), { paid_date: d(-121) }),
    stage('c:sil', 'DOWN_PAYMENT', 30, Math.round(amount('q:sil') * 0.3), { paid_date: d(-28) }),
    stage('c:sil', 'BALANCE_PAYMENT', 70, Math.round(amount('q:sil') * 0.7), { approval_status: 'PENDING', due_date: d(9), requested_at: iso(-1), requested_by_name: '데모 담당 PM', request_note: '출고 전 검수 전에 잔금을 부탁드립니다.' }),
  ];

  const lc = (cardRef: string, product: string, orderDay: number, units: number, goodsUsd: number, fx: number, dest: number) => {
    const goods = Math.round(goodsUsd * fx);
    return { card: cardRef, product_key: '$card:c:fan0', product_name: product, order_date: d(orderDay), units, unit_label: '개', status: 'CONFIRMED', revision: 1, confirmed_at: iso(orderDay + 120), confirmed_by_name: '데모 담당 PM',
      lines: [{ key: 'g', kind: 'GOODS', label: '상품 대금', amount: goodsUsd, currency: 'USD', fx, amount_krw: goods, source: 'PAYMENT', estimated: false, one_time: false }, { key: 'd', kind: 'DEST', label: '한국 도착 비용', amount: dest, currency: 'KRW', fx: 1, amount_krw: dest, source: 'SHIPMENT_ACTUAL', estimated: false, one_time: false }],
      goods_krw: goods, logistics_krw: dest, other_krw: 0, one_time_krw: 0, total_krw: goods + dest, per_unit_krw: Math.round((goods + dest) / units), goods_foreign: { currency: 'USD', amount: goodsUsd }, vat_krw: Math.round((goods + dest) * 0.1), estimated: false };
  };
  const landed = [
    lc('c:fan0', '휴대용 미니 선풍기', -300, 2000, amount('q:fan0'), 1380, 1380000),
    lc('c:fan', '휴대용 미니 선풍기', -125, 3000, amount('q:fanA'), 1395, 1710000),
  ];

  const claims = [{
    card: 'c:spk', title: '충전 단자 접촉 불량', title_cn: '充电口接触不良', description: '입고 1,000개 중 18개에서 충전이 끊기는 현상이 있습니다.', description_cn: '到货1000个中18个出现充电中断。',
    defect_qty: 18, received_qty: 1000, lot_note: '입고 박스 7·9번', status: 'RESOLVED', resolution: 'DISCOUNT',
    client_message: '공장이 충전 단자 납땜 불량을 인정했습니다. 불량 18개 금액과 운임을 다음 발주(실리콘 주방 집게)에서 할인해 드렸습니다.',
    factory_response: '납땜 공정 불량 인정, 다음 발주 할인으로 보상', submitted_by_name: '데모 담당자', submitted_at: iso(-100), resolved_at: iso(-90), factory_requested_at: iso(-99), factory_responded_at: iso(-97),
    compensation: { kind: 'DISCOUNT', amount: 450, currency: 'USD', note: '불량 18개 + 운임', promised_at: iso(-90), applied_card_id: '$card:c:sil', applied_card_title: '실리콘 주방 집게 5,000개', applied_at: iso(-45), applied_by_name: '데모 담당 PM', applied_note: '잔금에서 450달러 할인' },
    history: [],
  }];

  const meetings = [
    { card: 'c:fan', meeting_date: d(-94), meeting_type: 'OFFLINE', title: '양산 라인 점검 (공장 방문)', notes: '양산 1일차 라인 점검. 풍량 3단 작동, 배터리 용량 표본 측정 이상 없음.', decisions: '마스터 박스를 5겹 골판지로 변경', next_steps: '출고 전 검수 일정 확정', client_shared_at: iso(-93), created_by_name: '데모 담당 PM' },
    { card: 'c:sil', meeting_date: d(-31), meeting_type: 'OFFLINE', title: '금형 수정 확인 (공장 방문)', notes: '로고 각인 위치 2mm 조정 금형 확인. T2 시사출 표본 양호.', decisions: '양산 착수', next_steps: '양산 4일차 중간 점검', client_shared_at: iso(-30), created_by_name: '데모 담당 PM' },
    { card: 'c:led', meeting_date: d(-8), meeting_type: 'ONLINE', title: '무드등 사양 협의 (화상)', notes: '원통형·구형 두 가지 샘플 견적 요청. 충전식 필수.', decisions: '샘플 20개씩 견적', next_steps: '견적 비교 후 고객 선택', client_shared_at: iso(-7), created_by_name: '데모 담당 PM' },
  ];

  return { factories, cards, quotes, milestones, qcReports, shipments, stages, landed, claims, meetings };
}

// 데모 팀 찾기 (없으면 null)
export async function findDemoTenant(svc: any) {
  const rows = await svc.entities.Tenant.filter({ slug: DEMO_TENANT.slug }, '-created_date', 5);
  return rows.find((t: any) => t.slug === DEMO_TENANT.slug && t.is_demo === true) || null;
}

// 데모 팀 안의 데이터를 모두 지운다. 데모 팀이 아니면 아무것도 지우지 않는다.
export async function clearDemo(svc: any, tenant: any) {
  if (!tenant || tenant.is_demo !== true || tenant.slug !== DEMO_TENANT.slug) throw new Error('데모 팀이 아닙니다');
  let removed = 0;
  for (const name of DEMO_ENTITIES) {
    for (let guard = 0; guard < 20; guard++) {
      const rows = (await svc.entities[name].filter({ tenant_id: tenant.id }, '-created_date', 500)).filter((r: any) => r.tenant_id === tenant.id);
      if (!rows.length) break;
      for (const r of rows) { await svc.entities[name].delete(r.id); removed++; }
      if (rows.length < 500) break;
    }
  }
  return removed;
}

export async function seedDemo(svc: any, tenant: any, today = kstToday()) {
  const db = svc.entities;
  const T = tenant.id;
  const data = demoDataset(today);
  const { d, iso } = demoDates(today);
  const ids: Record<string, string> = {};
  const res = (v: any): any => (typeof v === 'string' && v.startsWith('$card:') ? ids[v.slice(6)] || '' : v);
  const company = await db.Company.create({ tenant_id: T, company_type: 'CLIENT', company_name: DEMO_COMPANY_NAME, contact_person: '데모 담당자', email: 'demo-client@example.com', memo: '영업 시연용 예시 고객사입니다. 데모 환경 초기화로 언제든 다시 만들 수 있습니다.', is_demo: true });
  for (const f of data.factories) ids[f.ref] = (await db.Company.create({ tenant_id: T, company_type: 'FACTORY', company_name: f.company_name, factory_address: f.factory_address, verification_status: 'VERIFIED', is_demo: true })).id;
  const factoryName = (ref: string) => data.factories.find((f) => f.ref === ref)?.company_name || '';
  for (const c of data.cards) {
    const { ref, factory, created, updated, ...rest } = c as any;
    // created_date 는 시스템이 정하므로, 요청일·완료일은 별도 칸에 넣는다
    const row = await db.TaskCard.create({ ...rest, reorder_of: res(rest.reorder_of), tenant_id: T, client_id: company.id, client_name: DEMO_COMPANY_NAME, factory_id: factory ? ids[factory] : '', factory_name: factory ? factoryName(factory) : '', owner_name: '데모 담당 PM', received_date: d(created), completed_date: rest.status === 'DONE' ? d(updated) : '', is_demo: true });
    ids[ref] = row.id;
  }
  const byRef = (ref: string) => ids[ref];
  for (const qt of data.quotes) {
    const { ref, card, factory, created, ...rest } = qt as any;
    ids[ref] = (await db.Quotation.create({ ...rest, tenant_id: T, card_id: byRef(card), client_id: company.id, client_name: DEMO_COMPANY_NAME, factory_id: ids[factory], factory_name: factoryName(factory), factory_quote_date: d(created), sent_at: rest.client_published_at || null })).id;
  }
  const put = async (name: string, rows: any[], extra: (r: any) => any = () => ({})) => {
    for (const r of rows) {
      const { card, ...rest } = r;
      const fixed = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, res(v)]));
      await db[name].create({ ...fixed, tenant_id: T, card_id: byRef(card), ...extra(r) });
    }
  };
  await put('CardMilestone', data.milestones, () => ({ client_id: company.id }));
  await put('QCReport', data.qcReports);
  await put('Shipment', data.shipments);
  await put('PaymentStage', data.stages);
  await put('LandedCostRecord', data.landed, () => ({ client_id: company.id, quotation_id: '' }));
  await put('QualityClaim', data.claims.map((c) => ({ ...c, compensation: { ...c.compensation, applied_card_id: res(c.compensation.applied_card_id) } })), () => ({ client_id: company.id }));
  await put('MeetingLog', data.meetings);

  // 최근 6개월 성과 리포트를 발행해 둔다 (고객 대시보드에서 바로 보이게)
  const start = d(-180), end = today;
  const built = await buildPerformanceReport(svc, { company, start, end });
  const label = periodLabel(start, end);
  await db.PerformanceReport.create({
    tenant_id: T, company_id: company.id, company_name: DEMO_COMPANY_NAME, period_start: start, period_end: end, period_label: label, status: 'PUBLISHED',
    ...built, highlights: draftHighlights(built.metrics, '최근 6개월'), next_plan: '휴대용 미니 선풍기는 지난 두 번의 주문 주기로 보면 다음 달 중순 재주문이 적기입니다. 실리콘 주방 집게는 출고 전 검수 뒤 바로 선적하겠습니다.',
    hidden_metrics: [], generated_at: new Date().toISOString(), published_at: new Date().toISOString(), published_by_name: '데모 담당 PM', created_by_name: '데모 담당 PM',
  });
  return { company_id: company.id, cards: data.cards.length, quotes: data.quotes.length };
}
