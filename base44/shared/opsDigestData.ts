// 일일 운영 요약에 쓸 팀 데이터 한 번에 읽기 (sendDailyOpsDigest·getOpsDigest 공용). 계산은 opsDigest.ts 가 한다.
import { clientOverview } from './clientOverview.ts';
import { clientWaitsFrom } from './opsDigest.ts';

const CHUNK = 50;
async function byCards(entity: any, ids: string[], sort: string, limit = 1000) {
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK);
    out.push(...(await entity.filter({ card_id: { $in: part } }, sort, limit)).filter((r: any) => part.includes(r.card_id)));
  }
  return out;
}

export async function loadOpsData(svc: any, tenantId: string, { staffUser }: { staffUser: any }) {
  const db = svc.entities;
  const cards = (await db.TaskCard.filter({ tenant_id: tenantId }, '-updated_date', 500)).filter((c: any) => c.tenant_id === tenantId && !['DONE', 'CANCELLED'].includes(c.status));
  const ids = cards.map((c: any) => c.id);
  const since = new Date(Date.now() - 8 * 86400000).toISOString();
  const [milestones, tasks, factoryRequests, chats] = ids.length ? await Promise.all([
    byCards(db.CardMilestone, ids, 'planned_date'),
    byCards(db.TaskItem, ids, 'due_date'),
    byCards(db.FactoryRequest, ids, '-created_date', 200),
    byCards(db.CardChat, ids, '-created_date', 300).then((rows) => rows.filter((m: any) => (m.created_date || '') >= since)),
  ]) : [[], [], [], []];
  // 고객 대기: 고객사마다 대시보드와 같은 계산으로 결정할 것을 모은다 (직원 계정으로 부르면 서명 대기는 빠지므로 따로 읽는다)
  const clientWaits: any[] = [];
  for (const companyId of [...new Set(cards.map((c: any) => c.client_id).filter(Boolean))] as string[]) {
    try { clientWaits.push(...clientWaitsFrom(await clientOverview(svc, { user: staffUser, companyId }))); } catch (_e) { /* 한 고객사 실패가 요약 전체를 막지 않는다 */ }
  }
  const signatures = (await db.SignatureRequest.filter({ tenant_id: tenantId, status: 'OUT' }, '-created_date', 200)).filter((s: any) => s.tenant_id === tenantId);
  const plans = (await db.ProductPlan.filter({ tenant_id: tenantId }, '-updated_date', 500)).filter((p: any) => p.tenant_id === tenantId && p.order_by);
  const companies = new Map<string, string>();
  for (const id of [...new Set(plans.map((p: any) => p.company_id))] as string[]) companies.set(id, (await db.Company.get(id).catch(() => null))?.company_name || '');
  // 재주문 상품의 첫 카드(product_key)는 완료된 카드라 위 목록에 없을 수 있다: 책임자·제목만 따로 읽는다
  const extra = [];
  for (const key of [...new Set(plans.map((p: any) => p.product_key))] as string[]) if (!ids.includes(key)) { const c = await db.TaskCard.get(key).catch(() => null); if (c) extra.push(c); }
  return {
    cards: [...cards, ...extra], milestones, tasks, factoryRequests, chats, clientWaits, signatures,
    plans: plans.map((p: any) => ({ ...p, company_name: companies.get(p.company_id) || '' })),
  };
}
