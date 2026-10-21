import React from 'react';
import { Ship, BatteryCharging } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MODES, SHIPMENT_STATUS } from '@/lib/shipments';
import ShipmentSteps from '@/components/shipments/ShipmentSteps';
import ClientDestCost from './ClientDestCost';

// 고객 포털 진행 정보: 선적 상태 단계, 출항·도착일, 서류 준비 여부, 도착지 비용 예상액 (파일·포워더·내부 메모는 보이지 않음)
export default function ClientShipmentPanel({ cardId, shipments = [], onChanged }) {
  if (!shipments.length) return null;
  return (
    <div className="mb-4 space-y-3">
      {shipments.map((s) => {
        const ready = s.docs.filter((d) => d.status !== 'MISSING').length;
        return (
          <div key={s.id} className="space-y-2.5 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Ship className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">{s.label || '선적'}</p>
              <Badge variant="outline">{SHIPMENT_STATUS[s.status]}</Badge>
              {s.dangerous_goods && <Badge className="gap-1 border-0 bg-chart-3/15 text-chart-3"><BatteryCharging className="h-3 w-3" />배터리 포함</Badge>}
              <span className="ml-auto text-xs text-muted-foreground">{[MODES[s.mode], s.carrier].filter(Boolean).join(' · ')}</span>
            </div>
            <ShipmentSteps status={s.status} />
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
              <div><dt className="text-muted-foreground">출발</dt><dd>{s.port_from || '-'}</dd></div>
              <div><dt className="text-muted-foreground">도착</dt><dd>{s.port_to || '-'}</dd></div>
              <div><dt className="text-muted-foreground">{s.atd ? '출항' : '출항 예정'}</dt><dd className="tabular-nums">{s.atd || s.etd || '미정'}</dd></div>
              <div><dt className="text-muted-foreground">{s.ata ? '도착' : '도착 예정'}</dt><dd className="tabular-nums">{s.ata || s.eta || '미정'}</dd></div>
              {s.tracking_no && <div className="col-span-2"><dt className="text-muted-foreground">B/L · 운송장 번호</dt><dd className="font-mono">{s.tracking_no}</dd></div>}
              {s.package_note && <div className="col-span-2"><dt className="text-muted-foreground">포장</dt><dd>{s.package_note}</dd></div>}
            </dl>
            <div>
              <p className="text-[11px] text-muted-foreground">선적 서류 {ready}/{s.docs.length} 준비</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {s.docs.map((d) => (
                  <span key={d.key} className={`rounded px-1.5 py-0.5 text-[10px] ${d.status === 'MISSING' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
                    {d.status === 'MISSING' ? '' : '✓ '}{d.label}{d.status === 'NA' ? ' (해당 없음)' : ''}
                  </span>
                ))}
              </div>
            </div>
            {s.client_note && <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-xs">{s.client_note}</p>}
            {s.dest_cost && <ClientDestCost cardId={cardId} shipment={s} onChanged={onChanged} />}
          </div>
        );
      })}
    </div>
  );
}
