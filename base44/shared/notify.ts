// 앱 내 알림 + 이메일 병행 발송 공용 모듈.
// Notification 의 권한 키는 recipient_id 이므로 cross-tenant(본사 ↔ 고객사) 알림이 동작한다.
// 발신자명은 앱 전체에서 'AEGIS' 로 단일화한다.
export const FROM_NAME = 'AEGIS';

const DEBOUNCE_MS = 5 * 60 * 1000;
// 매번 이메일을 보내는 알림 (5분 규칙 제외)
const ALWAYS_EMAIL = ['quote_published', 'payment_confirmed', 'schedule_changed'];

// 공통 이메일 본문 틀: 본문 + 프로젝트 + 바로가기 링크 + 안내
export function emailBody(text, cardTitle, link) {
  const base = (Deno.env.get('APP_BASE_URL') || 'https://aegistrade.biz').replace(/\/$/, '');
  const lines = [text || ''];
  const meta = [];
  if (cardTitle) meta.push(`프로젝트: ${cardTitle}`);
  if (link) meta.push(`바로 확인하기: ${base}${link}`);
  if (meta.length) lines.push('', ...meta);
  lines.push('', 'AEGIS Cloud 알림 메일입니다. 이 메일에는 회신하지 마시고, 문의는 프로젝트 카드의 문의 탭을 이용해 주세요.');
  return lines.join('\n');
}

// 같은 수신자·카드·타입의 미읽음 알림이 최근에 있으면 이메일만 생략한다 (앱 내 알림은 항상 생성)
async function shouldEmail(svc, recipientId, type, cardId) {
  if (!cardId) return true;
  const recent = await svc.entities.Notification.filter(
    { recipient_id: recipientId, type, task_card_id: cardId },
    '-created_date',
    1
  );
  const last = recent[0];
  if (!last) return true;
  return Date.now() - new Date(last.created_date).getTime() > DEBOUNCE_MS;
}

/**
 * @param svc  base44.asServiceRole
 * @param recipients  User 레코드 배열
 * @param payload  { type, title, body, link, task_card_id, card_title }
 * @param options  { email: false } 이면 이메일 생략 (앱 알림만)
 */
export async function notifyUsers(svc, recipients, payload, options = {}) {
  const targets = (recipients || []).filter((u) => u?.id && u.is_active !== false);
  if (targets.length === 0) return 0;

  for (const u of targets) {
    const emailAllowed = options.email !== false &&
      (ALWAYS_EMAIL.includes(payload.type) || await shouldEmail(svc, u.id, payload.type, payload.task_card_id));

    await svc.entities.Notification.create({
      tenant_id: u.tenant_id || '',
      recipient_id: u.id,
      recipient_email: u.email || '',
      type: payload.type,
      title: payload.title,
      body: payload.body || '',
      link: payload.link || '',
      task_card_id: payload.task_card_id || '',
      read: false,
    });

    if (emailAllowed && u.email) {
      try {
        await svc.integrations.Core.SendEmail({
          to: u.email,
          from_name: FROM_NAME,
          subject: payload.title,
          body: emailBody(payload.body || payload.title, payload.card_title, payload.link),
        });
      } catch (_e) { /* 메일 실패가 알림 생성을 막지 않는다 */ }
    }
  }
  return targets.length;
}

// 특정 고객사(Company)에 속한 활성 client 계정 전원
export async function clientUsersOfCompany(svc, companyId) {
  if (!companyId) return [];
  const users = await svc.entities.User.filter({ account_tier: 'client', company_id: companyId });
  return users.filter((u) => u.is_active !== false);
}

// 카드를 소유한 내부 팀의 담당자 전원 (service + sub)
export async function internalUsersOfTenant(svc, tenantId) {
  if (!tenantId) return [];
  const users = await svc.entities.User.filter({ tenant_id: tenantId });
  return users.filter((u) => ['service', 'sub'].includes(u.account_tier) && u.is_active !== false);
}