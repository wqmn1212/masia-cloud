import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

// 실시간 디자인 리뷰 연결. 지금은 서버 함수(designRoom)를 짧은 간격으로 부르는 방식이다.
// 다른 사람이 있으면 1초, 혼자면 2.5초, 1분 넘게 손대지 않으면 5초, 탭이 가려지면 8초. 커서는 움직였을 때만 보낸다.
// (서버 함수 100번에 연동 크레딧 약 1 — 쉬는 동안 늦춰 크레딧을 아낀다. 다시 움직이면 바로 빨라진다)
// 나중에 Base44 실시간 연결(actor)로 바꿀 때는 이 파일의 sync 부분만 바꾸면 된다 (화면은 그대로).
const FAST = 1000, SLOW = 2500, IDLE = 5000, HIDDEN = 8000;
const IDLE_AFTER_MS = 60_000;

/** 지금 간격 정하기 (검산용으로 따로 둔다) */
export function syncDelay({ hidden, idleMs, others }) {
  if (hidden) return HIDDEN;
  if (idleMs > IDLE_AFTER_MS) return IDLE;
  return others > 0 ? FAST : SLOW;
}

function tabId() {
  try {
    let id = sessionStorage.getItem('masia.design.sid');
    if (!id) { id = `t${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`; sessionStorage.setItem('masia.design.sid', id); }
    return id;
  } catch { return `t${Math.random().toString(36).slice(2, 12)}`; }
}

const errOf = (e) => e?.response?.data || { error: e?.message || '연결하지 못했습니다' };
export async function callRoom(body) {
  try {
    const res = await base44.functions.invoke('designRoom', body);
    return res.data || {};
  } catch (e) { return errOf(e); }
}

/**
 * auth: 손님이면 { invite } 또는 { token, pin, name }, 로그인 계정이면 {}
 * 돌려줌: { state: 'loading'|'ready'|'error'|'pin', error, room, me, comments, presence, version, setVersion, setCursor, comment, resolve, refreshRoom }
 */
export function useDesignRoom(roomId, auth, { enabled = true } = {}) {
  const sid = useRef(tabId()).current;
  const [state, setState] = useState({ state: 'loading' });
  const [room, setRoom] = useState(null);
  const [me, setMe] = useState(null);
  const [comments, setComments] = useState([]);
  const [presence, setPresence] = useState([]);
  const [version, setVersion] = useState(null);
  const since = useRef('');
  const cursor = useRef(undefined); // undefined = 안 바뀜, null = 화면 밖
  const lastSent = useRef('');
  const others = useRef(0);
  const versionRef = useRef(null);
  versionRef.current = version;
  const lastActive = useRef(Date.now());
  const authRef = useRef(auth);
  authRef.current = auth;

  const merge = useCallback((list) => {
    if (!list?.length) return;
    setComments((prev) => {
      const map = new Map(prev.map((c) => [c.id, c]));
      list.forEach((c) => map.set(c.id, { ...map.get(c.id), ...c }));
      return [...map.values()].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    });
  }, []);

  const join = useCallback(async () => {
    const r = await callRoom({ action: 'join', room_id: roomId, sid, ...authRef.current });
    if (r.needs_pin) { setState({ state: 'pin' }); return; }
    if (!r.room) { setState({ state: 'error', error: r.error || '리뷰 방을 열지 못했습니다', code: r.code }); return; }
    setRoom(r.room); setMe(r.me); setPresence(r.presence || []);
    setComments([]); merge(r.comments || []);
    since.current = r.now;
    setVersion((v) => v ?? (r.room.kind === 'model' ? 0 : (r.room.versions.at(-1)?.v || 1)));
    setState({ state: 'ready' });
  }, [roomId, sid, merge]);

  useEffect(() => { if (enabled && roomId) join(); }, [enabled, roomId, join]);

  // 동기화 반복
  useEffect(() => {
    if (state.state !== 'ready') return undefined;
    let timer, alive = true;
    const tick = async () => {
      const cur = cursor.current;
      const key = JSON.stringify(cur ?? null);
      const body = { action: 'sync', room_id: roomId, sid, since: since.current, version: versionRef.current, ...authRef.current };
      if (cur !== undefined && key !== lastSent.current) { body.cursor = cur; lastSent.current = key; }
      const r = await callRoom(body);
      if (!alive) return;
      if (r.now) {
        since.current = r.now;
        merge(r.comments);
        setPresence(r.presence || []);
        others.current = (r.presence || []).length;
        setRoom((rm) => {
          if (!rm) return rm;
          if (r.status && r.status !== rm.status) return { ...rm, status: r.status };
          return rm;
        });
        if (room && ((room.kind === 'file' && r.versions > room.versions.length) || (room.kind === 'model' && r.model_at && r.model_at !== room.model?.at))) join();
      } else if (r.code && ['invite_revoked', 'link_off', 'expired', 'closed', 'forbidden', 'locked'].includes(r.code)) {
        setState({ state: 'error', error: r.error, code: r.code }); return;
      }
      timer = setTimeout(tick, syncDelay({ hidden: document.hidden, idleMs: Date.now() - lastActive.current, others: others.current }));
    };
    timer = setTimeout(tick, 300);
    const wake = () => { if (!document.hidden) { clearTimeout(timer); timer = setTimeout(tick, 50); } };
    // 손을 대면(마우스·키·터치·스크롤) 쉬는 상태를 풀고, 쉬고 있었다면 바로 한 번 맞춘다
    const activity = () => {
      const wasIdle = Date.now() - lastActive.current > IDLE_AFTER_MS;
      lastActive.current = Date.now();
      if (wasIdle) wake();
    };
    const evs = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'];
    evs.forEach((e) => window.addEventListener(e, activity, { passive: true }));
    document.addEventListener('visibilitychange', wake);
    return () => { alive = false; clearTimeout(timer); evs.forEach((e) => window.removeEventListener(e, activity)); document.removeEventListener('visibilitychange', wake); };
  }, [state.state, roomId, sid, merge, join, room]);

  const setCursor = useCallback((c) => { cursor.current = c; lastActive.current = Date.now(); }, []);
  const comment = useCallback(async (payload) => {
    const r = await callRoom({ action: 'comment', room_id: roomId, sid, version: versionRef.current, ...payload, ...authRef.current });
    if (r.comment) merge([r.comment]);
    return r;
  }, [roomId, sid, merge]);
  const resolve = useCallback(async (id, resolved) => {
    const r = await callRoom({ action: 'resolve', room_id: roomId, sid, comment_id: id, resolved, ...authRef.current });
    if (r.comment) merge([r.comment]);
    return r;
  }, [roomId, sid, merge]);
  const fileUrl = useCallback((v) => callRoom({ action: 'file', room_id: roomId, v, ...authRef.current }), [roomId]);

  return { ...state, sid, room, me, comments, presence, version, setVersion, setCursor, comment, resolve, fileUrl, rejoin: join, transport: 'poll' };
}
