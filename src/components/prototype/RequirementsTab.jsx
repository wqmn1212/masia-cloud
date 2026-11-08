import React, { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import RequirementFields, { REQUIREMENT_FIELDS } from '@/components/prototype/RequirementFields';
import ProtoFiles from '@/components/prototype/ProtoFiles';
import { INPUT_CATEGORIES } from '@/lib/prototype';
import { errorText } from '@/lib/prototypeApi';

export default function RequirementsTab({ project, user, onChanged }) {
  const pick = (p) => Object.fromEntries(REQUIREMENT_FIELDS.map((f) => [f.key, p[f.key] || '']));
  const [form, setForm] = useState(pick(project));
  const [saving, setSaving] = useState(false);
  useEffect(() => { setForm(pick(project)); }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = REQUIREMENT_FIELDS.some((f) => (project[f.key] || '') !== form[f.key]);
  const empty = REQUIREMENT_FIELDS.filter((f) => !String(project[f.key] || '').trim());

  const save = async () => {
    setSaving(true);
    try { await base44.entities.ProtoProject.update(project.id, form); onChanged(); toast({ title: '요구사항을 저장했습니다' }); }
    catch (e) { toast({ title: errorText(e), variant: 'destructive' }); }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-title font-semibold">요구사항</p>
            {empty.length > 0 && <p className="text-caption text-warning-text">비어 있음: {empty.map((f) => f.label).join(', ')} — AI가 누락 항목으로 표시합니다</p>}
          </div>
          <Button size="sm" onClick={save} disabled={!dirty || saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}저장</Button>
        </div>
        <RequirementFields value={form} onChange={setForm} />
      </div>
      <ProtoFiles project={project} user={user} categories={INPUT_CATEGORIES} onChanged={onChanged} title="도면·사진·참고 문서" />
    </div>
  );
}