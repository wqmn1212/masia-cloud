import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { taskBody, syncHash, planPush, pullDone, sameAsGoogle } from '../../shared/googleTaskSync.ts';

// 할일 ↔ Google Tasks('Masia 업무' 목록).
// - item_id 를 주면 그 할일 한 건만 반영한다: 할일이 생기거나 고쳐지거나 지워질 때 워크플로우(GoogleTasksSync)가 부른다.
//   지워진 할일은 워크플로우가 넘긴 google_task_id 로 Google 작업을 지운다.
// - item_id 없이 직원이 부르면 전체 동기화: 빠진 할일 등록·바뀐 할일 반영과 함께, Google 에서 체크한 완료를 앱으로 가져온다.
// 바뀐 게 없으면 Google API 를 부르지 않는다 (예전 15분 주기 전체 조회는 하루 호출 한도를 넘겨 멈췄다).
const LIST_TITLE = 'Masia 업무';
const API = 'https://tasks.googleapis.com/tasks/v1';

class GoogleError extends Error { status: number; constructor(status: number, text: string) { super(`Google Tasks API ${status}: ${text}`); this.status = status; } }

async function gapi(path: string, token: string, options: any = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) throw new GoogleError(res.status, await res.text());
  return res.status === 204 ? null : res.json();
}

async function getTaskListId(token: string) {
  const lists = await gapi('/users/@me/lists?maxResults=100', token);
  const found = (lists.items || []).find((l: any) => l.title === LIST_TITLE);
  if (found) return found.id;
  const created = await gapi('/users/@me/lists', token, { method: 'POST', body: JSON.stringify({ title: LIST_TITLE }) });
  return created.id;
}

async function readAll(fetchPage: (skip: number) => Promise<any[]>, size: number) {
  const out: any[] = [];
  for (let skip = 0; ; skip += size) { const page = await fetchPage(skip); out.push(...page); if (page.length < size) return out; }
}

const getOrNull = (p: Promise<any>) => p.catch(() => null);

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const staff = !!user && user.is_active !== false && ['master', 'service'].includes(user.account_tier);
    const body = await req.json().catch(() => ({}));
    const itemId = typeof body?.item_id === 'string' ? body.item_id : '';
    // 한 건 반영은 워크플로우(로그인 없음)나 직원만, 전체 동기화는 직원만
    if (user ? !staff : !itemId) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const svc = base44.asServiceRole.entities;
    let token = '', listId = '';
    const ready = async () => {
      if (!listId) {
        token = (await base44.asServiceRole.connectors.getConnection('googletasks')).accessToken;
        listId = await getTaskListId(token);
      }
    };
    const now = () => new Date().toISOString();

    // Google 에 앱 할일 상태를 보낸다. 고칠 작업이 Google 에서 지워졌으면 새로 만든다
    const push = async (item: any, card: any, action: string) => {
      const b = taskBody(item, card);
      const payload = { title: b.title, notes: b.notes, due: b.due, status: b.status, ...(b.status === 'needsAction' ? { completed: null } : {}) };
      await ready();
      if (action === 'update') {
        try {
          await gapi(`/lists/${listId}/tasks/${item.google_task_id}`, token, { method: 'PATCH', body: JSON.stringify(payload) });
          await svc.TaskItem.update(item.id, { google_sync_hash: syncHash(b), google_synced_at: now() });
          return 'updated';
        } catch (e) {
          if (!(e instanceof GoogleError && e.status === 404)) throw e;
        }
      }
      // 새로 만들기: 같은 할일을 동시에 반영하는 다른 실행이 먼저 만들었으면 내 것을 지운다 (생성 직후 번역 저장으로 두 번 깨어날 수 있다)
      const prevGid = item.google_task_id || '';
      const { due, ...rest } = payload;
      const task = await gapi(`/lists/${listId}/tasks`, token, { method: 'POST', body: JSON.stringify(due ? payload : rest) });
      const fresh = await getOrNull(svc.TaskItem.get(item.id));
      if (fresh?.google_task_id && fresh.google_task_id !== prevGid && fresh.google_task_id !== task.id) {
        await gapi(`/lists/${listId}/tasks/${task.id}`, token, { method: 'DELETE' }).catch(() => null);
        return 'duplicate_skipped';
      }
      await svc.TaskItem.update(item.id, { google_task_id: task.id, google_sync_hash: syncHash(b), google_synced_at: now() });
      return 'created';
    };

    if (itemId) {
      const item = await getOrNull(svc.TaskItem.get(itemId));
      if (!item) {
        // 지워진 할일: 넘겨받은 Google 작업을 지운다. 다른 할일이 아직 그 작업을 쓰고 있으면 두지 않는다
        const gid = typeof body?.google_task_id === 'string' ? body.google_task_id : '';
        if (!gid) return Response.json({ ok: true, action: 'none' });
        if ((await svc.TaskItem.filter({ google_task_id: gid }, '-created_date', 1)).length) return Response.json({ ok: true, action: 'none' });
        await ready();
        await gapi(`/lists/${listId}/tasks/${gid}`, token, { method: 'DELETE' }).catch((e) => { if (!(e instanceof GoogleError && [404, 410].includes(e.status))) throw e; });
        return Response.json({ ok: true, action: 'deleted' });
      }
      const card = item.card_id ? await getOrNull(svc.TaskCard.get(item.card_id)) : null;
      const action = planPush(item, taskBody(item, card));
      if (action === 'none') return Response.json({ ok: true, action: 'none' });
      return Response.json({ ok: true, action: await push(item, card, action) });
    }

    // 전체 동기화 (직원이 화면에서 누름)
    await ready();
    const items = await readAll((skip) => svc.TaskItem.list('-created_date', 500, skip), 500);
    const cardById: Record<string, any> = {};
    for (const c of await readAll((skip) => svc.TaskCard.list('-created_date', 500, skip), 500)) cardById[c.id] = c;
    const gById: Record<string, any> = {};
    let pageToken = '';
    do {
      const page = await gapi(`/lists/${listId}/tasks?showCompleted=true&showHidden=true&maxResults=100${pageToken ? `&pageToken=${pageToken}` : ''}`, token);
      for (const g of page.items || []) gById[g.id] = g;
      pageToken = page.nextPageToken || '';
    } while (pageToken);

    let created = 0, updated = 0, completedInApp = 0;
    for (const item of items) {
      const card = cardById[item.card_id];
      const b = taskBody(item, card);
      const gtask = item.google_task_id ? gById[item.google_task_id] : null;
      if (pullDone(item, b, gtask)) {
        const done = { ...item, status: 'DONE' };
        await svc.TaskItem.update(item.id, { status: 'DONE', google_sync_hash: syncHash(taskBody(done, card)), google_synced_at: now() });
        completedInApp++;
        continue;
      }
      const action = planPush(item, b);
      if (action === 'none') continue;
      if (action === 'update') {
        // 지문 없는 예전 연결 할일: Google 에서 지운 작업은 다시 만들지 않고, 이미 같은 작업은 지문만 남긴다
        if (!gtask && !item.google_sync_hash) continue;
        if (sameAsGoogle(gtask, b)) { await svc.TaskItem.update(item.id, { google_sync_hash: syncHash(b), google_synced_at: now() }); continue; }
      }
      const r = await push(item, card, action);
      if (r === 'created') created++;
      else if (r === 'updated') updated++;
    }
    return Response.json({ ok: true, list: LIST_TITLE, created, updated, completedInApp });
  } catch (error) {
    if (String(error?.message).includes('API 429')) {
      return Response.json({ error: 'Google Tasks 일일 사용 한도를 초과했습니다. 한국시간 오후 4~5시경(태평양시 자정) 한도가 초기화된 뒤 다시 시도해 주세요.' }, { status: 429 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
}
