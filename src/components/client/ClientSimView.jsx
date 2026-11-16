import React, { useMemo, useState } from 'react';
import { MapPin, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import SimStep from '@/components/prototype/develop/SimStep';

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '');

// 고객용 3D·동작 시뮬레이션: 직원이 공개한 설계로 움직여 보고, 부품 위치를 눌러 의견을 남긴다. 바꾼 값은 이 화면 안에서만 쓴다
export default function ClientSimView({ project, canComment, onComment }) {
  const model = project.model;
  const [dev, setDev] = useState(model.dev);
  const change = (fn) => setDev((d) => ({ ...d, ...(typeof fn === 'function' ? fn(d) : fn) }));
  // 의견을 보내면 목록이 새로 오지만 3D 장면은 다시 만들지 않는다 (처음 받은 모형을 계속 쓴다)
  const [concept] = useState(() => (model.parts?.length ? { id: `shared-${project.id}`, preview: { parts: model.parts } } : null));
  const [partName] = useState(() => Object.fromEntries((model.parts || []).map((x) => [x.id, x.name])));
  const [mode, setMode] = useState(false);
  const [draft, setDraft] = useState(null);
  const [text, setText] = useState('');
  const [active, setActive] = useState(null);
  const [busy, setBusy] = useState(false);
  const comments = project.comments || [];
  const pins = useMemo(() => [
    ...comments.map((c) => ({ point: c.point, resolved: c.resolved, active: c.id === active })),
    ...(draft ? [{ point: draft.point, active: true }] : []),
  ], [comments, draft, active]);
  const send = async () => {
    setBusy(true);
    const ok = await onComment({ part_id: draft?.part_id || null, part_name: draft ? partName[draft.part_id] || '' : '', point: draft?.point || null, text: text.trim() });
    setBusy(false);
    if (ok) { setDraft(null); setText(''); setMode(false); }
  };

  return (
    <div className="space-y-4">
      {canComment && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
          <Button size="sm" variant={mode ? 'default' : 'outline'} aria-pressed={mode} onClick={() => { setMode(!mode); setDraft(null); }}><MapPin className="h-4 w-4" />{mode ? '위치 고르는 중 · 끝내기' : '위치에 의견 남기기'}</Button>
          <span className="text-caption text-muted-foreground">{mode ? '3D 에서 의견을 남길 곳을 누르세요.' : '부품을 짚어 “여기 버튼이 작아요”처럼 남길 수 있습니다. 위치 없이 남겨도 됩니다.'}</span>
        </div>
      )}
      {canComment && (draft || !mode) && (
        <div className="space-y-2 rounded-xl border p-3">
          <p className="text-label font-semibold">{draft ? `의견 위치: ${partName[draft.part_id] || '선택한 곳'}` : '전체 의견'}</p>
          <Textarea aria-label="의견" value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="예: 전원 버튼이 손가락보다 작아 보여요. 조금 키워 주세요." className="text-body" />
          <div className="flex gap-2">
            <Button size="sm" onClick={send} disabled={busy || !text.trim()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}의견 보내기</Button>
            {draft && <Button size="sm" variant="ghost" onClick={() => setDraft(null)} disabled={busy}>위치 지우기</Button>}
          </div>
        </div>
      )}
      <SimStep concept={concept} dev={dev} change={change} viewer pin={{ mode, pins, onPick: (p) => { setDraft(p); setMode(false); } }} />
      <div className="space-y-1.5 rounded-xl border p-3">
        <p className="text-label font-semibold">남긴 의견 {comments.length}건</p>
        {comments.length === 0 ? <p className="text-caption text-muted-foreground">아직 없습니다.</p> : (
          <ul className="space-y-1">{[...comments].reverse().map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => setActive(active === c.id ? null : c.id)} className={`w-full rounded-lg px-3 py-2 text-left text-caption ${active === c.id ? 'bg-primary/10' : c.resolved ? 'bg-muted text-muted-foreground' : 'bg-secondary'}`}>
                <span className="font-semibold">{c.part_name || '전체'}</span> · {c.text}
                <span className="block text-micro text-muted-foreground">{c.by} · {fmt(c.at)}{c.resolved ? ' · 반영 처리됨' : ''}{c.point ? ' · 누르면 3D 에 파란 점' : ''}</span>
              </button>
            </li>
          ))}</ul>
        )}
      </div>
    </div>
  );
}
