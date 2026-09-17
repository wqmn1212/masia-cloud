import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export default function ChineseContentEditor({ record, fields, onSave, saving }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map(f => [`${f.key}_cn`, record?.[`${f.key}_cn`] || ''])));
  const [manual, setManual] = useState(record?.cn_manual === true);
  return <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-3">
    <p className="text-xs font-semibold text-primary">中文人工校正</p>
    {fields.map(f => <div key={f.key}>
      <Label className="text-[11px]">{f.label}</Label>
      {f.multiline ? <Textarea rows={3} value={values[`${f.key}_cn`]} onChange={e => setValues(v => ({ ...v, [`${f.key}_cn`]: e.target.value }))} /> : <Input value={values[`${f.key}_cn`]} onChange={e => setValues(v => ({ ...v, [`${f.key}_cn`]: e.target.value }))} />}
    </div>)}
    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={manual} onChange={e => setManual(e.target.checked)} />人工确认（保存韩文时不自动覆盖中文）</label>
    <Button size="sm" disabled={saving} onClick={() => onSave({ ...values, cn_manual: manual })}>保存中文</Button>
  </div>;
}