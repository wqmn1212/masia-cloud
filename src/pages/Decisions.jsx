import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, BookMarked } from 'lucide-react';
import DecisionCard from '@/components/decisions/DecisionCard';
import DecisionForm from '@/components/decisions/DecisionForm';
import { CATEGORY_LABELS, STATUS_META } from '@/components/decisions/decisionMeta';

export default function Decisions() {
  const qc = useQueryClient();
  const [user, setUser] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cardFilter, setCardFilter] = useState('all');

  React.useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);
  const canEdit = user?.account_tier === 'master' || user?.account_tier === 'service';

  const { data: decisions = [], isLoading } = useQuery({
    queryKey: ['decisions', 'all'],
    queryFn: () => base44.entities.DecisionLog.list('-decided_at', 500),
  });
  const { data: cards = [] } = useQuery({
    queryKey: ['taskcards-for-decisions'],
    queryFn: () => base44.entities.TaskCard.list('-updated_date', 500),
  });
  const cardMap = Object.fromEntries(cards.map(c => [c.id, c.title]));

  const invalidate = () => qc.invalidateQueries({ queryKey: ['decisions'] });
  const saveMut = useMutation({
    mutationFn: (data) => editing?.id
      ? base44.entities.DecisionLog.update(editing.id, data)
      : base44.entities.DecisionLog.create(data),
    onSuccess: () => { invalidate(); setFormOpen(false); setEditing(null); },
  });
  const delMut = useMutation({
    mutationFn: (d) => base44.entities.DecisionLog.delete(d.id),
    onSuccess: invalidate,
  });

  const filtered = decisions.filter(d =>
    (catFilter === 'all' || d.category === catFilter) &&
    (statusFilter === 'all' || d.status === statusFilter) &&
    (cardFilter === 'all' || d.card_id === cardFilter)
  );

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><BookMarked className="w-5 h-5" />결정 기록</h1>
          <p className="text-xs text-muted-foreground mt-0.5">기술적·상업적 결정과 기각된 대안의 이력</p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" />결정 추가
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 분류</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            {Object.entries(STATUS_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={cardFilter} onValueChange={setCardFilter}>
          <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 카드</SelectItem>
            {cards.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-10 text-center">불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">결정 기록이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(d => (
            <DecisionCard key={d.id} decision={d} cardTitle={cardMap[d.card_id]} canEdit={canEdit}
              onEdit={(dec) => { setEditing(dec); setFormOpen(true); }}
              onDelete={(dec) => { if (confirm('이 결정 기록을 삭제할까요?')) delMut.mutate(dec); }} />
          ))}
        </div>
      )}

      <DecisionForm open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }}
        onSave={(data) => saveMut.mutate(data)} initial={editing} cards={cards} />
    </div>
  );
}