import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { assertPublicHttpUrl } from '../../shared/safeUrl.ts';
import { parseInspectionSheets, expandRange, productionSummary, unitStatus, VERDICT } from '../../shared/productionUnits.ts';

// 양산 시리얼 관리 (직원 전용). 카드 '양산' 탭과 '시리얼 조회' 메뉴가 쓴다.
//  'list'          {card_id} → 카드의 제품 목록(간단히)과 집계
//  'preview'       {card_id, file_url, file_name} → 성적서를 읽어 새로 등록·갱신·충돌을 보여 줌 (저장 안 함)
//  'import'        {card_id, file_url, file_name, lot?} → 성적서대로 등록·갱신. 출하된 제품과 다른 카드의 시리얼은 건드리지 않음
//  'assign_pallet' {card_id, serials, pallet} → 시리얼(범위 가능)에 파레트 지정. pallet 이 '' 이면 해제
//  'dispose'       {card_id, serial, disposition: REWORK|SCRAP|REPASS|CLEAR, note?} → 불량 처리. REPASS 는 수리 후 재검사 합격
//  'ship'          {card_id, pallets?, serials?, date, label?, shipment_id?} → 출하 대기(합격·미출하·미폐기)만 출하 처리
//  'unship'        {card_id, serials} → 출하 취소
//  'search'        {q} → 시리얼로 찾기 (팀 안, 마스터는 전체)
const STAFF = ['master', 'service', 'sub'];
const MAX_BYTES = 15 * 1024 * 1024;
const s = (v: unknown, n = 200) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const compact = (u: any) => ({ id: u.id, serial: u.serial, lot: u.lot || '', inspected_date: u.inspected_date || '', verdict: u.verdict, failed_items: u.failed_items || [], fail_note: u.fail_note || '', pallet: u.pallet || '', box: u.box || '', disposition: u.disposition || '', shipped_date: u.shipped_date || '', shipment_label: u.shipment_label || '', status: unitStatus(u) });

async function allUnits(db: any, query: any) {
  const out: any[] = [], ids = new Set();
  for (let skip = 0, guard = 0; guard < 40; skip += 1000, guard++) {
    const page = await db.ProductionUnit.filter(query, 'serial', 1000, skip);
    for (const u of page) if (!ids.has(u.id)) { ids.add(u.id); out.push(u); }
    if (page.length < 1000) break;
  }
  return out;
}

async function readWorkbook(fileUrl: string) {
  await assertPublicHttpUrl(fileUrl);
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error('성적서 파일을 내려받지 못했습니다');
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) throw new Error('파일이 너무 큽니다 (15MB 이하)');
  const XLSX: any = await import('npm:xlsx@0.18.5');
  const wb = XLSX.read(bytes, { type: 'array' });
  return wb.SheetNames.map((name: string) => ({ name, rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, blankrows: false, defval: '' }) }));
}

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.is_active === false || !STAFF.includes(user.account_tier)) return Response.json({ error: '직원만 사용할 수 있습니다.' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole, db = svc.entities;
    const by = user.full_name || user.email || '';
    const now = new Date().toISOString();
    const inScope = (r: any) => !!r && (user.account_tier === 'master' || r.tenant_id === user.tenant_id);
    const log = (u: any, action: string, note = '') => [...(u.history || []).slice(-30), { at: now, by, action, note }];

    if (body.action === 'search') {
      const q = s(body.q, 40).toUpperCase().replace(/\s/g, '');
      if (q.length < 4) return Response.json({ error: '시리얼을 4자 이상 넣어 주세요' }, { status: 400 });
      const scope = user.account_tier === 'master' ? {} : { tenant_id: user.tenant_id };
      let rows = (await db.ProductionUnit.filter({ ...scope, serial: q }, 'serial', 20)).filter(inScope);
      // 정확히 맞는 게 없으면 끝자리로 (예: '3982')
      if (!rows.length) rows = (await allUnits(db, scope)).filter((u) => inScope(u) && u.serial.endsWith(q)).slice(0, 20);
      const cards = new Map();
      for (const u of rows) if (!cards.has(u.card_id)) cards.set(u.card_id, await db.TaskCard.get(u.card_id).catch(() => null));
      return Response.json({ results: rows.map((u) => ({ ...compact(u), card_id: u.card_id, card_title: cards.get(u.card_id)?.title || '', client_name: cards.get(u.card_id)?.client_name || '', checks: u.checks || {}, inspector: u.inspector || '', history: (u.history || []).slice(-10) })) });
    }

    const card = typeof body.card_id === 'string' ? await db.TaskCard.get(body.card_id).catch(() => null) : null;
    if (!inScope(card)) return Response.json({ error: '카드를 찾을 수 없습니다' }, { status: 404 });
    const units = await allUnits(db, { card_id: card.id });
    const bySerial = new Map(units.filter((u) => u.card_id === card.id).map((u) => [u.serial, u]));

    if (body.action === 'list') {
      const list = [...bySerial.values()];
      return Response.json({ units: list.map(compact), summary: productionSummary(list) });
    }

    if (body.action === 'preview' || body.action === 'import') {
      const fileUrl = s(body.file_url, 2000);
      if (!fileUrl) return Response.json({ error: '성적서 파일을 올려 주세요' }, { status: 400 });
      // 검산에서는 globalThis.__readWorkbook 으로 파일 읽기를 바꿔 끼운다
      const parsed = parseInspectionSheets(await ((globalThis as any).__readWorkbook || readWorkbook)(fileUrl));
      if (!parsed.units.length) return Response.json({ error: '성적서에서 시리얼을 찾지 못했습니다', sheets: parsed.sheets, warnings: parsed.warnings }, { status: 400 });
      // 같은 팀의 다른 카드에 이미 있는 시리얼은 충돌로 건너뛴다
      const others = new Map((await allUnits(db, { tenant_id: card.tenant_id })).filter((u) => u.card_id !== card.id).map((u) => [u.serial, u]));
      const plan = { create: [] as any[], update: [] as any[], same: 0, conflict: [] as string[], locked: [] as string[] };
      for (const p of parsed.units) {
        if (others.has(p.serial)) { plan.conflict.push(p.serial); continue; }
        const cur = bySerial.get(p.serial);
        if (!cur) { plan.create.push(p); continue; }
        const changed = cur.verdict !== p.verdict || JSON.stringify(cur.checks || {}) !== JSON.stringify(p.checks) || (p.pallet && p.pallet !== cur.pallet);
        if (!changed) { plan.same++; continue; }
        if (cur.shipped_date) { plan.locked.push(p.serial); continue; }
        plan.update.push({ cur, p });
      }
      const result = {
        sheets: parsed.sheets, warnings: parsed.warnings,
        create: plan.create.length, update: plan.update.length, same: plan.same,
        conflict: plan.conflict.slice(0, 50), conflict_count: plan.conflict.length,
        locked: plan.locked.slice(0, 50), locked_count: plan.locked.length,
      };
      if (body.action === 'preview') return Response.json(result);

      const lot = s(body.lot, 40);
      const fileName = s(body.file_name, 200);
      const rows = plan.create.map((p) => ({
        tenant_id: card.tenant_id, card_id: card.id, client_id: card.client_id || '', ...p, lot: p.lot || lot,
        disposition: '', source_file: fileName, updated_by_name: by, history: [{ at: now, by, action: '성적서 등록', note: `${fileName} · ${p.sheet}` }],
      }));
      for (let i = 0; i < rows.length; i += 200) await db.ProductionUnit.bulkCreate(rows.slice(i, i + 200));
      for (const { cur, p } of plan.update) {
        await db.ProductionUnit.update(cur.id, {
          checks: p.checks, verdict: p.verdict, failed_items: p.failed_items, inspected_date: p.inspected_date || cur.inspected_date, sheet: p.sheet,
          ...(p.pallet ? { pallet: p.pallet } : {}), ...(p.fail_note ? { fail_note: p.fail_note } : {}), ...(p.inspector ? { inspector: p.inspector } : {}),
          // 다시 합격하면 수리 중 표시는 지운다 (폐기는 그대로)
          ...(p.verdict === VERDICT.PASS && cur.disposition === 'REWORK' ? { disposition: '' } : {}),
          source_file: fileName, updated_by_name: by, history: log(cur, '성적서 갱신', `${cur.verdict} → ${p.verdict} · ${p.sheet}`),
        });
      }
      try { await db.ProjectAuditLog.create({ tenant_id: card.tenant_id, card_id: card.id, event_type: 'PRODUCTION_IMPORT', actor_id: user.id, actor_name: by, details: `검사 성적서 등록 ${fileName}: 새로 ${rows.length}대 · 갱신 ${plan.update.length}대 · 충돌 ${plan.conflict.length}` }); } catch (_e) { /* 기록 실패가 등록을 막지 않는다 */ }
      return Response.json({ ok: true, ...result });
    }

    // 시리얼 목록 해석: 범위·쉼표·줄바꿈 (앞부분 없이 숫자만 넣으면 카드의 시리얼 형식으로)
    const sample = units[0]?.serial || '';
    const pick = (text: unknown) => expandRange(s(text, 20000), sample).map((x) => bySerial.get(x)).filter(Boolean);

    if (body.action === 'assign_pallet') {
      const pallet = s(body.pallet, 40);
      const targets = pick(body.serials);
      if (!targets.length) return Response.json({ error: '이 카드에서 해당 시리얼을 찾지 못했습니다' }, { status: 400 });
      const skipped = targets.filter((u: any) => u.shipped_date).map((u: any) => u.serial);
      const todo = targets.filter((u: any) => !u.shipped_date);
      for (const u of todo) await db.ProductionUnit.update(u.id, { pallet, updated_by_name: by, history: log(u, pallet ? '파레트 지정' : '파레트 해제', pallet) });
      return Response.json({ ok: true, updated: todo.length, skipped_shipped: skipped.slice(0, 50) });
    }

    if (body.action === 'dispose') {
      const u = bySerial.get(s(body.serial, 40).toUpperCase());
      if (!u) return Response.json({ error: '시리얼을 찾지 못했습니다' }, { status: 404 });
      if (u.shipped_date) return Response.json({ error: '이미 출하된 제품입니다' }, { status: 409 });
      const note = s(body.note, 300);
      const act = String(body.disposition || '').toUpperCase();
      let patch: any;
      if (act === 'REWORK' || act === 'SCRAP') { if (u.verdict === VERDICT.PASS) return Response.json({ error: '합격 제품은 불량 처리할 수 없습니다' }, { status: 400 }); patch = { disposition: act }; }
      else if (act === 'REPASS') patch = { verdict: VERDICT.PASS, disposition: '', failed_items: [] };
      else if (act === 'CLEAR') patch = { disposition: '' };
      else return Response.json({ error: '처리 방법을 고르세요 (수리·폐기·재검사 합격)' }, { status: 400 });
      const label = { REWORK: '수리', SCRAP: '폐기', REPASS: '재검사 합격', CLEAR: '처리 취소' }[act];
      await db.ProductionUnit.update(u.id, { ...patch, ...(note ? { fail_note: note } : {}), updated_by_name: by, history: log(u, label, note) });
      return Response.json({ ok: true, unit: compact({ ...u, ...patch }) });
    }

    if (body.action === 'ship') {
      if (!isDate(body.date)) return Response.json({ error: '출하일을 넣어 주세요' }, { status: 400 });
      const pallets = new Set((Array.isArray(body.pallets) ? body.pallets : []).map((p: unknown) => s(p, 40)).filter(Boolean));
      const targets = [...(pallets.size ? [...bySerial.values()].filter((u) => pallets.has(u.pallet)) : []), ...(body.serials ? pick(body.serials) : [])];
      const uniq = [...new Map(targets.map((u: any) => [u.id, u])).values()];
      if (!uniq.length) return Response.json({ error: '출하할 제품을 고르세요 (파레트 또는 시리얼)' }, { status: 400 });
      const ready = uniq.filter((u: any) => unitStatus(u) === 'READY');
      const skipped = uniq.filter((u: any) => unitStatus(u) !== 'READY').map((u: any) => ({ serial: u.serial, status: unitStatus(u) }));
      const label = s(body.label, 60);
      const shipmentId = s(body.shipment_id, 60);
      for (const u of ready) await db.ProductionUnit.update(u.id, { shipped_date: body.date, shipment_label: label, shipment_id: shipmentId, updated_by_name: by, history: log(u, '출하', `${body.date}${label ? ` · ${label}` : ''}`) });
      try { await db.ProjectAuditLog.create({ tenant_id: card.tenant_id, card_id: card.id, event_type: 'PRODUCTION_SHIP', actor_id: user.id, actor_name: by, details: `${body.date} 출하 ${ready.length}대${label ? ` (${label})` : ''}` }); } catch (_e) { /* 기록 실패 무시 */ }
      return Response.json({ ok: true, shipped: ready.length, skipped: skipped.slice(0, 100), skipped_count: skipped.length });
    }

    if (body.action === 'unship') {
      const targets = pick(body.serials).filter((u: any) => u.shipped_date);
      for (const u of targets) await db.ProductionUnit.update(u.id, { shipped_date: '', shipment_label: '', shipment_id: '', updated_by_name: by, history: log(u, '출하 취소', u.shipped_date) });
      return Response.json({ ok: true, updated: targets.length });
    }

    return Response.json({ error: '알 수 없는 작업입니다' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
