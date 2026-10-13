import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';

// 팀 구성원 중 여러 명을 단계 담당자로 지정
export default function OwnerMultiSelect({ value = [], team = [], onChange, placeholder = '미지정' }) {
  const names = team.filter((u) => value.includes(u.id)).map((u) => u.name);
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="h-7 w-full rounded-md border border-input text-[11px] px-1 text-left truncate">{names.join(', ') || placeholder}</button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        {team.length === 0 && <p className="text-xs text-muted-foreground p-1">팀 구성원이 없습니다.</p>}
        {team.map((u) => (
          <label key={u.id} className="flex items-center gap-2 px-1 py-1.5 rounded hover:bg-muted cursor-pointer text-xs">
            <Checkbox checked={value.includes(u.id)} onCheckedChange={() => toggle(u.id)} />{u.name}
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}