// 고객 포털에 내보내는 검수 리포트 형태. 담당자가 공개(client_visible)한 리포트만 이 함수로 변환한다.
// 내부 전용 필드(공장 클레임 업무, 감사 로그 등)는 여기에 넣지 않는다.
export const QC_DECISIONS = ['APPROVED', 'ON_HOLD'];

export function clientQcReport(r) {
  return {
    id: r.id,
    card_id: r.card_id,
    inspection_type: r.inspection_type,
    qc_result: r.qc_result,
    inspector_name: r.inspector_name || '',
    checklist: (r.checklist || []).map((i) => ({ label: i.label || '', status: i.status || 'PENDING', note: i.note || '' })),
    comments: r.comments || '',
    media: (r.media_urls || []).map((url, i) => ({ url, name: r.media_names?.[i] || `사진 ${i + 1}` })),
    published_at: r.client_published_at || r.created_date,
    decision: r.client_decision || 'PENDING',
    decision_note: r.client_decision_note || '',
    decided_at: r.client_decided_at || '',
    decided_by_name: r.client_decided_by_name || '',
  };
}
