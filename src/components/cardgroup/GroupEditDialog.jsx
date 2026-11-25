import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { CARD_STATUS } from '@/lib/cardGroup';

// 그룹 만들기·고치기: 이름, 고객사, 묶을 카드, 대표 카드
export default function GroupEditDialog({ open, onClose, group, user, onSaved }) {
  const [form, setForm] = useState(() => ({
    name: group?.name || '', description: group?.description || '', client_id: group?.client_id || '',
    card_ids: group?.card_ids || [], main_card_id: group?.main_card_id || '',
  }));
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const { data: clients = [] } = useQuery({ queryKey: ['group-clients'], queryFn: () => base44.entities.Company.filter({ company_type: 'CLIENT' }, 'company_name', 500) });
  const { data: cards = [], isLoading } = useQuery({ queryKey: ['group-card-pick'], queryFn: () => base44.entities.TaskCard.list('-updated_date', 500) });

  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return cards.filter((c) => (form.card_ids.includes(c.id))
      || ((showAll || c.status !== 'CANCELLED') && (!form.client_id || c.client_id === form.client_id)
        && words.every((w) => `${c.title} ${c.client_name || ''}`.toLowerCase().includes(w))));
  }, [cards, q, form.client_id, form.card_ids, showAll]);

  const toggle = (id) => set('card_ids', form.card_ids.includes(id) ? form.card_ids.filter((x) => x !== id) : [...form.card_ids, id]);
  const save = async () => {
    if (!form.name.trim()) { setError('그룹 이름을 적어 주세요'); return; }
    setBusy(true); setError('');
    try {
      const client = clients.find((c) => c.id === form.client_id);
      const main = form.card_ids.includes(form.main_card_id) ? form.main_card_id : form.card_ids[0] || '';
      const data = { name: form.name.trim(), description: form.description.trim(), client_id: form.client_id, client_name: client?.company_name || '', card_ids: form.card_ids, main_card_id: main, updated_by_name: user?.full_name || '' };
      const saved = group?.id
        ? await base44.entities.CardGroup.update(group.id, data)
        : await base44.entities.CardGroup.create({ ...data, tenant_id: user?.tenant_id, status: 'ACTIVE', created_by_name: user?.full_name || '' });
      onSaved?.(saved);
      onClose();
    } catch (e) { setError(e?.message || '저장하지 못했습니다'); }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{group?.id ? '그룹 고치기' : '새 프로젝트 그룹'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <label className="block text-label font-medium">그룹 이름
            <Input className="mt-1" value={form.name} placeholder="예: N30 미샤 RF써마 프로" onChange={(e) => set('name', e.target.value)} />
          </label>
          <label className="block text-label font-medium">설명 (선택)
            <Textarea className="mt-1" rows={2} value={form.description} placeholder="예: 레지에나 제조 업무 전체 · 조립 비트라테크" onChange={(e) => set('description', e.target.value)} />
          </label>
          <label className="block text-label font-medium">고객사
            <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-body" value={form.client_id} onChange={(e) => set('client_id', e.target.value)}>
              <option value="">고객사 없음 · 모든 카드에서 고르기</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </label>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-label font-medium">묶을 카드 <span className="text-muted-foreground">· {form.card_ids.length}장 선택</span></p>
              <label className="ml-auto flex items-center gap-1.5 text-caption text-muted-foreground"><Checkbox checked={showAll} onCheckedChange={(v) => setShowAll(!!v)} />취소된 카드도 보기</label>
            </div>
            <div className="relative mt-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="h-9 pl-8" value={q} placeholder="카드 이름으로 찾기 (예: N30)" onChange={(e) => setQ(e.target.value)} /></div>
            <div className="mt-2 max-h-72 divide-y overflow-y-auto rounded-lg border">
              {isLoading && <p className="flex items-center gap-2 p-3 text-caption text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />카드를 불러오는 중</p>}
              {!isLoading && !shown.length && <p className="p-3 text-caption text-muted-foreground">맞는 카드가 없습니다</p>}
              {shown.map((c) => {
                const on = form.card_ids.includes(c.id);
                return (
                  <div key={c.id} className={`flex items-center gap-2 px-3 py-2 ${on ? 'bg-primary/5' : ''}`}>
                    <Checkbox checked={on} onCheckedChange={() => toggle(c.id)} aria-label={`${c.title} 묶기`} />
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => toggle(c.id)}>
                      <span className="block truncate text-body">{c.title}</span>
                      <span className="text-caption text-muted-foreground">{c.client_name || '고객사 없음'} · {CARD_STATUS[c.status] || c.status}</span>
                    </button>
                    {on && (
                      <button type="button" onClick={() => set('main_card_id', c.id)} className={`shrink-0 rounded-md border px-2 py-0.5 text-micro ${form.main_card_id === c.id ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                        {form.main_card_id === c.id ? '대표 카드' : '대표로'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-1 text-caption text-muted-foreground">대표 카드는 그룹 회의록·문서를 주로 쌓는 카드입니다. 정하지 않으면 첫 카드가 대표가 됩니다.</p>
          </div>
          {error && <p className="text-label text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>닫기</Button>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
