import React, { useState } from 'react';
import { Check, X, Pencil, Copy, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { actorName, errorText, protoAction } from '@/lib/prototypeApi';

// 승인·반려·수정·복제. 승인하면 현재 설계가 되고(이전 승인본은 '대체됨') 단계가 '제작'으로 넘어간다.
export default function VersionActions({ project, version, user, onEdit, onChanged }) {
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
    await protoAction('approve_version', { project_id: project.id, version_id: version.id, note });
  });

  const reject = () => run('reject', async () => {
    const note = window.prompt('반려 사유');
    if (!note) return;
    await base44.entities.ProtoDesignVersion.update(version.id, { status: 'REJECTED', review_note: note, reviewed_by_name: actorName(user), reviewed_at: new Date().toISOString(), history: log('반려', note) });
  });

  const duplicate = () => run('copy', () => protoAction('duplicate_version', { project_id: project.id, version_id: version.id }));

  // 승인본·대체된 버전은 고치지 않고 복제해서 새 버전으로 고친다. 대체된 버전은 다시 승인할 수 있다.
  const canApprove = version.status !== 'APPROVED';
  const editable = !['APPROVED', 'SUPERSEDED'].includes(version.status);
  return (
    <div className="flex flex-wrap gap-2">
      {canApprove && <Button size="sm" onClick={approve} disabled={!!busy}>{busy === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}승인</Button>}
      {editable && version.status !== 'REJECTED' && <Button size="sm" variant="outline" onClick={reject} disabled={!!busy}><X className="w-4 h-4" />반려</Button>}
      {editable && <Button size="sm" variant="outline" onClick={onEdit} disabled={!!busy}><Pencil className="w-4 h-4" />수정</Button>}
      <Button size="sm" variant="ghost" onClick={duplicate} disabled={!!busy}>{busy === 'copy' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}새 버전으로 복제</Button>
    </div>
  );
}