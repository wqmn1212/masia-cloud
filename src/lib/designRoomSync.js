// 디자인 리뷰 동기화 간격·실시간 알림 거르기 (React 없이 계산만 — check:design-room 이 검산한다)
// 실시간 디자인 리뷰 연결.
//  · 직원(로그인, 같은 팀): Base44 실시간 구독(DesignComment·DesignPresence)으로 "바뀌었을 때만" 서버 함수를 부른다.
//    새 댓글·남의 커서 이동·판 바꾸기가 오면 곧바로 맞추고, 그 밖에는 6초마다 내 접속 표시만 갱신한다(접속 표시는 15초 유지).
//    접속 표시의 시각만 바뀐 알림은 무시한다 — 서로의 갱신이 서로를 부르는 핑퐁을 막는다.
//  · 고객·손님(링크+PIN): 구독 권한이 없어 예전처럼 짧은 간격으로 부른다.
//    다른 사람이 있으면 1초, 혼자면 2.5초, 1분 넘게 손대지 않으면 5초, 탭이 가려지면 8초. 커서는 움직였을 때만 보낸다.
// (서버 함수 100번에 연동 크레딧 약 1 — 실시간 구독이면 쉬는 동안 호출이 1/6 정도로 준다)
const FAST = 1000, SLOW = 2500, IDLE = 5000, HIDDEN = 8000;
export const LIVE_CURSOR = 400;
const LIVE_BEAT = 6000, LIVE_IDLE = 10000, LIVE_HIDDEN = 12000;
export const IDLE_AFTER_MS = 60_000;

/** 지금 간격 정하기 (검산용으로 따로 둔다) */
export function syncDelay({ hidden, idleMs, others, live = false, dirty = false }) {
  if (live) {
    if (hidden) return LIVE_HIDDEN;
    if (dirty) return LIVE_CURSOR;
    return idleMs > IDLE_AFTER_MS ? LIVE_IDLE : LIVE_BEAT;
  }
  if (hidden) return HIDDEN;
  if (idleMs > IDLE_AFTER_MS) return IDLE;
  return others > 0 ? FAST : SLOW;
}

/**
 * 구독 알림이 왔을 때 바로 맞출지 (검산용).
 * known = { [sid]: { cursor, version } } 지난 동기화에서 본 다른 사람들
 */
export function shouldWake(entity, ev, { roomId, sid, known }) {
  const d = ev?.data || {};
  if (d.room_id && d.room_id !== roomId) return false;
  if (entity === 'DesignComment') return ev?.type === 'delete' || d.room_id === roomId;
  if (entity !== 'DesignPresence' || d.room_id !== roomId || d.sid === sid) return false;
  const k = known[d.sid];
  if (!k) return true; // 새로 들어온 사람
  return JSON.stringify(d.cursor ?? null) !== JSON.stringify(k.cursor ?? null) || (d.version ?? null) !== (k.version ?? null);
}
