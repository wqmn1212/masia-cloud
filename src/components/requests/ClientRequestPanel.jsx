import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ClipboardList, FileDown, Loader2, Plus, RotateCcw, Send, Trash2, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { withClientView } from '@/lib/clientView';

export const STATUS = { WAITING: ['기다리는 중', 'bg-muted text-muted-foreground'], SUBMITTED: ['확인 필요', 'bg-warning/15 text-warning-text'], ACCEPTED: ['확인 완료', 'bg-success/15 text-success-text'], REDO: ['다시 요청', 'bg-destructive/10 text-destructive'] };
const errText = (e) => e?.response?.data?.error || e?.message || String(e);
export async function callRequest(body, { clientView = false } = {}) {
  try { const r = (await base44.functions.invoke('clientRequest', clientView ? withClientView(body) : body)).data; if (r?.error) throw new Error(r.error); return r; }
  catch (e) { throw new Error(errText(e)); }
}
const day = (iso) => (iso ? String(iso).slice(0, 10) : '');

/** 항목 파일 열기 */
export function ItemFiles({ reqId, item, clientView = false }) {
  const open = async (f) => {
    try { const r = await callRequest({ action: 'file', id: reqId, key: item.key, idx: f.idx }, { clientView }); window.open(r.url, '_blank', 'noopener'); }
    catch (e) { toast({ title: e.message, variant: 'destructive' }); }
  };
  if (!item.files?.length) return null;
  return <div className="flex flex-wrap gap-1.5">{item.files.map((f) => <button key={f.idx} type="button" onClick={() => open(f)} className="flex items-center gap-1 rounded bg-card px-2 py-1 text-caption text-primary ring-1 ring-border hover:bg-muted"><FileDown className="h-3.5 w-3.5" />{f.name}</button>)}</div>;
}

function NewRequestDialog({ cardId, onClose, onDone }) {
  const { data } = useQuery({ queryKey: ['client-request-templates'], queryFn: () => callRequest({ action: 'templates', card_id: cardId }), staleTime: Infinity });
  const templates = data?.templates || [];
  const [tpl, setTpl] = useState('design_handoff');
  const [draft, setDraft] = useState(null);
  const t = templates.find((x) => x.key === tpl);
  const form = draft?.tpl === tpl ? draft : t ? { tpl, title: t.title, note: t.note, items: t.items.map((x) => ({ ...x })), due_date: '' } : null;
  const set = (patch) => setDraft({ ...form, ...patch });
  const setItem = (i, patch) => set({ items: form.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      const r = await callRequest({ action: 'create', card_id: cardId, template: tpl, title: form.title, note: form.note, due_date: form.due_date, items: form.items });
      toast({ title: '자료 요청을 보냈습니다', description: r.notified ? '고객에게 알림과 메일이 갑니다' : '카드가 고객 비공개라 알림은 보내지 않았습니다' });
      onDone(); onClose();
    } catch (e) { toast({ title: e.message, variant: 'destructive' }); }
    setBusy(false);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle className="text-title">고객에게 자료 요청</DialogTitle></DialogHeader>
        <div className="flex flex-wrap gap-1">{templates.map((x) => <button key={x.key} type="button" onClick={() => setTpl(x.key)} className={`rounded-full border px-3 py-1 text-caption ${tpl === x.key ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{x.key === 'custom' ? '직접 만들기' : x.title}</button>)}</div>
        {!form ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
              <label className="space-y-1 text-caption">제목<Input aria-label="요청 제목" value={form.title} onChange={(e) => set({ title: e.target.value })} className="h-9" /></label>
              <label className="space-y-1 text-caption">회신 기한<Input type="date" aria-label="회신 기한" value={form.due_date} onChange={(e) => set({ due_date: e.target.value })} className="h-9" /></label>
            </div>
            <label className="block space-y-1 text-caption">고객에게 보일 안내<Textarea aria-label="안내" rows={2} value={form.note} onChange={(e) => set({ note: e.target.value })} /></label>
            <div className="space-y-2">
              {form.items.map((x, i) => (
                <div key={i} className="grid gap-1.5 rounded-lg border p-2 sm:grid-cols-[1fr_1.4fr_auto]">
                  <Input aria-label={`항목 ${i + 1} 이름`} value={x.label} onChange={(e) => setItem(i, { label: e.target.value })} placeholder="항목 이름" className="h-8 text-label" />
                  <Input aria-label={`항목 ${i + 1} 설명`} value={x.hint} onChange={(e) => setItem(i, { hint: e.target.value })} placeholder="설명 (고객에게 보임)" className="h-8 text-label" />
                  <div className="flex items-center gap-1.5 text-caption">
                    <select aria-label={`항목 ${i + 1} 종류`} value={x.kind} onChange={(e) => setItem(i, { kind: e.target.value })} className="h-8 rounded-md border bg-background px-1"><option value="file">파일</option><option value="text">글</option></select>
                    <label className="flex items-center gap-1"><input type="checkbox" checked={!!x.required} onChange={(e) => setItem(i, { required: e.target.checked })} />필수</label>
                    <button type="button" aria-label={`항목 ${i + 1} 빼기`} onClick={() => set({ items: form.items.filter((_, j) => j !== i) })} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => set({ items: [...form.items, { key: `item${form.items.length + 1}`, label: '', hint: '', kind: 'file', required: false }] })}><Plus className="h-4 w-4" />항목 추가</Button>
            </div>
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>취소</Button><Button onClick={send} disabled={busy || !form.items.some((x) => x.label.trim())}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}고객에게 보내기</Button></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReviewItem({ req, item, onChanged }) {
  const [redo, setRedo] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const act = async (decision) => {
    setBusy(true);
    try { await callRequest({ action: 'review', id: req.id, key: item.key, decision, note }); setRedo(false); setNote(''); onChanged(); }
    catch (e) { toast({ title: e.message, variant: 'destructive' }); }
    setBusy(false);
  };
  const [label, tone] = STATUS[item.status] || STATUS.WAITING;
  return (
    <li className="space-y-1.5 rounded-lg border bg-card px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-label font-semibold">{item.label}{item.required && <span className="text-destructive"> *</span>}</span>
        <span className={`rounded px-1.5 py-0.5 text-micro font-semibold ${tone}`}>{label}</span>
        {item.submitted_at && <span className="text-micro text-muted-foreground">{item.submitted_by} · {day(item.submitted_at)}</span>}
      </div>
      {item.answer && <p className="whitespace-pre-wrap text-caption">{item.answer}</p>}
      <ItemFiles reqId={req.id} item={item} />
      {item.staff_note && item.status === 'REDO' && <p className="text-caption text-destructive">다시 요청: {item.staff_note}</p>}
      {item.status === 'SUBMITTED' && req.status === 'OPEN' && (
        redo ? (
          <div className="flex flex-wrap gap-1.5"><Input aria-label="다시 요청 이유" value={note} onChange={(e) => setNote(e.target.value)} placeholder="무엇이 더 필요한지" className="h-8 min-w-0 flex-1 text-caption" /><Button size="sm" variant="outline" className="h-8" onClick={() => act('REDO')} disabled={busy || !note.trim()}>보내기</Button><Button size="sm" variant="ghost" className="h-8" onClick={() => setRedo(false)}><X className="h-4 w-4" /></Button></div>
        ) : (
          <div className="flex gap-1.5"><Button size="sm" className="h-7" onClick={() => act('ACCEPTED')} disabled={busy}><Check className="h-3.5 w-3.5" />확인</Button><Button size="sm" variant="ghost" className="h-7" onClick={() => setRedo(true)} disabled={busy}><RotateCcw className="h-3.5 w-3.5" />다시 요청</Button></div>
        )
      )}
    </li>
  );
}

// 직원: 카드 소통 탭의 고객 자료 요청 (디자인 전달 자료·신제품 기획·인쇄 원고 템플릿)
export default function ClientRequestPanel({ card }) {
  const qc = useQueryClient();
  const key = ['client-requests', card.id];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => callRequest({ action: 'list', card_id: card.id }) });
  const [creating, setCreating] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const list = data?.requests || [];
  const setStatus = async (id, action) => { try { await callRequest({ action, id }); refresh(); } catch (e) { toast({ title: e.message, variant: 'destructive' }); } };
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-1.5 text-label font-semibold"><ClipboardList className="h-4 w-4 text-primary" />고객 자료 요청</p>
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />자료 요청 보내기</Button>
      </div>
      <p className="text-caption text-muted-foreground">디자인 전달 자료·신제품 기획·인쇄 원고처럼 필요한 것을 목록으로 보내면, 고객이 포털에서 항목마다 파일이나 답을 올립니다. 올린 파일은 파일 탭에도 남습니다.</p>
      {!card.client_visible && <p className="rounded bg-warning/10 px-2 py-1 text-caption text-warning-text">카드가 고객 비공개입니다. 고객이 보려면 고객 공개를 켜야 합니다.</p>}
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : list.map((r) => (
        <div key={r.id} className="space-y-2 rounded-lg bg-secondary/60 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-label font-semibold">{r.title}</span>
            <span className="text-caption text-muted-foreground">확인 {r.progress.done}/{r.progress.total}{r.progress.submitted ? ` · 확인 필요 ${r.progress.submitted}` : ''}{r.due_date ? ` · 기한 ${r.due_date}` : ''}{r.status === 'CLOSED' ? ' · 마감' : ''}</span>
            <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={() => setStatus(r.id, r.status === 'CLOSED' ? 'reopen' : 'close')}>{r.status === 'CLOSED' ? '다시 열기' : '마감'}</Button>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${r.progress.total ? ((r.progress.done + r.progress.submitted * 0.5) / r.progress.total) * 100 : 0}%` }} /></div>
          <ul className="space-y-1.5">{r.items.map((x) => <ReviewItem key={x.key} req={r} item={x} onChanged={refresh} />)}</ul>
        </div>
      ))}
      {creating && <NewRequestDialog cardId={card.id} onClose={() => setCreating(false)} onDone={refresh} />}
    </section>
  );
}
