import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Landmark, Plus, ShieldAlert } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { VERIFY_METHODS, accountState } from '@/lib/factoryAccount';

const EMPTY = { beneficiary_name: '', bank_name: '', account_no: '', swift_code: '', bank_address: '', currency: 'CNY', change_reason: '' };
const fmtAt = (iso) => (iso ? new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '');
const errorOf = (e) => e?.response?.data?.error || e?.message;

export function useFactoryAccounts(factoryId) {
  return useQuery({
    queryKey: ['factory-accounts', factoryId],
    queryFn: () => base44.entities.FactoryAccount.filter({ factory_id: factoryId }, '-created_date', 50),
    enabled: !!factoryId,
  });
}

function AccountLines({ a }) {
  return (
    <dl className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-xs">
      <dt className="text-muted-foreground">예금주</dt><dd className="break-all font-medium">{a.beneficiary_name}</dd>
      <dt className="text-muted-foreground">은행</dt><dd className="break-all">{a.bank_name}</dd>
      <dt className="text-muted-foreground">계좌</dt><dd className="break-all font-mono">{a.account_no} <span className="font-sans text-muted-foreground">({a.currency || 'CNY'})</span></dd>
      {a.swift_code && <><dt className="text-muted-foreground">SWIFT</dt><dd className="font-mono">{a.swift_code}</dd></>}
      {a.bank_address && <><dt className="text-muted-foreground">은행 주소</dt><dd className="break-all">{a.bank_address}</dd></>}
    </dl>
  );
}

function ProposeDialog({ factory, open, onClose, isChange }) {
  const qc = useQueryClient();
  const [f, setF] = useState(EMPTY);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = useMutation({
    mutationFn: () => base44.functions.invoke('manageFactoryAccount', { action: 'propose', factory_id: factory.id, ...f }),
    onSuccess: () => {
      toast({ title: isChange ? '계좌 변경을 요청했습니다' : '계좌 등록을 요청했습니다', description: '마스터가 공장에 직접 확인해야 확인된 계좌가 됩니다.' });
      qc.invalidateQueries({ queryKey: ['factory-accounts'] });
      setF(EMPTY);
      onClose();
    },
    onError: (e) => toast({ title: '요청하지 못했습니다', description: errorOf(e), variant: 'destructive' }),
  });
  const field = (k, label, props = {}) => <label className="space-y-1 text-xs"><span>{label}</span><Input className="h-9" value={f[k]} onChange={set(k)} {...props} /></label>;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="text-base">{factory.company_name} · {isChange ? '지급 계좌 변경 요청' : '지급 계좌 등록 요청'}</DialogTitle></DialogHeader>
        {isChange && <p className="flex gap-1.5 rounded-md bg-destructive/10 p-2 text-xs text-destructive"><ShieldAlert className="h-4 w-4 shrink-0" />계좌 변경은 송금 사기에서 가장 흔한 수법입니다. 메신저·이메일로 받은 변경 요청이라면, 공장 대표 번호로 직접 전화해 확인해 주세요. 요청하면 이 공장에 직접 송금하는 고객에게 '확인 전 송금 중지' 알림이 갑니다.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {field('beneficiary_name', '예금주 (법인명) *', { className: 'h-9 sm:col-span-2' })}
          {field('bank_name', '은행·지점 *')}
          {field('account_no', '계좌 번호 *')}
          {field('swift_code', 'SWIFT (해외 송금 시)')}
          <label className="space-y-1 text-xs"><span>받는 통화</span>
            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={f.currency} onChange={set('currency')}>
              <option value="CNY">CNY (위안)</option><option value="USD">USD (달러)</option><option value="KRW">KRW (원)</option>
            </select>
          </label>
          <div className="sm:col-span-2">{field('bank_address', '은행 주소')}</div>
          <label className="space-y-1 text-xs sm:col-span-2"><span>{isChange ? '변경 사유 *' : '메모'}</span><Textarea rows={2} value={f.change_reason} onChange={set('change_reason')} placeholder={isChange ? '예: 공장 재무 담당자가 위챗으로 은행 변경을 알림' : ''} /></label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button disabled={save.isPending || !f.beneficiary_name.trim() || !f.bank_name.trim() || !f.account_no.trim() || (isChange && !f.change_reason.trim())} onClick={() => save.mutate()}>{save.isPending ? '요청 중…' : '확인 요청'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VerifyBox({ account, canVerify }) {
  const qc = useQueryClient();
  const [method, setMethod] = useState('');
  const [matches, setMatches] = useState(null);
  const [note, setNote] = useState('');
  const act = useMutation({
    mutationFn: (action) => base44.functions.invoke('manageFactoryAccount', { action, account_id: account.id, verify_method: method, name_matches_license: matches, verify_note: note }),
    onSuccess: (_r, action) => { toast({ title: action === 'verify' ? '확인된 계좌로 지정했습니다' : '요청을 거절했습니다' }); qc.invalidateQueries({ queryKey: ['factory-accounts'] }); },
    onError: (e) => toast({ title: '처리하지 못했습니다', description: errorOf(e), variant: 'destructive' }),
  });
  return (
    <div className="space-y-2 rounded-lg border border-chart-3/40 bg-chart-3/5 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-chart-3"><AlertTriangle className="h-3.5 w-3.5" />확인 대기 · {account.proposed_by_name} {fmtAt(account.proposed_at)}</p>
      <AccountLines a={account} />
      {account.change_reason && <p className="text-xs text-muted-foreground">사유: {account.change_reason}</p>}
      {canVerify ? (
        <div className="space-y-2 border-t pt-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-xs"><span>확인 방법 *</span>
              <select className="h-8 w-full rounded-md border bg-background px-2 text-xs" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="">선택</option>{Object.entries(VERIFY_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <fieldset className="space-y-1 text-xs"><legend>예금주 = 사업자등록증 회사명? *</legend>
              <div className="flex gap-3 pt-1">
                <label className="flex items-center gap-1"><input type="radio" name={`m-${account.id}`} checked={matches === true} onChange={() => setMatches(true)} />같음</label>
                <label className="flex items-center gap-1"><input type="radio" name={`m-${account.id}`} checked={matches === false} onChange={() => setMatches(false)} />다름</label>
              </div>
            </fieldset>
          </div>
          {matches === false && <p className="text-xs text-destructive">예금주가 거래 법인과 다르면 개인·제3자 계좌일 수 있습니다. 공장 대표에게 이유를 확인하고 메모에 남겨 주세요.</p>}
          <Textarea rows={1} className="text-xs" placeholder="확인 메모 (예: 공장 대표 번호로 통화, 재무 담당 왕 씨 확인)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => act.mutate('reject')}>거절</Button>
            <Button size="sm" disabled={act.isPending || !method || matches === null || (matches === false && !note.trim())} onClick={() => act.mutate('verify')}>확인된 계좌로 지정</Button>
          </div>
        </div>
      ) : <p className="text-[11px] text-muted-foreground">마스터가 공장에 직접 확인하면 확인된 계좌가 됩니다. 그 전에는 이 계좌로 송금하지 마세요.</p>}
    </div>
  );
}

// 공장 지급 계좌 잠금: 확인된 계좌 1개 + 확인 대기 요청. 등록·변경은 요청, 확인은 마스터만.
export default function FactoryAccountPanel({ factory, user }) {
  const { data: rows = [], isLoading } = useFactoryAccounts(factory.id);
  const [open, setOpen] = useState(false);
  const { verified, pending } = accountState(rows);
  const history = rows.filter((r) => ['RETIRED', 'REJECTED'].includes(r.status)).slice(0, 5);
  const canVerify = user?.account_tier === 'master';
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Landmark className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">지급 계좌</h3>
        {!isLoading && (verified ? <Badge className="border-0 bg-primary/10 text-primary">확인됨</Badge> : <Badge className="border-0 bg-destructive/10 text-destructive">확인된 계좌 없음</Badge>)}
        <Button size="sm" variant="outline" className="ml-auto h-7 gap-1 text-xs" onClick={() => setOpen(true)}><Plus className="h-3 w-3" />{verified ? '변경 요청' : '등록 요청'}</Button>
      </div>
      {verified && (
        <div className="space-y-1.5 rounded-lg bg-muted/40 p-3">
          <AccountLines a={verified} />
          <p className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground"><CheckCircle2 className="h-3 w-3 text-primary" />{VERIFY_METHODS[verified.verify_method]} · {verified.verified_by_name} · {fmtAt(verified.verified_at)}{verified.verify_note ? ` · ${verified.verify_note}` : ''}</p>
          {verified.name_matches_license === false && <p className="text-[11px] text-destructive">⚠ 예금주가 사업자등록증 회사명과 다릅니다</p>}
        </div>
      )}
      {pending.map((p) => <VerifyBox key={p.id} account={p} canVerify={canVerify} />)}
      {!isLoading && !verified && !pending.length && <p className="text-xs text-muted-foreground">공장 대금은 확인된 계좌로만 보내야 합니다. 공장에서 받은 계좌를 등록 요청하면 마스터가 공장에 직접 확인합니다.</p>}
      {!!history.length && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">지난 계좌·거절 내역 {history.length}건</summary>
          <ul className="mt-2 space-y-1.5">
            {history.map((h) => <li key={h.id} className="rounded-md border p-2"><span className="mr-1 font-semibold">{h.status === 'RETIRED' ? '이전 계좌' : '거절'}</span>{h.bank_name} · {h.account_no} · {h.beneficiary_name}{h.verify_note ? ` · ${h.verify_note}` : ''}</li>)}
          </ul>
        </details>
      )}
      <ProposeDialog factory={factory} open={open} onClose={() => setOpen(false)} isChange={!!verified} />
    </section>
  );
}
