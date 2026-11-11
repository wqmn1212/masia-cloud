import React from 'react';
import { cn } from '@/lib/utils';
import { tx } from '@/lib/landingContent';

// turnkey(턴키 납품, 기본) · monthly(제조팀 구독) · sourcing(단건 상품)
export const INQUIRY_TYPES = [
  { value: 'turnkey', label: ['개발·양산 의뢰', 'Turnkey project', '开发·量产委托'] },
  { value: 'monthly', label: ['제조팀 구독', 'Team subscription', '制造团队订阅'] },
  { value: 'sourcing', label: ['단건 상품', 'Single service', '单项服务'] },
];
const TITLE = ['문의 유형', 'Inquiry type', '咨询类型'];

export default function InquiryTypePicker({ value, onChange, lang }) {
  return (
    <div className="mb-4 flex flex-col gap-1.5">
      <span className="text-[13px] font-bold text-landing-ink2">{tx(TITLE, lang)}</span>
      <div className="grid grid-cols-3 gap-[7px] bg-landing-toggle p-1 rounded-[10px]">
        {INQUIRY_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            aria-pressed={value === t.value}
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