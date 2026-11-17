import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Lock, MessageSquarePlus, Minus, Plus, Reply, Share2, Undo2, Users, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import PdfViewer from '@/components/signature/PdfViewer';
import SimStep from '@/components/prototype/develop/SimStep';
import DesignShareDialog from '@/components/design/DesignShareDialog';
import { useDesignRoom } from '@/lib/designRoomLive';
import { toast } from '@/components/ui/use-toast';

const KIND_LABEL = { staff: '이지스', client: '고객사', guest: '손님' };
const ago = (iso) => {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  return s < 60 ? '방금' : s < 3600 ? `${Math.floor(s / 60)}분 전` : s < 86400 ? `${Math.floor(s / 3600)}시간 전` : new Date(iso).toLocaleDateString('ko-KR');
};
const initials = (name) => String(name || '?').trim().slice(0, 1).toUpperCase();
const storeKey = (id) => `masia.design.${id}`;
const readStore = (id) => { try { return JSON.parse(sessionStorage.getItem(storeKey(id)) || 'null'); } catch { return null; } };
const writeStore = (id, v) => { try { sessionStorage.setItem(storeKey(id), JSON.stringify(v)); } catch { /* 저장 불가 환경 */ } };

/** 다른 사람 커서: 1초마다 오는 위치 사이를 부드럽게 옮긴다 */
function RemoteCursor({ p }) {
  return (
    <div className="pointer-events-none absolute z-20" style={{ left: `${p.cursor.x * 100}%`, top: `${p.cursor.y * 100}%`, transition: 'left 0.9s linear, top 0.9s linear' }}>
      <svg width="16" height="18" viewBox="0 0 16 18" className="-translate-x-[2px] -translate-y-[2px] drop-shadow"><path d="M1 1l13 7-6 1.5L5.5 17z" fill={p.color} stroke="white" strokeWidth="1.2" /></svg>
      <span className="ml-3 -mt-1 inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-micro font-medium text-white" style={{ background: p.color }}>{p.name}</span>
    </div>
  );
}

function PinDot({ n, c, active, onClick }) {
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} aria-label={`댓글 ${n}`}
      className={`absolute z-10 flex h-6 w-6 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full rounded-bl-none text-micro font-bold text-white shadow ring-2 ${active ? 'ring-foreground scale-110' : 'ring-white'}`}
      style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, background: c.resolved ? '#94a3b8' : c.color }}>{n}</button>
  );
}

// 이미지·PDF 시안 위에 핀과 커서를 얹는다
function FileCanvas({ live, version, numbered, active, setActive, commentMode, onSpot, draft }) {
  const [url, setUrl] = useState(null);
  const [zoom, setZoom] = useState(1);
  const ver = live.room.versions.find((v) => v.v === version) || live.room.versions.at(-1);
  useEffect(() => { let ok = true; setUrl(null); live.fileUrl(ver.v).then((r) => { if (ok) setUrl(r.url || ''); }); return () => { ok = false; }; }, [ver.v]);  
  const cursors = live.presence.filter((p) => p.cursor && p.version === ver.v && p.cursor.page);
  const overlay = (page) => (
    <>
      {numbered.filter(({ c }) => c.page === page && c.x != null).map(({ n, c }) => <PinDot key={c.id} n={n} c={c} active={active === c.id} onClick={() => setActive(c.id)} />)}
      {draft?.page === page && <span className="absolute z-10 h-6 w-6 -translate-x-1/2 -translate-y-full animate-pulse rounded-full rounded-bl-none bg-primary ring-2 ring-white" style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%` }} />}
      {cursors.filter((p) => p.cursor.page === page).map((p) => <RemoteCursor key={p.sid} p={p} />)}
    </>
  );
  const move = (page, x, y) => live.setCursor({ page, x, y });
  const leave = () => live.setCursor(null);
  const click = commentMode ? (page, x, y) => onSpot({ page, x, y }) : undefined;
  const ratio = (e) => { const b = e.currentTarget.getBoundingClientRect(); return [(e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height]; };
  return (
    <div className="relative flex h-full min-h-[50vh] flex-col">
      <div className="absolute right-3 top-3 z-30 flex items-center gap-1 rounded-lg border bg-card/95 p-0.5 shadow-sm">
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label="축소" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}><Minus className="h-4 w-4" /></Button>
        <button type="button" className="w-12 text-caption tabular-nums" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label="확대" onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}><Plus className="h-4 w-4" /></Button>
      </div>
      {!url ? <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        : ver.file_type === 'pdf'
          ? <PdfViewer url={url} className="h-full flex-1 rounded-none" maxWidth={Math.round(900 * zoom)} endLabel="시안 끝" errorText="시안을 불러오지 못했습니다" overlay={overlay} onPageClick={click} onPageMove={move} onPageLeave={leave} />
          : (
            <div className="flex-1 overflow-auto bg-muted/60 p-4">
              <div className={`relative mx-auto ${commentMode ? 'cursor-crosshair' : ''}`} style={{ width: `${zoom * 100}%`, maxWidth: zoom === 1 ? 1100 : 'none' }}
                onMouseMove={(e) => { const [x, y] = ratio(e); move(1, x, y); }} onMouseLeave={leave}
                onClick={click ? (e) => { const [x, y] = ratio(e); click(1, x, y); } : undefined}>
                <img src={url} alt={ver.file_name} className="block w-full select-none rounded shadow-sm" draggable={false} />
                {overlay(1)}
              </div>
            </div>
          )}
    </div>
  );
}

// 시제품 3D: 시뮬레이션 그대로, 댓글 위치·다른 사람 커서를 점으로 보인다
function ModelCanvas({ live, numbered, active, commentMode, onSpot }) {
  const model = live.room.model;
  const [dev, setDev] = useState(model.dev);
  const change = (fn) => setDev((d) => ({ ...d, ...(typeof fn === 'function' ? fn(d) : fn) }));
  const concept = useMemo(() => (model.parts?.length ? { id: `room-${live.room.id}-${model.at}`, preview: { parts: model.parts } } : null), [model.parts, model.at, live.room.id]);
  const partName = useMemo(() => Object.fromEntries((model.parts || []).map((x) => [x.id, x.name])), [model.parts]);
  const pins = [
    ...numbered.filter(({ c }) => c.point).map(({ c }) => ({ point: c.point, color: active === c.id ? '#111827' : c.resolved ? '#94a3b8' : c.color })),
    ...live.presence.filter((p) => p.cursor?.point).map((p) => ({ point: p.cursor.point, color: p.color, scale: 0.6 })),
  ];
  return (
    <div className="h-full overflow-auto p-3">
      <SimStep concept={concept} dev={dev} change={change} viewer
        pin={{ mode: commentMode, pins, onPick: (p) => onSpot({ point: p.point, part_name: partName[p.part_id] || '' }), onHover: (h) => live.setCursor(h ? { point: h.point } : null) }} />
    </div>
  );
}

function Thread({ n, c, replies, me, active, onSelect, live }) {
  const [reply, setReply] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const canResolve = me.kind !== 'guest' || c.author_key === me.key;
  const send = async () => { if (!reply.trim()) return; setBusy(true); const r = await live.comment({ parent_id: c.id, text: reply.trim() }); setBusy(false); if (r.comment) { setReply(''); setOpen(false); } };
  return (
    <li id={`cm-${c.id}`} className={`rounded-lg border p-3 transition-colors ${active ? 'border-primary bg-primary/5' : 'bg-card'} ${c.resolved ? 'opacity-70' : ''}`}>
      <button type="button" className="block w-full text-left" onClick={onSelect}>
        <div className="flex items-center gap-2">
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-micro font-bold text-white" style={{ background: c.resolved ? '#94a3b8' : c.color }}>{c.x != null || c.point ? n : '·'}</span>
          <span className="text-label font-semibold">{c.author_name}</span>
          <span className="text-micro text-muted-foreground">{KIND_LABEL[c.author_kind]} · {ago(c.created_at)}</span>
          {c.resolved && <span className="ml-auto rounded bg-success/15 px-1.5 text-micro text-success-text">해결</span>}
        </div>
        <p className="mt-1 whitespace-pre-wrap text-body">{c.part_name ? <span className="text-muted-foreground">[{c.part_name}] </span> : c.page > 1 ? <span className="text-muted-foreground">{c.page}쪽 · </span> : null}{c.text}</p>
      </button>
      {replies.length > 0 && (
        <ul className="mt-2 space-y-1.5 border-l-2 pl-3">{replies.map((r) => (
          <li key={r.id}><p className="text-caption"><span className="font-semibold" style={{ color: r.color }}>{r.author_name}</span> <span className="text-micro text-muted-foreground">{ago(r.created_at)}</span></p><p className="whitespace-pre-wrap text-label">{r.text}</p></li>
        ))}</ul>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {!open && <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setOpen(true)}><Reply className="h-3.5 w-3.5" />답글</Button>}
        {canResolve && <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => live.resolve(c.id, !c.resolved)}>{c.resolved ? <><Undo2 className="h-3.5 w-3.5" />다시 열기</> : <><Check className="h-3.5 w-3.5" />해결</>}</Button>}
      </div>
      {open && (
        <div className="mt-1 space-y-1.5">
          <Textarea aria-label="답글" autoFocus rows={2} value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }} className="text-label" placeholder="답글 (Ctrl+Enter 보내기)" />
          <div className="flex gap-1"><Button size="sm" className="h-7" onClick={send} disabled={busy || !reply.trim()}>{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}보내기</Button><Button size="sm" variant="ghost" className="h-7" onClick={() => { setOpen(false); setReply(''); }}>취소</Button></div>
        </div>
      )}
    </li>
  );
}

function Room({ live, auth }) {
  const { room, me } = live;
  const [commentMode, setCommentMode] = useState(false);
  const [draft, setDraft] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(null);
  const [filter, setFilter] = useState('open');
  const [share, setShare] = useState(false);
  const draftRef = useRef(null);
  const version = live.version;
  const tops = live.comments.filter((c) => !c.parent_id && (room.kind === 'model' || c.version === version));
  const numbered = tops.map((c, i) => ({ n: i + 1, c }));
  const shown = numbered.filter(({ c }) => (filter === 'open' ? !c.resolved : filter === 'done' ? c.resolved : true));
  const repliesOf = (id) => live.comments.filter((r) => r.parent_id === id);
  const closed = room.status === 'CLOSED';

  useEffect(() => {
    const key = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return;
      if (e.key === 'c' || e.key === 'C') setCommentMode((m) => !m);
      if (e.key === 'Escape') { setCommentMode(false); setDraft(null); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const onSpot = (spot) => { setDraft(spot); setCommentMode(false); setTimeout(() => draftRef.current?.focus(), 30); };
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const { part_name, ...spot } = draft || {};
    const r = await live.comment({ text: text.trim(), spot: draft ? spot : null, part_name });
    setBusy(false);
    if (r.comment) { setText(''); setDraft(null); setActive(r.comment.id); } else toast({ title: r.error || '보내지 못했습니다', variant: 'destructive' });
  };
  const select = (c) => {
    setActive(c.id);
    if (c.page) document.querySelector(`[data-page="${c.page}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex flex-wrap items-center gap-2 border-b bg-card px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-micro font-semibold text-primary">디자인 실시간 리뷰</p>
          <h1 className="truncate text-title font-semibold">{room.title}</h1>
        </div>
        {room.kind === 'file' && room.versions.length > 1 && (
          <select aria-label="시안 판" value={version} onChange={(e) => { live.setVersion(Number(e.target.value)); setDraft(null); }} className="h-8 rounded-md border bg-background px-2 text-label">
            {[...room.versions].reverse().map((v) => <option key={v.v} value={v.v}>v{v.v} · {v.file_name}</option>)}
          </select>
        )}
        <div className="flex items-center -space-x-1.5" aria-label="지금 보고 있는 사람">
          {[{ sid: 'me', name: `${me.name} (나)`, color: me.color }, ...live.presence].slice(0, 8).map((p) => (
            <span key={p.sid} title={p.name} className="flex h-7 w-7 items-center justify-center rounded-full text-micro font-bold text-white ring-2 ring-card" style={{ background: p.color }}>{initials(p.name)}</span>
          ))}
          {live.presence.length > 7 && <span className="pl-2 text-caption text-muted-foreground">+{live.presence.length - 7}</span>}
        </div>
        <span className="hidden items-center gap-1 text-micro text-muted-foreground sm:flex"><Users className="h-3.5 w-3.5" />{live.presence.length + 1}명</span>
        {!closed && <Button size="sm" variant={commentMode ? 'default' : 'outline'} aria-pressed={commentMode} onClick={() => setCommentMode((m) => !m)}><MessageSquarePlus className="h-4 w-4" />{commentMode ? '위치 고르는 중' : '댓글 (C)'}</Button>}
        {me.manage && <Button size="sm" variant="outline" onClick={() => setShare(true)}><Share2 className="h-4 w-4" />공유</Button>}
      </header>
      {closed && <p className="bg-warning/15 px-3 py-1.5 text-caption text-warning-text">리뷰가 끝난 방입니다. 내용은 볼 수 있지만 새 댓글은 남길 수 없습니다.</p>}
      {commentMode && <p className="bg-primary px-3 py-1.5 text-caption text-primary-foreground">댓글을 남길 위치를 누르세요. 그만두려면 Esc</p>}
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-1">
        <main className="min-h-0 overflow-hidden border-b lg:border-b-0 lg:border-r">
          {room.kind === 'model'
            ? <ModelCanvas live={live} numbered={numbered} active={active} commentMode={commentMode} onSpot={onSpot} />
            : <FileCanvas live={live} version={version} numbered={numbered} active={active} setActive={(id) => select(tops.find((c) => c.id === id))} commentMode={commentMode} onSpot={onSpot} draft={draft} />}
        </main>
        <aside className="flex max-h-[45vh] min-h-0 flex-col lg:max-h-none">
          {!closed && (
            <div className="space-y-1.5 border-b p-3">
              <p className="text-caption font-semibold">{draft ? (draft.part_name ? `새 댓글 · ${draft.part_name}` : draft.page ? `새 댓글 · ${draft.page}쪽 위치` : '새 댓글 · 3D 위치') : '새 댓글 (위치 없이)'}</p>
              <Textarea ref={draftRef} aria-label="댓글" rows={2} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }} placeholder="댓글 남기기 (Ctrl+Enter 보내기)" className="text-body" />
              <div className="flex gap-1.5">
                <Button size="sm" onClick={send} disabled={busy || !text.trim()}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}보내기</Button>
                {draft && <Button size="sm" variant="ghost" onClick={() => setDraft(null)}><X className="h-4 w-4" />위치 지우기</Button>}
              </div>
            </div>
          )}
          <div className="flex gap-1 border-b px-3 py-2 text-caption" role="tablist" aria-label="댓글 보기">
            {[['open', `열림 ${numbered.filter(({ c }) => !c.resolved).length}`], ['done', `해결 ${numbered.filter(({ c }) => c.resolved).length}`], ['all', '전체']].map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={`rounded-md px-2 py-1 ${filter === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{l}</button>
            ))}
            <span className="ml-auto self-center text-micro text-muted-foreground">{live.transport === 'poll' ? '약 1초마다 맞춤' : '실시간 연결'}</span>
          </div>
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {shown.length === 0 ? <li className="py-8 text-center text-caption text-muted-foreground">{filter === 'open' ? '열린 댓글이 없습니다. “댓글 (C)”을 누르고 위치를 찍어 보세요.' : '없습니다'}</li>
              : [...shown].reverse().map(({ n, c }) => <Thread key={c.id} n={n} c={c} replies={repliesOf(c.id)} me={me} active={active === c.id} onSelect={() => select(c)} live={live} />)}
          </ul>
        </aside>
      </div>
      {share && <DesignShareDialog room={room} onClose={() => setShare(false)} onChanged={live.rejoin} auth={auth} />}
    </div>
  );
}

// /design/<방 ID>  — 로그인한 팀원·고객사 계정은 바로, 이메일 초대(?i=)는 링크로, 공유 링크(?k=)는 PIN·이름을 넣고 들어온다
export default function DesignReview({ roomId: forcedId }) {
  const roomId = forcedId || window.location.pathname.split('/')[2] || '';
  const params = new URLSearchParams(window.location.search);
  const token = params.get('k'), invite = params.get('i');
  const saved = token ? readStore(roomId) : null;
  const [auth, setAuth] = useState(() => (invite ? { invite } : token ? (saved?.pin && saved?.name ? { token, pin: saved.pin, name: saved.name } : null) : {}));
  const [form, setForm] = useState({ pin: '', name: saved?.name || '' });
  const live = useDesignRoom(roomId, auth, { enabled: !!auth });
  useEffect(() => {
    if (token && auth && live.state === 'error' && ['wrong_pin', 'bad_pin', 'need_name'].includes(live.code)) setAuth(null);
  }, [live.state, live.code]);  

  if (!auth || live.state === 'pin') {
    const submit = (e) => { e.preventDefault(); writeStore(roomId, { pin: form.pin, name: form.name.trim() }); setAuth({ token, pin: form.pin, name: form.name.trim() }); };
    return (
      <div className="min-h-screen bg-background px-4 py-16">
        <form onSubmit={submit} className="mx-auto max-w-sm space-y-4 rounded-xl border bg-card p-6">
          <p className="flex items-center gap-2 text-title font-semibold"><Lock className="h-5 w-5 text-primary" />디자인 리뷰</p>
          <p className="text-caption text-muted-foreground">받으신 PIN 과 다른 사람에게 보일 이름을 넣어 주세요.</p>
          <label className="block space-y-1 text-label">이름<Input aria-label="이름" autoFocus maxLength={30} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="예: 박지은 (디자인팀)" /></label>
          <label className="block space-y-1 text-label">PIN 6자리<Input aria-label="PIN" inputMode="numeric" maxLength={6} value={form.pin} onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, '') }))} className="text-center font-mono text-xl tracking-[0.4em]" /></label>
          {live.state === 'error' && <p className="text-caption text-destructive" role="alert">{live.error}</p>}
          <Button type="submit" className="w-full" disabled={form.pin.length !== 6 || !form.name.trim()}>들어가기</Button>
        </form>
      </div>
    );
  }
  if (live.state === 'loading') return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (live.state === 'error') {
    return (
      <div className="min-h-screen bg-background px-4 py-16">
        <div className="mx-auto max-w-sm space-y-3 rounded-xl border bg-card p-6 text-center">
          <p className="text-title font-semibold">디자인 리뷰</p>
          <p className="text-body text-muted-foreground" role="alert">{live.error}</p>
          {live.code === 'login' && <Button onClick={() => base44.auth.redirectToLogin(window.location.href)}>로그인</Button>}
        </div>
      </div>
    );
  }
  return <Room live={live} auth={auth} />;
}
