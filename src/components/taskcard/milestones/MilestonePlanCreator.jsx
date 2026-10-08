import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MILESTONE_TEMPLATES } from '@/lib/milestones';

export default function MilestonePlanCreator({ onCreate, busy }) {
  const [tpl, setTpl] = useState('general');
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <p className="text-sm font-semibold">마일스톤 계획 만들기</p>
      <p className="text-xs text-muted-foreground">템플릿과 시작일을 고르면 중국 휴무를 피한 근무일 기준으로 단계별 계획일이 채워집니다.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">템플릿</Label>
          <Select value={tpl} onValueChange={setTpl}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(MILESTONE_TEMPLATES).map(([k, v]) => <SelectItem key={k} value={k}>{v.name} · {v.steps.length}단계</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">시작일</Label>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9 text-sm" />
        </div>
      </div>
      <Button size="sm" disabled={busy || !start} onClick={() => onCreate(tpl, start)}>{busy ? '생성 중…' : '계획 생성'}</Button>
    </div>
  );
}