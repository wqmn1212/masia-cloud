import { clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// 디자인 토큰 글자 크기(text-micro·caption·label·body·title)를 글자 크기로 알려 준다.
// 알려 주지 않으면 cn('text-caption', 'text-muted-foreground') 에서 글자색과 겹친다고 보고 크기 클래스를 지운다.
const twMerge = extendTailwindMerge({ extend: { classGroups: { 'font-size': [{ text: ['micro', 'caption', 'label', 'body', 'title'] }] } } })

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}


export const isIframe = window.self !== window.top;
