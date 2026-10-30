// 할일(TaskItem) ↔ Google Tasks 한 건 반영에 쓰는 계산. 서버 함수 syncGoogleTasks 가 쓴다. 검산: npm run check:google-tasks
// 마지막으로 Google 에 보낸 상태를 google_sync_hash 로 남겨, 바뀐 게 없으면 API 를 부르지 않는다 (동기화가 남긴 기록 수정으로 다시 깨어나도 호출 0).

// Google 작업 본문: 제목·메모(프로젝트·고객사·설명·담당자)·마감일·완료 여부
export function taskBody(item: any, card: any) {
  const notes = [
    card?.title ? `프로젝트: ${card.title}` : null,
    card?.client_name ? `고객사: ${card.client_name}` : null,
    item.description || null,
    item.assignee_name ? `담당자: ${item.assignee_name}` : null,
  ].filter(Boolean).join('\n');
  return {
    title: String(item.title || '').slice(0, 1024),
    notes,
    due: item.due_date ? `${item.due_date}T00:00:00.000Z` : null,
    status: item.status === 'DONE' ? 'completed' : 'needsAction',
  };
}

// 짧은 지문 (FNV-1a 32bit). 같은 본문이면 같은 값
export function syncHash(body: ReturnType<typeof taskBody>) {
  const s = JSON.stringify([body.title, body.notes, body.due, body.status]);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

// 할일 한 건에 할 일: create / update / none
// - Google 에 아직 없고 이미 완료된 할일은 만들지 않는다
// - 마지막으로 보낸 지문과 같으면 아무것도 하지 않는다
export function planPush(item: any, body: ReturnType<typeof taskBody>) {
  if (!item.google_task_id) return body.status === 'completed' ? 'none' : 'create';
  return item.google_sync_hash === syncHash(body) ? 'none' : 'update';
}

// 전체 동기화 때 Google 에서 체크한 완료를 앱으로 가져올지: 앱 할일이 마지막 동기화 뒤 그대로일 때만 (앱에서 고친 쪽이 우선).
// 지문이 없는 예전 연결 할일은 예전처럼 Google 완료를 가져온다
export function pullDone(item: any, body: ReturnType<typeof taskBody>, gtask: any) {
  if (!gtask || gtask.status !== 'completed' || item.status === 'DONE') return false;
  return !item.google_sync_hash || item.google_sync_hash === syncHash(body);
}

// Google 작업이 이미 이 본문과 같은지 (지문만 남기고 API 를 아낀다)
export function sameAsGoogle(gtask: any, body: ReturnType<typeof taskBody>) {
  if (!gtask) return false;
  const day = (v: any) => (v ? String(v).slice(0, 10) : '');
  return (gtask.title || '') === body.title && (gtask.notes || '') === body.notes && day(gtask.due) === day(body.due) && (gtask.status || 'needsAction') === body.status;
}
