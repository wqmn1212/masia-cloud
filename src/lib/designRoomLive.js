import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

// 실시간 디자인 리뷰 연결 — 간격·알림 규칙은 designRoomSync.js
import { syncDelay, shouldWake, IDLE_AFTER_MS, LIVE_CURSOR } from './designRoomSync';
export { syncDelay, shouldWake };

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
  const known = useRef({});
  const [live, setLive] = useState(false);
  const wakeRef = useRef(() => {});
  const nextAt = useRef(0);
  const lastEventAt = useRef(Date.now());
  const missed = useRef(0);
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
    let inflight = false, again = false;
    const tick = async () => {
      inflight = true; again = false;
      const cur = cursor.current;
      const key = JSON.stringify(cur ?? null);
      const body = { action: 'sync', room_id: roomId, sid, since: since.current, version: versionRef.current, ...authRef.current };
      if (cur !== undefined && key !== lastSent.current) { body.cursor = cur; lastSent.current = key; }
      const r = await callRoom(body);
      inflight = false;
      if (!alive) return;
      if (r.now) {
        since.current = r.now;
        merge(r.comments);
        setPresence(r.presence || []);
        others.current = (r.presence || []).length;
        const next = Object.fromEntries((r.presence || []).map((x) => [x.sid, { cursor: x.cursor, version: x.version }]));
        // 실시간 알림이 실제로 오는지 확인: 남의 커서가 바뀌었는데 8초 넘게 알림이 없었으면 놓친 것. 두 번 놓치면 반복 방식으로 돌아간다
        if (liveRef.current && Object.entries(next).some(([k, v]) => known.current[k] && JSON.stringify(v) !== JSON.stringify(known.current[k])) && Date.now() - lastEventAt.current > 8000) {
          missed.current += 1;
          if (missed.current >= 2) { liveRef.current = false; setLive(false); }
        }
        known.current = next;
        setRoom((rm) => {
          if (!rm) return rm;
          if (r.status && r.status !== rm.status) return { ...rm, status: r.status };
          return rm;
        });
        if (room && ((room.kind === 'file' && r.versions > room.versions.length) || (room.kind === 'model' && r.model_at && r.model_at !== room.model?.at))) join();
      } else if (r.code && ['invite_revoked', 'link_off', 'expired', 'closed', 'forbidden', 'locked'].includes(r.code)) {
        setState({ state: 'error', error: r.error, code: r.code }); return;
      }
      const dirty = cursor.current !== undefined && JSON.stringify(cursor.current ?? null) !== lastSent.current;
      const wait = again ? 120 : syncDelay({ hidden: document.hidden, idleMs: Date.now() - lastActive.current, others: others.current, live: liveRef.current, dirty });
      nextAt.current = Date.now() + wait;
      timer = setTimeout(tick, wait);
    };
    nextAt.current = Date.now() + 300;
    timer = setTimeout(tick, 300);
    const wake = () => { if (!document.hidden) { clearTimeout(timer); nextAt.current = Date.now() + 50; timer = setTimeout(tick, 50); } };
    // 실시간 알림·내 커서 이동: 다음 동기화가 ms 보다 늦게 잡혀 있을 때만 앞당긴다 (계속 움직여도 멈추지 않게)
    wakeRef.current = (ms = 120) => {
      if (document.hidden || !alive) return;
      if (inflight) { again = true; return; }
      if (nextAt.current - Date.now() <= ms) return;
      clearTimeout(timer); nextAt.current = Date.now() + ms; timer = setTimeout(tick, ms);
    };
    // 손을 대면(마우스·키·터치·스크롤) 쉬는 상태를 풀고, 쉬고 있었다면 바로 한 번 맞춘다
    const activity = () => {
      const wasIdle = Date.now() - lastActive.current > IDLE_AFTER_MS;
      lastActive.current = Date.now();
      if (wasIdle) wake();
    };
    const evs = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'];
    evs.forEach((e) => window.addEventListener(e, activity, { passive: true }));
    document.addEventListener('visibilitychange', wake);
    return () => { alive = false; wakeRef.current = () => {}; clearTimeout(timer); evs.forEach((e) => window.removeEventListener(e, activity)); document.removeEventListener('visibilitychange', wake); };
  }, [state.state, roomId, sid, merge, join, room]);

  // 직원은 실시간 구독 (고객·손님은 읽기 권한이 없어 반복 방식 그대로)
  const liveRef = useRef(false);
  useEffect(() => {
    if (state.state !== 'ready' || me?.kind !== 'staff') return undefined;
    const unsubs = [];
    try {
      for (const entity of ['DesignComment', 'DesignPresence']) {
        unsubs.push(base44.entities[entity].subscribe((ev) => {
          if (ev?.data?.room_id === roomId) lastEventAt.current = Date.now();
          if (liveRef.current && shouldWake(entity, ev, { roomId, sid, known: known.current })) wakeRef.current();
        }));
      }
      liveRef.current = true; missed.current = 0; lastEventAt.current = Date.now(); setLive(true);
    } catch { liveRef.current = false; setLive(false); }
    return () => { unsubs.forEach((u) => { try { u?.(); } catch { /* 이미 끊김 */ } }); liveRef.current = false; setLive(false); };
  }, [state.state, me?.kind, roomId, sid]);

  const setCursor = useCallback((c) => {
    const moved = JSON.stringify(c ?? null) !== JSON.stringify(cursor.current ?? null);
    cursor.current = c; lastActive.current = Date.now();
    if (moved && liveRef.current) wakeRef.current(LIVE_CURSOR);
  }, []);
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

  return { ...state, sid, room, me, comments, presence, version, setVersion, setCursor, comment, resolve, fileUrl, rejoin: join, transport: live ? 'live' : 'poll' };
}
