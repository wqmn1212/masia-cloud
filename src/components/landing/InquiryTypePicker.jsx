import React from 'react';
import { cn } from '@/lib/utils';
import { tx } from '@/lib/landingContent';

export const INQUIRY_TYPES = [
  { value: 'sourcing', label: ['단발 소싱', 'One-off sourcing', '单次采购'] },
  { value: 'monthly', label: ['월 계약 상담', 'Monthly contract', '月度合同咨询'] },
];
const TITLE = ['문의 유형', 'Inquiry type', '咨询类型'];

export default function InquiryTypePicker({ value, onChange, lang }) {
  return (
    <div className="mb-4 flex flex-col gap-1.5">
      <span className="text-[13px] font-bold text-landing-ink2">{tx(TITLE, lang)}</span>
      <div className="grid grid-cols-2 gap-[7px] bg-landing-toggle p-1 rounded-[10px]">
        {INQUIRY_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={cn(
              'text-[13.5px] font-bold py-2 rounded-lg transition-colors',
              value === t.value ? 'bg-white text-landing-brand shadow-sm' : 'text-landing-muted'
            )}
          >
            {tx(t.label, lang)}
          </button>
        ))}
      </div>
    </div>
  );
}