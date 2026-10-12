import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useWorkT } from '@/lib/workI18n';

// milestone 이 있으면 수정, open && !milestone 이면 새 단계 추가
export default function MilestoneEditDialog({ open, milestone, onClose, onSave }) {
  const { tr } = useWorkT();
  const [f, setF] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setF({ label: milestone?.label || '', label_cn: milestone?.label_cn || '', planned_date: milestone?.planned_date || '', client_visible: milestone ? milestone.client_visible !== false : true, needs_qc_report: !!milestone?.needs_qc_report });
  }, [open, milestone]);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => { setSaving(true); const ok = await onSave(f); setSaving(false); if (ok) onClose(); };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{tr(milestone ? '단계 수정' : '단계 추가')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">{tr('단계 이름')}</Label><Input value={f.label || ''} onChange={(e) => set('label', e.target.value)} /></div>
          <div><Label className="text-xs">{tr('중국어 이름')}</Label><Input value={f.label_cn || ''} onChange={(e) => set('label_cn', e.target.value)} /></div>
          {!milestone && <div><Label className="text-xs">{tr('계획일')}</Label><Input type="date" value={f.planned_date || ''} onChange={(e) => set('planned_date', e.target.value)} /></div>}
          <label className="flex items-center justify-between text-sm">{tr('고객에게 공개')}<Switch checked={!!f.client_visible} onCheckedChange={(v) => set('client_visible', v)} /></label>
          <label className="flex items-center justify-between text-sm">{tr('완료 시 QC 보고서 필요')}<Switch checked={!!f.needs_qc_report} onCheckedChange={(v) => set('needs_qc_report', v)} /></label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tr('취소')}</Button>
          <Button disabled={saving || !f.label?.trim()} onClick={save}>{tr('저장')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}