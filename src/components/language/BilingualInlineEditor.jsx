import React, { useEffect, useState } from 'react';
import BilingualField from '@/components/language/BilingualField';

export default function BilingualInlineEditor({ record, field, onSave, saving, required, ...props }) {
  const [draft, setDraft] = useState(record);
  useEffect(() => setDraft(record), [record]);
  return <BilingualField {...props} record={draft} field={field} disabled={saving}
    onChange={(key, value) => setDraft(prev => ({ ...prev, [key]: value }))}
    onBlur={(key, value) => {
      if (value === (record[key] || '')) return;
      if (required && !value.trim() && !(draft[key === field ? `${field}_cn` : field] || '').trim()) return;
      onSave({ [key]: value });
    }} />;
}