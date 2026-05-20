import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { Plus, ChevronRight, Edit2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import Step1DirectPayment from '@/components/settlement/Step1DirectPayment';
import Step2KickbackInput from '@/components/settlement/Step2KickbackInput';
import Step3HQShare from '@/components/settlement/Step3HQShare';
import LedgerSummaryCards from '@/components/settlement/LedgerSummaryCards';

const BASE_ACTIVITY_FEE = 50000;

const STATUS_MAP = {
  PENDING: { label: '대기', className: 'bg-muted text-muted-foreground' },
  KICKBACK_RECEIVED: { label: '수금완료', className: 'bg-chart-3/15 text-chart-3' },
  SETTLED: { label: '정산완료', className: 'bg-accent/15 text-accent' },
  PAID_OUT: { label: '지급완료', className: 'bg-primary/15 text-primary' },
};

const emptyForm = {
  project_date: new Date().toISOString().slice(0, 10),
  factory_name: '', client_name: '', machine_description: '',
  incoterms: 'EXW',
  client_to_factory_usd: 0, factory_base_cost_usd: 0, expected_kickback_usd: 0,
  actual_kickback_rmb: 0, exchange_rate: 7.2, logistics_cost_usd: 0,
  masir_fee_type: 'PERCENT', masir_fee_value: 0,
  actual_margin_rmb: 0, hq_final_share_rmb: 0,
  adjustment_rmb: 0, adjustment_note: '',
  payout_date: '', note_1: '', note_2: '',
  status: 'PENDING',
};

export default function Settlement() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: ledgers = [] } = useQuery({
    queryKey: ['ledgers'],
    queryFn: () => base44.entities.FinancialLedger.list('-project_date', 100),
  });

  const { data: factories = [] } = useQuery({
    queryKey: ['factories'],
    queryFn: () => base44.entities.Company.filter({ company_type: 'FACTORY' }),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Company.filter({ company_type: 'CLIENT' }),
  });

  // Recalculate derived fields whenever inputs change
  const computedForm = React.useMemo(() => {
    const expectedKickback = (Number(form.client_to_factory_usd) || 0) - (Number(form.factory_base_cost_usd) || 0);
    const actualMargin = Number(form.actual_kickback_rmb) || 0;
    const adjustment = Number(form.adjustment_rmb) || 0;
    const netMargin = actualMargin - BASE_ACTIVITY_FEE + adjustment;
    const hqShare = netMargin / 2;
    return {
      ...form,
      expected_kickback_usd: expectedKickback,
      actual_margin_rmb: actualMargin,
      hq_final_share_rmb: hqShare,
    };
  }, [form]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.FinancialLedger.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledgers'] });
      setCreateOpen(false);
      setForm(emptyForm);
      toast({ title: '정산 원장 등록 완료' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FinancialLedger.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledgers'] });
      setEditItem(null);
      toast({ title: '정산 원장 업데이트 완료' });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data: computedForm });
    } else {
      createMutation.mutate(computedForm);
    }
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({ ...emptyForm, ...item });
    setCreateOpen(true);
  };

  // Totals for summary cards
  const totalMarginPool = ledgers.reduce((s, l) => s + (Number(l.actual_kickback_rmb) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">정산 대시보드</h1>
          <p className="text-sm text-muted-foreground mt-1">페이백 기반 3단계 수익 정산 원장</p>
        </div>
        <Button onClick={() => { setEditItem(null); setForm(emptyForm); setCreateOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />신규 정산 등록
        </Button>
      </div>

      <LedgerSummaryCards ledgers={ledgers} />

      {/* Monthly pool banner */}
      {totalMarginPool > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">전체 총 마진 풀</p>
                <p className="text-2xl font-extrabold font-mono text-primary">
                  ¥{totalMarginPool.toLocaleString(undefined, { minimumFractionDigits: 2 })} RMB
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">에이전트 고정비 차감</p>
                  <p className="font-mono font-bold text-destructive">− ¥50,000</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">순 마진</p>
                  <p className="font-mono font-bold">¥{Math.max(0, totalMarginPool - BASE_ACTIVITY_FEE).toLocaleString()}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                <div className="text-center p-2 rounded-lg bg-primary text-primary-foreground">
                  <p className="text-[10px]">본사 수령 (50%)</p>
                  <p className="font-mono font-extrabold">¥{Math.max(0, (totalMarginPool - BASE_ACTIVITY_FEE) / 2).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ledger Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">정산 원장</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium text-xs">날짜</th>
                  <th className="text-left p-3 font-medium text-xs">공장 → 고객사</th>
                  <th className="text-right p-3 font-medium text-xs">직송금 (USD)</th>
                  <th className="text-right p-3 font-medium text-xs">원가 (USD)</th>
                  <th className="text-right p-3 font-medium text-xs text-orange-600">예상마진 (USD)</th>
                  <th className="text-right p-3 font-medium text-xs text-accent">실수금 (RMB)</th>
                  <th className="text-right p-3 font-medium text-xs text-primary">본사몫 (RMB)</th>
                  <th className="text-center p-3 font-medium text-xs">상태</th>
                  <th className="p-3 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {ledgers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-muted-foreground">
                      등록된 정산 원장이 없습니다
                    </td>
                  </tr>
                ) : (
                  ledgers.map((l) => {
                    const st = STATUS_MAP[l.status] || STATUS_MAP.PENDING;
                    return (
                      <tr key={l.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{l.project_date}</td>
                        <td className="p-3">
                          <p className="font-medium text-xs truncate max-w-[160px]">{l.factory_name}</p>
                          <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">{l.client_name}</p>
                        </td>
                        <td className="p-3 text-right font-mono text-xs">
                          ${(Number(l.client_to_factory_usd) || 0).toLocaleString()}
                        </td>
                        <td className="p-3 text-right font-mono text-xs">
                          ${(Number(l.factory_base_cost_usd) || 0).toLocaleString()}
                        </td>
                        <td className="p-3 text-right font-mono text-xs font-bold text-orange-600">
                          ${(Number(l.expected_kickback_usd) || 0).toLocaleString()}
                        </td>
                        <td className="p-3 text-right font-mono text-xs font-bold text-accent">
                          ¥{(Number(l.actual_kickback_rmb) || 0).toLocaleString()}
                        </td>
                        <td className="p-3 text-right font-mono text-xs font-bold text-primary">
                          ¥{(Number(l.hq_final_share_rmb) || 0).toLocaleString()}
                        </td>
                        <td className="p-3 text-center">
                          <Badge className={`${st.className} border-0 text-[10px]`}>{st.label}</Badge>
                        </td>
                        <td className="p-3">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(l)}>
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setEditItem(null); }}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? '정산 원장 수정' : '신규 정산 등록'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Header info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">프로젝트 날짜 *</Label>
                <Input type="date" value={form.project_date} onChange={(e) => setForm(p => ({ ...p, project_date: e.target.value }))} required />
              </div>
              <div>
                <Label className="text-xs">공장 선택</Label>
                <Select value={form.factory_name} onValueChange={(v) => setForm(p => ({ ...p, factory_name: v }))}>
                  <SelectTrigger><SelectValue placeholder="공장 선택" /></SelectTrigger>
                  <SelectContent>
                    {factories.map(f => <SelectItem key={f.id} value={f.company_name}>{f.company_name}</SelectItem>)}
                    <SelectItem value="__custom">직접 입력</SelectItem>
                  </SelectContent>
                </Select>
                {(!form.factory_name || form.factory_name === '__custom') && (
                  <Input className="mt-1 text-xs h-8" placeholder="공장명 직접 입력" value={form.factory_name === '__custom' ? '' : form.factory_name} onChange={(e) => setForm(p => ({ ...p, factory_name: e.target.value }))} />
                )}
              </div>
              <div>
                <Label className="text-xs">고객사 선택</Label>
                <Select value={form.client_name} onValueChange={(v) => setForm(p => ({ ...p, client_name: v }))}>
                  <SelectTrigger><SelectValue placeholder="고객사 선택" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.company_name}>{c.company_name}</SelectItem>)}
                    <SelectItem value="__custom">직접 입력</SelectItem>
                  </SelectContent>
                </Select>
                {(!form.client_name || form.client_name === '__custom') && (
                  <Input className="mt-1 text-xs h-8" placeholder="고객사명 직접 입력" value={form.client_name === '__custom' ? '' : form.client_name} onChange={(e) => setForm(p => ({ ...p, client_name: e.target.value }))} />
                )}
              </div>
              <div>
                <Label className="text-xs">상태</Label>
                <Select value={form.status} onValueChange={(v) => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_MAP).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">장비 설명</Label>
              <Input value={form.machine_description || ''} onChange={(e) => setForm(p => ({ ...p, machine_description: e.target.value }))} placeholder="예: 드립백 포장기 DBM-5000" />
            </div>

            {/* 3-step columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 rounded-xl border bg-orange-50/50 border-orange-200">
                <Step1DirectPayment data={computedForm} onChange={(updated) => setForm(prev => ({ ...prev, ...updated }))} />
              </div>
              <div className="p-4 rounded-xl border bg-accent/5 border-accent/20">
                <Step2KickbackInput data={form} onChange={(updated) => setForm(prev => ({ ...prev, ...updated }))} />
              </div>
              <div className="p-4 rounded-xl border bg-primary/5 border-primary/20">
                <Step3HQShare
                  data={form}
                  onChange={(updated) => setForm(prev => ({ ...prev, ...updated }))}
                  totalMarginRmb={Number(form.actual_kickback_rmb) || 0}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => { setCreateOpen(false); setEditItem(null); }}>취소</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editItem ? '수정 저장' : '정산 등록'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}