import { addWorkdays } from '@/lib/chinaHolidays';

const s = (key, label, label_cn, days, extra = {}) => ({ key, label, label_cn, default_days: days, client_visible: true, needs_qc_report: false, ...extra });

const OEM = [
  s('spec', '사양 확정', '规格确认', 3),
  s('factory', '공장 확정', '工厂确认', 5, { client_visible: false }),
  s('deposit', '선금 입금', '定金到账', 3),
  s('sample1', '1차 샘플', '首样', 10),
  s('sample_ok', '샘플 승인', '样品确认', 5),
  s('mass', '양산 시작', '开始量产', 3),
  s('qc', '출고 전 검수', '出货前检验', 15, { needs_qc_report: true }),
  s('ship_out', '공장 출고', '工厂出货', 2),
  s('shipping', '선적', '装船', 3),
  s('customs', '통관', '清关', 5),
  s('delivery', '납품', '交付', 2),
];
const insertAfter = (list, key, items) => { const i = list.findIndex((x) => x.key === key); return [...list.slice(0, i + 1), ...items, ...list.slice(i + 1)]; };

export const MILESTONE_TEMPLATES = {
  general: { name: '일반 OEM', steps: OEM },
  electronics: { name: '전자기기', steps: insertAfter(OEM, 'sample_ok', [s('cert', '인증 시험(KC 등)', '认证测试', 15), s('firmware', '펌웨어 확정', '固件确认', 5)]) },
  beauty: { name: '뷰티', steps: insertAfter(OEM, 'sample1', [s('color', '색상 기준 확정', '颜色标准确认', 3), s('print', '인쇄 시안 확정', '印刷稿确认', 3)]) },
  goods: { name: '굿즈', steps: [
    s('design', '시안·3D 확정', '设计稿/3D确认', 5), s('sample1', '1차 샘플', '首样', 10), s('color', '색상 교정', '颜色校正', 3),
    s('sample_ok', '샘플 승인', '样品确认', 3), s('mass', '양산', '量产', 15), s('qc', '출고 전 검수', '出货前检验', 2, { needs_qc_report: true }),
    s('pack', '포장 기준 확정', '包装标准确认', 2), s('ship_out', '공장 출고', '工厂出货', 2), s('shipping', '선적', '装船', 3),
    s('customs', '통관', '清关', 5), s('delivery', '납품', '交付', 2)] },
  machine: { name: '설비', steps: [
    s('spec', '사양서 확정', '规格书确认', 5), s('drawing', '도면 승인', '图纸确认', 7), s('build', '제작', '制造', 30),
    s('test', '출고 전 작동 시험(영상 보고)', '出货前试机(视频)', 3, { needs_qc_report: true }), s('shipping', '포장·선적', '包装装船', 5),
    s('customs', '통관', '清关', 5), s('delivery', '납품', '交付', 2), s('install', '설치·시운전(선택)', '安装调试(可选)', 5, { optional: true })] },
};

// 시작일부터 근무일 누적으로 계획일 계산
export function buildPlan(steps, startDate, holidays) {
  let d = startDate;
  return steps.map(({ optional, ...st }, i) => { d = addWorkdays(d, st.default_days || 0, holidays); return { ...st, seq: i, planned_date: d }; });
}

export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export const todayStr = () => new Date().toISOString().slice(0, 10);

// 납품 단계: key 'delivery', 없으면 마지막 단계 (base44/shared/milestoneSummary.ts 와 같은 규칙)
export function deliveryMilestone(list) {
  const live = list.filter((m) => m.status !== 'skipped');
  return live.find((m) => m.key === 'delivery') || [...live].sort((a, b) => a.seq - b.seq).pop() || null;
}

// 완료: 실제일 − 기준일 / 미완료: max(계획일, 오늘) − 기준일
export function delayDays(m, today = todayStr()) {
  if (!m?.baseline_date) return 0;
  if (m.status === 'done') return m.actual_date ? daysBetween(m.baseline_date, m.actual_date) : 0;
  const ref = m.planned_date && m.planned_date > today ? m.planned_date : today;
  return daysBetween(m.baseline_date, ref);
}

export function cardSummary(list, confirmed, today = todayStr()) {
  const sorted = [...list].sort((a, b) => a.seq - b.seq);
  const current = sorted.find((m) => m.status !== 'done' && m.status !== 'skipped');
  const delivery = deliveryMilestone(sorted);
  return {
    current_milestone_label: current?.label || '완료',
    delay_days: confirmed && delivery ? Math.max(0, delayDays(delivery, today)) : 0,
    overdue_steps: confirmed ? sorted.filter((m) => m.status === 'pending' || m.status === 'in_progress').filter((m) => m.planned_date && m.planned_date < today).length : 0,
  };
}

// 지연 완료 시 뒤 단계들 계획일을 같은 근무일 수만큼 민다
export function countWorkdays(from, to, isWork) {
  let n = 0; let d = from;
  while (d < to) { d = new Date(Date.parse(d) + 86400000).toISOString().slice(0, 10); if (isWork(d)) n++; }
  return n;
}