// 고객(client 등급) 데이터 접근 공용 규칙.
// 원칙: 고객의 모든 조회는 asServiceRole 전용 함수 경로로만 처리한다.
// TaskCard/Quotation 의 read RLS 는 tenant_id 기준이므로, 다른 테넌트인 고객은 직접 쿼리로 접근할 수 없다.

export const CLIENT_MENU = ['/client/dashboard', '/client/board'];
export const CLIENT_CARD_TABS = ['overview', 'quotation', 'chat', 'settlement'];

// 고객 요청의 유효성 검사 — 통과 시 { user, companyId } 반환, 실패 시 Response 반환
export async function requireClient(base44) {
  const user = await base44.auth.me();
  if (!user) return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.account_tier !== 'client') {
    return { error: Response.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  if (user.is_active === false) {
    return { error: Response.json({ error: '비활성 계정입니다' }, { status: 403 }) };
  }
  if (!user.company_id) {
    return { error: Response.json({ error: '고객사 정보가 연결되지 않았습니다' }, { status: 403 }) };
  }
  return { user, companyId: user.company_id };
}

// 고객에게 보여도 되는 카드인지 — 소유 고객사 일치 + 공개 토글 ON
export function cardVisibleToClient(card, companyId) {
  return !!card && card.client_visible === true && card.client_id === companyId;
}

// 고객에게 보여도 되는 견적인지 — 소유 고객사 일치 + 공개 시점 기록됨
export function quotationVisibleToClient(q, companyId) {
  return !!q && !!q.client_published_at && q.client_id === companyId;
}