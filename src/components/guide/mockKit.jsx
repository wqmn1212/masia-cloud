// 이용 가이드 예시 화면(HTML) 공용 부품 — 고객 가이드와 직원 가이드가 함께 쓴다.
// 예시 화면은 눌러도 동작하지 않는 정적 화면이며 화면 읽기 프로그램에는 숨긴다.
import React from 'react';
import { cn } from '@/lib/utils';

const PIN = { tl: '-left-2.5 -top-2.5', tr: '-right-2.5 -top-2.5', bl: '-left-2.5 -bottom-2.5', br: '-right-2.5 -bottom-2.5' };

export function Pin({ n, pos = 'tr', className }) {
  return <span className={cn('absolute z-10 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold leading-none text-white shadow ring-2 ring-white', PIN[pos], className)}>{n}</span>;
}

// 설명 번호가 붙는 영역: 붉은 테두리 + 번호. 번호는 기본으로 오른쪽 위에 붙어 왼쪽 글자를 가리지 않는다.
// inline: 글자 길이만큼만 감싸고, 번호 자리만큼 오른쪽을 비운다.
export function Mark({ n, pos = 'tr', inline, className, children }) {
  return <div className={cn('relative rounded-md ring-2 ring-rose-500/80 ring-offset-2 ring-offset-background', inline && 'inline-flex items-center pr-3', className)}>{children}<Pin n={n} pos={pos} /></div>;
}

// 창 모양 틀: 제목 + "예시 화면" 표시
export function Frame({ title, badge, children, className }) {
  return (
    <div className="pointer-events-none select-none overflow-hidden rounded-xl border bg-background text-foreground shadow-sm" aria-hidden="true">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/50 px-3 py-2">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"><span className="flex gap-1"><i className="h-2 w-2 rounded-full bg-rose-300" /><i className="h-2 w-2 rounded-full bg-amber-300" /><i className="h-2 w-2 rounded-full bg-emerald-300" /></span>{title}</span>
        {badge && <span className="rounded border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground">{badge}</span>}
      </div>
      <div className={cn('p-4', className)}>{children}</div>
    </div>
  );
}
