import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MILESTONE_TEMPLATES, todayStr } from '@/lib/milestones';
import { useWorkT } from '@/lib/workI18n';

export default function MilestonePlanCreator({ onCreate, busy }) {
  const { tr, label, lang } = useWorkT();
  const [tpl, setTpl] = useState('general');
  const [start, setStart] = useState(todayStr());
  const [withOptional, setWithOptional] = useState(false);
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <p className="text-sm font-semibold">{tr('계획 만들기')}</p>
      {lang !== 'zh' && <p className="text-xs text-muted-foreground">템플릿과 시작일을 고르면 중국 휴무를 피한 근무일 기준으로 단계별 계획일이 채워집니다.</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">{tr('템플릿')}</Label>
          <Select value={tpl} onValueChange={setTpl}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(MILESTONE_TEMPLATES).map(([k, v]) => <SelectItem key={k} value={k}>{tr(v.name)} · {v.steps.length}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">{tr('시작일')}</Label>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9 text-sm" />
        </div>
      </div>
      {MILESTONE_TEMPLATES[tpl].steps.filter((st) => st.optional).map((st) => (
        <label key={st.key} className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={withOptional} onChange={(e) => setWithOptional(e.target.checked)} />{label(st)} · {tr('단계 포함')}
        </label>
      ))}
      <Button size="sm" disabled={busy || !start} onClick={() => onCreate(tpl, start, withOptional)}>{busy ? tr('저장 중…') : tr('계획 만들기')}</Button>
    </div>
  );
}