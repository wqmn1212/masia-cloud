import React from 'react';
import { Input } from '@/components/ui/input';
import { DOCUMENT_TYPES } from '@/components/files/documentTypes';
export default function CompanyFileFilters({ value, onChange }) {
  const set = (key, next) => onChange({ ...value, [key]: next });
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"><label className="text-xs">카드명<Input value={value.card_name} onChange={e => set('card_name', e.target.value)} placeholder="카드명 검색" /></label><label className="text-xs">문서 유형<select value={value.document_type} onChange={e => set('document_type', e.target.value)} className="h-9 w-full border rounded-md bg-background px-2"><option value="">전체</option>{Object.entries(DOCUMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label><label className="text-xs">업로드 시작일<Input type="date" value={value.from_date} onChange={e => set('from_date', e.target.value)} /></label><label className="text-xs">업로드 종료일<Input type="date" value={value.to_date} onChange={e => set('to_date', e.target.value)} /></label></div>;
}