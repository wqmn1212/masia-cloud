import React from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';

/** 어셈블리 STEP 의 부품 고르기. 사출 부품을 위에, 구매품·전자부품은 아래 '제외' 묶음에 둔다 */
export default function MoldPartPicker({ parts, value, onChange, disabled }) {
  const molded = parts.map((p, i) => ({ p, i })).filter(({ p }) => p.molded);
  const others = parts.map((p, i) => ({ p, i })).filter(({ p }) => !p.molded);
  const label = (p) => `${p.part_name} · 삼각형 ${Number(p.triangle_count || 0).toLocaleString()}개`;
  return (
    <Select value={value != null ? String(value) : undefined} onValueChange={(v) => onChange(Number(v))} disabled={disabled}>
      <SelectTrigger className="h-9 text-xs">
        <SelectValue placeholder="검토할 부품 선택" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel className="text-[11px]">사출 부품 {molded.length}개</SelectLabel>
          {molded.map(({ p, i }) => (
            <SelectItem key={i} value={String(i)} className="text-xs">{label(p)}</SelectItem>
          ))}
        </SelectGroup>
        {others.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-[11px]">검토 제외 추정 {others.length}개 (구매품 · 전자부품)</SelectLabel>
            {others.map(({ p, i }) => (
              <SelectItem key={i} value={String(i)} className="text-xs text-muted-foreground">{p.part_name} · {p.reason}</SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
