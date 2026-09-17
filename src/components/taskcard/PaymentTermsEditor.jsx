import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function PaymentTermsEditor({ stages, onSaved }) {
  const down = stages.find(s => s.stage_type === 'DOWN_PAYMENT');
  const balance = stages.find(s => s.stage_type === 'BALANCE_PAYMENT');
  const [values, setValues] = React.useState({ down: 50, balance: 50 });
  React.useEffect(() => setValues({ down: down?.percentage ?? 50, balance: balance?.percentage ?? 50 }), [down?.percentage, balance?.percentage]);
  const save = useMutation({
    mutationFn: async () => {
      const downValue = Number(values.down), balanceValue = Number(values.balance);
      if (!down || !balance) throw new Error('선금과 잔금 단계를 먼저 설정하세요.');
      if (![downValue, balanceValue].every(v => Number.isFinite(v) && v >= 0 && v <= 100)) throw new Error('비율은 0~100 사이로 입력하세요.');
      if (downValue + balanceValue !== 100) throw new Error('선금과 잔금 비율의 합계는 100%여야 합니다.');
      await base44.entities.PaymentStage.bulkUpdate([{ id: down.id, percentage: downValue }, { id: balance.id, percentage: balanceValue }]);
    },
    onSuccess: onSaved,
  });
  return <div className="rounded-lg border p-3 space-y-3"><div><p className="text-sm font-semibold">결제 비율</p><p className="text-xs text-muted-foreground">선금과 잔금의 합계는 100%로 입력하세요.</p></div><div className="grid grid-cols-2 gap-3"><label className="text-xs">선금 비율 (%)<Input type="number" min="0" max="100" value={values.down} onChange={e => setValues(v => ({ ...v, down: e.target.value }))} /></label><label className="text-xs">잔금 비율 (%)<Input type="number" min="0" max="100" value={values.balance} onChange={e => setValues(v => ({ ...v, balance: e.target.value }))} /></label></div>{save.isError && <p role="alert" className="text-xs text-destructive">{save.error.message}</p>}<div className="flex justify-end"><Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? '저장 중...' : '비율 저장'}</Button></div></div>;
}