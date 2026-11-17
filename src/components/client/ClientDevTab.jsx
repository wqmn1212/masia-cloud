import React, { Suspense, lazy, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Box, Check, FileText, GitPullRequest, Loader2, MessageSquare, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';

const ClientSimView = lazy(() => import('./ClientSimView'));
const DOC_LABEL = { nameplate: '명판·라벨 문구', manual: '사용설명서 초안' };
const DOC_HINT = { nameplate: '제품 바닥·뒷면에 인쇄하거나 새길 문구입니다. 회사명·모델명·표기를 확인해 주세요.', manual: '제품과 함께 들어갈 사용설명서 초안입니다. 문구·주의사항을 확인해 주세요.' };
const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '');
const errText = (e) => e?.response?.data?.error || e?.message || String(e);

export const devQueryKey = (cardId) => ['client-proto', cardId];

/** 결정 버튼 두 개 + 메모. 부정 결정은 메모가 있어야 보낸다 */
function Decide({ yes, no, noNeeds, onSend, disabled }) {
  const [mode, setMode] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async (decision) => { setBusy(true); const ok = await onSend(decision, note.trim()); setBusy(false); if (ok) { setMode(null); setNote(''); } };
  if (disabled) return <p className="text-caption text-muted-foreground">미리보기에서는 결정할 수 없습니다.</p>;
  return (
    <div className="space-y-2">
      {mode === 'no' && <Textarea aria-label={noNeeds} value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder={noNeeds} className="text-body" />}
      {mode === 'yes' && <Textarea aria-label="남길 말 (선택)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="남길 말 (선택)" className="text-body" />}
      <div className="flex flex-wrap gap-2">
        {mode !== 'no' && <Button size="sm" onClick={() => (mode === 'yes' ? send('yes') : setMode('yes'))} disabled={busy}>{busy && mode === 'yes' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{mode === 'yes' ? `${yes} 보내기` : yes}</Button>}
        {mode !== 'yes' && <Button size="sm" variant="outline" onClick={() => (mode === 'no' ? send('no') : setMode('no'))} disabled={busy || (mode === 'no' && !note.trim())}>{busy && mode === 'no' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}{mode === 'no' ? `${no} 보내기` : no}</Button>}
        {mode && <Button size="sm" variant="ghost" onClick={() => { setMode(null); setNote(''); }} disabled={busy}>취소</Button>}
      </div>
    </div>
  );
}

const Status = ({ ok, children }) => <span className={`rounded-full px-2 py-0.5 text-caption font-medium ${ok === true ? 'bg-success/15 text-success-text' : ok === false ? 'bg-destructive/10 text-destructive' : 'bg-warning/15 text-warning-text'}`}>{children}</span>;

// 고객 카드 "개발" 탭: 설계 변경 승인, 명판·설명서 확인, 3D·동작 시뮬레이션 보기와 위치 의견
export default function ClientDevTab({ cardId, projects }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canAct = user?.account_tier === 'client';
  const [simFor, setSimFor] = useState(null);
  const act = async (body, ok) => {
    try {
      const res = await base44.functions.invoke('protoClient', body);
      if (res.data?.error) throw new Error(res.data.error);
      qc.setQueryData(devQueryKey(cardId), (d) => (d ? { ...d, projects: d.projects.map((p) => (p.id === res.data.project.id ? res.data.project : p)) } : d));
      toast({ title: ok });
      return res.data.project;
    } catch (e) { toast({ title: '보내지 못했습니다', description: errText(e), variant: 'destructive' }); return null; }
  };
  const sim = projects.find((p) => p.id === simFor);

  return (
    <div className="space-y-6">
      {projects.map((p) => (
        <section key={p.id} className="space-y-4" aria-label={p.title}>
          <div>
            <h3 className="text-title font-semibold">{p.title}</h3>
            <p className="text-caption text-muted-foreground">개발 중인 시제품입니다. 확인이 필요한 것은 아래에서 승인하거나 의견을 남겨 주세요.</p>
          </div>

          {p.ecos.length > 0 && (
            <div className="space-y-3">
              <p className="flex items-center gap-1.5 text-label font-semibold"><GitPullRequest className="h-4 w-4 text-primary" />설계 변경 승인</p>
              {[...p.ecos].reverse().map((e) => (
                <div key={e.no} className="space-y-2 rounded-xl border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-label font-semibold">{e.no}</span>
                    <span className="text-caption text-muted-foreground">요청 {fmt(e.at)}</span>
                    <span className="ml-auto">{e.decision ? <Status ok={e.decision.decision === 'APPROVED'}>{e.decision.decision === 'APPROVED' ? '승인함' : '반려함'} · {e.decision.by} · {fmt(e.decision.at)}</Status> : <Status>승인 필요</Status>}</span>
                  </div>
                  <p className="text-body"><span className="text-muted-foreground">변경 이유 </span>{e.reason}</p>
                  {e.changes.length > 0 && (
                    <div className="rounded-lg bg-secondary px-3 py-2">
                      <p className="text-caption font-semibold">바뀌는 내용</p>
                      <ul className="mt-1 space-y-0.5 text-caption">{e.changes.map((c, i) => <li key={i}><span className="text-muted-foreground">[{c.area}]</span> {c.text}</li>)}</ul>
                    </div>
                  )}
                  {e.impact.length > 0 && <p className="text-caption text-muted-foreground">이 변경으로 다시 하는 일: {e.impact.join(' · ')}</p>}
                  {e.decision?.note && <p className="text-caption">남긴 말: {e.decision.note}</p>}
                  {!e.decision && <Decide yes="이 변경 승인" no="반려" noNeeds="반려 이유를 적어 주세요" disabled={!canAct}
                    onSend={(d, note) => act({ action: 'eco_decide', project_id: p.id, no: e.no, decision: d === 'yes' ? 'APPROVED' : 'REJECTED', note }, d === 'yes' ? `${e.no} 변경을 승인했습니다` : `${e.no} 변경을 반려했습니다`)} />}
                </div>
              ))}
            </div>
          )}

          {Object.entries(p.docs).map(([k, d]) => {
            const mine = d.decisions.find((x) => x.version === d.version);
            return (
              <div key={k} className="space-y-2 rounded-xl border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="flex items-center gap-1.5 text-label font-semibold"><FileText className="h-4 w-4 text-primary" />{DOC_LABEL[k]} <span className="font-normal text-muted-foreground">v{d.version}</span></p>
                  <span className="ml-auto">{mine ? <Status ok={mine.decision === 'APPROVED'}>{mine.decision === 'APPROVED' ? '승인함' : '수정 요청함'} · {fmt(mine.at)}</Status> : <Status>확인 필요</Status>}</span>
                </div>
                <p className="text-caption text-muted-foreground">{DOC_HINT[k]}</p>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-secondary px-3 py-2 font-sans text-body">{d.text.replace(/^```\n?|```$/gm, '')}</pre>
                {d.decisions.length > 0 && <ul className="space-y-0.5 text-caption text-muted-foreground">{[...d.decisions].reverse().map((x, i) => <li key={i}>v{x.version} {x.decision === 'APPROVED' ? '승인' : '수정 요청'} · {x.by} · {fmt(x.at)}{x.note ? ` — ${x.note}` : ''}</li>)}</ul>}
                {!mine && <Decide yes="이대로 승인" no="수정 요청" noNeeds="고칠 내용을 적어 주세요 (예: 제조자에 회사명 영문 표기 추가)" disabled={!canAct}
                  onSend={(dd, note) => act({ action: 'doc_decide', project_id: p.id, doc: k, version: d.version, decision: dd === 'yes' ? 'APPROVED' : 'CHANGES', note }, dd === 'yes' ? `${DOC_LABEL[k]}을 승인했습니다` : '수정 요청을 보냈습니다')} />}
              </div>
            );
          })}

          {p.model && (
            <div className="space-y-2 rounded-xl border p-4">
              <p className="flex items-center gap-1.5 text-label font-semibold"><Box className="h-4 w-4 text-primary" />3D·동작 시뮬레이션 <span className="font-normal text-caption text-muted-foreground">{fmt(p.model.at)} 설계 기준</span></p>
              <p className="text-caption text-muted-foreground">3D 를 돌려 보고 버튼·조명·앱 값을 직접 눌러 볼 수 있습니다. 고칠 곳은 그 자리를 눌러 의견을 남겨 주세요. 시뮬레이션에서 바꾼 값은 저장되지 않습니다.</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => setSimFor(p.id)}><Box className="h-4 w-4" />3D·시뮬레이션 열기</Button>
                {p.comments.length > 0 && <span className="flex items-center gap-1 text-caption text-muted-foreground"><MessageSquare className="h-3.5 w-3.5" />의견 {p.comments.length}건 (처리됨 {p.comments.filter((c) => c.resolved).length})</span>}
              </div>
            </div>
          )}
        </section>
      ))}

      <Dialog open={!!sim} onOpenChange={(o) => !o && setSimFor(null)}>
        <DialogContent className="max-w-6xl w-[96vw] max-h-[94vh] overflow-y-auto grid-cols-[minmax(0,1fr)]">
          <DialogHeader><DialogTitle className="text-title pr-6">{sim?.title} · 3D·동작 시뮬레이션</DialogTitle></DialogHeader>
          {sim && (
            <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
              <ClientSimView project={sim} canComment={canAct} onComment={(c) => act({ action: 'comment', project_id: sim.id, ...c }, '의견을 남겼습니다. 담당자가 확인합니다')} />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
