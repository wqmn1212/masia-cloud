import React, { useState } from 'react';
import { Check, X, Pencil, Copy, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { actorName, errorText } from '@/lib/prototypeApi';

// 승인·반려·수정·복제. 승인하면 현재 설계가 되고 단계가 '제작'으로 넘어간다.
export default function VersionActions({ project, version, versions, user, onEdit, onChanged }) {
  const [busy, setBusy] = useState('');
  const log = (action, note) => [...(version.history || []), { at: new Date().toISOString(), by: actorName(user), action, note: note || '' }];

  const run = async (key, fn) => {
    setBusy(key);
    try { await fn(); onChanged(); } catch (e) { toast({ title: errorText(e), variant: 'destructive' }); }
    setBusy('');
  };

  const approve = () => run('approve', async () => {
    const note = window.prompt('승인 메모 (선택)') ?? null;
    if (note === null) return;
    const now = new Date().toISOString();
    await base44.entities.ProtoDesignVersion.update(version.id, { status: 'APPROVED', review_note: note, reviewed_by_name: actorName(user), reviewed_at: now, history: log('승인', note) });
    await base44.entities.ProtoProject.update(project.id, { current_version_id: version.id, stage: ['REQUIREMENTS', 'DESIGN', 'IMPROVE'].includes(project.stage) ? 'BUILD' : project.stage });
  });

  const reject = () => run('reject', async () => {
    const note = window.prompt('반려 사유');
    if (!note) return;
    await base44.entities.ProtoDesignVersion.update(version.id, { status: 'REJECTED', review_note: note, reviewed_by_name: actorName(user), reviewed_at: new Date().toISOString(), history: log('반려', note) });
  });

  const duplicate = () => run('copy', async () => {
    const { id, created_date, updated_date, created_by_id, history, review_note, reviewed_by_name, reviewed_at, ...rest } = version;
    const no = Math.max(...versions.map((v) => v.version_no || 0)) + 1;
    await base44.entities.ProtoDesignVersion.create({
      ...rest, version_no: no, source: 'MANUAL', status: 'REVIEW', based_on_version_id: version.id, source_test_id: null,
      change_note: `v${version.version_no} 복제`, created_by_name: actorName(user),
      history: [{ at: new Date().toISOString(), by: actorName(user), action: `v${version.version_no}에서 복제`, note: '' }],
    });
  });

  const editable = version.status !== 'APPROVED';
  return (
    <div className="flex flex-wrap gap-2">
      {editable && <Button size="sm" onClick={approve} disabled={!!busy}>{busy === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}승인</Button>}
      {editable && version.status !== 'REJECTED' && <Button size="sm" variant="outline" onClick={reject} disabled={!!busy}><X className="w-4 h-4" />반려</Button>}
      {editable && <Button size="sm" variant="outline" onClick={onEdit} disabled={!!busy}><Pencil className="w-4 h-4" />수정</Button>}
      <Button size="sm" variant="ghost" onClick={duplicate} disabled={!!busy}>{busy === 'copy' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}새 버전으로 복제</Button>
    </div>
  );
}