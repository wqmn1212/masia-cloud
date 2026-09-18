import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import createDeferredBilingualSave, { cleanDraft } from '@/components/language/createDeferredBilingualSave';

export default function useDeferredBilingualSave({ entity, id, form, setForm, initialForm, onSaved, enabled = true }) {
  const [status, setStatus] = useState('saved');
  const latest = useRef({ form, setForm, onSaved });
  latest.current = { form, setForm, onSaved };
  const controller = useRef(null);
  useLayoutEffect(() => {
    if (!enabled || !id) return;
    let live = true;
    const session = createDeferredBilingualSave(entity, id, initialForm || form, {
      status: value => { if (live) setStatus(value); },
      saved: saved => latest.current.onSaved?.(saved),
      patch: (patch, before) => {
        if (!live || !Object.keys(patch).length) return;
        latest.current.setForm(current => ({ ...current, ...Object.fromEntries(Object.entries(patch).filter(([key]) => (current[key] ?? '') === (before[key] ?? ''))) }));
      },
    });
    controller.current = session;
    return () => { live = false; session.close(); controller.current = null; };
  }, [entity, id, enabled]);
  const fingerprint = JSON.stringify(cleanDraft(form));
  useLayoutEffect(() => { controller.current?.update(latest.current.form); }, [fingerprint, entity, id, enabled]);
  useEffect(() => {
    const hidden = () => { if (document.visibilityState === 'hidden') controller.current?.flush(); };
    document.addEventListener('visibilitychange', hidden);
    return () => document.removeEventListener('visibilitychange', hidden);
  }, []);
  return { status, flush: () => controller.current?.flush() };
}