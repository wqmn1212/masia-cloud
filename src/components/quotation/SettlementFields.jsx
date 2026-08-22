import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// 정산 경로 + 견적서 발행 명의 입력 (발행 명의는 service 이상만 변경 가능)
export default function SettlementFields({ settlementRoute, quoteIssuer, onChange, canEditIssuer, compact = false }) {
  const h = compact ? 'h-8 text-xs' : '';
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <Label className={compact ? 'text-xs' : ''}>정산 경로</Label>
        <Select value={settlementRoute || 'CLIENT_TO_AEGIS'} onValueChange={(v) => onChange('settlement_route', v)}>
          <SelectTrigger className={h}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="CLIENT_TO_AEGIS" className="text-xs">고객 → 이지스 (대행 정산)</SelectItem>
            <SelectItem value="CLIENT_TO_FACTORY" className="text-xs">고객 → 공장 직접 결제</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className={compact ? 'text-xs' : ''}>견적서 발행 명의</Label>
        <Select value={quoteIssuer || 'AEGIS'} onValueChange={(v) => onChange('quote_issuer', v)} disabled={!canEditIssuer}>
          <SelectTrigger className={h}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="AEGIS" className="text-xs">이지스 명의</SelectItem>
            <SelectItem value="FACTORY" className="text-xs">공장 명의</SelectItem>
          </SelectContent>
        </Select>
        {!canEditIssuer && (
          <p className="text-[10px] text-muted-foreground mt-1">발행 명의 변경은 팀 관리자 이상만 가능합니다.</p>
        )}
      </div>
    </div>
  );
}