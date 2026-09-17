import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, CalendarDays } from 'lucide-react';
import MeetingLogForm from './MeetingLogForm';
import MeetingLogItem from './MeetingLogItem';
import MeetingAnalysisDialog from './MeetingAnalysisDialog';
import MeetingRecordingLibrary from './MeetingRecordingLibrary';
import { translateFieldsToCN } from '@/lib/translate';

export default function MeetingLogPanel({ card, user, onRecordingBusy = () => {} }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [analyzing, setAnalyzing] = useState(null);
  const [recordingId, setRecordingId] = useState(null);
  useEffect(() => { onRecordingBusy(!!recordingId); }, [recordingId]);
  const qc = useQueryClient();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['meeting-logs', card.id],
    queryFn: () => base44.entities.MeetingLog.filter({ card_id: card.id }, '-meeting_date'),
  });

  const createMut = useMutation({
    mutationFn: async (form) => {
      const cn = await translateFieldsToCN({ title: form.title, attendees: form.attendees, notes: form.notes, decisions: form.decisions, next_steps: form.next_steps });
      return base44.entities.MeetingLog.create({ ...form, ...Object.fromEntries(Object.entries(cn).filter(([k]) => !k.startsWith('__')).map(([k, v]) => [`${k}_cn`, v])), tenant_id: card.tenant_id, card_id: card.id, created_by_name: user?.full_name || user?.email || '' });
    },
    onSuccess: () => { setAdding(false); qc.invalidateQueries({ queryKey: ['meeting-logs', card.id] }); },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, form }) => {
      const cn = await translateFieldsToCN({ title: form.title, attendees: form.attendees, notes: form.notes, decisions: form.decisions, next_steps: form.next_steps });
      const translated = Object.fromEntries(Object.entries(cn).filter(([k]) => !k.startsWith('__')).map(([k, v]) => [`${k}_cn`, v]));
      return base44.entities.MeetingLog.update(id, { ...form, ...translated });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meeting-logs', card.id] }),
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
          <Button size="sm" variant="outline" disabled={!!recordingId} onClick={() => { setEditing(null); setAdding(true); }}>
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
                autoSave
                saving={updateMut.isPending}
                onSubmit={(form) => updateMut.mutate({ id: l.id, form })}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <MeetingLogItem
                key={l.id}
                log={l}
                userId={user?.id}
                disabled={!!recordingId}
                recordDisabled={!!recordingId && recordingId !== l.id}
                onBusy={busy => setRecordingId(prev => busy ? l.id : prev === l.id ? null : prev)}
                onEdit={(log) => { setAdding(false); setEditing(log); }}
                onDelete={(id) => deleteMut.mutate(id)}
                onAnalyze={(log) => setAnalyzing(log)}
              />
            )
          ))}
        </div>
      )}

      <MeetingRecordingLibrary logs={logs} />

      {analyzing && (
        <MeetingAnalysisDialog
          open={!!analyzing}
          log={analyzing}
          card={card}
          user={user}
          onClose={() => setAnalyzing(null)}
        />
      )}
    </div>
  );
}