// 고객 불량 신고(클레임). 화면 쪽 src/lib/claims.js 와 같은 상태 목록을 쓴다 (둘을 함께 고칠 것).
import { factoryWait, compensationState } from './claimTracking.ts';
export const CLAIM_STATUS_LABEL = { SUBMITTED: '접수', REVIEWING: '확인 중', FACTORY_CONFIRMED: '공장 확인', RESOLVED: '처리 완료', REJECTED: '반려' };
export const CLAIM_RESOLUTION_LABEL = { REWORK: '재작업', REPLACE: '재생산·교체', REFUND: '환불', DISCOUNT: '다음 발주 할인', NONE: '보상 없음' };

// 고객에게 보내는 값 — 공장 회신(내부)과 중국어 번역은 빼고 보낸다
export function clientClaim(c: any, photos: any[]) {
  return {
    id: c.id, title: c.title, description: c.description || '', defect_qty: c.defect_qty ?? null, received_qty: c.received_qty ?? null, lot_note: c.lot_note || '',
    status: c.status || 'SUBMITTED', resolution: c.resolution && c.resolution !== 'PENDING' ? c.resolution : '', client_message: c.client_message || '',
    submitted_by_name: c.submitted_by_name || '', submitted_at: c.submitted_at || c.created_date || '', resolved_at: c.resolved_at || '',
    photos: photos.filter((p) => (c.photo_ids || []).includes(p.id)).map((p) => ({ id: p.id, card_id: p.card_id, file_name: p.file_name })),
    history: (c.history || []).map((h: any) => ({ at: h.at, status: h.status, note: h.note || '' })),
    // 공장 회신 대기 일수 (문서를 보냈고 회신 전일 때만) · 보상 약속과 다음 주문 반영 여부
    factory_wait_days: factoryWait(c)?.days ?? null,
    compensation: compensationState(c) ? {
      kind: c.compensation?.kind || c.resolution, state: compensationState(c), amount: c.compensation?.amount ?? null, currency: c.compensation?.currency || 'KRW',
      note: c.compensation?.note || '', applied_card_title: c.compensation?.applied_card_title || '', applied_at: c.compensation?.applied_at || '',
    } : null,
  };
}
