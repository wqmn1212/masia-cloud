// 공장 업로드 링크 만들기 (화면의 manageFactoryRequest · AI 비서 assistantQuote 공용).
// 링크 토큰과 PIN 원문은 여기서 한 번만 돌려주고, 저장은 해시로만 한다.
import { sha256Hex, pinHash, newToken, newPin, cleanItems, DEFAULT_DAYS, MAX_DAYS } from './factoryRequest.ts';

const DAY = 86400000;
const clampDays = (v: unknown) => Math.min(MAX_DAYS, Math.max(1, Math.round(Number(v) || DEFAULT_DAYS)));

/**
 * card: 링크를 만들 카드 · items: [{ kind, label_ko, label_cn, ... }] · factory_name: 링크마다 정하는 공장 이름 (비우면 카드의 공장)
 * 돌려줌: { error } 또는 { request, token, pin, items }
 */
export async function createFactoryRequest(svc: any, { card, items: rawItems, days, message_cn, factory_name, by, actorId = '' }: any) {
  const db = svc.entities;
  const milestones = (await db.CardMilestone.filter({ card_id: card.id }, 'seq', 100)).filter((m: any) => m.card_id === card.id);
  const [precheck] = await db.QCPrecheck.filter({ card_id: card.id }, '-version', 1);
  const precheckKeys = (precheck?.items || []).filter((i: any) => i.kind === 'QUESTION' && i.decision !== 'DISMISSED').map((i: any) => i.key);
  const items = cleanItems(rawItems, { milestones, precheckKeys });
  if (!items.length) return { error: '공장에 받을 항목을 하나 이상 고르세요' };
  // 같은 카드라도 공장마다 따로 링크를 만든다 (견적을 여러 공장에서 받을 때)
  const factoryName = typeof factory_name === 'string' ? factory_name.trim().slice(0, 200) : '';
  const token = newToken(), pin = newPin();
  const request = await db.FactoryRequest.create({
    tenant_id: card.tenant_id, card_id: card.id, factory_id: factoryName && factoryName !== card.factory_name ? '' : card.factory_id || '', factory_name: factoryName || card.factory_name || '',
    token_hash: await sha256Hex(token), pin_hash: await pinHash(token, pin),
    expires_at: new Date(Date.now() + clampDays(days) * DAY).toISOString(), status: 'OPEN',
    message_cn: typeof message_cn === 'string' ? message_cn.trim().slice(0, 1000) : '',
    items, submissions: [], failed_pin_count: 0, created_by_name: by || '',
  });
  try { await db.ProjectAuditLog.create({ tenant_id: card.tenant_id, card_id: card.id, event_type: 'FACTORY_REQUEST_CREATED', actor_id: actorId, actor_name: by || '', details: `공장 업로드 링크 생성 · ${items.length}개 항목` }); } catch (_e) { /* 기록 실패가 요청을 막지 않는다 */ }
  return { request, token, pin, items };
}

export const factoryLinkUrl = (token: string) => `${(Deno.env.get('APP_BASE_URL') || 'https://aegistrade.biz').replace(/\/$/, '')}/f/${token}`;

// 공장에 보낼 견적 요청 중국어 안내 (화면의 '견적 요청 문구 넣기'와 같은 내용)
export const quoteRequestMessage = (product: string) => `您好，请根据以下产品提供正式报价单：\n产品：${product}\n请注明：单价、数量、模具费（如有）、交期（工作日）、付款条件、报价有效期、是否含税。\n可以直接上传 Excel、Word 或 PDF。谢谢！`;
