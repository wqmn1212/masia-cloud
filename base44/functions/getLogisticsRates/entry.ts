import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// 물류비 계산기 요율 조회 — 고객 포털(고객사 계정)과 직원 화면 전용. 비로그인 호출은 거절한다.
// 활성 요율과 최신 환율만 돌려주고, 요율의 근거(source: 포워더명·청구서)는 내부 정보라 빼고 보낸다.
const PUBLIC_FIELDS = ['mode', 'segment', 'code', 'label', 'unit', 'amount', 'currency', 'fx_krw', 'region', 'max_cbm', 'over_cbm', 'min', 'verified', 'variable', 'note', 'valid_from'];
const STAFF_TIERS = ['master', 'service', 'sub'];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const isStaff = STAFF_TIERS.includes(user.account_tier);
    const isClient = user.account_tier === 'client' && user.is_active !== false && !!user.company_id;
    if (!isStaff && !isClient) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const svc = base44.asServiceRole;
    const [rows, fx] = await Promise.all([
      svc.entities.LogisticsRate.filter({ active: true }, 'segment', 500),
      svc.entities.ExchangeRate.list('-rate_date', 1),
    ]);

    const rates = rows.map((r) => Object.fromEntries(PUBLIC_FIELDS.filter((k) => r[k] !== undefined && r[k] !== null).map((k) => [k, r[k]])));
    const latest = fx[0];
    return Response.json({
      rates,
      usd_krw: latest?.usd_krw || null,
      rate_date: latest?.rate_date || null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
