import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import call from '@/components/taskcard/meetingAudioClient';
export default function useMeetingAnalysis(log, card, user, open) {
  const [state, setState] = useState({ loading: true, result: null, error: '', applied: false, adding: false, added: 0, applying: false });
  const [selected, setSelected] = useState({});
  const qc = useQueryClient();
  const patch = values => setState(s => ({ ...s, ...values }));
  const analyze = async () => {
    patch({ loading: true, error: '', result: null, applied: false, added: 0 });
    try { const data = await call(log.id, 'analyze'); patch({ result: data.result, analysisUri: data.analysis_uri }); setSelected({}); }
    catch (error) { patch({ error: error.message }); }
    finally { patch({ loading: false }); }
  };
  useEffect(() => { if (open) analyze(); }, [open, log.id]);
  const apply = async replace => {
    patch({ applying: true, error: '' });
    try { await call(log.id, 'apply', { analysis_uri: state.analysisUri, replace }); patch({ applied: true }); await qc.invalidateQueries({ queryKey: ['meeting-logs', card.id] }); }
    catch (error) { patch({ error: error.message }); }
    finally { patch({ applying: false }); }
  };
  const add = async () => {
    patch({ adding: true, error: '' });
    const picked = (state.result.tasks || []).filter((_,i) => selected[i]);
    try {
      await base44.entities.TaskItem.bulkCreate(picked.map(t => ({ tenant_id: card.tenant_id, card_id: card.id, title: t.title, description: `${t.description}\n(미팅 ${log.meeting_date} - ${log.title} 분석)`, status: 'TODO', priority: t.priority || 'MEDIUM', ...(/^\d{4}-\d{2}-\d{2}$/.test(t.due_date || '') ? { due_date: t.due_date } : {}), assignee_name: user?.full_name || user?.email || '' })));
      patch({ added: picked.length }); qc.invalidateQueries({ queryKey: ['task-items', card.id] }); qc.invalidateQueries({ queryKey: ['task-items-all'] });
    } catch (error) { patch({ error: error.message }); }
    finally { patch({ adding: false }); }
  };
  return { ...state, selected, setSelected, analyze, apply, add };
}