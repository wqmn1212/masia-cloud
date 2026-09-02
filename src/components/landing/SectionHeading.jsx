import React from 'react';
import { cn } from '@/lib/utils';

export default function SectionHeading({ eyebrow, title, dark = false, maxWidth = 'max-w-[660px]', className }) {
  return (
    <div className={className}>
      <div className={cn('text-xs font-bold tracking-[1px] font-mono', dark ? 'text-landing-dark-accent' : 'text-landing-brand')}>{eyebrow}</div>
      <h2 className={cn(
        'mt-3.5 font-extrabold leading-[1.25] text-[27px] tracking-[-1px] lg:text-[32px] lg:tracking-[-1.2px] xl:text-[38px] xl:tracking-[-1.6px] [text-wrap:balance]',
        dark ? 'text-white' : 'text-landing-ink',
        maxWidth
      )}>
        {title}
      </h2>
    </div>
  );
}