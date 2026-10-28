import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Landmark, Loader2, Pencil, Plus, ShieldAlert } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';

// 이지스 받는 계좌: 결제 요청에 붙는 계좌. 계좌 사기를 막기 위해 마스터만 등록·변경하고(PayeeAccount 쓰기 권한도 마스터만),
// 대표·팀 관리자는 보기만 한다. 고객은 결제 요청이 있을 때 서버 함수로만 본다.
const CURRENCIES = ['USD', 'CNY', 'KRW'];
const EMPTY = { label: '', currency: 'USD', bank_name: '', account_holder: '', account_no: '', swift_code: '', bank_address: '', note: '', active: true };
const FIELDS = [
  ['label', '표시 이름', '예: 이지스 USD 계좌'], ['bank_name', '은행', ''], ['account_holder', '예금주', ''], ['account_no', '계좌 번호', ''],
  ['swift_code', 'SWIFT (해외 송금)', ''], ['bank_address', '은행 주소 (해외 송금)', ''], ['note', '고객 안내', '예: 송금 메모에 프로젝트명을 적어 주세요'],
];

export function usePayeeAccounts(tenantId, enabled = true) {
  return useQuery({
    queryKey: ['payee-accounts', tenantId],
    enabled: !!tenantId && enabled,
    queryFn: async () => (await base44.entities.PayeeAccount.filter({ tenant_id: tenantId }, '-created_date', 50)).filter((a) => a.tenant_id === tenantId),
  });
}

function AccountDialog({ account, tenantId, user, onClose }) {
  const qc = useQueryClient();
  const [f, setF] = useState(() => ({ ...EMPTY, ...(account || {}) }));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const data = { ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, typeof f[k] === 'string' ? f[k].trim() : f[k]])), updated_by_name: user.full_name || user.email || '' };
      if (account?.id) await base44.entities.PayeeAccount.update(account.id, data);
      else await base44.entities.PayeeAccount.create({ ...data, tenant_id: tenantId });
      qc.invalidateQueries({ queryKey: ['payee-accounts', tenantId] });
      toast({ title: account?.id ? '받는 계좌를 바꿨습니다' : '받는 계좌를 등록했습니다' });
      onClose();
    } catch (err) {
      toast({ title: '저장하지 못했습니다', description: err.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{account?.id ? '받는 계좌 바꾸기' : '받는 계좌 등록'}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={save}>
          {account?.id && (
            <p className="flex gap-1.5 rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-label text-warning-text">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />이미 보낸 결제 요청에도 바뀐 계좌가 보입니다. 바꾸기 전에 고객에게 먼저 알리세요.
            </p>
          )}
          <label className="block text-label">받는 통화
            <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-label" value={f.currency} onChange={set('currency')} disabled={busy}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          {FIELDS.map(([k, label, ph]) => (
            <label key={k} className="block text-label">{label}
              <Input className="mt-1 text-label" value={f[k]} onChange={set(k)} placeholder={ph} disabled={busy} required={['bank_name', 'account_holder', 'account_no'].includes(k)} maxLength={k === 'note' ? 200 : 120} />
            </label>
          ))}
          <label className="flex items-center justify-between gap-3 rounded-lg border p-2.5 text-label">
            <span>새 결제 요청에 쓰기<span className="block text-caption text-muted-foreground">끄면 새 요청에서 고를 수 없고, 이 계좌로 보낸 요청은 고객 화면에서 계좌가 가려집니다.</span></span>
            <Switch checked={f.active !== false} onCheckedChange={(v) => setF((x) => ({ ...x, active: v }))} disabled={busy} />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>닫기</Button>
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}저장</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function PayeeAccountsPanel({ user }) {
  const isMaster = user?.account_tier === 'master';
  const tenantId = user?.tenant_id;
  const { data: rows = [], isLoading, isError } = usePayeeAccounts(tenantId);
  const [editing, setEditing] = useState(null);
  return (
    <Card id="payee-accounts" className="scroll-mt-20 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Landmark className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <h2 className="text-body font-semibold">이지스 받는 계좌</h2>
          <p className="mt-0.5 text-label text-muted-foreground">결제 요청을 보낼 때 고르는 계좌입니다. 계좌 사기를 막기 위해 마스터 계정만 등록·변경할 수 있고, 고객은 포털 결제 탭에서만 봅니다.</p>
        </div>
        {isMaster && <Button size="sm" variant="outline" className="h-8 gap-1 text-label" onClick={() => setEditing({})}><Plus className="h-3.5 w-3.5" />계좌 등록</Button>}
      </div>
      <div className="mt-3">
        {isLoading ? <p className="flex items-center gap-2 py-3 text-label text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />불러오는 중…</p>
          : isError ? <p className="py-3 text-label text-destructive">계좌를 불러오지 못했습니다.</p>
            : !rows.length ? <p className="py-3 text-label text-muted-foreground">등록된 계좌가 없습니다.{isMaster ? ' 결제 요청을 보내려면 먼저 계좌를 등록하세요.' : ' 마스터 계정에 등록을 요청하세요.'}</p>
              : (
                <ul className="divide-y">
                  {rows.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-body font-medium">{a.label || a.bank_name}<Badge variant="outline" className="text-micro">{a.currency}</Badge>{a.active === false && <Badge variant="secondary" className="text-micro">쓰지 않음</Badge>}</div>
                        <p className="mt-0.5 text-label text-muted-foreground">{[a.bank_name, a.account_holder, a.account_no].filter(Boolean).join(' · ')}{a.updated_by_name ? ` · 마지막 수정 ${a.updated_by_name}` : ''}</p>
                      </div>
                      {isMaster && <Button size="sm" variant="ghost" className="h-8 gap-1 text-label" onClick={() => setEditing(a)}><Pencil className="h-3.5 w-3.5" />바꾸기</Button>}
                    </li>
                  ))}
                </ul>
              )}
      </div>
      {editing && <AccountDialog account={editing.id ? editing : null} tenantId={tenantId} user={user} onClose={() => setEditing(null)} />}
    </Card>
  );
}
