import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';

/** 금형 설계 지시서 초안. 한국어 · 중국어(공장 전달용)를 바꿔 보고 복사한다 */
export default function MoldSpecBox({ spec }) {
  const [lang, setLang] = useState('ko');
  const [copied, setCopied] = useState(false);
  const text = spec[lang];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-lg border p-0.5" role="group" aria-label="지시서 언어">
          {[['ko', '한국어'], ['zh', '中文 (공장용)']].map(([v, label]) => (
            <button
              key={v}
              type="button"
              aria-pressed={lang === v}
              onClick={() => setLang(v)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${lang === v ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={copy}>
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? '복사했습니다' : '지시서 복사'}
        </Button>
      </div>
      <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/50 p-3 font-mono text-[11.5px] leading-relaxed text-foreground/80">
        {text}
      </pre>
    </div>
  );
}
