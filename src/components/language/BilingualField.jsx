import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function BilingualField({ record, field, chineseField = `${field}_cn`, onChange, onBlur, multiline, disabled, className = '', ...props }) {
  const [language, setLanguage] = useState('ko');
  const key = language === 'zh' ? chineseField : field;
  const Control = multiline ? Textarea : Input;
  return <div className="min-w-0 flex-1 space-y-1">
    <div className="flex justify-end gap-1" role="group" aria-label="입력 언어 / 输入语言">
      {['ko', 'zh'].map(lang => <button key={lang} type="button" disabled={disabled} aria-pressed={language === lang}
        className={`rounded px-2 py-0.5 text-[10px] font-semibold transition-colors ${language === lang ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
        onMouseDown={e => e.preventDefault()} onClick={() => setLanguage(lang)}>{lang === 'ko' ? 'KR' : 'CN'}</button>)}
    </div>
    <Control {...props} disabled={disabled} className={className} lang={language === 'zh' ? 'zh-CN' : 'ko'}
      value={record?.[key] || ''} onChange={e => onChange(key, e.target.value)} onBlur={e => onBlur?.(key, e.target.value)} />
  </div>;
}