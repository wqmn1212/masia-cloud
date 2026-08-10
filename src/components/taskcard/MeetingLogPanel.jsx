import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, CalendarDays } from 'lucide-react';
import MeetingLogForm from './MeetingLogForm';
import MeetingLogItem from './MeetingLogItem';

export default function MeetingLogPanel({ card, user }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const qc = useQueryClient();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['meeting-logs', card.id],
    queryFn: () => base44.entities.MeetingLog.filter({ card_id: card.id }, '-meeting_date'),
  });

  const createMut = useMutation({
    mutationFn: (form) => base44.entities.MeetingLog.create({
      ...form, card_id: card.id, created_by_name: user?.full_name || user?.email || '',
    }),
    onSuccess: () => { setAdding(false); qc.invalidateQueries({ queryKey: ['meeting-logs', card.id] }); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, form }) => base44.entities.MeetingLog.update(id, form),
    onSuccess: () => { setEditing(null); qc.invalidateQueries({ queryKey: ['meeting-logs', card.id] }); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.MeetingLog.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meeting-logs', card.id] }),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4" /> 미팅 일정 ({logs.length})
        </h4>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => { setEditing(null); setAdding(true); }}>
            <Plus className="h-3.5 w-3.5" /> 미팅 추가
          </Button>
        )}
      </div>

      {adding && (
        <MeetingLogForm
          saving={createMut.isPending}
          onSubmit={(form) => createMut.mutate(form)}
          onCancel={() => setAdding(false)}
        />
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">불러오는 중...</p>
      ) : logs.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">등록된 미팅이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {logs.map(l => (
            editing?.id === l.id ? (
              <MeetingLogForm
                key={l.id}
                initial={l}
                saving={updateMut.isPending}
                onSubmit={(form) => updateMut.mutate({ id: l.id, form })}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <MeetingLogItem
                key={l.id}
                log={l}
                onEdit={(log) => { setAdding(false); setEditing(log); }}
                onDelete={(id) => deleteMut.mutate(id)}
              />
            )
          ))}
        </div>
      )}
    </div>
  );
}