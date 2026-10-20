import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { useFactoryAccounts } from '@/components/factory/FactoryAccountPanel';
import { accountState } from '@/lib/factoryAccount';
import { CHECK_STATUS, FACTORY_CHECKS, FACTORY_CHECK_STATE, factoryCheckDone, factoryCheckStatus } from '@/lib/factoryCheck';

// 공장 확인 카드: 거래 공장이 진짜 제조사인지 확인한 항목. 전부 확인돼야 카드를 '생산 착수'로 넘길 수 있다.
export default function FactoryCheckPanel({ factory, user }) {
  const qc = useQueryClient();
  const [items, setItems] = useState(factory.verification_items || {});
  const [visited, setVisited] = useState(factory.verification_visited_at || '');
  useEffect(() => { setItems(factory.verification_items || {}); setVisited(factory.verification_visited_at || ''); }, [factory.id, factory.verification_updated_at]);
  const { data: accounts = [] } = useFactoryAccounts(factory.id);
  const { verified } = accountState(accounts);
  const status = factoryCheckStatus(items);
  const set = (key, patch) => setItems((x) => ({ ...x, [key]: { ...(x[key] || {}), ...patch } }));
  const dirty = JSON.stringify(items) !== JSON.stringify(factory.verification_items || {}) || visited !== (factory.verification_visited_at || '');
  const save = useMutation({
    mutationFn: () => base44.entities.Company.update(factory.id, {
      verification_items: items, verification_status: status, verification_visited_at: visited,
      verification_checked_by_name: user?.full_name || user?.email || '', verification_updated_at: new Date().toISOString(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['factory', factory.id] });
      qc.invalidateQueries({ queryKey: ['companies-factory'] });
      qc.invalidateQueries({ queryKey: ['card-factory'] });
      toast({ title: '공장 확인 카드를 저장했습니다', description: FACTORY_CHECK_STATE[status].label });
    },
    onError: (e) => toast({ title: '저장하지 못했습니다', description: e.message, variant: 'destructive' }),
  });
  const st = FACTORY_CHECK_STATE[status];

  return (
    <section className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <ClipboardCheck className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">공장 확인 카드</h3>
        <Badge className={`border-0 ${st.cls}`}>{st.label} · {factoryCheckDone(items)}/{FACTORY_CHECKS.length}</Badge>
      </div>
      <ul className="divide-y rounded-lg border">
        {FACTORY_CHECKS.map((c) => {
          const it = items[c.key] || {};
          return (
            <li key={c.key} className="space-y-1.5 p-2.5">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1"><p className="text-xs font-semibold">{c.label}</p><p className="text-[11px] text-muted-foreground">{c.hint}</p></div>
                <div className="flex shrink-0 gap-1" role="group" aria-label={`${c.label} 결과`}>
                  {Object.entries(CHECK_STATUS).map(([k, v]) => (
                    <button key={k} type="button" aria-pressed={it.status === k} onClick={() => set(c.key, { status: it.status === k ? '' : k })}
                      className={`rounded-md border px-2 py-1 text-[11px] ${it.status === k ? (k === 'NG' ? 'border-destructive bg-destructive/10 text-destructive' : 'border-primary bg-primary/10 text-primary') : 'text-muted-foreground'}`}>{v}</button>
                  ))}
                </div>
              </div>
              {(it.status || it.note) && <Input className="h-7 text-xs" placeholder={it.status === 'NG' ? '무엇이 문제인지 적어 주세요' : '확인 내용 (예: 통일사회신용코드 9144…, 사출기 280톤 6대)'} value={it.note || ''} onChange={(e) => set(c.key, { note: e.target.value })} />}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-2">방문일<Input type="date" className="h-8 w-40 text-xs" value={visited} onChange={(e) => setVisited(e.target.value)} /></label>
        <span className={verified ? (verified.name_matches_license === false ? 'text-destructive' : 'text-muted-foreground') : 'text-destructive'}>
          지급 계좌: {verified ? (verified.name_matches_license === false ? '예금주가 회사명과 다름' : '확인됨 · 예금주 일치') : '확인된 계좌 없음'}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">{factory.verification_updated_at ? `마지막 저장 ${new Date(factory.verification_updated_at).toLocaleDateString('ko-KR')} · ${factory.verification_checked_by_name || ''}` : '전부 확인돼야 이 공장 카드를 생산 착수로 넘길 수 있습니다.'}</p>
        <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>{save.isPending ? '저장 중…' : '저장'}</Button>
      </div>
    </section>
  );
}
