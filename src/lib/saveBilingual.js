import { base44 } from '@/api/base44Client';
import { translateFieldsToCN, translateFieldsToKO } from '@/lib/translate';
import { toast } from '@/components/ui/use-toast';

export const bilingualFields = {
  TaskCard: ['title', 'hq_requirements', 'agent_meeting_notes'],
  TaskItem: ['title', 'description'],
  MeetingLog: ['title', 'attendees', 'notes', 'decisions', 'next_steps'],
  DecisionLog: ['topic', 'decision', 'rationale'],
  CardChat: ['message_text'],
};
export const editBilingual = (record, key, value) => ({ ...record, [key]: value, __bilingualDirty: { ...record.__bilingualDirty, [key]: true } });
const text = value => typeof value === 'string' && value.trim().length > 0;
export async function saveBilingual(entity, input, id) {
  const api = base44.entities[entity];
  const current = id ? await api.get(id) : {};
  const data = Object.fromEntries(Object.entries(input).filter(([k]) => !k.startsWith('__') && !['id', 'created_date', 'updated_date', 'created_by_id'].includes(k)));
  const toCN = {}, toKO = {};
  for (const field of bilingualFields[entity] || []) {
    const cn = `${field}_cn`;
    if (id && input.__bilingualDirty) {
      if (!input.__bilingualDirty[field]) delete data[field];
      if (!input.__bilingualDirty[cn]) delete data[cn];
    }
    if (!id && text(data[cn]) && data[field] === undefined) data[field] = '';
    // Do not erase translations from an older, still-open form.
    if (id && data[field] === '' && text(current[field]) && text(data[cn])) delete data[field];
    if (id && data[cn] === '' && text(current[cn]) && text(data[field])) delete data[cn];
    const value = { ...current, ...data };
    const manual = value.cn_manual === true;
    const cnChanged = data[cn] !== undefined && data[cn] !== current[cn];
    const koChanged = data[field] !== undefined && data[field] !== current[field];
    if (text(value[cn]) && !text(value[field])) toKO[field] = value[cn];
    else if (text(value[field]) && !cnChanged && (!text(value[cn]) || (!manual && koChanged))) toCN[field] = value[field];
    // Never show an old automatic Chinese translation after Korean text changes.
    if (toCN[field] || (!manual && koChanged && !cnChanged)) data[cn] = '';
  }
  const saved = id ? await api.update(id, data) : await api.create(data);
  const [cn, ko] = await Promise.all([translateFieldsToCN(toCN), translateFieldsToKO(toKO)]);
  if (cn.__translation_failed || ko.__translation_failed) toast({ title: '원문 저장됨 / 原文已保存', description: '자동 번역을 완료하지 못했습니다. 번역 보충으로 재시도하세요. / 自动翻译未完成，可稍后补译。' });
  if (!Object.keys(toCN).length && !Object.keys(toKO).length) return saved;
  const latest = await api.get(saved.id);
  const patch = {};
  for (const field of Object.keys(toCN)) if (text(cn[field]) && latest[field] === toCN[field] && !text(latest[`${field}_cn`])) patch[`${field}_cn`] = cn[field];
  for (const field of Object.keys(toKO)) if (text(ko[field]) && latest[`${field}_cn`] === toKO[field] && !text(latest[field])) patch[field] = ko[field];
  const result = Object.keys(patch).length ? await api.update(saved.id, patch) : latest;
  return { ...result, __translation_failed: !!(cn.__translation_failed || ko.__translation_failed) };
}