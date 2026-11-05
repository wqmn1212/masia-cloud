import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { readWorkbook } from '../../shared/workbook.ts';
import { parseInspectionSheets, expandRange, unitStatus, VERDICT } from '../../shared/productionUnits.ts';
import { parseDefectSheets, groupDefects, dateFromName, defectLine, DEFECT_KIND } from '../../shared/defects.ts';
import { saveDefectGroups, similarRecords } from '../../shared/defectStore.ts';

// 불량 기록 (직원 전용). AI 비서와 카드 QC 화면이 쓴다.
//  'parse'   {file_url, file_name, card_id?} → 엑셀이 검사 성적서인지 불량 목록인지 보고 미리보기 (저장 안 함)
//  'apply'   {card_id, file_url, file_name, kind, date?, stage?, defect_type?, note?, update_serials?} → 사용자 승인 뒤에만.
//            카드 불량 기록(DefectLog)을 남기고, 시리얼이 있으면 양산 시리얼도 고친다 (스티커 불량 → 스티커 불량 표시, 제품 불량 → 불합격)
//  'record'  {card_id, date, stage, defect_type, qty?, description?, serials?, kind?} → 파일 없이 말로 남기는 불량 (사용자 승인 뒤에만)
//  'list'    {card_id} → 카드의 불량 기록
//  'similar' {card_id?, text?} → 같은 팀의 비슷한 과거 불량 (불량 기록·QC 사례·고객 클레임)
const STAFF = ['master', 'service', 'sub'];
const KINDS = Object.keys(DEFECT_KIND);
const s = (v: unknown, n = 200) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const kstToday = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

async function allUnits(db: any, query: any) {
  const out: any[] = [], ids = new Set();
  for (let skip = 0, guard = 0; guard < 40; skip += 1000, guard++) {
    const page = await db.ProductionUnit.filter(query, 'serial', 1000, skip);
    for (const u of page) if (!ids.has(u.id)) { ids.add(u.id); out.push(u); }
    if (page.length < 1000) break;
  }
  return out;
}

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.is_active === false || !STAFF.includes(user.account_tier)) return Response.json({ error: '직원만 사용할 수 있습니다.' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const db = base44.asServiceRole.entities;
    const by = user.full_name || user.email || '';
    const now = new Date().toISOString();
    const inScope = (r: any) => !!r && (user.account_tier === 'master' || r.tenant_id === user.tenant_id);
    const action = String(body.action || '');
    const card = typeof body.card_id === 'string' && body.card_id ? await db.TaskCard.get(body.card_id).catch(() => null) : null;
    if (body.card_id && !inScope(card)) return Response.json({ error: '카드를 찾을 수 없습니다' }, { status: 404 });
    const needCard = () => { if (!card) throw Object.assign(new Error('어느 카드인지 먼저 정해 주세요 (card_id)'), { status: 400 }); };

    if (action === 'similar') {
      const text = s(body.text, 2000) || (card ? [card.title, card.title_cn, card.product_name, card.category].filter(Boolean).join(' ') : '');
      if (!text) return Response.json({ error: '찾을 내용(text)이나 카드를 주세요' }, { status: 400 });
      const scope = user.account_tier === 'master' ? (card ? { tenant_id: card.tenant_id } : {}) : { tenant_id: user.tenant_id };
      const found = await similarRecords(db, scope, { text, card_id: card?.id, factory_id: card?.factory_id }, Math.min(Number(body.limit) || 8, 20));
      return Response.json({
        query: text.slice(0, 200),
        results: found.map((r) => ({ source: r.source, date: r.date, stage: r.stage || '', title: r.title, qty: r.qty || 0, card_id: r.card_id, card_title: r.card_title || '', same_card: r.same_card, matched: r.matched, prevention: r.prevention || '', serial_range: r.serial_range || '', line: defectLine(r) })),
      });
    }

    if (action === 'list') {
      needCard();
      const logs = await db.DefectLog.filter({ card_id: card.id }, '-occurred_date', 500);
      return Response.json({ logs: logs.map((l: any) => ({ id: l.id, date: l.occurred_date, stage: l.stage, defect_type: l.defect_type, description: l.description || '', kind: l.kind, qty: l.qty, serial_range: l.serial_range || '', source: l.source, source_file: l.source_file || '', by: l.created_by_name || '', line: defectLine({ date: l.occurred_date, stage: l.stage, title: l.defect_type, qty: l.qty }) })) });
    }

    // 시리얼 반영: 스티커 불량은 '스티커 불량' 표시, 그 밖은 불합격. 출하된 제품과 다른 카드의 시리얼은 건드리지 않는다
    const applySerials = async (items: any[], kind: string) => {
      const withSerial = items.filter((x) => x.serial);
      const res = { updated: 0, created: 0, conflict: [] as string[], shipped: [] as string[] };
      if (!withSerial.length) return res;
      const mine = new Map((await allUnits(db, { card_id: card.id })).filter((u) => u.card_id === card.id).map((u) => [u.serial, u]));
      const others = new Set((await allUnits(db, { tenant_id: card.tenant_id })).filter((u) => u.card_id !== card.id).map((u) => u.serial));
      const fresh: any[] = [];
      for (const it of withSerial) {
        if (others.has(it.serial)) { res.conflict.push(it.serial); continue; }
        const u = mine.get(it.serial);
        const note = it.desc || (kind === 'STICKER' ? '스티커 불량' : '불량');
        const log = (action: string) => [...(u?.history || []).slice(-30), { at: now, by, action, note: `${note}${it.date ? ` · ${it.date}` : ''}${it.stage ? ` · ${it.stage}` : ''}` }];
        if (u?.shipped_date) { res.shipped.push(it.serial); continue; }
        if (kind === 'STICKER') {
          if (u) { if (u.disposition !== 'VOID') { await db.ProductionUnit.update(u.id, { disposition: 'VOID', pallet: '', fail_note: note, updated_by_name: by, history: log('스티커 불량') }); res.updated++; } }
          else fresh.push({ serial: it.serial, verdict: VERDICT.PENDING, disposition: 'VOID', fail_note: note, history: log('스티커 불량') });
        } else if (u) {
          await db.ProductionUnit.update(u.id, { verdict: VERDICT.FAIL, failed_items: [...new Set([...(u.failed_items || []), note])], fail_note: note, ...(u.disposition === 'VOID' ? { disposition: '' } : {}), inspected_date: u.inspected_date || it.date || '', pallet: '', updated_by_name: by, history: log('불량 등록') });
          res.updated++;
        } else fresh.push({ serial: it.serial, verdict: VERDICT.FAIL, failed_items: [note], fail_note: note, inspected_date: it.date || '', disposition: '', history: log('불량 등록') });
      }
      const rows = fresh.map((f) => ({ tenant_id: card.tenant_id, card_id: card.id, client_id: card.client_id || '', checks: {}, updated_by_name: by, ...f }));
      for (let i = 0; i < rows.length; i += 200) await db.ProductionUnit.bulkCreate(rows.slice(i, i + 200));
      res.created = rows.length;
      return res;
    };

    if (action === 'parse' || action === 'apply') {
      const fileUrl = s(body.file_url, 2000);
      const fileName = s(body.file_name, 200);
      if (!fileUrl) return Response.json({ error: '엑셀 파일을 첨부해 주세요' }, { status: 400 });
      const book = await readWorkbook(fileUrl);
      const insp = parseInspectionSheets(book);
      // 검사 항목 칸이 2개 이상 있는 시트가 있어야 성적서로 본다 (시리얼만 있는 불량 목록과 구분)
      if (insp.units.length && insp.sheets.some((x: any) => x.count && (x.items || []).length >= 2)) {
        // 검사 성적서는 양산 시리얼 등록(productionUnits)으로 처리한다. 불합격은 거기서 불량 기록으로도 남는다
        const failed: Record<string, number> = {};
        for (const u of insp.units) for (const f of u.failed_items || []) failed[f] = (failed[f] || 0) + 1;
        return Response.json({
          kind: 'INSPECTION', sheets: insp.sheets.map((x: any) => ({ name: x.name, date: x.date, count: x.count, pass: x.pass, fail: x.fail, incomplete: x.incomplete, range: x.range })),
          total: insp.units.length, fail: insp.units.filter((u: any) => u.verdict === 'FAIL').length, failed_items: failed, warnings: insp.warnings.slice(0, 10),
          next: '검사 성적서입니다. productionUnits(action=preview → 사용자 승인 → import, card_id, file_url, file_name)로 양산 시리얼을 등록하면 불합격 제품은 카드 불량 기록에도 자동으로 남습니다.',
        });
      }
      const parsed = parseDefectSheets(book);
      if (!parsed.items.length) return Response.json({ error: '시리얼이나 불량 내용을 찾지 못했습니다. 첫 줄에 "시리얼", "불량 내용", "날짜", "공정" 같은 머리글이 있는지 확인해 주세요.', warnings: parsed.warnings }, { status: 400 });
      const fileDate = dateFromName(fileName);
      const kind = KINDS.includes(String(body.kind)) ? String(body.kind) : '';
      const defaults = {
        date: isDate(body.date) ? body.date : fileDate,
        stage: s(body.stage, 60) || (kind === 'STICKER' ? '스티커 부착' : ''),
        defect_type: s(body.defect_type, 120) || (kind === 'STICKER' ? '스티커 불량' : ''),
      };
      const groups = groupDefects(parsed.items, defaults);
      const ask: string[] = [];
      if (!kind) ask.push('kind: 어떤 불량인가요? 제품 불량(PRODUCT) / 스티커 불량(STICKER, 스티커가 망가져 버린 번호) / 포장 불량(PACKAGING) / 기타(OTHER)');
      if (!parsed.columns.includes('date') && !defaults.date) ask.push('date: 언제 나온 불량인가요?');
      if (!parsed.columns.includes('stage') && !defaults.stage) ask.push('stage: 어떤 작업 중에 나왔나요? (예: 양산 검사, 스티커 부착, 포장, 출고 전 검수, 입고 검사)');
      if (!parsed.columns.includes('desc') && !defaults.defect_type) ask.push('defect_type: 불량 내용이 무엇인가요? (파일에 불량 내용 칸이 없습니다)');
      let serialCheck: any = null;
      if (card) {
        const mine = new Map((await allUnits(db, { card_id: card.id })).filter((u) => u.card_id === card.id).map((u) => [u.serial, u]));
        const others = new Set((await allUnits(db, { tenant_id: card.tenant_id })).filter((u) => u.card_id !== card.id).map((u) => u.serial));
        const ser = parsed.items.filter((x: any) => x.serial).map((x: any) => x.serial);
        serialCheck = {
          registered: ser.filter((x: string) => mine.has(x)).length,
          not_registered: ser.filter((x: string) => !mine.has(x) && !others.has(x)).length,
          other_card: ser.filter((x: string) => others.has(x)).slice(0, 20),
          shipped: ser.filter((x: string) => mine.get(x)?.shipped_date).slice(0, 20),
          already_void: ser.filter((x: string) => mine.get(x) && unitStatus(mine.get(x)) === 'VOID').length,
        };
      }
      const preview = {
        kind: 'DEFECT_LIST', defect_kind: kind, card_title: card?.title || '', total_qty: groups.reduce((a, g) => a + g.qty, 0), with_serial: parsed.items.filter((x: any) => x.serial).length,
        columns: parsed.columns, file_date: fileDate, defaults, ask,
        groups: groups.slice(0, 20).map((g) => ({ date: g.date, stage: g.stage, defect_type: g.defect_type, qty: g.qty, serial_range: g.serial_range })), group_count: groups.length,
        serial_check: serialCheck, warnings: parsed.warnings.slice(0, 10),
      };
      if (action === 'parse') return Response.json(preview);

      needCard();
      if (!kind) return Response.json({ error: '어떤 불량인지(kind) 정해 주세요', ask }, { status: 400 });
      const missing = groups.filter((g) => !g.date || !g.stage);
      if (missing.length) return Response.json({ error: '날짜와 작업 단계가 빈 불량이 있습니다. date·stage 를 정해 주세요', ask }, { status: 400 });
      const serialRes = body.update_serials === false ? null : await applySerials(parsed.items.map((x: any) => ({ ...x, date: x.date || defaults.date, stage: x.stage || defaults.stage, desc: x.desc || defaults.defect_type })), kind);
      const saved = await saveDefectGroups(db, card, groups, { kind, source: 'ASSISTANT', source_file: fileName, by, note: s(body.note, 600) });
      try { await db.ProjectAuditLog.create({ tenant_id: card.tenant_id, card_id: card.id, event_type: 'DEFECT_IMPORT', actor_id: user.id, actor_name: by, details: `불량 기록 ${fileName}: ${DEFECT_KIND[kind]} ${preview.total_qty}건 (${saved.created}묶음)` }); } catch (_e) { /* 기록 실패 무시 */ }
      return Response.json({ ok: true, card_title: card.title, logs_created: saved.created, logs_skipped: saved.skipped, total_qty: preview.total_qty, serials: serialRes, groups: preview.groups });
    }

    if (action === 'record') {
      needCard();
      const kind = KINDS.includes(String(body.kind)) ? String(body.kind) : 'PRODUCT';
      const date = isDate(body.date) ? body.date : kstToday();
      const stage = s(body.stage, 60);
      const type = s(body.defect_type, 120);
      if (!stage || !type) return Response.json({ error: '어떤 작업 중(stage)에 무슨 불량(defect_type)이었는지 알려 주세요' }, { status: 400 });
      const sample = (await db.ProductionUnit.filter({ card_id: card.id }, 'serial', 1))[0]?.serial || '';
      const serials = body.serials ? expandRange(s(body.serials, 20000), sample) : [];
      const qty = serials.length || Math.max(1, Math.floor(Number(body.qty) || 1));
      const items = serials.length ? serials.map((x) => ({ serial: x, desc: type, date, stage, qty: 1 })) : [{ serial: '', desc: type, date, stage, qty }];
      const serialRes = serials.length ? await applySerials(items, kind) : null;
      const saved = await saveDefectGroups(db, card, groupDefects(items), { kind, source: 'MANUAL', by, note: s(body.description, 600) });
      return Response.json({ ok: true, card_title: card.title, logs_created: saved.created, qty, serials: serialRes });
    }

    return Response.json({ error: '알 수 없는 작업입니다' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: (error as any).status || 500 });
  }
}
