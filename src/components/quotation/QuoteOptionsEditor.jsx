import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

const fmtUSD = (v) => '$' + Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

// 통화별 금액을 USD 로 환산 (usdToKrw: 1 USD = ? KRW, cnyToKrw: 1 CNY = ? KRW)
export function optionToUSD(value, currency, usdToKrw, cnyToKrw) {
  const v = Number(value) || 0;
  if (!currency || currency === 'USD') return v;
  if (currency === 'KRW') return usdToKrw > 0 ? v / usdToKrw : 0;
  if (currency === 'CNY') return (usdToKrw > 0 && cnyToKrw > 0) ? (v * cnyToKrw) / usdToKrw : 0;
  return v;
}

export default function QuoteOptionsEditor({ options = [], onChange, usdToKrw = 0, cnyToKrw = 0 }) {
  const update = (i, field, value) => {
    onChange(options.map((o, idx) => (idx === i ? { ...o, [field]: value } : o)));
  };
  const add = () => onChange([...options, { option_name: '', specification: '', quantity: 1, unit_price: '', currency: 'USD' }]);
  const remove = (i) => onChange(options.filter((_, idx) => idx !== i));

  const lineTotalUSD = (o) => (Number(o.quantity) || 0) * optionToUSD(o.unit_price, o.currency, usdToKrw, cnyToKrw);
  const totalUSD = options.reduce((s, o) => s + lineTotalUSD(o), 0);
  const totalKRW = usdToKrw > 0 ? Math.round(totalUSD * usdToKrw) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">옵션 / 세부 항목 (통화 선택 → USD 자동 환산)</p>
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
          <div className="hidden sm:grid grid-cols-[1fr_1fr_55px_85px_70px_85px_28px] gap-1.5 px-1 text-[10px] text-muted-foreground font-medium">
            <span>항목명</span><span>세부 사양</span><span>수량</span><span>단가</span><span>통화</span><span className="text-right">금액 ($)</span><span />
          </div>
          {options.map((o, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_55px_85px_70px_85px_28px] gap-1.5 items-center">
              <Input value={o.option_name || ''} onChange={(e) => update(i, 'option_name', e.target.value)} placeholder="옵션명" className="h-7 text-xs" />
              <Input value={o.specification || ''} onChange={(e) => update(i, 'specification', e.target.value)} placeholder="사양" className="h-7 text-xs" />
              <Input type="number" min="0" value={o.quantity} onChange={(e) => update(i, 'quantity', e.target.value)} placeholder="수량" className="h-7 text-xs" />
              <Input type="number" min="0" step="0.01" value={o.unit_price} onChange={(e) => update(i, 'unit_price', e.target.value)}
                placeholder={o.currency === 'KRW' ? '₩' : o.currency === 'CNY' ? '¥' : '$'} className="h-7 text-xs" />
              <Select value={o.currency || 'USD'} onValueChange={(v) => update(i, 'currency', v)}>
                <SelectTrigger className="h-7 text-xs px-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD" className="text-xs">$ USD</SelectItem>
                  <SelectItem value="CNY" className="text-xs">¥ CNY</SelectItem>
                  <SelectItem value="KRW" className="text-xs">₩ KRW</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs font-semibold text-right pr-1">{fmtUSD(lineTotalUSD(o))}</span>
              <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive justify-self-center">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <div className="flex items-center justify-end gap-3 border-t pt-2 mt-1 flex-wrap">
            <span className="text-[11px] text-muted-foreground">합산 총액 (USD 환산)</span>
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