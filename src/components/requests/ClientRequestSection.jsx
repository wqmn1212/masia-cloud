import React, { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Loader2, Paperclip, Send, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { MAX_FILES, mergeFiles, toAttachmentPayload } from '@/lib/clientFileUpload';
import { STATUS, ItemFiles, callRequest } from './ClientRequestPanel';

const CLIENT_STATUS = { ...STATUS, SUBMITTED: ['보냄 · 담당자 확인 중', 'bg-primary/10 text-primary'] };

function Item({ req, item, canAct, onDone }) {
  const [answer, setAnswer] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(['WAITING', 'REDO'].includes(item.status));
  const input = useRef(null);
  const [label, tone] = CLIENT_STATUS[item.status] || CLIENT_STATUS.WAITING;
  const add = (list) => { const r = mergeFiles(files, list); if (r.rejected.length) toast({ title: `일부 파일 제외 (최대 ${MAX_FILES}개 · 10MB)`, description: r.rejected.join(', '), variant: 'destructive' }); setFiles(r.files); };
  const send = async () => {
    setBusy(true);
    try {
      await callRequest({ action: 'submit', id: req.id, key: item.key, answer, attachments: await toAttachmentPayload(files) });
      toast({ title: `“${item.label}”을 보냈습니다`, description: '담당자가 확인하면 표시가 바뀝니다' });
      setAnswer(''); setFiles([]); setOpen(false); onDone();
    } catch (e) { toast({ title: '보내지 못했습니다', description: e.message, variant: 'destructive' }); }
    setBusy(false);
  };
  const editable = canAct && req.status === 'OPEN' && item.status !== 'ACCEPTED';
  return (
    <li className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-label font-semibold">{item.label}{item.required && <span className="text-destructive"> *</span>}</span>
        <span className={`rounded px-1.5 py-0.5 text-micro font-semibold ${tone}`}>{label}</span>
        {editable && !open && <button type="button" className="ml-auto text-caption text-primary" onClick={() => setOpen(true)}>더 보내기</button>}
      </div>
      {item.hint && <p className="text-caption text-muted-foreground">{item.hint}</p>}
      {item.status === 'REDO' && item.staff_note && <p className="rounded bg-destructive/10 px-2 py-1 text-caption text-destructive">담당자: {item.staff_note}</p>}
      {item.answer && <p className="whitespace-pre-wrap text-caption">{item.answer}</p>}
      <ItemFiles reqId={req.id} item={item} clientView />
      {editable && open && (
        <div className="space-y-2">
          <Textarea aria-label={`${item.label} 답`} rows={2} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={item.kind === 'file' ? '설명이나 파일 공유 링크 (선택)' : '여기에 적어 주세요'} className="text-body" />
          {item.kind === 'file' && (
            <div className="flex flex-wrap items-center gap-1.5">
              <input ref={input} type="file" multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
              <Button size="sm" variant="outline" onClick={() => input.current?.click()}><Paperclip className="h-4 w-4" />파일 고르기</Button>
              {files.map((f, i) => <span key={i} className="flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-caption">{f.name}<button type="button" aria-label={`${f.name} 빼기`} onClick={() => setFiles(files.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button></span>)}
            </div>
          )}
          <Button size="sm" onClick={send} disabled={busy || (!answer.trim() && !files.length)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}보내기</Button>
        </div>
      )}
    </li>
  );
}

// 고객: 진행 정보 탭 맨 위 "요청드린 자료"
export default function ClientRequestSection({ cardId, requests }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canAct = user?.account_tier === 'client';
  const list = (requests || []).filter((r) => r.status === 'OPEN' || r.progress.done < r.progress.total);
  if (!list.length) return null;
  const refresh = () => qc.invalidateQueries({ queryKey: ['client-requests-portal', cardId] });
  return (
    <section className="mb-4 space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4" aria-label="요청드린 자료">
      {list.map((r) => (
        <div key={r.id} className="space-y-2">
          <p className="flex flex-wrap items-center gap-2 text-label font-semibold"><ClipboardList className="h-4 w-4 text-primary" />요청드린 자료 · {r.title}<span className="text-caption font-normal text-muted-foreground">{r.progress.done + r.progress.submitted}/{r.progress.total} 보냄{r.due_date ? ` · ${r.due_date}까지` : ''}</span></p>
          {r.note && <p className="text-caption text-muted-foreground">{r.note}</p>}
          <ul className="space-y-2">{r.items.map((x) => <Item key={x.key} req={r} item={x} canAct={canAct} onDone={refresh} />)}</ul>
        </div>
      ))}
      <p className="text-micro text-muted-foreground">파일은 하나에 10MB 까지, 한 번에 {MAX_FILES}개까지 올릴 수 있습니다. 더 큰 3D 파일은 공유 링크를 적어 주세요.</p>
    </section>
  );
}
