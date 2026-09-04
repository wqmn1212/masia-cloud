import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const LIST_TITLE = '중국소싱 업무';
const API = 'https://tasks.googleapis.com/tasks/v1';

async function gapi(path, token, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Tasks API ${res.status}: ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

async function getTaskListId(token) {
  const lists = await gapi('/users/@me/lists?maxResults=100', token);
  const found = (lists.items || []).find((l) => l.title === LIST_TITLE);
  if (found) return found.id;
  const created = await gapi('/users/@me/lists', token, {
    method: 'POST',
    body: JSON.stringify({ title: LIST_TITLE }),
  });
  return created.id;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googletasks');
    const listId = await getTaskListId(accessToken);
    const svc = base44.asServiceRole.entities;

    const items = await svc.TaskItem.list('-created_date', 500);
    const cards = await svc.TaskCard.list('-created_date', 500);
    const cardById = {};
    cards.forEach((c) => { cardById[c.id] = c; });

    let created = 0;
    let completedInGoogle = 0;
    let completedInApp = 0;

    // 1) 앱 → Google Tasks 반영
    for (const item of items) {
      const card = cardById[item.card_id];
      const notes = [
        card ? `프로젝트: ${card.title}` : null,
        card?.client_name ? `고객사: ${card.client_name}` : null,
        item.description || null,
        item.assignee_name ? `담당자: ${item.assignee_name}` : null,
      ].filter(Boolean).join('\n');

      if (!item.google_task_id) {
        if (item.status === 'DONE') continue;
        const task = await gapi(`/lists/${listId}/tasks`, accessToken, {
          method: 'POST',
          body: JSON.stringify({
            title: item.title,
            notes,
            ...(item.due_date ? { due: `${item.due_date}T00:00:00.000Z` } : {}),
          }),
        });
        await svc.TaskItem.update(item.id, {
          google_task_id: task.id,
          google_synced_at: new Date().toISOString(),
        });
        created++;
        continue;
      }

      if (item.status === 'DONE') {
        const gtask = await gapi(`/lists/${listId}/tasks/${item.google_task_id}`, accessToken).catch(() => null);
        if (gtask && gtask.status !== 'completed') {
          await gapi(`/lists/${listId}/tasks/${item.google_task_id}`, accessToken, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'completed' }),
          });
          completedInGoogle++;
        }
      }
    }

    // 2) Google Tasks 체크박스 → 앱 완료 처리
    const byGoogleId = {};
    items.forEach((i) => { if (i.google_task_id) byGoogleId[i.google_task_id] = i; });

    let pageToken = null;
    do {
      const query = `/lists/${listId}/tasks?showCompleted=true&showHidden=true&maxResults=100${pageToken ? `&pageToken=${pageToken}` : ''}`;
      const page = await gapi(query, accessToken);
      for (const gtask of page.items || []) {
        const item = byGoogleId[gtask.id];
        if (!item) continue;
        if (gtask.status === 'completed' && item.status !== 'DONE') {
          await svc.TaskItem.update(item.id, {
            status: 'DONE',
            google_synced_at: new Date().toISOString(),
          });
          completedInApp++;
        }
      }
      pageToken = page.nextPageToken || null;
    } while (pageToken);

    return Response.json({ ok: true, list: LIST_TITLE, created, completedInGoogle, completedInApp });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}