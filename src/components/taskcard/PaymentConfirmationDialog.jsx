import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
const labels = { DOWN_PAYMENT: '선금', INTERIM_PAYMENT: '중도금', BALANCE_PAYMENT: '잔금' };
export default function PaymentConfirmationDialog({ stage, onClose, onConfirm, pending, error }) {
  const [reason, setReason] = React.useState(''), [date, setDate] = React.useState('');
  React.useEffect(() => { setReason(''); setDate(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })); }, [stage?.id]);
  const cancel = stage?.approval_status === 'APPROVED';
  return <Dialog open={!!stage} onOpenChange={open => { if (!open && !pending) onClose(); }}><DialogContent><DialogHeader><DialogTitle>{labels[stage?.stage_type]} 입금 {cancel ? '확인 취소' : '확인'}</DialogTitle></DialogHeader>
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); onConfirm({ stage, reason, paid_date: date }); }}>
      <p className="text-sm text-muted-foreground">{cancel ? '입금 확인을 취소하며 수금률과 공정 잠금에 반영됩니다. 기존 생산·출고 기록은 되돌리지 않습니다.' : '실제 입금을 확인한 후 확정하세요. 이후 취소·재확정할 수 있습니다.'}</p>
      {stage?.stage_type === 'DOWN_PAYMENT' && <p className="text-xs text-muted-foreground">{cancel ? '선금 기준일과 자동 계산 납품일은 미정으로 바뀝니다. 직접 조정한 납품일은 유지합니다.' : '입금일을 일정에 반영하고 자동 계산 중인 납품일을 갱신합니다.'}</p>}
      {!cancel && stage?.stage_type === 'DOWN_PAYMENT' && <label className="block text-sm">실제 선금 입금일<Input type="date" required value={date} disabled={pending} onChange={e => setDate(e.target.value)} /></label>}
      <label className="block text-sm">처리 사유<Input required maxLength={1000} value={reason} disabled={pending} onChange={e => setReason(e.target.value)} placeholder={cancel ? '예: 다른 거래 입금으로 확인됨' : '예: 은행 입금내역 대조 완료'} /></label>
      {error && <p role="alert" className="text-sm text-destructive">{error?.response?.data?.error || '저장에 실패했습니다.'}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={pending} onClick={onClose}>닫기</Button><Button type="submit" variant={cancel ? 'destructive' : 'default'} disabled={pending}>{pending ? '저장 중...' : cancel ? '입금 확인 취소' : '입금 확인'}</Button></div>
    </form></DialogContent></Dialog>;
}