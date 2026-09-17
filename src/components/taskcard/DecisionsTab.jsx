import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, BookMarked } from 'lucide-react';
import DecisionCard from '@/components/decisions/DecisionCard';
import DecisionForm from '@/components/decisions/DecisionForm';
import { translateFieldsToCN } from '@/lib/translate';

export default function DecisionsTab({ card, user }) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const canEdit = user?.account_tier === 'master' || user?.account_tier === 'service';

  const { data: decisions = [], isLoading } = useQuery({
    queryKey: ['decisions', card.id],
    queryFn: () => base44.entities.DecisionLog.filter({ card_id: card.id }, '-decided_at'),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['decisions'] });

  const saveMut = useMutation({
    mutationFn: async (data) => {
      const cn = await translateFieldsToCN({ topic: data.topic, decision: data.decision, rationale: data.rationale });
      const translated = Object.fromEntries(Object.entries(cn).filter(([k]) => !k.startsWith('__')).map(([k, v]) => [`${k}_cn`, v]));
      return editing?.id
        ? base44.entities.DecisionLog.update(editing.id, { ...data, ...translated })
        : base44.entities.DecisionLog.create({ ...data, ...translated, tenant_id: card.tenant_id, card_id: card.id });
    },
    onSuccess: () => { invalidate(); setFormOpen(false); setEditing(null); },
  });
  const delMut = useMutation({
    mutationFn: (d) => base44.entities.DecisionLog.delete(d.id),
    onSuccess: invalidate,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5"><BookMarked className="w-4 h-4" />결정 기록</h3>
        {canEdit && (
          <Button size="sm" className="h-8 text-xs" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="w-3.5 h-3.5 mr-1" />결정 추가
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground py-6 text-center">불러오는 중...</p>
      ) : decisions.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">기록된 결정이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {decisions.map(d => (
            <DecisionCard key={d.id} decision={d} canEdit={canEdit}
              onEdit={(dec) => { setEditing(dec); setFormOpen(true); }}
              onDelete={(dec) => { if (confirm('이 결정 기록을 삭제할까요?')) delMut.mutate(dec); }} />
          ))}
        </div>
      )}

      <DecisionForm open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }}
        onSave={(data) => saveMut.mutate(data)} initial={editing} fixedCardId={card.id} />
    </div>
  );
}