import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, CalendarClock, ClipboardPaste, Loader2, Plus, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import ProspectDialog from '@/components/sales/ProspectDialog';
import { ACTIVE, stageOf, followUpState, kstToday, parseProspects, outreachCount, SOURCES } from '@/lib/salesPipeline';

const keyOf = ['sales-prospects'];

function FollowBadge({ p, today }) {
  const f = followUpState(p, today);
  if (!f) return p.next_follow_up && ACTIVE.includes(p.stage) ? <span className="text-micro text-muted-foreground">다음 연락 {p.next_follow_up.slice(5).replace('-', '/')}</span> : null;
  return f.late
    ? <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-micro font-semibold text-destructive">연락 {f.days}일 밀림</span>
    : <span className="rounded-full bg-primary/10 px-2 py-0.5 text-micro font-semibold text-primary">오늘 연락</span>;
}

function ProspectCard({ p, today, onOpen }) {
  return (
    <button type="button" onClick={() => onOpen(p.id)} className="w-full space-y-1 rounded-lg border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/50">
      <p className="truncate text-label font-semibold">{p.company}</p>
      <p className="truncate text-caption text-muted-foreground">{[p.contact_name, p.product_idea || p.industry].filter(Boolean).join(' · ') || '—'}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <FollowBadge p={p} today={today} />
        {outreachCount(p) > 0 && <span className="text-micro text-muted-foreground">연락 {outreachCount(p)}회</span>}
        {p.owner_name && <span className="ml-auto text-micro text-muted-foreground">{p.owner_name}</span>}
      </div>
    </button>
  );
}

// 영업 파이프라인: 콜드메일·소개·전시회로 찾은 잠재 고객을 단계별로 관리하고, 다음 연락일을 놓치지 않게 한다
export default function SalesPipeline() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = kstToday();
  const [openId, setOpenId] = useState(() => new URLSearchParams(window.location.search).get('p'));
  const [creating, setCreating] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [paste, setPaste] = useState('');
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [mine, setMine] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const { data: rows = [], isLoading } = useQuery({ queryKey: keyOf, queryFn: () => base44.entities.SalesProspect.list('-updated_date', 1000) });
  const me = user?.full_name || user?.email || '';
  const list = useMemo(() => rows.filter((p) => (!mine || p.owner_name === me) && (!q || `${p.company} ${p.contact_name || ''} ${p.email || ''} ${p.product_idea || ''} ${p.industry || ''}`.toLowerCase().includes(q.toLowerCase()))), [rows, mine, me, q]);
  const due = list.filter((p) => followUpState(p, today)).sort((a, b) => String(a.next_follow_up).localeCompare(String(b.next_follow_up)));
  const count = (k) => list.filter((p) => p.stage === k).length;
  const open = rows.find((p) => p.id === openId) || null;
  const refresh = () => qc.invalidateQueries({ queryKey: keyOf });

  const importRows = async () => {
    const items = parseProspects(paste);
    if (!items.length) { toast({ title: '회사명이 있는 줄을 찾지 못했습니다', description: '첫 줄에 회사·담당자·이메일 같은 머리글을 두거나, 회사명부터 차례로 붙여 넣으세요' }); return; }
    const known = new Set(rows.map((p) => (p.email || '').toLowerCase()).filter(Boolean));
    const fresh = items.filter((o) => !o.email || !known.has(o.email.toLowerCase()));
    setBusy(true);
    try {
      for (const o of fresh) await base44.entities.SalesProspect.create({ tenant_id: user.tenant_id, stage: 'TARGET', source: 'cold_email', owner_name: me, owner_email: user.email || '', next_follow_up: today, touches: [], created_by_name: me, ...o });
      toast({ title: `영업 대상 ${fresh.length}곳을 추가했습니다`, description: items.length > fresh.length ? `이미 있는 이메일 ${items.length - fresh.length}곳은 건너뛰었습니다` : '오늘 연락할 곳에 올라갑니다' });
      setPaste(''); setPasting(false); refresh();
    } catch (e) { toast({ title: `추가하지 못했습니다: ${e.message || e}`, variant: 'destructive' }); }
    setBusy(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Briefcase className="h-6 w-6 text-primary" />영업 파이프라인</h1>
          <p className="mt-1 text-body text-muted-foreground">콜드메일·소개·전시회로 찾은 곳을 단계별로 관리합니다. 다음 연락일이 되면 아침 요약과 이 화면 맨 위에 올라옵니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setPasting(true)}><ClipboardPaste className="h-4 w-4" />엑셀 목록 붙여넣기</Button>
          <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />영업 대상 추가</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input aria-label="찾기" value={q} onChange={(e) => setQ(e.target.value)} placeholder="회사·담당자·제품 찾기" className="h-9 w-64 pl-8" /></div>
        <label className="flex items-center gap-1.5 text-label"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />내 담당만</label>
        <span className="ml-auto text-caption text-muted-foreground">진행 {list.filter((p) => ACTIVE.includes(p.stage)).length}곳 · 수주 {count('WON')} · 보류 {count('LOST')}</span>
      </div>

      {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
        <>
          {due.length > 0 && (
            <section className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4" aria-label="오늘 연락할 곳">
              <p className="flex items-center gap-1.5 text-label font-semibold"><CalendarClock className="h-4 w-4 text-primary" />오늘 연락할 곳 {due.length}곳</p>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{due.map((p) => (
                <li key={p.id}><button type="button" onClick={() => setOpenId(p.id)} className="flex w-full items-center gap-2 rounded-lg bg-card px-3 py-2 text-left text-caption shadow-sm hover:bg-muted">
                  <span className={`rounded px-1.5 py-0.5 text-micro font-semibold ${stageOf(p.stage).tone}`}>{stageOf(p.stage).label}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{p.company}</span>
                  <FollowBadge p={p} today={today} />
                </button></li>
              ))}</ul>
            </section>
          )}

          <div className="grid gap-3 overflow-x-auto pb-2" style={{ gridTemplateColumns: `repeat(${ACTIVE.length}, minmax(220px, 1fr))` }}>
            {ACTIVE.map((k) => {
              const s = stageOf(k);
              const items = list.filter((p) => p.stage === k);
              return (
                <section key={k} className="min-w-0 space-y-2 rounded-xl bg-muted/50 p-2.5" aria-label={s.label}>
                  <p className="flex items-center gap-1.5 px-1 text-label font-semibold">{s.label}<span className="text-caption font-normal text-muted-foreground">{items.length}</span></p>
                  <p className="px-1 text-micro text-muted-foreground">{s.hint}</p>
                  <div className="space-y-2">{items.map((p) => <ProspectCard key={p.id} p={p} today={today} onOpen={setOpenId} />)}</div>
                </section>
              );
            })}
          </div>

          <div>
            <button type="button" className="text-caption text-primary" onClick={() => setShowClosed((v) => !v)}>{showClosed ? '수주·보류 숨기기' : `수주 ${count('WON')} · 보류 ${count('LOST')} 보기`}</button>
            {showClosed && (
              <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{list.filter((p) => ['WON', 'LOST'].includes(p.stage)).map((p) => (
                <li key={p.id}><button type="button" onClick={() => setOpenId(p.id)} className="flex w-full items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left text-caption hover:bg-muted">
                  <span className={`rounded px-1.5 py-0.5 text-micro font-semibold ${stageOf(p.stage).tone}`}>{stageOf(p.stage).label}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{p.company}</span>
                  <span className="truncate text-muted-foreground">{p.stage === 'LOST' ? p.lost_reason : SOURCES[p.source] || ''}</span>
                </button></li>
              ))}</ul>
            )}
          </div>
        </>
      )}

      {(open || creating) && <ProspectDialog prospect={creating ? null : open} user={user} onClose={() => { setOpenId(null); setCreating(false); }} onSaved={refresh} />}

      <Dialog open={pasting} onOpenChange={(o) => !o && setPasting(false)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle className="text-title">엑셀 목록 붙여넣기</DialogTitle></DialogHeader>
          <p className="text-caption text-muted-foreground">엑셀에서 표를 복사해 붙여 넣으세요. 첫 줄 머리글(회사, 담당자, 직함, 이메일, 전화, 업종, 제품, 메모)로 칸을 맞춥니다. 머리글이 없으면 회사·담당자·이메일·전화·업종·제품 순으로 읽습니다. 이미 있는 이메일은 건너뜁니다.</p>
          <Textarea aria-label="붙여 넣을 목록" rows={8} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'회사\t담당자\t이메일\t업종\n무니스\t길상현\tkil@example.com\t조명'} className="font-mono text-caption" />
          <p className="text-caption">{parseProspects(paste).length}곳을 읽었습니다</p>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setPasting(false)}>취소</Button><Button onClick={importRows} disabled={busy || !paste.trim()}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}추가</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
