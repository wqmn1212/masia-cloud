// 공장 확인 카드. 화면 쪽 src/lib/factoryCheck.js 와 같은 목록을 쓴다 (둘을 함께 고칠 것).
const FACTORY_CHECKS = [
  { key: 'LICENSE', label: '사업자등록증 원본 확인' },
  { key: 'SCOPE', label: '경영 범위에 생산 포함' },
  { key: 'MANUFACTURER', label: '실제 제조사 (무역회사 아님)' },
  { key: 'SITE_VISIT', label: '공장 현장 방문' },
  { key: 'EQUIPMENT', label: '생산 설비·라인 확인' },
];

// 고객에게는 확인 여부만 보낸다 (공장명·주소·메모는 보내지 않는다)
export async function clientFactoryCheck(svc: any, card: any) {
  if (!card?.factory_id) return null;
  const f = await svc.entities.Company.get(card.factory_id).catch(() => null);
  // 예전에 팀 없이 만든 공장도 카드가 가리키는 공장이면 보여 준다 (다른 팀 공장은 제외)
  if (!f || f.company_type !== 'FACTORY' || (f.tenant_id && f.tenant_id !== card.tenant_id)) return null;
  const items = f.verification_items || {};
  return {
    status: f.verification_status || 'NONE',
    items: FACTORY_CHECKS.map((c) => ({ key: c.key, label: c.label, status: items[c.key]?.status || '' })),
    visited_at: f.verification_visited_at || '',
    updated_at: f.verification_updated_at || '',
  };
}
