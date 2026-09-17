export function cnOrKo(record, field, lang = 'ko') {
  if (!record) return '';
  return lang === 'zh' ? (record[`${field}_cn`] || record[field] || '') : (record[field] || record[`${field}_cn`] || '');
}

export function hasChinese(record, fields) {
  return fields.some((field) => Boolean(record?.[`${field}_cn`]?.trim()));
}