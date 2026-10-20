// 수입 요건(인증·신고) 체크리스트. 화면 쪽 src/lib/importRequirements.js 와 같은 상태 규칙을 쓴다 (둘을 함께 고칠 것).
export const pendingReqs = (list: any[] = []) => list.filter((r) => r && r.status !== 'DONE' && r.status !== 'NA');

export function clientImportRequirements(card: any) {
  const list = Array.isArray(card?.import_requirements) ? card.import_requirements : [];
  return list.map((r: any) => ({ key: r.key || '', label: r.label || '', status: r.status || 'REQUIRED', cert_no: r.cert_no || '', due_date: r.due_date || '', note: r.note || '' }));
}
