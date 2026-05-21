import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2, Save } from 'lucide-react';

const emptyRow = {
  record_date: new Date().toISOString().slice(0, 10),
  description: '',
  hk_received_usd: 0,
  agency_fee_usd: 0,
  sent_amount_usd: 0,
  exchange_rate: 7.2,
  agent_payout_rmb: 0,
  hq_margin_rmb: 0,
  notes: '',
};

export default function SettlementTab({ card, user }) {
  const [rows, setRows] = useState([]);
  const [initialized, setInitialized] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settlements = [], isLoading } = useQuery({
    queryKey: ['card-settlement', card.id],
    queryFn: () => base44.entities.CardSettlement.filter({ card_id: card.id }, 'record_date'),
    onSuccess: (data) => {
      if (!initialized) {
        setRows(data.map(s => ({ ...s })));
        setInitialized(true);
      }
    },
  });

  React.useEffect(() => {
    if (settlements.length > 0 && !initialized) {
      setRows(settlements.map(s => ({ ...s })));
      setInitialized(true);
    }
  }, [settlements, initialized]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.CardSettlement.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['card-settlement', card.id] }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CardSettlement.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['card-settlement', card.id] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CardSettlement.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['card-settlement', card.id] }),
  });

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        🔒 정산 탭은 HQ 전용입니다
      </div>
    );
  }

  const addRow = () => setRows(r => [...r, { ...emptyRow, _new: true, _tempId: Date.now() }]);

  const updateRow = (idx, field, value) => {
    setRows(r => r.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  };

  const saveAll = async () => {
    for (const row of rows) {
      const { _new, _tempId, id, ...data } = row;
      const payload = { ...data, card_id: card.id };
      if (_new) await createMutation.mutateAsync(payload);
      else if (id) await updateMutation.mutateAsync({ id, data: payload });
    }
    setInitialized(false);
    toast({ title: '정산 내역 저장 완료' });
  };

  const deleteRow = async (row, idx) => {
    if (row.id) await deleteMutation.mutateAsync(row.id);
    setRows(r => r.filter((_, i) => i !== idx));
  };

  // Totals
  const totals = rows.reduce((acc, r) => ({
    hk: acc.hk + (Number(r.hk_received_usd) || 0),
    fee: acc.fee + (Number(r.agency_fee_usd) || 0),
    sent: acc.sent + (Number(r.sent_amount_usd) || 0),
    agent: acc.agent + (Number(r.agent_payout_rmb) || 0),
    hqm: acc.hqm + (Number(r.hq_margin_rmb) || 0),
  }), { hk: 0, fee: 0, sent: 0, agent: 0, hqm: 0 });

  const cellClass = "px-1.5 py-1 text-xs border-0 h-8 rounded-none focus-visible:ring-0 focus-visible:border-b-2 focus-visible:border-primary";

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">수기 정산 원장 — HQ 전용 열람/편집</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={addRow} className="h-7 text-xs gap-1">
            <Plus className="w-3 h-3" />행 추가
          </Button>
          <Button size="sm" onClick={saveAll} className="h-7 text-xs gap-1">
            <Save className="w-3 h-3" />전체 저장
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-xs min-w-[900px]">
          <thead>
            <tr className="bg-muted/50 border-b">
              {['일자','내역','수금(USD)','수수료(USD)','송금(USD)','환율','에이전트(RMB)','HQ마진(RMB)','비고',''].map(h => (
                <th key={h} className="px-2 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id || row._tempId} className="border-b hover:bg-muted/20">
                <td><Input type="date" value={row.record_date || ''} onChange={(e) => updateRow(idx, 'record_date', e.target.value)} className={`${cellClass} w-32`} /></td>
                <td><Input value={row.description || ''} onChange={(e) => updateRow(idx, 'description', e.target.value)} className={`${cellClass} w-32`} placeholder="내역" /></td>
                <td><Input type="number" value={row.hk_received_usd || ''} onChange={(e) => updateRow(idx, 'hk_received_usd', e.target.value)} className={`${cellClass} w-24`} /></td>
                <td><Input type="number" value={row.agency_fee_usd || ''} onChange={(e) => updateRow(idx, 'agency_fee_usd', e.target.value)} className={`${cellClass} w-24`} /></td>
                <td><Input type="number" value={row.sent_amount_usd || ''} onChange={(e) => updateRow(idx, 'sent_amount_usd', e.target.value)} className={`${cellClass} w-24`} /></td>
                <td><Input type="number" value={row.exchange_rate || ''} onChange={(e) => updateRow(idx, 'exchange_rate', e.target.value)} className={`${cellClass} w-20`} /></td>
                <td><Input type="number" value={row.agent_payout_rmb || ''} onChange={(e) => updateRow(idx, 'agent_payout_rmb', e.target.value)} className={`${cellClass} w-24`} /></td>
                <td><Input type="number" value={row.hq_margin_rmb || ''} onChange={(e) => updateRow(idx, 'hq_margin_rmb', e.target.value)} className={`${cellClass} w-24`} /></td>
                <td><Input value={row.notes || ''} onChange={(e) => updateRow(idx, 'notes', e.target.value)} className={`${cellClass} w-32`} placeholder="비고" /></td>
                <td className="px-1">
                  <button onClick={() => deleteRow(row, idx)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="text-center py-6 text-muted-foreground">행 추가 버튼을 클릭하여 정산 내역을 입력하세요</td></tr>
            )}
            {/* Totals */}
            {rows.length > 0 && (
              <tr className="bg-muted/40 font-bold border-t-2">
                <td className="px-2 py-2 text-xs" colSpan={2}>합계</td>
                <td className="px-2 py-2 text-xs font-mono text-right">${totals.hk.toFixed(2)}</td>
                <td className="px-2 py-2 text-xs font-mono text-right">${totals.fee.toFixed(2)}</td>
                <td className="px-2 py-2 text-xs font-mono text-right">${totals.sent.toFixed(2)}</td>
                <td className="px-2 py-2" />
                <td className="px-2 py-2 text-xs font-mono text-right text-accent">¥{totals.agent.toFixed(2)}</td>
                <td className="px-2 py-2 text-xs font-mono text-right text-primary">¥{totals.hqm.toFixed(2)}</td>
                <td colSpan={2} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}