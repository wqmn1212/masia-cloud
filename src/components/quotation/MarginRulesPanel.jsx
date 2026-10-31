import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Percent, Plus, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { INQUIRY_CATEGORIES } from '@/lib/inquiryForm';

// 견적 마진 규칙 (대표·팀 관리자·마스터): 팀 기본 기준·최소 마진과 고객사·카테고리별 규칙.
// 고객사 → 카테고리(카드 문의 카테고리) → 팀 기본 → 앱 기본(15%·10%) 순으로 칸마다 적용한다.
// 기준 마진은 공장 견적 초안·견적 작성에 미리 채우고, 최소 마진보다 낮으면 승인 때 주의로 보인다. 저장·정리는 서버(quoteApproval)가 한다.
const sel = 'h-8 rounded-md border bg-background px-2 text-xs';
const blank = () => ({ scope: 'CLIENT', client_id: '', client_name: '', category: INQUIRY_CATEGORIES[0], default_pct: '', min_pct: '', note: '' });
const v = (n) => (n == null ? '' : String(n));

export default function MarginRulesPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const tenantId = user?.tenant_id;
  const allowed = ['master', 'service'].includes(user?.account_tier) && !!tenantId;
  const { data: setting, isLoading } = useQuery({
    queryKey: ['operation-setting', tenantId],
    enabled: allowed,
    queryFn: async () => (await base44.entities.OperationSetting.filter({ tenant_id: tenantId }, '-updated_date', 1))[0] || null,
  });
  const { data: clients = [] } = useQuery({ queryKey: ['client-companies'], enabled: allowed, queryFn: () => base44.entities.Company.filter({ company_type: 'CLIENT' }, 'company_name') });
  const [base, setBase] = useState({ d: '', m: '' });
  const [rules, setRules] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setBase({ d: v(setting?.margin_default_pct), m: v(setting?.margin_min_pct) });
    setRules((setting?.margin_rules || []).map((r) => ({ ...r, default_pct: v(r.default_pct), min_pct: v(r.min_pct) })));
  }, [setting]);
  if (!allowed || isLoading) return null;

  const update = (i, patch) => setRules((list) => list.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  const save = async () => {
    setBusy(true);
    try {
      const { data } = await base44.functions.invoke('quoteApproval', { action: 'save_margin_rules', margin_default_pct: base.d, margin_min_pct: base.m, margin_rules: rules });
      qc.invalidateQueries({ queryKey: ['operation-setting', tenantId] });
      qc.invalidateQueries({ queryKey: ['margin-rule'] });
      toast({ title: '마진 규칙을 저장했습니다', description: `규칙 ${data?.margin_rules?.length ?? 0}개 (숫자가 빈 줄은 뺐습니다)` });
    } catch (err) {
      toast({ title: '저장하지 못했습니다', description: err?.response?.data?.error || err.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Percent className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <h2 className="text-body font-semibold">견적 마진 규칙</h2>
          <p className="mt-0.5 text-label text-muted-foreground">기준 마진은 공장 견적 초안과 견적 작성에 미리 채워지고, 최소 마진보다 낮은 견적은 승인할 때 주의로 표시됩니다. 고객사 규칙 → 카테고리 규칙 → 팀 기본 순으로 적용합니다.</p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-label">팀 기준 마진 (%)<Input className="mt-1 h-8 text-xs" type="number" min="0" step="0.5" value={base.d} onChange={(e) => setBase((b) => ({ ...b, d: e.target.value }))} placeholder="비우면 15" /></label>
        <label className="text-label">팀 최소 마진 (%)<Input className="mt-1 h-8 text-xs" type="number" min="0" step="0.5" value={base.m} onChange={(e) => setBase((b) => ({ ...b, m: e.target.value }))} placeholder="비우면 10" /></label>
      </div>
      <div className="space-y-1.5">
        <p className="text-label font-medium">고객사·카테고리별 규칙</p>
        {rules.length === 0 && <p className="text-caption text-muted-foreground">규칙이 없습니다. 특정 고객사나 품목군만 마진을 다르게 잡을 때 추가하세요.</p>}
        {rules.length > 0 && <div className="hidden gap-1.5 px-2 text-caption text-muted-foreground sm:grid sm:grid-cols-[96px_1fr_80px_80px_1fr_32px]"><span>범위</span><span>대상</span><span>기준 %</span><span>최소 %</span><span>메모</span><span /></div>}
        {rules.map((r, i) => (
          <div key={i} className="grid grid-cols-2 gap-1.5 rounded-lg bg-muted/30 p-2 sm:grid-cols-[96px_1fr_80px_80px_1fr_32px] sm:items-center">
            <select className={sel} value={r.scope} aria-label="범위" onChange={(e) => update(i, { scope: e.target.value })}><option value="CLIENT">고객사</option><option value="CATEGORY">카테고리</option></select>
            {r.scope === 'CLIENT'
              ? <select className={sel} value={r.client_id} aria-label="고객사" onChange={(e) => update(i, { client_id: e.target.value, client_name: clients.find((c) => c.id === e.target.value)?.company_name || '' })}><option value="">고객사 선택</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}</select>
              : <select className={sel} value={r.category} aria-label="카테고리" onChange={(e) => update(i, { category: e.target.value })}>{INQUIRY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>}
            <Input className="h-8 text-xs" type="number" min="0" step="0.5" value={r.default_pct} onChange={(e) => update(i, { default_pct: e.target.value })} placeholder="기준 %" aria-label="기준 마진" />
            <Input className="h-8 text-xs" type="number" min="0" step="0.5" value={r.min_pct} onChange={(e) => update(i, { min_pct: e.target.value })} placeholder="최소 %" aria-label="최소 마진" />
            <Input className="h-8 text-xs" value={r.note || ''} maxLength={200} onChange={(e) => update(i, { note: e.target.value })} placeholder="메모 (예: 연간 계약 고객)" />
            <button type="button" className="justify-self-end text-muted-foreground hover:text-destructive" aria-label="규칙 삭제" onClick={() => setRules((list) => list.filter((_, n) => n !== i))}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => setRules((list) => [...list, blank()])}><Plus className="h-3.5 w-3.5" />규칙 추가</Button>
      </div>
      <div className="flex items-center justify-end gap-2 border-t pt-3">
        {setting?.updated_by && <span className="mr-auto text-caption text-muted-foreground">최근 수정 {setting.updated_by}</span>}
        <Button size="sm" className="h-8" disabled={busy} onClick={save}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}저장</Button>
      </div>
    </Card>
  );
}
