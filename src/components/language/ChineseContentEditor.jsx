import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import BilingualField from '@/components/language/BilingualField';
import { editBilingual } from '@/lib/saveBilingual';

export default function ChineseContentEditor({ record, fields, onSave, saving }) {
  const [values, setValues] = useState(() => ({ ...Object.fromEntries(fields.flatMap(f => [[f.key, record?.[f.key] || ''], [`${f.key}_cn`, record?.[`${f.key}_cn`] || '']])), __bilingualDirty: {} }));
  const [manual, setManual] = useState(record?.cn_manual === true);
  return <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-3">
    <p className="text-xs font-semibold text-primary">번역 수동 교정 / 翻译人工校正</p>
    {fields.map(f => <div key={f.key}>
      <Label className="text-[11px]">{f.label}</Label>
      <BilingualField record={values} field={f.key} multiline={f.multiline} rows={f.multiline ? 3 : undefined} disabled={saving} onChange={(key, value) => setValues(v => editBilingual(v, key, value))} />
    </div>)}
    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={manual} onChange={e => setManual(e.target.checked)} />人工确认（保存韩文时不自动覆盖中文）</label>
    <Button size="sm" disabled={saving} onClick={() => onSave({ ...values, cn_manual: manual })}>저장 / 保存</Button>
  </div>;
}