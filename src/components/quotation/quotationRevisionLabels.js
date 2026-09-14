export const revisionLabels = {
  factory_name: '공장명', client_name: '고객사', incoterms: '인코텀즈', settlement_route: '정산 경로', quote_issuer: '발행 명의', quote_title: '견적 제목', product_name: '제품명', model_name: '모델명', quote_options: '견적 항목', line_items: '원본 견적 항목', final_currency: '표시 통화', factory_total_cost: '공장 원가 (CNY)', factory_cost_currency: '원가 입력 통화', logistics_cost: '물류비 (CNY)', logistics_cost_currency: '물류비 입력 통화', masir_fee_type: '수수료 유형', masir_fee_value: '수수료 값 (% 또는 CNY)', exchange_rate_date: '환율 기준일', exchange_rate_usd: '1 USD → KRW', exchange_rate_krw: '1 CNY → KRW', remarks: '비고', advance_payment_percent: '선금 (%)', balance_payment_percent: '잔금 (%)', shipping_days: '출하일 (일)', product_image_url: '제품 사진', status: '상태', raw_file_url: '원본 견적 파일', cargo_length_cm: '포장 가로 (cm)', cargo_width_cm: '포장 세로 (cm)', cargo_height_cm: '포장 높이 (cm)', cargo_weight_kg: '중량 (kg)', cargo_quantity: '포장 개수', cargo_cbm: '부피 (CBM)', shipping_mode: '운송 방식', shipping_term: '물류 조건', logistics_estimated_usd: '물류 추정액 (USD)', logistics_estimate_lines: '물류 세부 내역', options_total_usd: '항목 원가 합계 (USD)', final_price_usd: '제품 제안가 (USD)', masir_fee_amount_cny: '수수료 (CNY)', final_client_price: '고객 제안가 (CNY)'
};
export const itemLabels = { option_name: '품목명', item_name_ko: '품목명', item_name_cn: '품목명(중문)', specification: '사양', quantity: '수량', unit_price: '단가', unit_price_usd: '단가(USD)', currency: '통화', margin_percent: '마진(%)', total_usd: '소계(USD)', unit_price_cny: '단가(CNY)', total_cny: '소계(CNY)', label: '항목', amount: '금액' };
export function revisionRows(value, prefix = '') {
  if (!value || typeof value !== 'object') return { [prefix]: value };
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
    const label = Array.isArray(value) ? `${Number(key) + 1}번` : (revisionLabels[key] || itemLabels[key] || key);
    return Object.entries(revisionRows(item, prefix ? `${prefix} · ${label}` : label));
  }));
}
export function revisionValue(value) {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'number') return value.toLocaleString('ko-KR', { maximumFractionDigits: 6 });
  return String(value);
}