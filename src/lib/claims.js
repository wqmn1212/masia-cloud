// 고객 불량 신고(클레임) 화면 공용 값. 서버 쪽 base44/shared/claims.ts 와 같은 상태 목록을 쓴다 (둘을 함께 고칠 것).
export const CLAIM_STEPS = ['SUBMITTED', 'REVIEWING', 'FACTORY_CONFIRMED', 'RESOLVED'];
export const CLAIM_STATUS = { SUBMITTED: '접수', REVIEWING: '확인 중', FACTORY_CONFIRMED: '공장 확인', RESOLVED: '처리 완료', REJECTED: '반려' };
export const CLAIM_RESOLUTION = { REWORK: '재작업', REPLACE: '재생산·교체', REFUND: '환불', DISCOUNT: '다음 발주 할인', NONE: '보상 없음' };
const SEVERITY_CN = { CRITICAL: '致命', MAJOR: '主要', MINOR: '次要' };
const QC_RESULT_CN = { PASS: '合格', CONDITIONAL_PASS: '有条件合格', FAIL: '不合格' };

// 공장에 보낼 중국어 클레임 문서 (위챗·이메일에 붙여 넣기). 번역이 없으면 한국어 원문을 그대로 넣는다.
export function claimDocCn({ card, claim, spec, qc, photoCount = 0 }) {
  const lines = [
    `【质量投诉】${card.title_cn || card.title}`,
    `投诉日期：${(claim.submitted_at || claim.created_date || '').slice(0, 10)}`,
    '',
    `问题：${claim.title_cn || claim.title}`,
    `详细说明：${claim.description_cn || claim.description}`,
  ];
  if (claim.defect_qty != null) lines.push(`不良数量：${claim.defect_qty} 个${claim.received_qty ? ` / 收货数量 ${claim.received_qty} 个（不良率 ${((claim.defect_qty / claim.received_qty) * 100).toFixed(1)}%）` : ''}`);
  if (claim.lot_note) lines.push(`批次信息：${claim.lot_note}`);
  if (photoCount) lines.push(`照片：${photoCount} 张（另附）`);
  if (spec?.items?.length) {
    lines.push('', `【双方确认的质量标准 v${spec.version || 1}】AQL ${spec.aql_level || ''} 致命 ${spec.aql_critical ?? '-'} / 主要 ${spec.aql_major ?? '-'} / 次要 ${spec.aql_minor ?? '-'}`);
    spec.items.forEach((i, n) => lines.push(`${n + 1}. ${i.label_cn || i.label}（${SEVERITY_CN[i.severity] || i.severity || ''}）：${i.standard_cn || i.standard}`));
  }
  if (qc) lines.push('', `【出货前检验】${(qc.created_date || '').slice(0, 10)} ${QC_RESULT_CN[qc.qc_result] || qc.qc_result || ''}`);
  lines.push('', '请在 3 个工作日内回复原因分析和处理方案（返工 / 补货 / 退款 / 下次订单抵扣）。', 'AEGIS 质量管理');
  return lines.join('\n');
}
