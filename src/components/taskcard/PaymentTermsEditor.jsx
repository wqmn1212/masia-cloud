import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function PaymentTermsEditor({ stages, onSaved }) {
  const down = stages.find(s => s.stage_type === 'DOWN_PAYMENT');
  const balance = stages.find(s => s.stage_type === 'BALANCE_PAYMENT');
  const [values, setValues] = React.useState({ down: 50, balance: 50, downAmount: '', balanceAmount: '', currency: 'USD' });
  React.useEffect(() => setValues({
    down: down?.percentage ?? 50, balance: balance?.percentage ?? 50,
    downAmount: down?.amount ?? '', balanceAmount: balance?.amount ?? '', currency: down?.currency || balance?.currency || 'USD',
  }), [down?.percentage, balance?.percentage, down?.amount, balance?.amount, down?.currency, balance?.currency]);
  const save = useMutation({
    mutationFn: async () => {
      const downValue = Number(values.down), balanceValue = Number(values.balance);
      if (!down || !balance) throw new Error('선금과 잔금 단계를 먼저 설정하세요.');
      if (![downValue, balanceValue].every(v => Number.isFinite(v) && v >= 0 && v <= 100)) throw new Error('비율은 0~100 사이로 입력하세요.');
      if (downValue + balanceValue !== 100) throw new Error('선금과 잔금 비율의 합계는 100%여야 합니다.');
      // 금액은 선택: 비워 두면 비율만 쓴다
      const amount = (v) => (v === '' || v == null ? null : Number(v));
      if ([values.downAmount, values.balanceAmount].some((v) => v !== '' && v != null && !(Number(v) >= 0))) throw new Error('금액은 0 이상 숫자로 입력하세요.');
      await base44.entities.PaymentStage.bulkUpdate([
        { id: down.id, percentage: downValue, amount: amount(values.downAmount), currency: values.currency },
        { id: balance.id, percentage: balanceValue, amount: amount(values.balanceAmount), currency: values.currency },
      ]);
    },
    onSuccess: onSaved,
  });
  return <div className="rounded-lg border p-3 space-y-3"><div><p className="text-sm font-semibold">결제 비율·금액</p><p className="text-xs text-muted-foreground">선금과 잔금의 합계는 100%로 입력하세요. 금액을 넣으면 고객 결제 탭에도 보입니다.</p></div><div className="grid grid-cols-2 gap-3"><label className="text-xs">선금 비율 (%)<Input type="number" min="0" max="100" value={values.down} onChange={e => setValues(v => ({ ...v, down: e.target.value }))} /></label><label className="text-xs">잔금 비율 (%)<Input type="number" min="0" max="100" value={values.balance} onChange={e => setValues(v => ({ ...v, balance: e.target.value }))} /></label><label className="text-xs">선금 금액 (선택)<Input type="number" min="0" value={values.downAmount} onChange={e => setValues(v => ({ ...v, downAmount: e.target.value }))} /></label><label className="text-xs">잔금 금액 (선택)<Input type="number" min="0" value={values.balanceAmount} onChange={e => setValues(v => ({ ...v, balanceAmount: e.target.value }))} /></label><label className="col-span-2 text-xs">통화<select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm" value={values.currency} onChange={e => setValues(v => ({ ...v, currency: e.target.value }))}><option value="USD">USD</option><option value="CNY">CNY</option><option value="KRW">KRW</option></select></label></div>{save.isError && <p role="alert" className="text-xs text-destructive">{save.error.message}</p>}<div className="flex justify-end"><Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? '저장 중...' : '저장'}</Button></div></div>;
}