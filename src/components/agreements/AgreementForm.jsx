import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/use-toast';
import { AGREEMENT_STATUS, TERM_OPTIONS, endDateOf, kstToday } from '@/lib/agreements';

const select = 'mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm';
const blank = () => ({ company_id: '', title: '', agreement_no: '', start_date: kstToday(), term_months: 3, end_date: endDateOf(kstToday(), 3), monthly_fee: '', currency: 'KRW', factory_rebate_percent: 10, assigned_user_ids: [], status: 'DRAFT', note: '' });

// 월 계약 기본 정보. 월 계약료·페이백 비율은 필드 보안으로 대표·팀 관리자만 읽고 쓴다.
export default function AgreementForm({ agreement, companies, team, onSaved }) {
  const [f, setF] = useState(blank);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setF(agreement ? { ...blank(), ...agreement, monthly_fee: agreement.monthly_fee ?? '', assigned_user_ids: agreement.assigned_user_ids || [] } : blank()); }, [agreement]);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setPeriod = (start, months) => setF((x) => ({ ...x, start_date: start, term_months: months, end_date: endDateOf(start, months) }));
  const toggleUser = (id, on) => set('assigned_user_ids', on ? [...f.assigned_user_ids, id] : f.assigned_user_ids.filter((x) => x !== id));

  const save = async () => {
    if (!f.company_id) return toast({ title: '고객사를 선택하세요', variant: 'destructive' });
    if (!f.start_date || !f.end_date || f.end_date < f.start_date) return toast({ title: '계약 기간을 확인하세요', variant: 'destructive' });
    setSaving(true);
    try {
      const company = companies.find((c) => c.id === f.company_id);
      const data = {
        company_id: f.company_id, company_name: company?.company_name || f.company_name || '', title: f.title.trim(), agreement_no: f.agreement_no.trim(),
        start_date: f.start_date, end_date: f.end_date, term_months: Number(f.term_months), currency: f.currency,
        monthly_fee: f.monthly_fee === '' ? null : Number(f.monthly_fee), factory_rebate_percent: Number(f.factory_rebate_percent),
        assigned_user_ids: f.assigned_user_ids, status: f.status, note: f.note,
      };
      const saved = agreement?.id ? await base44.entities.ServiceAgreement.update(agreement.id, data) : await base44.entities.ServiceAgreement.create(data);
      toast({ title: agreement?.id ? '계약을 저장했습니다' : '계약을 만들었습니다' });
      onSaved({ ...agreement, ...data, ...saved });
    } catch (e) {
      toast({ title: '저장하지 못했습니다', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs">고객사
          <select className={select} value={f.company_id} disabled={!!agreement?.id} onChange={(e) => set('company_id', e.target.value)}>
            <option value="">선택</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
        </label>
        <label className="text-xs">상태
          <select className={select} value={f.status} onChange={(e) => set('status', e.target.value)}>
            {Object.entries(AGREEMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        <div><Label className="text-xs">계약명</Label><Input value={f.title} maxLength={120} placeholder="예: 생활가전 OEM 현지 관리" onChange={(e) => set('title', e.target.value)} /></div>
        <div><Label className="text-xs">계약 번호</Label><Input value={f.agreement_no} maxLength={40} placeholder="예: AG-2026-011" onChange={(e) => set('agreement_no', e.target.value)} /></div>
        <div><Label className="text-xs">시작일</Label><Input type="date" value={f.start_date} onChange={(e) => setPeriod(e.target.value, f.term_months)} /></div>
        <label className="text-xs">기간
          <select className={select} value={f.term_months} onChange={(e) => setPeriod(f.start_date, Number(e.target.value))}>
            {TERM_OPTIONS.map((m) => <option key={m} value={m}>{m}개월</option>)}
          </select>
        </label>
        <div><Label className="text-xs">종료일 (자동 계산, 수정 가능)</Label><Input type="date" value={f.end_date} onChange={(e) => set('end_date', e.target.value)} /></div>
        <div className="grid grid-cols-[1fr_88px] gap-2">
          <div><Label className="text-xs">월 계약료 (VAT 별도)</Label><Input type="number" min={0} step={10000} value={f.monthly_fee} placeholder="예: 1500000" onChange={(e) => set('monthly_fee', e.target.value)} /></div>
          <label className="text-xs">통화
            <select className={select} value={f.currency} onChange={(e) => set('currency', e.target.value)}>{['KRW', 'USD', 'CNY'].map((c) => <option key={c}>{c}</option>)}</select>
          </label>
        </div>
        <div><Label className="text-xs">공장 페이백 비율 % (내부 전용)</Label><Input type="number" min={0} max={100} value={f.factory_rebate_percent} onChange={(e) => set('factory_rebate_percent', e.target.value)} /></div>
      </div>
      <div>
        <Label className="text-xs">담당 팀 (고객 포털에 이름이 보입니다)</Label>
        <div className="mt-1 grid gap-1.5 rounded-lg border p-2 sm:grid-cols-2">
          {team.length === 0 && <p className="text-xs text-muted-foreground">팀원이 없습니다.</p>}
          {team.map((u) => (
            <label key={u.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={f.assigned_user_ids.includes(u.id)} onCheckedChange={(v) => toggleUser(u.id, !!v)} />
              {u.full_name || u.email}<span className="text-[11px] text-muted-foreground">{u.account_tier === 'service' ? '관리자' : '팀원'}</span>
            </label>
          ))}
        </div>
      </div>
      <div><Label className="text-xs">메모 (내부)</Label><Textarea rows={2} value={f.note || ''} onChange={(e) => set('note', e.target.value)} /></div>
      <div className="flex justify-end"><Button onClick={save} disabled={saving}>{saving ? '저장 중…' : '저장'}</Button></div>
    </div>
  );
}
