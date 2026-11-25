import { createClientFromRequest } from 'npm:@base44/sdk@0.8.59';
import { readWorkbook } from '../../shared/workbook.ts';
import { parseIssueSheets, changeText, issueSummary, importKey, SEVERITY, ISSUE_STATUS, ISSUE_SOURCE } from '../../shared/groupIssues.ts';
import { productionSummary } from '../../shared/productionUnits.ts';

// 프로젝트 그룹 (직원 전용): 업무 카드 여러 장을 한 그룹으로 묶어 이슈·회의·결정·불량·시리얼·파일을 한곳에서 본다.
//  'overview'       {group_id} → 그룹, 카드 진행, 이슈 전체와 집계, 묶인 카드들의 회의·결정·불량·파일
//  'serials'        {group_id} → 카드별 양산 시리얼 집계 (무거워서 따로)
//  'import_preview' {group_id, file_url, file_name} → 엑셀의 문제점 표 미리보기 (저장 안 함, 이미 있는 줄 표시)
//  'import_apply'   {group_id, file_url, file_name, card_id?} → 새 줄만 이슈로 등록
//  'issue_save'     {group_id, issue_id?, fields} → 이슈 추가·수정, 바뀐 칸을 이력에 남긴다
//  'issue_delete'   {group_id, issue_id} → 대표·팀 관리자만
const STAFF = ['master', 'service', 'sub'];
const FIELDS = ['card_id', 'area', 'title', 'detail', 'cause', 'vendor', 'impact', 'action_plan', 'severity', 'status', 'assignee_name', 'due_date', 'done_date', 'related_doc', 'photos', 'source'];
const LONG: Record<string, number> = { title: 500, detail: 2000, action_plan: 1000, impact: 300, related_doc: 300 };
const s = (v: unknown, n = 200) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const kstToday = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const fail = (msg: string, status = 400) => Object.assign(new Error(msg), { status });

async function allRows(ent: any, query: any, sort: string, max = 20000) {
  const out: any[] = [], ids = new Set();
  for (let skip = 0; skip < max; skip += 1000) {
    const page = await ent.filter(query, sort, 1000, skip);
    for (const r of page) if (!ids.has(r.id)) { ids.add(r.id); out.push(r); }
    if (page.length < 1000) break;
  }
  return out;
}

function cleanFields(raw: any) {
  const f: any = {};
  for (const k of FIELDS) {
    if (!(k in (raw || {}))) continue;
    const v = raw[k];
    if (k === 'photos') {
      f.photos = (Array.isArray(v) ? v : []).filter((p: any) => p && typeof p.url === 'string' && /^https?:\/\//.test(p.url)).slice(0, 12).map((p: any) => ({ url: p.url.slice(0, 1000), name: s(p.name, 120) }));
    } else if (k === 'severity') { if (v in SEVERITY) f.severity = v; else throw fail('중요도는 HIGH·MID·LOW 중 하나입니다'); }
    else if (k === 'status') { if (v in ISSUE_STATUS) f.status = v; else throw fail('상태 값이 맞지 않습니다'); }
    else if (k === 'source') { if (v in ISSUE_SOURCE) f.source = v; }
    else if (k === 'due_date' || k === 'done_date') { if (v === '' || v === null) f[k] = ''; else if (isDate(v)) f[k] = v; else throw fail('날짜는 YYYY-MM-DD 로 주세요'); }
    else f[k] = s(v, LONG[k] || 200);
  }
  return f;
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
    const action = String(body.action || '');
    const group = typeof body.group_id === 'string' && body.group_id ? await db.CardGroup.get(body.group_id).catch(() => null) : null;
    if (!group || (user.account_tier !== 'master' && group.tenant_id !== user.tenant_id)) return Response.json({ error: '그룹을 찾을 수 없습니다' }, { status: 404 });
    const cardIds: string[] = (Array.isArray(group.card_ids) ? group.card_ids : []).filter((x: unknown) => typeof x === 'string').slice(0, 60);
    const inGroup = { card_id: { $in: cardIds } };
    const issuesOf = () => allRows(db.GroupIssue, { group_id: group.id }, 'no', 5000);

    if (action === 'overview') {
      const cards = (await Promise.all(cardIds.map((id) => db.TaskCard.get(id).catch(() => null))))
        .filter((c: any) => c && c.tenant_id === group.tenant_id);
      const empty = !cardIds.length;
      const [issues, meetings, decisions, defects, files, folders] = await Promise.all([
        issuesOf(),
        empty ? [] : db.MeetingLog.filter(inGroup, '-meeting_date', 200),
        empty ? [] : db.DecisionLog.filter(inGroup, '-decided_at', 200),
        empty ? [] : db.DefectLog.filter(inGroup, '-occurred_date', 300),
        empty ? [] : db.CardAttachment.filter(inGroup, '-created_date', 500),
        empty ? [] : db.CardFolder.filter(inGroup, 'folder_name', 300),
      ]);
      const folderName = Object.fromEntries(folders.map((f: any) => [f.id, f.folder_name]));
      return Response.json({
        group,
        cards: cards.map((c: any) => ({ id: c.id, title: c.title, status: c.status, due_date: c.due_date || '', client_name: c.client_name || '', updated_date: c.updated_date || '' })),
        issues,
        summary: issueSummary(issues, kstToday()),
        meetings: meetings.map((m: any) => ({ id: m.id, card_id: m.card_id, date: m.meeting_date, title: m.title, attendees: m.attendees || '', decisions: s(m.decisions, 600), next_steps: s(m.next_steps, 600), notes: s(m.notes, 400) })),
        decisions: decisions.map((d: any) => ({ id: d.id, card_id: d.card_id, date: d.decided_at || '', topic: d.topic, decision: d.decision, status: d.status, category: d.category, by: d.decided_by || '' })),
        defects: defects.map((d: any) => ({ id: d.id, card_id: d.card_id, date: d.occurred_date, stage: d.stage || '', defect_type: d.defect_type, qty: d.qty || 0, kind: d.kind || '', serial_range: d.serial_range || '' })),
        files: files.filter((f: any) => !f.superseded_by_id).map((f: any) => ({ id: f.id, card_id: f.card_id, name: f.file_name, url: f.file_url, folder: folderName[f.folder_id] || '', by: f.uploader_name || '', date: f.created_date || '', client_visible: !!f.client_visible })),
      });
    }

    if (action === 'serials') {
      const out = [];
      for (const id of cardIds) {
        const units = await allRows(db.ProductionUnit, { card_id: id }, 'serial');
        if (!units.length) continue;
        out.push({ card_id: id, ...productionSummary(units).counts });
      }
      return Response.json({ cards: out });
    }

    if (action === 'import_preview' || action === 'import_apply') {
      const fileUrl = s(body.file_url, 2000), fileName = s(body.file_name, 200);
      if (!fileUrl) throw fail('엑셀 파일(file_url)을 주세요');
      const parsed = parseIssueSheets(await readWorkbook(fileUrl), fileName);
      const existing = await issuesOf();
      const have = new Set(existing.map((i: any) => i.import_key || importKey(i)));
      const rows = parsed.items.map((it: any) => ({ ...it, duplicate: have.has(it.import_key) }));
      if (action === 'import_preview') return Response.json({ ...parsed, items: rows, new_count: rows.filter((r: any) => !r.duplicate).length });
      const cardId = s(body.card_id, 80);
      if (cardId && !cardIds.includes(cardId)) throw fail('그룹에 묶인 카드가 아닙니다');
      let no = existing.reduce((m: number, i: any) => Math.max(m, Number(i.no) || 0), 0);
      const fresh = rows.filter((r: any) => !r.duplicate);
      const created = await db.GroupIssue.bulkCreate(fresh.map(({ duplicate: _d, sheet: _s, row: _r, ...it }: any) => ({
        ...it, tenant_id: group.tenant_id, group_id: group.id, card_id: cardId || '', no: ++no, photos: [], source_file: fileName,
        created_by_name: by, updated_by_name: by, history: [{ at: now, by, text: `엑셀에서 가져옴 (${fileName || '파일'})` }],
      })));
      return Response.json({ created: created.length, skipped: rows.length - fresh.length, warnings: parsed.warnings });
    }

    if (action === 'issue_save') {
      const f = cleanFields(body.fields);
      if (f.card_id && !cardIds.includes(f.card_id)) throw fail('그룹에 묶인 카드가 아닙니다');
      if (f.status === 'DONE' && !('done_date' in f)) f.done_date = kstToday();
      const id = s(body.issue_id, 80);
      if (!id) {
        if (!f.title) throw fail('문제점을 적어 주세요');
        const existing = await issuesOf();
        const no = existing.reduce((m: number, i: any) => Math.max(m, Number(i.no) || 0), 0) + 1;
        const rec = { severity: 'MID', status: 'OPEN', source: 'MANUAL', photos: [], ...f, tenant_id: group.tenant_id, group_id: group.id, no, import_key: importKey({ source: f.source || 'MANUAL', area: f.area, title: f.title }), created_by_name: by, updated_by_name: by, history: [{ at: now, by, text: '등록' }] };
        return Response.json({ issue: await db.GroupIssue.create(rec) });
      }
      const cur = await db.GroupIssue.get(id).catch(() => null);
      if (!cur || cur.group_id !== group.id) throw fail('이슈를 찾을 수 없습니다', 404);
      if (cur.status === 'DONE' && f.status && f.status !== 'DONE' && !('done_date' in body.fields)) f.done_date = '';
      if ('title' in f && !f.title) throw fail('문제점은 비울 수 없습니다');
      const text = changeText(cur, f);
      if (!text) return Response.json({ issue: cur, unchanged: true });
      const history = [...(Array.isArray(cur.history) ? cur.history : []), { at: now, by, text }].slice(-100);
      return Response.json({ issue: await db.GroupIssue.update(id, { ...f, history, updated_by_name: by }) });
    }

    if (action === 'issue_delete') {
      if (!['master', 'service'].includes(user.account_tier)) throw fail('이슈 삭제는 대표·팀 관리자만 할 수 있습니다', 403);
      const cur = await db.GroupIssue.get(s(body.issue_id, 80)).catch(() => null);
      if (!cur || cur.group_id !== group.id) throw fail('이슈를 찾을 수 없습니다', 404);
      await db.GroupIssue.delete(cur.id);
      return Response.json({ deleted: cur.id });
    }

    return Response.json({ error: '알 수 없는 작업입니다' }, { status: 400 });
  } catch (e) {
    const status = (e as any)?.status || 500;
    return Response.json({ error: (e as Error)?.message || '처리하지 못했습니다' }, { status });
  }
}
