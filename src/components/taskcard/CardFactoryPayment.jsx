import React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Landmark } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { useFactoryAccounts } from '@/components/factory/FactoryAccountPanel';
import { VERIFY_METHODS, accountState } from '@/lib/factoryAccount';

// 카드의 공장 대금 지급 계좌: 확인된 계좌만 쓰게 하고, 고객 직접 송금(월정액 관리형) 여부를 정한다.
export default function CardFactoryPayment({ card }) {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useFactoryAccounts(card.factory_id);
  const { verified, pending } = accountState(rows);
  const toggle = useMutation({
    mutationFn: (v) => base44.entities.TaskCard.update(card.id, { client_pays_factory: v }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ['task-cards'] });
      qc.invalidateQueries({ queryKey: ['client-card-detail', card.id] });
      toast({ title: v ? '고객 결제 탭에 확인된 공장 계좌를 보여 줍니다' : '고객에게 공장 계좌를 보여 주지 않습니다' });
    },
    onError: (e) => toast({ title: '저장하지 못했습니다', description: e.message, variant: 'destructive' }),
  });
  const link = card.factory_id ? `/factories/${card.factory_id}/dashboard` : '/factories';

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold"><Landmark className="h-4 w-4 text-primary" />공장 대금 지급 계좌</p>
      {!card.factory_id ? (
        <p className="text-xs text-muted-foreground">이 카드에 공장이 지정되지 않았습니다. 오버뷰에서 공장을 지정하면 확인된 지급 계좌가 보입니다.</p>
      ) : isLoading ? null : verified ? (
        <div className="text-xs">
          <p className="flex items-center gap-1 text-primary"><CheckCircle2 className="h-3.5 w-3.5" />확인된 계좌 · {VERIFY_METHODS[verified.verify_method]}</p>
          <p className="mt-0.5 break-all">{verified.beneficiary_name} · {verified.bank_name} · <span className="font-mono">{verified.account_no}</span> ({verified.currency || 'CNY'})</p>
        </div>
      ) : (
        <p className="flex gap-1.5 rounded-md bg-destructive/10 p-2 text-xs text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" />확인된 계좌가 없습니다. 공장 대금을 보내기 전에 계좌를 등록하고 마스터 확인을 받으세요.</p>
      )}
      {!!pending.length && <p className="flex gap-1.5 rounded-md bg-chart-3/10 p-2 text-xs text-chart-3"><AlertTriangle className="h-4 w-4 shrink-0" />계좌 {verified ? '변경' : '등록'} 요청이 확인을 기다리고 있습니다. 확인 전에는 새 계좌로 송금하지 마세요.</p>}
      {card.factory_id && <Link to={link} className="inline-block text-xs text-primary hover:underline">공장 계좌 관리 →</Link>}
      <label className="flex items-center justify-between gap-3 border-t pt-2 text-xs">
        <span><b>고객이 공장에 직접 송금 (월정액 관리형)</b><span className="block text-muted-foreground">켜면 고객 포털 결제 탭에 이지스가 확인한 공장 계좌가 보이고, 계좌 변경 요청이 오면 고객에게 송금 중지 알림이 갑니다.</span></span>
        <Switch checked={!!card.client_pays_factory} disabled={toggle.isPending} onCheckedChange={(v) => toggle.mutate(v)} />
      </label>
    </div>
  );
}
