import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

const CURRENCY_SYMBOL = { CNY: '¥', USD: '$', KRW: '₩' };
const CURRENCIES = ['CNY', 'USD', 'KRW'];

export default function QuoteLineEditor({ items, onChange }) {
  const addRow = () => {
    onChange([...items, { item_name_cn: '', item_name_ko: '', specification: '', quantity: 1, unit_price_cny: 0, total_cny: 0, currency: 'CNY' }]);
  };

  const removeRow = (idx) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  const updateRow = (idx, field, value) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === 'quantity' || field === 'unit_price_cny') {
      updated[idx].total_cny = (updated[idx].quantity || 0) * (updated[idx].unit_price_cny || 0);
    }
    onChange(updated);
  };

  // 통화별 소계
  const totals = items.reduce((acc, item) => {
    const cur = item.currency || 'CNY';
    acc[cur] = (acc[cur] || 0) + (item.total_cny || 0);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">견적 항목</h3>
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="w-3 h-3 mr-1" />행 추가
        </Button>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left p-2 font-medium text-xs">품목 (중문)</th>
              <th className="text-left p-2 font-medium text-xs">품목 (한글)</th>
              <th className="text-left p-2 font-medium text-xs">사양</th>
              <th className="text-right p-2 font-medium text-xs w-20">수량</th>
              <th className="text-center p-2 font-medium text-xs w-20">통화</th>
              <th className="text-right p-2 font-medium text-xs w-28">단가</th>
              <th className="text-right p-2 font-medium text-xs w-28">소계</th>
              <th className="w-10 p-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const sym = CURRENCY_SYMBOL[item.currency || 'CNY'];
              return (
              <tr key={idx} className="border-t">
                <td className="p-1.5">
                  <Input className="h-8 text-xs" value={item.item_name_cn} onChange={(e) => updateRow(idx, 'item_name_cn', e.target.value)} placeholder="中文名" />
                </td>
                <td className="p-1.5">
                  <Input className="h-8 text-xs" value={item.item_name_ko} onChange={(e) => updateRow(idx, 'item_name_ko', e.target.value)} placeholder="한글명" />
                </td>
                <td className="p-1.5">
                  <Input className="h-8 text-xs" value={item.specification} onChange={(e) => updateRow(idx, 'specification', e.target.value)} />
                </td>
                <td className="p-1.5">
                  <Input className="h-8 text-xs text-right" type="number" value={item.quantity} onChange={(e) => updateRow(idx, 'quantity', Number(e.target.value))} />
                </td>
                <td className="p-1.5">
                  <Select value={item.currency || 'CNY'} onValueChange={(v) => updateRow(idx, 'currency', v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map(c => <SelectItem key={c} value={c}>{CURRENCY_SYMBOL[c]} {c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-1.5">
                  <Input className="h-8 text-xs text-right" type="number" step="0.01" value={item.unit_price_cny} onChange={(e) => updateRow(idx, 'unit_price_cny', Number(e.target.value))} />
                </td>
                <td className="p-1.5 text-right text-xs font-medium">
                  {sym}{(item.total_cny || 0).toLocaleString()}
                </td>
                <td className="p-1.5">
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRow(idx)}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </td>
              </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-muted-foreground text-xs">
                  항목이 없습니다. '행 추가' 버튼을 클릭해 주세요.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            {Object.entries(totals).map(([cur, amt]) => (
              <tr key={cur} className="border-t bg-muted/30">
                <td colSpan={6} className="p-2 text-right font-semibold text-xs">{cur} 합계</td>
                <td className="p-2 text-right font-bold text-sm">{CURRENCY_SYMBOL[cur]}{amt.toLocaleString()}</td>
                <td></td>
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
    </div>
  );
}