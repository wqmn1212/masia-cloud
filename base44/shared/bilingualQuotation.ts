import { hasText, translateTextFields } from './bilingualTranslation.ts';
export async function fillQuotationNames(svc, row, target) {
  const sourceKey = target === 'ko' ? 'item_name_cn' : 'item_name_ko';
  const targetKey = target === 'ko' ? 'item_name_ko' : 'item_name_cn';
  const lines = row.line_items || [];
  const source = Object.fromEntries(lines.flatMap((line, i) => hasText(line[sourceKey]) && !hasText(line[targetKey]) ? [[`item${i}`, line[sourceKey]]] : []));
  if (!Object.keys(source).length) return false;
  const result = await translateTextFields(svc, source, target);
  const latest = await svc.entities.Quotation.get(row.id);
  if (JSON.stringify(latest.line_items) !== JSON.stringify(lines)) return false;
  await svc.entities.Quotation.update(row.id, { line_items: lines.map((line, i) => result[`item${i}`] ? { ...line, [targetKey]: result[`item${i}`] } : line) });
  return true;
}