import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { summarizeInvoice, matchShipment, WARNING_TEXT, LINE_KINDS } from '../../shared/destCostInvoice.ts';
import { assertPublicHttpUrl } from '../../shared/safeUrl.ts';

// AI 비서용: 관세사·포워더 정산서로 선적의 '한국 도착 실제 비용'을 기록한다.
//  find  — 도착했는데 실제 비용이 비어 있는 선적 (card_query 로 좁히기)
//  parse — 정산서 파일을 읽어 미리보기만 돌려준다 (저장하지 않음)
//  apply — 사람이 승인한 값을 선적에 기록하고, 정산서는 비공개 파일로 카드에 보관한다
// 직원(master·service·sub)만, 자기 팀 선적만. 실제 비용은 고객 화면(도착지 비용·상품 원가)에 쓰이므로 반드시 미리보기 → 승인 뒤에 apply 한다.
const STAFF = ['master', 'service', 'sub'];
const ARRIVED = ['ARRIVED', 'CUSTOMS', 'CLEARED', 'DELIVERED'];
const MAX_KRW = 2_000_000_000;

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!STAFF.includes(user.account_tier) || user.is_active === false) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole, db = svc.entities;
    const mine = (r: any) => !!r && (user.account_tier === 'master' || r.tenant_id === user.tenant_id);
    const scope = user.account_tier === 'master' ? {} : { tenant_id: user.tenant_id };

    const shipmentView = (s: any, card: any) => ({
      shipment_id: s.id, card_id: s.card_id, card_title: card?.title || '', client_name: card?.client_name || '', label: s.label || '', status: s.status,
      tracking_no: s.tracking_no || '', ata: s.ata || '', eta: s.eta || '',
      estimate_ex_vat: s.dest_cost_estimate ? Math.round(Number(s.dest_cost_estimate.buyer_ex_vat) || 0) : null,
      actual_ex_vat: s.dest_cost_actual ?? null, actual_vat: s.dest_cost_actual_vat ?? null,
    });

    if (body.action === 'find') {
      const ships = (await db.Shipment.filter(scope, '-updated_date', 300)).filter(mine);
      const cards = new Map();
      for (const id of [...new Set(ships.map((s: any) => s.card_id))]) cards.set(id, await db.TaskCard.get(id).catch(() => null));
      const q = String(body.card_query || '').trim().toLowerCase();
      const rows = ships
        .filter((s: any) => (body.include_recorded ? true : s.dest_cost_actual == null) && (body.include_all_status || ARRIVED.includes(s.status)))
        .map((s: any) => shipmentView(s, cards.get(s.card_id)))
        .filter((r: any) => !q || `${r.card_title} ${r.client_name} ${r.label} ${r.tracking_no}`.toLowerCase().includes(q));
      return Response.json({ shipments: rows.slice(0, 30) });
    }

    if (body.action === 'parse') {
      if (!body.file_url) return Response.json({ error: 'file_url 이 필요합니다' }, { status: 400 });
      try { await assertPublicHttpUrl(body.file_url); } catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
      const read = await svc.integrations.Core.InvokeLLM({
        prompt: `이 파일은 한국 관세사 또는 포워더가 수입 화물에 대해 보낸 정산서(청구서)다. 적힌 그대로 읽어라.
- lines: 청구 항목 한 줄씩. label 은 정산서의 항목명 그대로, amount_krw 는 그 줄의 원화 금액(숫자만). 합계·소계 줄은 넣지 마라.
- kind: DUTY(관세), IMPORT_VAT(수입 부가세), SERVICE_VAT(수수료·운임 등에 붙은 부가세), FREIGHT(해상·항공 운임), CUSTOMS_FEE(통관 수수료), LOCAL(THC·CFS·창고·내륙 운송 등), OTHER.
- grand_total_krw: 정산서에 적힌 총 청구액. bl_no: B/L 또는 AWB 번호. invoice_no, invoice_date(YYYY-MM-DD), issuer(발행 회사), currency.
- 읽을 수 없는 값은 비워 두고 지어내지 마라.`,
        file_urls: [body.file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            issuer: { type: 'string' }, invoice_no: { type: 'string' }, invoice_date: { type: 'string' }, bl_no: { type: 'string' }, currency: { type: 'string' },
            grand_total_krw: { type: 'number' },
            lines: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, amount_krw: { type: 'number' }, kind: { type: 'string', enum: LINE_KINDS } } } },
          },
        },
      });
      const ships = (await db.Shipment.filter(scope, '-updated_date', 300)).filter(mine);
      let target = body.shipment_id ? ships.find((s: any) => s.id === body.shipment_id) || null : null;
      let matchedBy = target ? 'GIVEN' : '';
      if (!target) { const m = matchShipment(read || {}, ships); target = m.shipment; matchedBy = m.by; }
      const card = target ? await db.TaskCard.get(target.card_id).catch(() => null) : null;
      const sum = summarizeInvoice(read || {}, { estimateExVat: target?.dest_cost_estimate ? target.dest_cost_estimate.buyer_ex_vat : null });
      return Response.json({
        invoice: { issuer: read?.issuer || '', invoice_no: read?.invoice_no || '', invoice_date: read?.invoice_date || '', bl_no: read?.bl_no || '' },
        ...sum, warning_text: sum.warnings.map((w) => WARNING_TEXT[w] || w),
        shipment: target ? { ...shipmentView(target, card), matched_by: matchedBy } : null,
        next: '이 값은 아직 저장되지 않았습니다. 선적과 금액을 사용자에게 보여 주고 승인을 받은 뒤 action=apply 로 기록하세요.',
      });
    }

    if (body.action === 'apply') {
      const s = body.shipment_id ? await db.Shipment.get(body.shipment_id).catch(() => null) : null;
      if (!mine(s)) return Response.json({ error: '선적을 찾을 수 없습니다' }, { status: 404 });
      const exVat = Math.round(Number(body.actual_ex_vat));
      const vat = body.actual_vat === undefined || body.actual_vat === null || body.actual_vat === '' ? null : Math.round(Number(body.actual_vat));
      if (!Number.isFinite(exVat) || exVat < 0 || exVat > MAX_KRW) return Response.json({ error: '부가세 제외 금액을 확인하세요' }, { status: 400 });
      if (vat !== null && (!Number.isFinite(vat) || vat < 0 || vat > MAX_KRW)) return Response.json({ error: '수입 부가세 금액을 확인하세요' }, { status: 400 });
      if (s.dest_cost_actual != null && body.overwrite !== true) return Response.json({ error: `이미 실제 비용(${Number(s.dest_cost_actual).toLocaleString('ko-KR')}원)이 기록된 선적입니다. 바꾸려면 사용자 확인 후 overwrite=true`, code: 'ALREADY_RECORDED' }, { status: 409 });
      const by = user.full_name || user.email || '';
      // 정산서는 비공개 파일로 옮겨 카드 파일(물류 청구서)로 보관한다 (고객 비공개)
      let fileNote = '';
      if (body.file_url) {
        try {
          await assertPublicHttpUrl(body.file_url);
          const res = await fetch(body.file_url);
          if (res.ok) {
            const bytes = new Uint8Array(await res.arrayBuffer());
            if (bytes.length <= 15 * 1024 * 1024) {
              const name = String(body.file_name || `정산서-${s.label || s.id}`).slice(0, 120);
              const up = await svc.integrations.Core.UploadPrivateFile({ file: new File([bytes], name, { type: res.headers.get('content-type') || 'application/octet-stream' }) });
              if (up?.file_uri) {
                await db.CardAttachment.create({ tenant_id: s.tenant_id, card_id: s.card_id, file_name: name, file_type: (name.split('.').pop() || '').toLowerCase(), file_url: up.file_uri, document_type: 'LOGISTICS_INVOICE', client_visible: false, uploader_name: `${by} (AI 비서)`, uploader_role: 'HQ' });
                fileNote = name;
              }
            }
          }
        } catch (_e) { /* 파일 보관 실패가 금액 기록을 막지 않는다 */ }
      }
      const patch: any = {
        dest_cost_actual: exVat, dest_cost_actual_vat: vat,
        dest_cost_actual_by_name: `${by} (AI 비서)`, dest_cost_actual_at: new Date().toISOString(), dest_cost_actual_source: fileNote || 'AI 비서 입력',
      };
      if (typeof body.client_note === 'string') patch.dest_cost_actual_note = body.client_note.trim().slice(0, 300);
      await db.Shipment.update(s.id, patch);
      await db.ProjectAuditLog.create({ tenant_id: s.tenant_id, card_id: s.card_id, event_type: 'SHIPMENT_OVERRIDDEN', actor_id: user.id, actor_name: by, details: `AI 비서로 한국 도착 실제 비용 기록 (${s.label || '선적'}): 부가세 제외 ${exVat.toLocaleString('ko-KR')}원${vat != null ? `, 수입 부가세 ${vat.toLocaleString('ko-KR')}원` : ''}${fileNote ? ` · 정산서 ${fileNote}` : ''}` }).catch(() => null);
      const card = await db.TaskCard.get(s.card_id).catch(() => null);
      return Response.json({
        ok: true, shipment_id: s.id, card_title: card?.title || '', label: s.label || '', actual_ex_vat: exVat, actual_vat: vat, file_saved: !!fileNote,
        next: '카드 정산 탭의 도착 원가 확정 창에서 이 값이 실제 청구로 들어갑니다. 원가 확정과 고객 공개는 직원이 화면에서 합니다.',
      });
    }

    return Response.json({ error: 'action 은 find · parse · apply 중 하나입니다' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
