import React from 'react';
import { Check } from 'lucide-react';
import { SHIPMENT_STATUS, STATUS_FLOW } from '@/lib/shipments';

// 선적 진행 단계 (직원·고객 화면 공용)
export default function ShipmentSteps({ status }) {
  const at = STATUS_FLOW.indexOf(status);
  if (status === 'ON_HOLD' || at < 0) return null;
  return (
    <ol className="flex items-start gap-1" aria-label="선적 단계">
      {STATUS_FLOW.map((k, i) => (
        <li key={k} className="flex flex-1 flex-col items-center gap-1">
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${i < at ? 'bg-primary text-primary-foreground' : i === at ? 'border-2 border-primary text-primary' : 'border text-muted-foreground'}`}>
            {i < at ? <Check className="h-3 w-3" /> : i + 1}
          </span>
          <span className={`text-center text-[10px] leading-tight ${i === at ? 'font-semibold' : 'text-muted-foreground'}`}>{SHIPMENT_STATUS[k]}</span>
        </li>
      ))}
    </ol>
  );
}
