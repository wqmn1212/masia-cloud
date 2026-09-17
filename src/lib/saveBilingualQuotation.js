import { base44 } from '@/api/base44Client';
import { translateFieldsToCN, translateFieldsToKO } from '@/lib/translate';
import { toast } from '@/components/ui/use-toast';

export default async function saveBilingualQuotation(data) {
  const saved = await base44.entities.Quotation.create(data);
  const lines = saved.line_items || [];
  const koSource = {}, cnSource = {};
  lines.forEach((line, i) => {
    if (line.item_name_cn?.trim() && !line.item_name_ko?.trim()) cnSource[`item${i}`] = line.item_name_cn;
    if (line.item_name_ko?.trim() && !line.item_name_cn?.trim()) koSource[`item${i}`] = line.item_name_ko;
  });
  const [ko, cn] = await Promise.all([translateFieldsToKO(cnSource), translateFieldsToCN(koSource)]);
  if (ko.__translation_failed || cn.__translation_failed) toast({ title: '원문 저장됨 / 原文已保存', description: '자동 번역 미완료 / 自动翻译未完成' });
  const latest = await base44.entities.Quotation.get(saved.id);
  if (JSON.stringify(latest.line_items) !== JSON.stringify(lines)) return latest;
  const translated = lines.map((line, i) => ({ ...line, item_name_ko: line.item_name_ko || ko[`item${i}`] || '', item_name_cn: line.item_name_cn || cn[`item${i}`] || '' }));
  const result = JSON.stringify(translated) !== JSON.stringify(lines) ? await base44.entities.Quotation.update(saved.id, { line_items: translated }) : saved;
  return { ...result, __translation_failed: !!(ko.__translation_failed || cn.__translation_failed) };
}