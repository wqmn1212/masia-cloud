import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Save, TrendingUp, DollarSign } from 'lucide-react';

const STATUS_META = {
  PENDING:           { label: '대기 중',         color: 'bg-muted text-muted-foreground' },
  KICKBACK_RECEIVED: { label: '커미션 수금',      color: 'bg-chart-3/15 text-chart-3' },
  SETTLED:           { label: '정산 완료',        color: 'bg-accent/15 text-accent' },
  PAID_OUT:          { label: '지급 완료',        color: 'bg-primary/15 text-primary' },
};

const emptyLedger = {
  project_date: new Date().toISOString().slice(0, 10),
  machine_description: '',
  incoterms: 'EXW',
  client_to_factory_usd: '',
  factory_base_cost_usd: '',
  actual_kickback_rmb: '',
  exchange_rate: '7.2',
  logistics_cost_usd: '',
  masir_fee_type: 'PERCENT',
  masir_fee_value: '',
  actual_margin_rmb: '',
  adjustment_rmb: '',
  adjustment_note: '',
  payout_date: '',
  note_1: '',
  status: 'PENDING',
};

export default function SettlementTab({ card, user }) {
  const [form, setForm] = useState(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: ledgers = [], isLoading } = useQuery({
    queryKey: ['ledger-by-card', card.id],
    queryFn: () => base44.entities.FinancialLedger.filter({ card_id: card.id }, '-project_date'),
  });

  const activeLedger = ledgers[0] || null;

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.FinancialLedger.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledger-by-card', card.id] });
      queryClient.invalidateQueries({ queryKey: ['financial-ledgers'] });
      toast({ title: '정산 원장 생성 완료 — 정산 대시보드에서도 확인하세요' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FinancialLedger.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledger-by-card', card.id] });
      queryClient.invalidateQueries({ queryKey: ['financial-ledgers'] });
      toast({ title: '정산 내역 저장 완료' });
    },
  });

  useEffect(() => {
    if (activeLedger && !form) {
      setForm({ ...activeLedger });
    }
  }, [activeLedger]);

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        🔒 정산 탭은 HQ 전용입니다
      </div>
    );
  }

  const startNew = () => {
    setForm({
      ...emptyLedger,
      factory_name: card.factory_name || '',
      client_name: card.client_name || '',
    });
  };

  const setF = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSave = () => {
    if (!form) return;
    const payload = {
      ...form,
      card_id: card.id,
      factory_name: form.factory_name || card.factory_name || '',
      client_name: form.client_name || card.client_name || '',
      client_to_factory_usd: Number(form.client_to_factory_usd) || 0,
      factory_base_cost_usd: Number(form.factory_base_cost_usd) || 0,
      actual_kickback_rmb: Number(form.actual_kickback_rmb) || 0,
      exchange_rate: Number(form.exchange_rate) || 7.2,
      logistics_cost_usd: Number(form.logistics_cost_usd) || 0,
      masir_fee_value: Number(form.masir_fee_value) || 0,
      actual_margin_rmb: Number(form.actual_margin_rmb) || 0,
      adjustment_rmb: Number(form.adjustment_rmb) || 0,
    };
    if (form.id) {
      updateMutation.mutate({ id: form.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // 자동 계산
  const expectedKickback = form
    ? ((Number(form.client_to_factory_usd) || 0) - (Number(form.factory_base_cost_usd) || 0)).toFixed(2)
    : '0.00';
  const hqShare = form
    ? ((Number(form.actual_margin_rmb) || 0) / 2 + (Number(form.adjustment_rmb) || 0)).toFixed(2)
    : '0.00';

  if (isLoading) return <div className="h-40 flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  if (!form) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <TrendingUp className="w-10 h-10 text-muted-foreground opacity-30" />
        <p className="text-sm text-muted-foreground">이 카드에 연결된 정산 원장이 없습니다</p>
        <p className="text-xs text-muted-foreground">생성 즉시 정산 대시보드와 동기화됩니다</p>
        <Button size="sm" className="gap-1.5 mt-1" onClick={startNew}>
          <Plus className="w-4 h-4" />정산 원장 생성
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold">정산 원장</p>
          {activeLedger && (
            <Select value={form.status} onValueChange={v => setF('status', v)}>
              <SelectTrigger className={`h-6 text-[10px] border-0 px-2 w-auto ${STATUS_META[form.status]?.color}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_META).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
          <Save className="w-3 h-3" />저장
        </Button>
      </div>

      {/* 요약 카드 */}
      {activeLedger && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-muted/30 rounded-lg p-2 text-center">
            <p className="text-[10px] text-muted-foreground">예상 마진</p>
            <p className="text-sm font-bold">${expectedKickback}</p>
          </div>
          <div className="bg-accent/10 rounded-lg p-2 text-center">
            <p className="text-[10px] text-muted-foreground">실제 마진 (RMB)</p>
            <p className="text-sm font-bold text-accent">¥{Number(form.actual_margin_rmb || 0).toLocaleString()}</p>
          </div>
          <div className="bg-primary/10 rounded-lg p-2 text-center">
            <p className="text-[10px] text-muted-foreground">HQ 몫 (RMB)</p>
            <p className="text-sm font-bold text-primary">¥{Number(hqShare).toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* STEP 1 */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Step 1 — 직접 송금</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">프로젝트 일자</Label>
            <Input type="date" value={form.project_date || ''} onChange={e => setF('project_date', e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-xs">인코텀즈</Label>
            <Select value={form.incoterms || 'EXW'} onValueChange={v => setF('incoterms', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['EXW', 'FOB_SHANGHAI', 'FOB_GUANGZHOU', 'CIF'].map(v => <SelectItem key={v} value={v}>{v.replace('_', ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">고객→공장 직송금 (USD)</Label>
            <Input type="number" value={form.client_to_factory_usd || ''} onChange={e => setF('client_to_factory_usd', e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-xs">공장 원가 (USD)</Label>
            <Input type="number" value={form.factory_base_cost_usd || ''} onChange={e => setF('factory_base_cost_usd', e.target.value)} className="h-8 text-xs" />
          </div>
        </div>
        <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/40 rounded-lg text-xs">
          <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">예상 마진:</span>
          <span className="font-bold">${expectedKickback}</span>
        </div>
      </div>

      {/* STEP 2 */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Step 2 — 커미션 수금</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">실제 커미션 수금 (RMB)</Label>
            <Input type="number" value={form.actual_kickback_rmb || ''} onChange={e => setF('actual_kickback_rmb', e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-xs">적용 환율 (USD/RMB)</Label>
            <Input type="number" value={form.exchange_rate || ''} onChange={e => setF('exchange_rate', e.target.value)} className="h-8 text-xs" />
          </div>
        </div>
        <div>
          <Label className="text-xs">물류/통관 비용 (USD)</Label>
          <Input type="number" value={form.logistics_cost_usd || ''} onChange={e => setF('logistics_cost_usd', e.target.value)} className="h-8 text-xs" />
        </div>
      </div>

      {/* STEP 3 */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Step 3 — HQ 정산</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">실제 마진 총합 (RMB)</Label>
            <Input type="number" value={form.actual_margin_rmb || ''} onChange={e => setF('actual_margin_rmb', e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-xs">조율 금액 (RMB, +/-)</Label>
            <Input type="number" value={form.adjustment_rmb || ''} onChange={e => setF('adjustment_rmb', e.target.value)} className="h-8 text-xs" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">정산 전달일</Label>
            <Input type="date" value={form.payout_date || ''} onChange={e => setF('payout_date', e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-xs">비고</Label>
            <Input value={form.note_1 || ''} onChange={e => setF('note_1', e.target.value)} className="h-8 text-xs" placeholder="비고" />
          </div>
        </div>
        {(form.actual_margin_rmb > 0) && (
          <div className="flex items-center gap-2 px-2 py-1.5 bg-primary/10 rounded-lg text-xs">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <span className="text-muted-foreground">HQ 최종 수령 (50% + 조율):</span>
            <span className="font-bold text-primary">¥{Number(hqShare).toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}