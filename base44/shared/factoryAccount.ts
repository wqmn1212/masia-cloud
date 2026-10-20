// 공장 지급 계좌 잠금. 계좌는 직원이 '요청'하고 마스터가 확인해야 쓸 수 있다 (FactoryAccount 쓰기는 마스터·서버만).
export const VERIFY_METHOD_LABEL = { VISIT: '공장 방문 확인', VIDEO_CALL: '영상통화 확인', PHONE: '대표 번호 전화 확인', DOCUMENT: '서류 확인' };
const PUBLIC_FIELDS = ['beneficiary_name', 'bank_name', 'account_no', 'swift_code', 'bank_address', 'currency', 'verified_at'];

export const sameAccount = (a: any, b: any) => !!a && !!b
  && String(a.account_no || '').replace(/\s/g, '') === String(b.account_no || '').replace(/\s/g, '')
  && String(a.beneficiary_name || '').trim() === String(b.beneficiary_name || '').trim()
  && String(a.bank_name || '').trim() === String(b.bank_name || '').trim();

export async function factoryAccounts(svc: any, factoryId: string) {
  const rows = await svc.entities.FactoryAccount.filter({ factory_id: factoryId }, '-created_date', 50);
  return {
    verified: rows.find((r: any) => r.status === 'VERIFIED') || null,
    pending: rows.filter((r: any) => r.status === 'PENDING'),
  };
}

// 고객이 공장에 직접 송금하는 카드(client_pays_factory)에서만 내려 준다. 확인된 계좌만, 변경 요청이 있으면 송금 중지 안내.
export async function clientFactoryPayment(svc: any, card: any) {
  if (!card?.client_pays_factory || !card.factory_id) return null;
  const { verified, pending } = await factoryAccounts(svc, card.factory_id);
  return {
    verified: verified ? { ...Object.fromEntries(PUBLIC_FIELDS.map((k) => [k, verified[k] || ''])), verify_method: VERIFY_METHOD_LABEL[verified.verify_method] || '' } : null,
    pending_change: pending.length > 0,
  };
}
