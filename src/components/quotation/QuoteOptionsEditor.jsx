import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

const fmtUSD = (v) => '$' + Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function QuoteOptionsEditor({ options = [], onChange, usdToKrw = 0 }) {
  const update = (i, field, value) => {
    onChange(options.map((o, idx) => (idx === i ? { ...o, [field]: value } : o)));
  };
  const add = () => onChange([...options, { option_name: '', specification: '', quantity: 1, unit_price_usd: '' }]);
  const remove = (i) => onChange(options.filter((_, idx) => idx !== i));

  const lineTotal = (o) => (Number(o.quantity) || 0) * (Number(o.unit_price_usd) || 0);
  const totalUSD = options.reduce((s, o) => s + lineTotal(o), 0);
  const totalKRW = usdToKrw > 0 ? Math.round(totalUSD * usdToKrw) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">옵션 / 세부 항목 (USD 기준)</p>
        <Button type="button" size="sm" variant="outline" className="h-6 text-[11px] gap-1 px-2" onClick={add}>
          <Plus className="w-3 h-3" />옵션 추가
        </Button>
      </div>

      {options.length === 0 ? (
        <p className="text-[11px] text-muted-foreground border border-dashed rounded-lg p-3 text-center">
          옵션을 추가하면 항목별 금액과 합산 금액이 자동 계산됩니다
        </p>
      ) : (
        <div className="space-y-1.5">
          <div className="hidden sm:grid grid-cols-[1fr_1fr_60px_90px_90px_28px] gap-1.5 px-1 text-[10px] text-muted-foreground font-medium">
            <span>항목명</span><span>세부 사양</span><span>수량</span><span>단가 ($)</span><span className="text-right">금액 ($)</span><span />
          </div>
          {options.map((o, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_60px_90px_90px_28px] gap-1.5 items-center">
              <Input value={o.option_name || ''} onChange={(e) => update(i, 'option_name', e.target.value)} placeholder="옵션명" className="h-7 text-xs" />
              <Input value={o.specification || ''} onChange={(e) => update(i, 'specification', e.target.value)} placeholder="사양" className="h-7 text-xs" />
              <Input type="number" min="0" value={o.quantity} onChange={(e) => update(i, 'quantity', e.target.value)} placeholder="수량" className="h-7 text-xs" />
              <Input type="number" min="0" step="0.01" value={o.unit_price_usd} onChange={(e) => update(i, 'unit_price_usd', e.target.value)} placeholder="$" className="h-7 text-xs" />
              <span className="text-xs font-semibold text-right pr-1">{fmtUSD(lineTotal(o))}</span>
              <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive justify-self-center">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <div className="flex items-center justify-end gap-3 border-t pt-2 mt-1">
            <span className="text-[11px] text-muted-foreground">옵션 합산 총액</span>
            <span className="text-sm font-bold text-primary">{fmtUSD(totalUSD)}</span>
            {totalKRW != null && (
              <span className="text-[11px] text-muted-foreground">≈ ₩{totalKRW.toLocaleString()} <span className="opacity-70">($1 = ₩{Number(usdToKrw).toLocaleString()})</span></span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}