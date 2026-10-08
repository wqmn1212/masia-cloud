import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const EMPTY = { factory_id: '', start_date: '', end_date: '', note: '' };

export default function ClosureManager({ user, canEdit }) {
  const qc = useQueryClient();
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const { data: rows = [] } = useQuery({ queryKey: ['factory-closures'], queryFn: () => base44.entities.FactoryClosure.list('-start_date', 500) });
  const { data: factories = [] } = useQuery({ queryKey: ['factories-for-closure'], queryFn: () => base44.entities.Company.filter({ company_type: 'FACTORY' }, 'company_name', 500) });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    const factory = factories.find((x) => x.id === f.factory_id);
    await base44.entities.FactoryClosure.create({ ...f, tenant_id: user.tenant_id, factory_name: factory?.company_name || '' });
    await qc.invalidateQueries({ queryKey: ['factory-closures'] });
    setF(EMPTY); setBusy(false);
  };
  const remove = async (c) => {
    if (!window.confirm('이 공장 휴무를 삭제할까요?')) return;
    await base44.entities.FactoryClosure.delete(c.id);
    qc.invalidateQueries({ queryKey: ['factory-closures'] });
  };

  return (
    <section className="rounded-2xl border bg-card p-5 space-y-4">
      <div><h2 className="font-semibold">공장별 휴무</h2><p className="text-xs text-muted-foreground">정전·설비 점검 등 개별 일정. 고객에게는 보이지 않습니다.</p></div>
      {canEdit && (
        <form onSubmit={add} className="grid sm:grid-cols-[1.2fr_1fr_1fr_1.5fr_auto] gap-2">
          <select required value={f.factory_id} onChange={set('factory_id')} className="h-9 rounded-md border bg-transparent px-2 text-sm">
            <option value="">공장 선택</option>
            {factories.map((x) => <option key={x.id} value={x.id}>{x.company_name}</option>)}
          </select>
          <Input type="date" required value={f.start_date} onChange={set('start_date')} />
          <Input type="date" required value={f.end_date} onChange={set('end_date')} />
          <Input value={f.note} onChange={set('note')} placeholder="사유" />
          <Button type="submit" disabled={busy}>추가</Button>
        </form>
      )}
      {!rows.length ? <p className="text-sm text-muted-foreground py-4 text-center">등록된 공장 휴무가 없습니다.</p> : (
        <div className="divide-y">
          {rows.map((c) => (
            <div key={c.id} className="py-2.5 flex items-center gap-3 text-sm">
              <span className="font-medium w-40 truncate">{c.factory_name || c.factory_id}</span>
              <span>{c.start_date} ~ {c.end_date}</span>
              <span className="text-muted-foreground truncate">{c.note}</span>
              {canEdit && <Button size="icon" variant="ghost" className="ml-auto" onClick={() => remove(c)}><Trash2 /></Button>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}