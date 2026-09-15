import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import MeetingRecorderEngine from '@/components/taskcard/MeetingRecorderEngine';
export default function useMeetingRecorder(log, userId, onComplete, onBusy) {
  const [state, setState] = useState({ phase: 'idle', seconds: 0, saved: 0, error: '' });
  const engine = useRef(null), callbacks = useRef({ onComplete, onBusy });
  callbacks.current = { onComplete, onBusy };
  const qc = useQueryClient();
  useEffect(() => {
    const instance = new MeetingRecorderEngine(log, userId, setState, async () => {
      await qc.invalidateQueries({ queryKey: ['meeting-logs', log.card_id] });
      callbacks.current.onComplete();
    });
    engine.current = instance;
    let alive = true;
    instance.recoverable().then(parts => {
      if (alive && (parts.length || (log.audio_parts || []).some(p => !p.transcript_uri) || ['RECORDING','UPLOADING','TRANSCRIBING','FAILED'].includes(log.audio_status))) setState(s => ({ ...s, phase: 'error', error: '미완료 녹음이 있습니다. 저장된 구간을 복구해 주세요. 화면 종료 직전의 미저장 구간은 복구되지 않을 수 있습니다.' }));
    }).catch(error => { if (alive) setState(s => ({ ...s, error: `기기 임시 저장을 사용할 수 없습니다: ${error.message}` })); });
    return () => { alive = false; instance.dispose(); callbacks.current.onBusy(false); };
  }, [log.id, userId]);
  const busy = ['recording','paused','processing'].includes(state.phase);
  useEffect(() => {
    callbacks.current.onBusy(busy);
    const guard = e => { e.preventDefault(); e.returnValue = ''; };
    if (busy) window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [busy]);
  const start = async () => {
    try { await engine.current.start(); }
    catch (error) { setState(s => ({ ...s, phase: 'error', error: error.message })); }
  };
  return { ...state, busy, start, pause: () => engine.current.pause(), stop: () => engine.current.stop(), retry: () => engine.current.retry() };
}