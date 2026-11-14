import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Archive, ArrowUpRight, Download, FileBox, Loader2, Search, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

// 설계 자료실: 문의·스케치 시안·도면 파일·금형 검토·STEP 부품표·회로·워크벤치·시제품 자료를 한곳에서 본다 (대표·팀 관리자)
const KINDS = [
  ['', '전체'],
  ['inquiry', '문의 첨부'],
  ['sketch', '스케치 시안'],
  ['upload', '도면 업로드'],
  ['card_file', '카드 도면 파일'],
  ['mold', '금형 검토'],
  ['bom', 'STEP 부품표'],
  ['circuit', '회로 시뮬레이터'],
  ['workbench', '개발 워크벤치'],
  ['proto_file', '시제품 설계 파일'],
  ['concept', '시제품 컨셉'],
];
const KIND_LABEL = Object.fromEntries(KINDS);
const KIND_TONE = {
  inquiry: 'bg-primary/10 text-primary', sketch: 'bg-primary/10 text-primary', upload: 'bg-warning/15 text-warning-text',
  card_file: 'bg-secondary text-foreground', mold: 'bg-secondary text-foreground', bom: 'bg-secondary text-foreground',
  circuit: 'bg-success/15 text-success-text', workbench: 'bg-success/15 text-success-text', proto_file: 'bg-success/15 text-success-text', concept: 'bg-success/15 text-success-text',
};
const fmtSize = (n) => (!n ? '' : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const fmtDate = (s) => (s ? new Date(s).toLocaleString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

export default function DesignArchive() {
  const { user } = useAuth();
  const isMaster = user?.account_tier === 'master';
  const [kind, setKind] = useState('');
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [tenant, setTenant] = useState('');
  const [opening, setOpening] = useState('');
  useEffect(() => { const t = setTimeout(() => setQ(text.trim()), 350); return () => clearTimeout(t); }, [text]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['designArchive', kind, q, tenant],
    queryFn: async () => (await base44.functions.invoke('designArchive', { action: 'list', kind, q, tenant_id: tenant })).data,
    keepPreviousData: true,
  });
  const items = data?.items || [];
  const counts = data?.counts || {};
  const tenantName = Object.fromEntries((data?.tenants || []).map((t) => [t.id, t.name]));

  const open = async (f) => {
    setOpening(f.ref);
    const win = window.open('', '_blank');
    try {
      const res = await base44.functions.invoke('designArchive', { action: 'sign', ref: f.ref, tenant_id: tenant });
      if (win) win.location.href = res.data.url; else window.location.href = res.data.url;
    } catch (e) {
      win?.close();
      toast({ title: '파일을 열지 못했습니다', description: e?.response?.data?.error || e.message, variant: 'destructive' });
    }
    setOpening('');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-primary"><Archive className="w-5 h-5" /><span className="text-label font-semibold">설계 자료실</span></div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">들어온 도면·시안·시뮬레이션을 한곳에서</h1>
          <p className="mt-1 text-caption text-muted-foreground">문의 첨부, 스케치 시안, 고객·팀원이 올린 도면, 금형 검토, STEP 부품표, 회로 시뮬레이터, 개발 워크벤치 자료가 모두 서버에 보관되고 여기에 모입니다. 파일은 비공개로 두고 열 때만 10분짜리 주소를 만듭니다.</p>
        </div>
        <div className="flex items-center gap-1.5 text-caption text-muted-foreground"><ShieldCheck className="w-4 h-4" />{isMaster ? '대표: 모든 팀 자료' : '팀 관리자: 우리 팀 자료'}</div>
      </div>

      <Card className="p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="제목·고객·파일 이름으로 찾기" className="pl-8" aria-label="자료 찾기" />
          </div>
          {isMaster && (
            <select value={tenant} onChange={(e) => setTenant(e.target.value)} className="h-9 max-w-[240px] rounded-md border bg-background px-2 text-label" aria-label="팀">
              <option value="">모든 팀</option>
              {(data?.tenants || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="자료 종류">
          {KINDS.map(([k, label]) => {
            const n = k ? counts[k] || 0 : data?.total || 0;
            if (k && !n && kind !== k) return null;
            return (
              <button key={k || 'all'} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}
                className={`rounded-full border px-3 py-1 text-caption transition-colors ${kind === k ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}>
                {label} <span className="tabular-nums opacity-80">{n}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <Card className="p-6 text-center text-body text-destructive">{error?.response?.data?.error || '자료를 불러오지 못했습니다.'}</Card>
      ) : !items.length ? (
        <Card className="p-10 text-center text-body text-muted-foreground">{q || kind ? '조건에 맞는 자료가 없습니다.' : '아직 보관된 설계 자료가 없습니다.'}</Card>
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <Card key={r.key} className="p-3">
              <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-micro font-semibold ${KIND_TONE[r.kind] || 'bg-secondary'}`}>{KIND_LABEL[r.kind] || r.kind}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-label font-semibold">{r.title}</p>
                  <p className="text-caption text-muted-foreground">
                    {[r.detail, r.who, isMaster && (r.tenant_name || tenantName[r.tenant_id]), fmtDate(r.at)].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {r.link && <Link to={r.link} className="inline-flex shrink-0 items-center gap-1 text-caption text-primary hover:underline">원래 화면<ArrowUpRight className="h-3.5 w-3.5" /></Link>}
              </div>
              {r.files?.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {r.files.map((f, i) => (
                    <li key={`${f.ref}-${i}`}>
                      <button type="button" onClick={() => open(f)} disabled={opening === f.ref}
                        className="inline-flex max-w-[320px] items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-caption hover:bg-muted disabled:opacity-60">
                        {opening === f.ref ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : /\.(step|stp|stl|igs|iges|dwg|dxf|glb|3mf|obj)$/i.test(f.name) ? <FileBox className="h-3.5 w-3.5 text-muted-foreground" /> : <Download className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className="truncate">{f.name}</span>
                        {f.size > 0 && <span className="shrink-0 text-micro text-muted-foreground">{fmtSize(f.size)}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
          {items.length >= 500 && <p className="text-center text-caption text-muted-foreground">최근 500건까지 보입니다. 종류·팀·검색어로 좁혀 보세요.</p>}
        </div>
      )}
    </div>
  );
}
