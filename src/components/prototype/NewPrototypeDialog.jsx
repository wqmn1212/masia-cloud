import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import RequirementFields from '@/components/prototype/RequirementFields';
import { actorName, errorText } from '@/lib/prototypeApi';

export default function NewPrototypeDialog({ open, onOpenChange, user, onCreated }) {
  const [form, setForm] = useState({ title: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!form.title.trim()) { setError('시제품 이름을 입력해 주세요'); return; }
    setSaving(true); setError('');
    try {
      const project = await base44.entities.ProtoProject.create({
        ...form, title: form.title.trim(), tenant_id: user.tenant_id, stage: 'REQUIREMENTS',
        owner_id: user.id, owner_name: actorName(user), files: [], open_risk_count: 0,
      });
      setForm({ title: '' });
      onCreated(project);
    } catch (e) { setError(errorText(e)); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-title">새 시제품</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>시제품 이름</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="예: 드립백 포장기 온도 컨트롤러" />
          </div>
          <RequirementFields value={form} onChange={setForm} />
          <p className="text-caption text-muted-foreground">도면·사진·참고 문서는 만든 뒤 요구사항 탭에서 첨부합니다.</p>
          {error && <p className="text-caption text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin" />}만들기</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}