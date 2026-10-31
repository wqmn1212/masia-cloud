import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox, Loader2, Plus, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { INQUIRY_CATEGORIES } from '@/lib/inquiryForm';

// 새 문의 배정 규칙 (대표·팀 관리자·마스터): 고객사 → 카테고리 → 팀 기본 담당자 순으로 책임자를 자동 배정하고,
// 견적 기한(영업일)과 급한 문의 기준(희망 입고일까지 남은 일수)을 정한다. 읽기·저장·검증은 서버(inquiryIntake)가 한다.
const sel = 'h-8 rounded-md border bg-background px-2 text-xs';
const blank = () => ({ scope: 'CATEGORY', client_id: '', client_name: '', category: INQUIRY_CATEGORIES[0], owner_id: '' });

export default function IntakeRulesPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const allowed = ['master', 'service'].includes(user?.account_tier) && !!user?.tenant_id;
  const { data, isLoading } = useQuery({ queryKey: ['intake-rules'], enabled: allowed, queryFn: async () => (await base44.functions.invoke('inquiryIntake', { action: 'get' })).data });
  const { data: clients = [] } = useQuery({ queryKey: ['client-companies'], enabled: allowed, queryFn: () => base44.entities.Company.filter({ company_type: 'CLIENT' }, 'company_name') });
  const [form, setForm] = useState({ owner: '', sla: '', rush: '' });
  const [rules, setRules] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!data) return;
    setForm({ owner: data.intake_default_owner_id || '', sla: data.quote_sla_days ?? '', rush: data.quote_rush_window_days ?? '' });
    setRules(data.intake_rules || []);
  }, [data]);
  if (!allowed || isLoading || !data) return null;
  const team = data.team || [];
  const update = (i, patch) => setRules((list) => list.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  const save = async () => {
    setBusy(true);
    try {
      const { data: saved } = await base44.functions.invoke('inquiryIntake', { action: 'save', intake_default_owner_id: form.owner, quote_sla_days: form.sla, quote_rush_window_days: form.rush, intake_rules: rules });
      qc.invalidateQueries({ queryKey: ['intake-rules'] });
      qc.invalidateQueries({ queryKey: ['admin-inbox', 'unassigned'] });
      toast({ title: '배정 규칙을 저장했습니다', description: `규칙 ${saved?.intake_rules?.length ?? 0}개 (담당자가 빈 줄은 뺐습니다)` });
    } catch (err) {
      toast({ title: '저장하지 못했습니다', description: err?.response?.data?.error || err.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Inbox className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <h2 className="text-body font-semibold">새 문의 배정 규칙</h2>
          <p className="mt-0.5 text-label text-muted-foreground">고객 포털·홈페이지로 문의가 들어오면 고객사 규칙 → 카테고리 규칙 → 팀 기본 담당자 순으로 책임자를 정하고 견적 기한을 넣습니다. 맞는 사람이 없으면 팀 관리자에게 '배정 필요'로 알립니다.</p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-label">팀 기본 담당자
          <select className={`${sel} mt-1 w-full`} value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}><option value="">없음 (배정 필요로 알림)</option>{team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        </label>
        <label className="text-label">견적 기한 (영업일)<Input className="mt-1 h-8 text-xs" type="number" min="1" max="30" value={form.sla} onChange={(e) => setForm((f) => ({ ...f, sla: e.target.value }))} placeholder={`비우면 ${data.base?.sla_days ?? 3}`} /></label>
        <label className="text-label">급한 문의 (희망 입고일까지 일수)<Input className="mt-1 h-8 text-xs" type="number" min="0" max="365" value={form.rush} onChange={(e) => setForm((f) => ({ ...f, rush: e.target.value }))} placeholder={`비우면 ${data.base?.rush_window_days ?? 30} · 0이면 끔`} /></label>
      </div>
      <p className="text-caption text-muted-foreground">급한 문의는 견적 기한이 다음 영업일이 되고 우선순위가 '높음'으로 올라갑니다.</p>
      <div className="space-y-1.5">
        <p className="text-label font-medium">고객사·카테고리별 담당자</p>
        {rules.length === 0 && <p className="text-caption text-muted-foreground">규칙이 없습니다. 고객사나 품목군마다 담당자가 정해져 있으면 추가하세요.</p>}
        {rules.length > 0 && <div className="hidden gap-1.5 px-2 text-caption text-muted-foreground sm:grid sm:grid-cols-[96px_1fr_1fr_32px]"><span>범위</span><span>대상</span><span>담당자</span><span /></div>}
        {rules.map((r, i) => (
          <div key={i} className="grid grid-cols-2 gap-1.5 rounded-lg bg-muted/30 p-2 sm:grid-cols-[96px_1fr_1fr_32px] sm:items-center">
            <select className={sel} value={r.scope} aria-label="범위" onChange={(e) => update(i, { scope: e.target.value })}><option value="CLIENT">고객사</option><option value="CATEGORY">카테고리</option></select>
            {r.scope === 'CLIENT'
              ? <select className={sel} value={r.client_id} aria-label="고객사" onChange={(e) => update(i, { client_id: e.target.value, client_name: clients.find((c) => c.id === e.target.value)?.company_name || '' })}><option value="">고객사 선택</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}</select>
              : <select className={sel} value={r.category} aria-label="카테고리" onChange={(e) => update(i, { category: e.target.value })}>{INQUIRY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>}
            <select className={sel} value={r.owner_id} aria-label="담당자" onChange={(e) => update(i, { owner_id: e.target.value })}><option value="">담당자 선택</option>{team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            <button type="button" className="justify-self-end text-muted-foreground hover:text-destructive" aria-label="규칙 삭제" onClick={() => setRules((list) => list.filter((_, n) => n !== i))}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => setRules((list) => [...list, blank()])}><Plus className="h-3.5 w-3.5" />규칙 추가</Button>
      </div>
      <div className="flex justify-end border-t pt-3">
        <Button size="sm" className="h-8" disabled={busy} onClick={save}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}저장</Button>
      </div>
    </Card>
  );
}
