import React, { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SEVERITY, ISSUE_STATUS, ISSUE_SOURCE, callGroup, uploadPhoto } from '@/lib/cardGroup';

const FIELDS = ['card_id', 'area', 'title', 'detail', 'cause', 'vendor', 'impact', 'action_plan', 'severity', 'status', 'assignee_name', 'due_date', 'done_date', 'related_doc', 'photos', 'source'];
const pick = (i) => Object.fromEntries(FIELDS.map((k) => [k, k === 'photos' ? i?.photos || [] : i?.[k] ?? (k === 'severity' ? 'MID' : k === 'status' ? 'OPEN' : k === 'source' ? 'MANUAL' : '')]));
const when = (iso) => { try { return new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

// 이슈 한 건 보기·고치기: 사진은 문제점 바로 옆에, 바뀐 칸은 이력으로 남는다
export default function IssueDialog({ issue, group, cards, canDelete, onClose, onSaved }) {
  const [form, setForm] = useState(() => pick(issue));
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isNew = !issue?.id;

  const addPhotos = async (files) => {
    const list = [...files].filter((f) => f.type.startsWith('image/')).slice(0, 12 - form.photos.length);
    if (!list.length) return;
    setBusy('photo'); setError('');
    try {
      const up = [];
      for (const f of list) up.push(await uploadPhoto(f));
      set('photos', [...form.photos, ...up]);
    } catch (e) { setError(e?.message || '사진을 올리지 못했습니다'); }
    setBusy('');
  };
  const save = async () => {
    if (!form.title.trim()) { setError('문제점을 적어 주세요'); return; }
    setBusy('save'); setError('');
    try {
      const fields = isNew ? form : Object.fromEntries(Object.entries(form).filter(([k, v]) => JSON.stringify(v ?? '') !== JSON.stringify(issue[k] ?? (k === 'photos' ? [] : ''))));
      const res = await callGroup('issue_save', { group_id: group.id, issue_id: issue?.id, fields });
      onSaved?.(res.issue); onClose();
    } catch (e) { setError(e.message); }
    setBusy('');
  };
  const remove = async () => {
    if (!window.confirm(`#${issue.no} 이슈를 지울까요? 되돌릴 수 없습니다.`)) return;
    setBusy('del');
    try { await callGroup('issue_delete', { group_id: group.id, issue_id: issue.id }); onSaved?.(null); onClose(); } catch (e) { setError(e.message); }
    setBusy('');
  };

  const field = (k, label, props = {}) => (
    <label className="block text-label font-medium">{label}
      <Input className="mt-1" value={form[k]} onChange={(e) => set(k, e.target.value)} {...props} />
    </label>
  );
  const area = (k, label, rows = 2) => (
    <label className="block text-label font-medium">{label}
      <Textarea className="mt-1" rows={rows} value={form[k]} onChange={(e) => set(k, e.target.value)} />
    </label>
  );
  const select = (k, label, options) => (
    <label className="block text-label font-medium">{label}
      <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-body" value={form[k]} onChange={(e) => set(k, e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>{isNew ? '새 이슈' : `#${issue.no} 이슈`}</DialogTitle></DialogHeader>
        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <div className="space-y-3">
            {area('title', '문제점', 2)}
            <div className="grid gap-3 sm:grid-cols-2">
              {field('area', '부위·공정', { placeholder: '예: 헤드 PCB' })}
              {field('vendor', '관련 업체', { placeholder: '예: BHS (PCB)' })}
            </div>
            {area('detail', '세부 내용 · 현장 메모', 3)}
            <div className="grid gap-3 sm:grid-cols-2">
              {field('cause', '원인 구분', { placeholder: '예: 설계 / 금형 / 작업 방법' })}
              {field('impact', '영향', { placeholder: '예: 기능 불량' })}
            </div>
            {area('action_plan', '개선 방안', 2)}
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-label font-medium">사진</p>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {form.photos.map((p, i) => (
                  <div key={p.url} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
                    <a href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={p.name || `사진 ${i + 1}`} className="h-full w-full object-cover" /></a>
                    <button type="button" aria-label="사진 빼기" onClick={() => set('photos', form.photos.filter((x) => x.url !== p.url))} className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5 shadow"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                {form.photos.length < 12 && (
                  <button type="button" onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addPhotos(e.dataTransfer.files); }}
                    className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-caption text-muted-foreground hover:border-primary hover:text-primary">
                    {busy === 'photo' ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}사진 추가
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
            </div>
            {select('severity', '중요도', Object.entries(SEVERITY).map(([k, v]) => [k, v.label]))}
            {select('status', '상태', Object.entries(ISSUE_STATUS).map(([k, v]) => [k, v.label]))}
            {field('assignee_name', '담당')}
            {field('due_date', '목표일', { type: 'date' })}
            {form.status === 'DONE' && field('done_date', '완료일', { type: 'date' })}
            {select('card_id', '관련 카드', [['', '그룹 전체'], ...cards.map((c) => [c.id, c.title])])}
            {select('source', '출처', Object.entries(ISSUE_SOURCE))}
            {field('related_doc', '관련 문서')}
          </div>
        </div>
        {!isNew && issue.history?.length > 0 && (
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-label font-semibold">변경 이력</p>
            <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-caption text-muted-foreground">
              {[...issue.history].reverse().map((h, i) => <li key={i}><span className="text-foreground">{h.by || '알 수 없음'}</span> · {when(h.at)} · {h.text}</li>)}
            </ul>
          </div>
        )}
        {error && <p className="text-label text-destructive">{error}</p>}
        <DialogFooter className="gap-2 sm:justify-between">
          {!isNew && canDelete ? <Button variant="ghost" className="text-destructive" onClick={remove} disabled={!!busy}><Trash2 className="mr-1 h-4 w-4" />지우기</Button> : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>닫기</Button>
            <Button onClick={save} disabled={!!busy}>{busy === 'save' && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}저장</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
