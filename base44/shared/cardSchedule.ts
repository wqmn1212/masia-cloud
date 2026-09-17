export const scheduleLabels = { quote_deadline: '견적 발송 기한', advance_paid_date: '선금 입금 기준일', delivery_business_days: '납품 소요일(일요일 제외)', delivery_date: '예정 납품일', delivery_date_mode: '납품일 계산 방식' };
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
}
export function deliveryDate(start, days) {
  if (!start || days === null || days === undefined || days === '') return '';
  if (!validDate(start) || !Number.isInteger(Number(days)) || Number(days) < 0 || Number(days) > 3650) throw new Error('입금일과 소요일(0~3650일)을 확인하세요.');
  const date = new Date(start + 'T00:00:00Z');
  for (let remaining = Number(days); remaining > 0;) { date.setUTCDate(date.getUTCDate() + 1); if (date.getUTCDay() !== 0) remaining--; }
  return date.toISOString().slice(0, 10);
}
export function schedulePatch(data) {
  const patch = {};
  for (const field of ['quote_deadline', 'advance_paid_date', 'delivery_date']) {
    const value = data[field] ?? '';
    if (value !== '' && !validDate(value)) throw new Error('날짜 형식이 올바르지 않습니다.');
    patch[field] = value;
  }
  const days = data.delivery_business_days;
  if (days === '' || days == null || !Number.isInteger(Number(days)) || Number(days) < 0 || Number(days) > 3650) throw new Error('소요일은 0~3650의 정수로 입력하세요.');
  patch.delivery_business_days = Number(days);
  patch.delivery_date_mode = data.delivery_date_mode || 'AUTO';
  if (!['AUTO', 'MANUAL'].includes(patch.delivery_date_mode)) throw new Error('계산 방식을 확인하세요.');
  if (patch.delivery_date_mode === 'AUTO') patch.delivery_date = deliveryDate(patch.advance_paid_date, patch.delivery_business_days);
  return patch;
}
export function scheduleDiff(before, after) {
  const display = value => value === 'AUTO' ? '자동 계산' : value === 'MANUAL' ? '직접 조정' : value === '' || value == null ? '미정' : String(value);
  return Object.keys(scheduleLabels).filter(key => display(before[key] ?? (key === 'delivery_date_mode' ? 'AUTO' : '')) !== display(after[key] ?? (key === 'delivery_date_mode' ? 'AUTO' : ''))).map(key => `${scheduleLabels[key]}: ${display(before[key] ?? (key === 'delivery_date_mode' ? 'AUTO' : ''))} → ${display(after[key] ?? (key === 'delivery_date_mode' ? 'AUTO' : ''))}`);
}