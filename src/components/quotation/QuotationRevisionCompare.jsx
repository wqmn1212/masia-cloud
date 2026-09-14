import React, { useState } from 'react';
import { revisionLabels, revisionRows, revisionValue } from '@/components/quotation/quotationRevisionLabels';

export default function QuotationRevisionCompare({ before, after }) {
  const [onlyChanges, setOnlyChanges] = useState(true);
  const pick = q => Object.fromEntries(Object.keys(revisionLabels).filter(k => q?.[k] !== undefined).map(k => [k, q[k]]));
  const left = revisionRows(pick(before));
  const right = revisionRows(pick(after));
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])];
  const changed = k => revisionValue(left[k]) !== revisionValue(right[k]);
  const rows = keys.filter(k => !onlyChanges || changed(k));
  return <div className="space-y-3">
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyChanges} onChange={e => setOnlyChanges(e.target.checked)} />변경 항목만 보기</label>
    <p className="text-xs text-muted-foreground">금액은 각 버전에 저장된 값과 통화 기준입니다. 항목은 저장된 순서대로 비교합니다.</p>
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-xs"><thead className="bg-muted"><tr>{['항목', '기준 버전', '비교 버전', '증감'].map(h => <th key={h} className="p-3 text-left">{h}</th>)}</tr></thead>
        <tbody>{rows.map(k => {
          const currencyKey = `${k.slice(0, k.lastIndexOf(' · '))} · 통화`;
          const unitChanged = (k.endsWith(' · 단가') && left[currencyKey] !== right[currencyKey]) || (k === revisionLabels.masir_fee_value && before.masir_fee_type !== after.masir_fee_type);
          const numeric = !unitChanged && typeof left[k] === 'number' && typeof right[k] === 'number'; const delta = numeric ? right[k] - left[k] : null;
          return <tr key={k} className={changed(k) ? 'border-t bg-primary/5' : 'border-t'}>
            <th className="p-3 text-left font-medium min-w-36">{k}</th>
            <td className="p-3 whitespace-pre-wrap break-all max-w-64">{revisionValue(left[k])}</td>
            <td className="p-3 whitespace-pre-wrap break-all max-w-64">{revisionValue(right[k])}</td>
            <td className="p-3 whitespace-nowrap">{unitChanged ? '단위 변경' : delta === null ? (changed(k) ? '변경' : '—') : `${delta > 0 ? '+' : ''}${revisionValue(delta)}`}</td>
          </tr>;
        })}</tbody>
      </table>
      {!rows.length && <p className="p-6 text-center text-sm text-muted-foreground">두 버전의 견적 내용이 동일합니다.</p>}
    </div>
  </div>;
}