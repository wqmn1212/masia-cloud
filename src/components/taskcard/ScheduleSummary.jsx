import React from 'react';
export default function ScheduleSummary({ card }) {
  return <section className="rounded-xl border bg-muted/20 p-4 space-y-3">
    <h3 className="text-sm font-semibold">견적·납품 일정</h3>
    <dl className="grid grid-cols-2 gap-3 text-sm">
      {[['견적 발송 기한', card.quote_deadline], ['선금 입금 기준일', card.advance_paid_date], ['납품 소요일', card.delivery_business_days == null ? '' : `${card.delivery_business_days}일`], ['예정 납품일', card.delivery_date]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value || '미정'}</dd></div>)}
    </dl><p className="text-xs text-muted-foreground">입금일 다음 날부터 계산 · 일요일 제외 · 토요일/공휴일 포함{card.delivery_date_mode === 'MANUAL' ? ' · 납품일 직접 조정' : ''}</p>
  </section>;
}