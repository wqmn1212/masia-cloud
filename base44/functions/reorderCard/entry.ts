import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { cardVisibleToClient } from '../../shared/clientAccess.ts';
import { notifyUsers, internalUsersOfTenant } from '../../shared/notify.ts';
import { fillMissingTranslation } from '../../shared/bilingualTranslation.ts';

// 재주문 = 지난 프로젝트를 복제해 새 카드로 시작한다 (고객 요청 · 직원 복제 공용).
// 복사: 공장·카테고리·요구사항·책임자·진행 중 월 계약, 제품 단위 서류(일반 파일·UN38.3·MSDS·배터리 사양서),
//       품질 기준서(고객 승인본 → 새 초안 v1, 다시 보내야 함), BOM.
// 복사하지 않음: 견적·결제·일정·검수·선적·채팅, 선적 건별 서류(CI·PL·B/L·원산지증명서·DGD), 송금 계좌.
const PRODUCT_DOC_TYPES = ['GENERAL', 'UN38_3', 'MSDS', 'BATTERY_SPEC'];
const BOM_FIELDS = ['bom_set_id', 'source_file_url', 'source_file_name', 'revision_label', 'part_name', 'display_name', 'quantity', 'volume_cm3', 'bbox_x_mm', 'bbox_y_mm', 'bbox_z_mm', 'projected_area_cm2', 'material', 'material_confirmed', 'density', 'weight_g', 'color_spec', 'finish', 'insert_count', 'cavity_count', 'cycle_time_sec', 'machine_class', 'thumbnail_url', 'is_purchased', 'note'];
const RATE_LIMIT_MS = 5 * 60 * 1000;
const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const validDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const baseTitle = (t = '') => String(t).replace(/^(\[(재주문|고객문의|返单)\]\s*)+/, '');

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_active === false) return Response.json({ error: '비활성 계정입니다' }, { status: 403 });
    const input = await req.json();
    const svc = base44.asServiceRole, db = svc.entities;
    const source = typeof input.card_id === 'string' ? await db.TaskCard.get(input.card_id).catch(() => null) : null;
    const isClient = user.account_tier === 'client';

    if (isClient) {
      if (!user.company_id || !cardVisibleToClient(source, user.company_id)) return Response.json({ error: 'Forbidden' }, { status: 403 });
      if (!['PRODUCTION', 'DONE'].includes(source.status)) return Response.json({ error: '발주 이후의 프로젝트만 재주문할 수 있습니다' }, { status: 400 });
      const recent = await db.TaskCard.filter({ reorder_of: source.id, client_id: user.company_id }, '-created_date', 3);
      if (recent.some((c) => Date.now() - new Date(c.created_date).getTime() < RATE_LIMIT_MS)) return Response.json({ error: '방금 같은 재주문을 접수했습니다. 잠시 후 다시 시도해 주세요' }, { status: 429 });
    } else {
      if (!['master', 'service', 'sub'].includes(user.account_tier)) return Response.json({ error: 'Forbidden' }, { status: 403 });
      if (!source || (user.account_tier !== 'master' && source.tenant_id !== user.tenant_id)) return Response.json({ error: '카드 접근 권한이 없습니다' }, { status: 403 });
    }

    const quantity = clean(input.quantity, 200);
    const changes = clean(input.changes, 3000);
    const target = validDate(input.target_date) ? input.target_date : '';
    const copy = isClient ? { docs: true, spec: true, bom: true } : { docs: input.copy?.docs !== false, spec: input.copy?.spec !== false, bom: input.copy?.bom !== false };
    const actor = user.full_name || user.account_label || user.email;
    const title = baseTitle(source.title);

    let agreementId = '';
    if (source.agreement_id) {
      const a = await db.ServiceAgreement.get(source.agreement_id).catch(() => null);
      if (a?.status === 'ACTIVE' && a.company_id === source.client_id) agreementId = a.id;
    }

    const card = await db.TaskCard.create({
      tenant_id: source.tenant_id,
      title: `[재주문] ${title}`.slice(0, 200),
      title_cn: source.title_cn ? `[返单] ${baseTitle(source.title_cn)}`.slice(0, 200) : '',
      status: 'TODO',
      priority: source.priority || 'MEDIUM',
      source: 'reorder',
      reorder_of: source.id,
      client_id: source.client_id || '',
      client_name: source.client_name || '',
      client_visible: isClient ? true : typeof input.client_visible === 'boolean' ? input.client_visible : source.client_visible === true,
      target_machine_category: source.target_machine_category || '',
      factory_id: source.factory_id || '',
      factory_name: source.factory_name || '',
      candidate_factory_ids: source.candidate_factory_ids || [],
      candidate_factory_names: source.candidate_factory_names || [],
      owner_id: source.owner_id || null,
      owner_name: source.owner_name || null,
      agreement_id: agreementId,
      hq_requirements: [
        `재주문 · 원 프로젝트: ${title}`,
        `요청: ${actor}${isClient ? ' (고객)' : ''}`,
        `수량: ${quantity || '-'} / 희망 납기: ${target || '-'}`,
        `바뀌는 점: ${changes || '없음 (이전과 같음)'}`,
        '',
        '— 이전 요구사항 —',
        source.hq_requirements || '',
      ].join('\n').slice(0, 20000),
      hq_requirements_cn: '',
      ...(target ? { due_date: target } : {}),
    });
    let translationFailed = false;
    try { await fillMissingTranslation(svc, 'TaskCard', card, ['hq_requirements'], 'zh'); } catch { translationFailed = true; }

    const copied = { docs: 0, spec: false, bom: 0 };
    if (copy.docs) {
      const docs = (await db.CardAttachment.filter({ card_id: source.id }, 'created_date', 500))
        .filter((a) => a.card_id === source.id && PRODUCT_DOC_TYPES.includes(a.document_type || 'GENERAL'));
      if (docs.length) {
        await db.CardAttachment.bulkCreate(docs.map((a) => ({
          tenant_id: source.tenant_id, card_id: card.id, file_name: a.file_name, file_type: a.file_type, file_url: a.file_url,
          client_visible: a.client_visible === true, document_type: a.document_type || 'GENERAL', uploader_name: a.uploader_name || '',
          ...(a.uploader_role ? { uploader_role: a.uploader_role } : {}),
        })));
      }
      copied.docs = docs.length;
    }
    if (copy.spec) {
      const specs = (await db.QualitySpec.filter({ card_id: source.id }, '-version', 20)).filter((s) => s.card_id === source.id && s.status === 'SENT');
      const base = specs.find((s) => s.client_decision === 'APPROVED') || specs[0];
      if (base) {
        await db.QualitySpec.create({
          tenant_id: source.tenant_id, card_id: card.id, version: 1, status: 'DRAFT',
          aql_level: base.aql_level || '', aql_critical: base.aql_critical ?? null, aql_major: base.aql_major ?? null, aql_minor: base.aql_minor ?? null,
          sampling_note: base.sampling_note || '', items: base.items || [],
          note: base.note || '', created_by_name: `${actor} (이전 프로젝트 v${base.version || 1}에서 가져옴)`,
        });
        copied.spec = true;
      }
    }
    if (copy.bom) {
      const items = (await db.BomItem.filter({ card_id: source.id }, 'created_date', 500)).filter((i) => i.card_id === source.id);
      if (items.length) await db.BomItem.bulkCreate(items.map((i) => ({ ...Object.fromEntries(BOM_FIELDS.filter((k) => i[k] !== undefined).map((k) => [k, i[k]])), tenant_id: source.tenant_id, card_id: card.id })));
      copied.bom = items.length;
    }

    if (isClient) {
      try {
        const staff = await internalUsersOfTenant(svc, source.tenant_id);
        await notifyUsers(svc, staff, {
          type: 'reorder_requested',
          title: `[재주문 요청] ${title}`,
          body: `${actor}: 수량 ${quantity || '-'}, 희망 납기 ${target || '-'}${changes ? `\n바뀌는 점: ${changes.slice(0, 300)}` : ''}`,
          link: `/task-board?card=${card.id}`,
          task_card_id: card.id,
          card_title: card.title,
        });
      } catch (_e) { /* 알림 실패가 접수를 막지 않는다 */ }
    }

    return Response.json({ ok: true, card_id: card.id, copied, translation_failed: translationFailed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
