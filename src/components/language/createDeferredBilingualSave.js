import { base44 } from '@/api/base44Client';
import { bilingualFields } from '@/lib/saveBilingual';
import translateChangedFields from '@/components/language/translateChangedFields';
import { toast } from '@/components/ui/use-toast';

export const cleanDraft = value => Object.fromEntries(Object.entries(value).filter(([key]) => !key.startsWith('__') && !['id', 'created_date', 'updated_date', 'created_by_id'].includes(key)));
const same = (a, b) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '');
export default function createDeferredBilingualSave(entity, id, initial, callbacks) {
  const api = base44.entities[entity], fields = bilingualFields[entity] || [];
  let desired = cleanDraft(initial), acknowledged = { ...desired }, revision = 0;
  let rawTimer, translationTimer, running, leaving = false, chain = Promise.resolve();
  const pending = new Map();
  const notify = status => callbacks.status(status);
  const synchronize = (patch, before) => {
    const safe = Object.fromEntries(Object.entries(patch).filter(([key]) => same(desired[key], before[key])));
    desired = { ...desired, ...safe };
    acknowledged = { ...acknowledged, ...safe };
    callbacks.patch(safe, before);
  };
  const persist = () => {
    clearTimeout(rawTimer);
    const operation = chain.then(async () => {
      const snapshot = { ...desired };
      const patch = Object.fromEntries(Object.entries(snapshot).filter(([key, value]) => !same(value, acknowledged[key])));
      if (!Object.keys(patch).length) return true;
      notify('saving');
      const current = await api.get(id), jobs = [], generated = {};
      for (const field of fields) {
        const cn = `${field}_cn`, koChanged = field in patch, cnChanged = cn in patch;
        if (!koChanged && !cnChanged) continue;
        pending.delete(field);
        if (koChanged && cnChanged) continue; // Both explicitly edited: preserve both.
        const source = cnChanged ? cn : field, target = cnChanged ? field : cn;
        if (target === cn && current.cn_manual) continue;
        generated[target] = '';
        if (String(snapshot[source] || '').trim()) jobs.push({ field, source, target, value: snapshot[source], expected: '' });
      }
      const saved = await api.update(id, { ...patch, ...generated });
      acknowledged = snapshot;
      for (const job of jobs) pending.set(job.field, job);
      synchronize(generated, snapshot);
      callbacks.saved(saved);
      notify(pending.size ? 'pending' : 'saved');
      return true;
    });
    chain = operation.catch(error => {
      notify('error');
      toast({ title: '원문 저장 실패 / 原文保存失败', description: error.message, variant: 'destructive' });
      return false;
    });
    return chain;
  };
  const flush = async () => {
    clearTimeout(translationTimer);
    if (!await persist()) return;
    if (running) return running;
    const batch = [...pending.values()];
    if (!batch.length) return;
    const version = revision;
    running = (async () => {
      notify('translating');
      try {
        const result = await translateChangedFields(batch);
        if (batch.some((_, i) => typeof result?.[`text${i}`] !== 'string' || !result[`text${i}`].trim())) throw new Error('Incomplete translation');
        await chain;
        const latest = await api.get(id);
        if (version !== revision) return;
        const patch = {};
        batch.forEach((job, index) => {
          if (pending.get(job.field) === job && latest[job.source] === job.value && same(latest[job.target], job.expected) && !(job.target.endsWith('_cn') && latest.cn_manual)) patch[job.target] = result[`text${index}`];
        });
        if (Object.keys(patch).length) {
          const before = { ...desired };
          const saved = await api.update(id, patch);
          synchronize(patch, before);
          callbacks.saved(saved);
        }
        batch.forEach(job => { if (pending.get(job.field) === job) pending.delete(job.field); });
        notify(pending.size ? 'pending' : 'translated');
      } catch (error) {
        // No automatic retry loop: keep the saved original; missing translations can be backfilled.
        batch.forEach(job => { if (pending.get(job.field) === job) pending.delete(job.field); });
        notify('translationError');
        toast({ title: '원문 저장됨 · 번역 미완료 / 原文已保存 · 翻译未完成', description: '번역 보충으로 나중에 재시도하세요. / 请稍后补译。' });
      } finally {
        running = null;
        if (pending.size) translationTimer = setTimeout(flush, leaving ? 0 : 15000);
      }
    })();
    return running;
  };
  return {
    update(value) {
      const next = cleanDraft(value);
      if (same(next, desired)) return;
      desired = next; revision += 1;
      clearTimeout(rawTimer); clearTimeout(translationTimer);
      notify('saving');
      rawTimer = setTimeout(persist, 700);
      translationTimer = setTimeout(flush, 15000);
    },
    flush,
    close() { leaving = true; return flush(); },
    resume() { leaving = false; },
  };
}