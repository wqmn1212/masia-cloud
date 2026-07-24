import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

export const DEFAULT_QC_ITEMS = ['외관/인쇄 상태', '치수/규격', '수량 카운팅', '기능/작동 상태'];

export default function QCChecklistEditor({ items, onChange }) {
  const update = (index, patch) => onChange(items.map((item, i) => i === index ? { ...item, ...patch } : item));
  return <div className="space-y-2">
    {items.map((item, index) => <div key={index} className="grid grid-cols-[1fr_110px_32px] gap-2">
      <Input value={item.label} onChange={e => update(index, { label: e.target.value })} className="h-8 text-xs" />
      <Select value={item.status} onValueChange={status => update(index, { status })}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="PASS">양호</SelectItem><SelectItem value="PENDING">진행 중</SelectItem><SelectItem value="FAIL">불량</SelectItem></SelectContent>
      </Select>
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => onChange(items.filter((_, i) => i !== index))}><Trash2 className="w-3.5 h-3.5" /></Button>
    </div>)}
    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onChange([...items, { label: '새 검수 항목', status: 'PENDING', note: '' }])}><Plus className="w-3 h-3" />항목 추가</Button>
  </div>;
}