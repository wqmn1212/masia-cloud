// 고객 포털에 내보내는 검수 리포트 형태. 담당자가 공개(client_visible)한 리포트만 이 함수로 변환한다.
// 내부 전용 필드(공장 클레임 업무, 감사 로그 등)는 여기에 넣지 않는다.
export const QC_DECISIONS = ['APPROVED', 'ON_HOLD'];
export const SPEC_DECISIONS = ['APPROVED', 'REVISION_REQUESTED'];

// 고객에게 보낸(SENT) 품질 기준서. 공장용 중국어 문구는 빼고 고객이 읽는 문장만 내보낸다.
export function clientQualitySpec(s) {
  return {
    id: s.id,
    card_id: s.card_id,
    version: s.version || 1,
    aql_level: s.aql_level || '',
    aql_critical: s.aql_critical ?? null,
    aql_major: s.aql_major ?? null,
    aql_minor: s.aql_minor ?? null,
    sampling_note: s.sampling_note || '',
    items: (s.items || []).map((i) => ({ key: i.key || '', label: i.label || '', standard: i.standard || '', severity: i.severity || 'MINOR', ok_photo_url: i.ok_photo_url || '', ng_photo_url: i.ng_photo_url || '' })),
    note: s.note || '',
    sent_at: s.sent_at || '',
    factory_confirmed: !!s.factory_confirmed_at,
    decision: s.client_decision || 'PENDING',
    comment: s.client_comment || '',
    decided_at: s.client_decided_at || '',
    decided_by_name: s.client_decided_by_name || '',
  };
}

// 카드별 최신 보낸 판본 (버전이 가장 높은 SENT)
export function latestSentSpecs(specs) {
  const byCard = new Map();
  for (const s of specs) {
    if (s.status !== 'SENT') continue;
    const cur = byCard.get(s.card_id);
    if (!cur || (s.version || 1) > (cur.version || 1)) byCard.set(s.card_id, s);
  }
  return byCard;
}

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
