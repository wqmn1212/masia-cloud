import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { toUSD, formatMoney, CURRENCY_DIGITS } from '@/components/quotation/quoteCurrency';

const fmtUSD = (v) => '$' + Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const optionToUSD = toUSD;

export default function QuoteOptionsEditor({ options = [], onChange, usdToKrw = 0, usdToCny = 0, calc }) {
  const [bulkMargin, setBulkMargin] = useState('');

  const update = (i, field, value) => {
    onChange(options.map((o, idx) => (idx === i ? { ...o, [field]: value } : o)));
  };
  const add = () => onChange([...options, { option_name: '', specification: '', quantity: 1, unit_price: '', currency: 'CNY', margin_percent: '' }]);
  const remove = (i) => onChange(options.filter((_, idx) => idx !== i));
  const applyBulkMargin = () => {
    if (bulkMargin === '') return;
    onChange(options.map(o => ({ ...o, margin_percent: bulkMargin })));
  };

  const lineBaseUSD = (o) => (Number(o.quantity) || 0) * toUSD(o.unit_price, o.currency || 'CNY', usdToKrw, usdToCny);
  const lineClientUSD = (o) => lineBaseUSD(o) * (1 + (Number(o.margin_percent) || 0) / 100);
  const baseTotalUSD = options.reduce((s, o) => s + lineBaseUSD(o), 0);
  const clientTotalUSD = options.reduce((s, o) => s + lineClientUSD(o), 0);
  // 고객 금액은 calculateQuote 결과(견적 통화, 품목별 올림)를 그대로 표시
  const cur = calc?.currency || 'USD';
  const filled = options.map(o => !!(o.option_name || Number(o.unit_price)));
  const lineOf = (i) => calc ? calc.lines[filled.slice(0, i).filter(Boolean).length] : null;
  const showLine = (o, i) => {
    if (!(usdToCny > 0 || o.currency !== 'CNY')) return '환율 필요';
    const l = filled[i] && lineOf(i);
    return l ? `${formatMoney(l.unit_price, cur)} × ${l.quantity} = ${formatMoney(l.total, cur)}` : fmtUSD(lineClientUSD(o));
  };
  const optionsClientTotal = calc ? calc.lines.slice(0, filled.filter(Boolean).length).reduce((s, l) => s + Math.round(l.total * 10 ** CURRENCY_DIGITS[cur]), 0) / 10 ** CURRENCY_DIGITS[cur] : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs font-semibold">옵션 / 세부 항목 (공장 견적 기본 통화: CNY/RMB)</p>
        <div className="flex items-center gap-1.5">
          <Input type="number" min="0" step="0.1" value={bulkMargin} onChange={(e) => setBulkMargin(e.target.value)}
            placeholder="마진 %" className="h-6 text-[11px] w-16 px-2" />
          <Button type="button" size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={applyBulkMargin}>
            전체 적용
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-6 text-[11px] gap-1 px-2" onClick={add}>
            <Plus className="w-3 h-3" />옵션 추가
          </Button>
        </div>
      </div>

      {options.length === 0 ? (
        <p className="text-[11px] text-muted-foreground border border-dashed rounded-lg p-3 text-center">
          옵션을 추가하면 항목별 금액과 합산 금액이 자동 계산됩니다
        </p>
      ) : (
        <div className="space-y-1.5">
          <div className="hidden sm:grid grid-cols-[1fr_1fr_50px_80px_65px_55px_170px_28px] gap-1.5 px-1 text-[10px] text-muted-foreground font-medium">
            <span>항목명</span><span>세부 사양</span><span>수량</span><span>단가</span><span>통화</span><span>마진 %</span><span className="text-right">고객 단가 × 수량 ({cur})</span><span />
          </div>
          {options.map((o, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_50px_80px_65px_55px_170px_28px] gap-1.5 items-center">
              <Input value={o.option_name || ''} onChange={(e) => update(i, 'option_name', e.target.value)} placeholder="옵션명" className="h-7 text-xs" />
              <Input value={o.specification || ''} onChange={(e) => update(i, 'specification', e.target.value)} placeholder="사양" className="h-7 text-xs" />
              <Input type="number" min="0" value={o.quantity} onChange={(e) => update(i, 'quantity', e.target.value)} placeholder="수량" className="h-7 text-xs" />
              <Input type="number" min="0" step="0.00001" value={o.unit_price} onChange={(e) => update(i, 'unit_price', e.target.value)}
                placeholder={o.currency === 'KRW' ? '₩' : o.currency === 'CNY' ? '¥' : '$'} className="h-7 text-xs" />
              <Select value={o.currency || 'CNY'} onValueChange={(v) => update(i, 'currency', v)}>
                <SelectTrigger className="h-7 text-xs px-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD" className="text-xs">$ USD</SelectItem>
                  <SelectItem value="CNY" className="text-xs">¥ CNY</SelectItem>
                  <SelectItem value="KRW" className="text-xs">₩ KRW</SelectItem>
                </SelectContent>
              </Select>
              <Input type="number" min="0" step="0.1" value={o.margin_percent ?? ''} onChange={(e) => update(i, 'margin_percent', e.target.value)} placeholder="%" className="h-7 text-xs" />
              <span className="text-xs font-semibold text-right pr-1" title={`원가 ${fmtUSD(lineBaseUSD(o))}`}>{showLine(o, i)}</span>
              <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive justify-self-center">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <div className="flex items-center justify-end gap-3 border-t pt-2 mt-1 flex-wrap">
            <span className="text-[11px] text-muted-foreground">원가 합계 {fmtUSD(baseTotalUSD)}</span>
            <span className="text-[11px] text-muted-foreground">합산 총액 (마진 포함)</span>
            <span className="text-sm font-bold text-primary">{usdToCny > 0 || options.every(o => o.currency !== 'CNY') ? (optionsClientTotal != null ? formatMoney(optionsClientTotal, cur) : fmtUSD(clientTotalUSD)) : '직접 환율 입력 필요'}</span>
          </div>
        </div>
      )}
    </div>
  );
}