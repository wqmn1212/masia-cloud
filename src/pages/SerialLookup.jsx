import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Loader2, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// 시리얼 조회: 고객 AS·클레임 문의가 오면 시리얼 하나로 검사 결과·파레트·출하 이력을 바로 찾는다.
const STATUS = {
  READY: ['출하 대기', 'bg-primary/10 text-primary'],
  SHIPPED: ['출하됨', 'bg-success/15 text-success-text'],
  FAILED: ['불량', 'bg-destructive/10 text-destructive'],
  REWORK: ['수리 중', 'bg-warning/15 text-warning-text'],
  SCRAPPED: ['폐기', 'bg-muted text-muted-foreground'],
  INCOMPLETE: ['미검사 항목', 'bg-warning/15 text-warning-text'],
  PENDING: ['생산 전', 'bg-muted text-muted-foreground'],
  VOID: ['스티커 불량', 'bg-muted text-muted-foreground'],
};
// 성적서 항목 결과는 'pass' | 'fail' | '' (빈칸 = 미검사)
const resultClass = (v) => (v === 'pass' ? 'text-success-text' : v === 'fail' ? 'text-destructive' : 'text-muted-foreground');
const resultText = (v) => (v === 'pass' ? '합격' : v === 'fail' ? '불합격' : '미검사');

export default function SerialLookup() {
  const [q, setQ] = useState('');
  const [state, setState] = useState({ busy: false, results: null, error: '' });
  const search = async (e) => {
    e?.preventDefault();
    setState({ busy: true, results: null, error: '' });
    try {
      const { data } = await base44.functions.invoke('productionUnits', { action: 'search', q });
      setState({ busy: false, results: data.results || [], error: '' });
    } catch (err) {
      setState({ busy: false, results: null, error: err?.response?.data?.error || err?.message || '찾지 못했습니다' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">시리얼 조회</h1>
        <p className="mt-1 text-body text-muted-foreground">제품 시리얼로 검사 결과·파레트·출하 이력을 찾습니다. 끝자리 숫자만 넣어도 됩니다. 시리얼은 카드의 '양산' 탭에서 검사 성적서를 올리면 등록됩니다.</p>
      </div>
      <form onSubmit={search} className="flex max-w-lg gap-2">
        <div className="relative flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input autoFocus className="h-9 pl-8 font-mono" value={q} placeholder="예: MHAFS1AA3982 또는 3982" onChange={(e) => setQ(e.target.value)} /></div>
        <Button type="submit" disabled={state.busy || q.trim().length < 4}>{state.busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}찾기</Button>
      </form>
      {state.error && <p className="text-body text-destructive">{state.error}</p>}
      {state.results && !state.results.length && <p className="text-body text-muted-foreground">등록된 시리얼이 없습니다. 성적서에 없는 번호(스티커 불량 등)는 등록되지 않습니다.</p>}
      <div className="space-y-4">
        {state.results?.map((u) => (
          <section key={`${u.card_id}-${u.serial}`} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-title font-semibold">{u.serial}</span>
              <span className={`rounded-md px-2 py-0.5 text-micro font-semibold ${STATUS[u.status]?.[1] || ''}`}>{STATUS[u.status]?.[0] || u.status}</span>
              <Button asChild size="sm" variant="ghost" className="ml-auto gap-1"><Link to={`/task-board?card=${u.card_id}&tab=production`}>{u.card_title || '카드'}<ArrowUpRight className="h-3.5 w-3.5" /></Link></Button>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-label sm:grid-cols-4">
              {[['고객사', u.client_name], ['LOT', u.lot], ['검사일', u.inspected_date], ['검사자', u.inspector], ['파레트', u.pallet], ['박스', u.box], ['출하일', u.shipped_date], ['출하', u.shipment_label]].map(([k, v]) => (
                <div key={k}><dt className="text-caption text-muted-foreground">{k}</dt><dd className="font-medium">{v || '-'}</dd></div>
              ))}
            </dl>
            {(() => {
              const checks = Object.entries(u.checks || {});
              if (!checks.length) return null;
              if (checks.every(([, v]) => v === 'pass')) return <p className="mt-3 text-caption text-success-text">검사 {checks.length}개 항목 모두 합격</p>;
              return (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {checks.map(([k, v]) => <span key={k} className="rounded-md border px-2 py-0.5 text-caption">{k} <b className={resultClass(v)}>{resultText(v)}</b></span>)}
                </div>
              );
            })()}
            {(u.failed_items?.length > 0 || u.fail_note) && <p className="mt-2 text-caption text-destructive">{[u.failed_items?.join(' · '), u.fail_note].filter(Boolean).join(' — ')}</p>}
            {!!u.history?.length && (
              <ol className="mt-3 space-y-0.5 border-t pt-2 text-caption text-muted-foreground">
                {u.history.slice().reverse().map((h, i) => <li key={i}>{h.at ? new Date(h.at).toLocaleString('ko-KR') : ''} · {h.action}{h.note ? ` · ${h.note}` : ''} · {h.by}</li>)}
              </ol>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
