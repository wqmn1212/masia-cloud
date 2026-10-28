import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Archive, Download, FileSignature, FileText, FolderOpen, Loader2, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { withClientView } from '@/lib/clientView';
import { makeZip, safeName, uniquePaths } from '@/lib/zipStore';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/use-toast';
import DocumentOpenButton from '@/components/files/DocumentOpenButton';
import CompanyFilesLibrary from '@/components/files/CompanyFilesLibrary';
import ClientCardModal from '@/components/client/ClientCardModal';
import { CLIENT_STATUS_LABEL } from '@/components/client/clientBoardMeta';
import { DOCUMENT_TYPES, TRADE_DOCUMENT_GROUPS } from '@/components/files/documentTypes';
import { kstToday } from '@/components/client/clientFormat';

// 고객 서류함: 주문별로 공유된 서류(거래·결제, 품질·인증, 선적·통관, 위험물, 공장 확인 서류, 체결된 계약서)를 모아 보고,
// 여러 개를 골라 ZIP 하나로 내려받는다. 선적에 필요한데 아직 공유되지 않은 서류는 따로 알려 준다.
const MAX_ZIP_FILES = 100;
const contractKey = (k) => `contract:${k.request_id}`;
const day = (iso) => (iso ? new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(0, 10) : '');

function groupsOf(order) {
  const trade = TRADE_DOCUMENT_GROUPS.map((g) => ({ label: g.label, docs: order.documents.filter((d) => d.document_kind === 'attachment' && g.types.includes(d.document_type)) }));
  const used = new Set(TRADE_DOCUMENT_GROUPS.flatMap((g) => g.types));
  return [
    ...trade,
    { label: '공장 확인 서류', docs: order.documents.filter((d) => d.document_kind === 'factory') },
    { label: '기타 파일', docs: order.documents.filter((d) => d.document_kind === 'attachment' && !used.has(d.document_type)) },
  ].filter((g) => g.docs.length);
}

function DocRow({ doc, checked, onToggle }) {
  return (
    <li className="flex items-center gap-2 py-1.5">
      <Checkbox checked={checked} onCheckedChange={onToggle} aria-label={`${doc.file_name} 고르기`} />
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-label">{doc.file_name}</span>
      <Badge variant="secondary" className="hidden shrink-0 text-micro sm:inline-flex">{DOCUMENT_TYPES[doc.document_type] || '일반 파일'}</Badge>
      {doc.superseded && <Badge variant="outline" className="shrink-0 text-micro text-muted-foreground">이전 판</Badge>}
      <span className="hidden w-20 shrink-0 text-right text-caption tabular-nums text-muted-foreground sm:block">{day(doc.created_date)}</span>
      <DocumentOpenButton document={doc} />
    </li>
  );
}

function ContractRow({ k, checked, onToggle }) {
  return (
    <li className="flex items-center gap-2 py-1.5">
      <Checkbox checked={checked} onCheckedChange={onToggle} aria-label={`${k.document_title} 고르기`} />
      <FileSignature className="h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1 truncate text-label">{k.document_title}{k.document_no ? ` (${k.document_no})` : ''}</span>
      <Badge className="hidden shrink-0 border-0 bg-primary/10 text-micro text-primary sm:inline-flex">체결 완료본</Badge>
      <span className="hidden w-20 shrink-0 text-right text-caption tabular-nums text-muted-foreground sm:block">{day(k.completed_at)}</span>
    </li>
  );
}

export default function ClientDocuments() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['client-documents'],
    queryFn: async () => (await base44.functions.invoke('listClientDocuments', withClientView())).data,
  });
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('active');
  const [selected, setSelected] = useState(() => new Set());
  const [progress, setProgress] = useState(null);
  const [openCard, setOpenCard] = useState(null);

  const orders = useMemo(() => (data?.orders || [])
    .filter((o) => scope === 'all' || !['DONE', 'CANCELLED'].includes(o.status))
    .filter((o) => !query.trim() || o.title.toLowerCase().includes(query.trim().toLowerCase())), [data, scope, query]);
  const loose = data?.contracts || [];
  const toggle = (key) => setSelected((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const keysOf = (o) => [...o.documents.map((d) => d.id), ...o.contracts.map(contractKey)];
  const toggleOrder = (o, on) => setSelected((s) => { const n = new Set(s); keysOf(o).forEach((k) => (on ? n.add(k) : n.delete(k))); return n; });

  const download = async () => {
    const picks = [];
    for (const o of data?.orders || []) {
      for (const d of o.documents) if (selected.has(d.id)) picks.push({ type: 'file', order: o, doc: d });
      for (const k of o.contracts) if (selected.has(contractKey(k))) picks.push({ type: 'contract', folder: o.title, k });
    }
    for (const k of loose) if (selected.has(contractKey(k))) picks.push({ type: 'contract', folder: '계약서', k });
    if (!picks.length) return;
    if (picks.length > MAX_ZIP_FILES) { toast({ title: `한 번에 ${MAX_ZIP_FILES}개까지 묶을 수 있습니다`, variant: 'destructive' }); return; }
    setProgress({ done: 0, total: picks.length });
    try {
      const files = [];
      const urlsByCard = new Map();
      for (const p of picks) {
        let url;
        if (p.type === 'file') {
          // 카드별로 한 번만 5분짜리 링크를 받아 둔다
          if (!urlsByCard.has(p.order.id)) {
            const res = await base44.functions.invoke('getClientCardDetail', withClientView({ card_id: p.order.id, include_file_urls: true }));
            urlsByCard.set(p.order.id, new Map((res.data?.attachments || []).map((a) => [a.id, a.file_url])));
          }
          url = urlsByCard.get(p.order.id).get(p.doc.id);
        } else {
          url = (await base44.functions.invoke('getSignatureRequest', withClientView({ request_id: p.k.request_id, purpose: 'download' }))).data?.url;
        }
        if (!url) throw new Error(`${p.type === 'file' ? p.doc.file_name : p.k.document_title}: 파일 주소를 받지 못했습니다`);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${p.type === 'file' ? p.doc.file_name : p.k.document_title}: 내려받지 못했습니다 (${res.status})`);
        const data = new Uint8Array(await res.arrayBuffer());
        files.push(p.type === 'file'
          ? { name: `${safeName(p.order.title)}/${safeName(p.doc.file_name)}`, data, date: new Date(p.doc.created_date) }
          : { name: `${safeName(p.folder)}/${safeName(p.k.document_title)}${p.k.document_no ? ` (${safeName(p.k.document_no)})` : ''}.pdf`, data, date: new Date(p.k.completed_at) });
        setProgress({ done: files.length, total: picks.length });
      }
      const names = uniquePaths(files.map((f) => f.name));
      const blob = new Blob([makeZip(files.map((f, i) => ({ ...f, name: names[i] })))], { type: 'application/zip' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `서류_${kstToday()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      toast({ title: `${files.length}개 서류를 ZIP으로 내려받았습니다` });
    } catch (err) {
      toast({ title: 'ZIP을 만들지 못했습니다', description: err.message, variant: 'destructive' });
    } finally { setProgress(null); }
  };

  const count = selected.size;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><FolderOpen className="h-6 w-6 text-primary" />서류함</h1>
        <p className="mt-1 text-body text-muted-foreground">주문별로 공유된 서류를 모았습니다. 여러 개를 골라 ZIP 하나로 내려받을 수 있어 통관·회계 서류를 챙길 때 편합니다.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8 text-label" placeholder="주문 이름으로 찾기" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex rounded-lg border p-0.5" role="group" aria-label="보일 주문">
          <Button type="button" size="sm" variant={scope === 'active' ? 'secondary' : 'ghost'} className="h-7 px-2.5 text-label" aria-pressed={scope === 'active'} onClick={() => setScope('active')}>진행 중</Button>
          <Button type="button" size="sm" variant={scope === 'all' ? 'secondary' : 'ghost'} className="h-7 px-2.5 text-label" aria-pressed={scope === 'all'} onClick={() => setScope('all')}>전체</Button>
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        : isError ? <Card className="p-6"><p role="alert" className="text-label text-destructive">서류를 불러오지 못했습니다.</p><Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>다시 불러오기</Button></Card>
          : (
            <>
              {orders.length === 0 && <Card className="p-10 text-center text-label text-muted-foreground">{scope === 'active' ? '진행 중인 주문이 없습니다. "전체"를 눌러 끝난 주문의 서류를 볼 수 있습니다.' : '공개된 주문이 없습니다.'}</Card>}
              {orders.map((o) => {
                const groups = groupsOf(o);
                const keys = keysOf(o);
                const all = keys.length > 0 && keys.every((k) => selected.has(k));
                return (
                  <Card key={o.id} className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      {keys.length > 0 && <Checkbox checked={all} onCheckedChange={(v) => toggleOrder(o, !!v)} aria-label={`${o.title} 서류 모두 고르기`} />}
                      <h2 className="min-w-0 truncate text-body font-semibold">{o.title}</h2>
                      <Badge variant="outline" className="text-micro">{CLIENT_STATUS_LABEL[o.status] || o.status}</Badge>
                      <span className="text-caption text-muted-foreground">서류 {keys.length}개</span>
                      <Button type="button" variant="ghost" size="sm" className="ml-auto h-8 text-label" onClick={() => setOpenCard({ id: o.id, tab: 'quotation' })}>견적서 보기</Button>
                    </div>
                    {keys.length === 0 && o.missing.length === 0 && <p className="mt-3 text-label text-muted-foreground">아직 공유된 서류가 없습니다.</p>}
                    <div className="mt-2 space-y-3">
                      {o.contracts.length > 0 && (
                        <section>
                          <h3 className="text-caption font-semibold text-muted-foreground">계약서</h3>
                          <ul className="divide-y">{o.contracts.map((k) => <ContractRow key={k.request_id} k={k} checked={selected.has(contractKey(k))} onToggle={() => toggle(contractKey(k))} />)}</ul>
                        </section>
                      )}
                      {groups.map((g) => (
                        <section key={g.label}>
                          <h3 className="text-caption font-semibold text-muted-foreground">{g.label}</h3>
                          <ul className="divide-y">{g.docs.map((d) => <DocRow key={d.id} doc={d} checked={selected.has(d.id)} onToggle={() => toggle(d.id)} />)}</ul>
                        </section>
                      ))}
                      {o.missing.length > 0 && (
                        <section className="rounded-lg border border-dashed p-3">
                          <h3 className="text-caption font-semibold text-muted-foreground">아직 공유되지 않은 선적 서류</h3>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {o.missing.map((m) => <Badge key={`${m.shipment_id}-${m.key}`} variant="outline" className="text-micro font-normal text-muted-foreground">{m.label} · {m.shipment_label}</Badge>)}
                          </div>
                          <p className="mt-1.5 text-caption text-muted-foreground">담당자가 올리면 여기에 바로 표시됩니다. 급하면 카드의 문의 탭으로 요청해 주세요.</p>
                        </section>
                      )}
                    </div>
                  </Card>
                );
              })}
              {loose.length > 0 && (
                <Card className="p-5">
                  <h2 className="flex items-center gap-1.5 text-body font-semibold"><Archive className="h-4 w-4 text-primary" />월 계약 등 기타 계약서</h2>
                  <ul className="mt-2 divide-y">{loose.map((k) => <ContractRow key={k.request_id} k={k} checked={selected.has(contractKey(k))} onToggle={() => toggle(contractKey(k))} />)}</ul>
                </Card>
              )}
            </>
          )}

      <CompanyFilesLibrary onCardClick={(card) => setOpenCard({ id: card.id, tab: 'files' })} />

      {/* 고른 서류가 있으면 화면 아래에 붙는 내려받기 막대 */}
      {count > 0 && (
        <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-2 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
          <span className="text-label font-medium">{count}개 고름</span>
          <Button type="button" variant="ghost" size="sm" className="h-8 text-label" onClick={() => setSelected(new Set())} disabled={!!progress}>고르기 취소</Button>
          <Button type="button" size="sm" className="ml-auto h-9 gap-1.5" onClick={download} disabled={!!progress}>
            {progress ? <><Loader2 className="h-4 w-4 animate-spin" />내려받는 중 {progress.done}/{progress.total}</> : <><Download className="h-4 w-4" />ZIP으로 내려받기</>}
          </Button>
        </div>
      )}
      <ClientCardModal cardId={openCard?.id} initialTab={openCard?.tab} open={!!openCard} onClose={() => setOpenCard(null)} onOpenCard={(id) => setOpenCard({ id })} />
    </div>
  );
}
