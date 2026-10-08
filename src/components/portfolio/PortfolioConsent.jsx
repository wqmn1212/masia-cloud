import React, { useEffect, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

// 고객 동의 확인 체크 + 근거 메모 (master·service 전용)
export default function PortfolioConsent({ item, onPatch }) {
  const [note, setNote] = useState(item.consent_note || '');
  useEffect(() => setNote(item.consent_note || ''), [item.consent_note]);
  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-1.5 text-xs font-medium whitespace-nowrap cursor-pointer">
        <Checkbox checked={!!item.consent_confirmed} onCheckedChange={(v) => onPatch(item, { consent_confirmed: !!v })} />
        고객 동의 확인
      </label>
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => note !== (item.consent_note || '') && onPatch(item, { consent_note: note })}
        placeholder="근거 (예: 계약서 제7조 / 메일 동의)"
        className="h-8 w-56 text-xs"
      />
    </div>
  );
}