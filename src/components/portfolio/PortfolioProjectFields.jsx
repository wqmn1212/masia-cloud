import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PORTFOLIO_REGIONS, PORTFOLIO_TYPES } from '@/lib/portfolioMeta';

// 지역 · 연도 · 프로젝트 유형
export default function PortfolioProjectFields({ form, setForm }) {
  const pick = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));
  return (
    <div className="grid sm:grid-cols-3 gap-4">
      <div>
        <Label>생산 지역</Label>
        <Select value={form.region || ''} onValueChange={pick('region')}>
          <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
          <SelectContent>{PORTFOLIO_REGIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label>진행 연도</Label>
        <Input type="number" value={form.project_year || ''} placeholder="2026"
          onChange={(e) => setForm((f) => ({ ...f, project_year: e.target.value }))} />
      </div>
      <div>
        <Label>프로젝트 유형</Label>
        <Select value={form.project_type || ''} onValueChange={pick('project_type')}>
          <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
          <SelectContent>{PORTFOLIO_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
  );
}