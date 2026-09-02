import { cn } from '@/lib/utils';

export default function SectionHeading({ eyebrow, title, dark = false, maxWidth = 'max-w-[660px]' }) {
  return (
    <>
      <div className={cn('text-xs font-bold tracking-[1px] font-mono', dark ? 'text-landing-dark-accent' : 'text-landing-brand')}>{eyebrow}</div>
      <h2 className={cn(
        'mt-3.5 text-[27px] lg:text-[32px] xl:text-[38px] leading-[1.25] tracking-[-1px] lg:tracking-[-1.2px] xl:tracking-[-1.6px] font-extrabold [text-wrap:balance]',
        dark ? 'text-white' : 'text-landing-ink',
        maxWidth
      )}>{title}</h2>
    </>
  );
}