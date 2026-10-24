import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { COMPONENT_TYPES, STAGES } from '@/lib/qcPrecheck';

const sel = 'h-9 w-full rounded-md border bg-background px-2 text-sm';
const EMPTY = { component_type: '', severity: 'MEDIUM', issue_case: '', root_cause: '', trigger_decision: '', preventable_stage: '', prevention: '', solution_parameter: '', tags: '' };

// QC 사례 등록 창. 지식 베이스 화면과 검수 불합격·불량 신고의 '사례로 남기기'가 같이 쓴다.
export default function CaseLogDialog({ open, onOpenChange, initial = {}, tenantId, cardId }) {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const tenant = tenantId || user?.tenant_id;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [f, setF] = useState(EMPTY);
  useEffect(() => { if (open) setF({ ...EMPTY, ...initial, tags: (initial.tags || []).join?.(', ') ?? initial.tags ?? '' }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = useMutation({
    mutationFn: () => {
      const { tags, preventable_stage, component_type, ...rest } = f;
      return base44.entities.QCKnowledgeLog.create({
        ...rest,
        component_type,
        ...(preventable_stage ? { preventable_stage } : {}),
        tags: tags.split(/[,，]/).map((x) => x.trim()).filter(Boolean),
        ...(tenant ? { tenant_id: tenant } : {}),
        ...(cardId ? { card_id: cardId } : {}),
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['qc-logs'] }); qc.invalidateQueries({ queryKey: ['qc-cases'] }); toast({ title: t('knowledge.saved') }); onOpenChange(false); },
    onError: (e) => toast({ title: e.message, variant: 'destructive' }),
  });
  const ok = f.component_type && f.issue_case.trim() && f.root_cause.trim();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{cardId ? t('knowledge.fromCard') : t('knowledge.form.title')}</DialogTitle>
          <DialogDescription>{t('knowledge.fromCardHint')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); if (ok) save.mutate(); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t('knowledge.form.componentType')}</Label>
              <select className={sel} value={f.component_type} onChange={set('component_type')} required>
                <option value="">—</option>
                {Object.entries(COMPONENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v[lang] || v.ko}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('knowledge.form.severity')}</Label>
              <select className={sel} value={f.severity} onChange={set('severity')}>
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((k) => <option key={k} value={k}>{t(`severity.${k}`)}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1"><Label className="text-xs">{t('knowledge.form.issue')}</Label><Input value={f.issue_case} onChange={set('issue_case')} placeholder="예: 사바리 박스 접힘 주름" required /></div>
          <div className="space-y-1"><Label className="text-xs">{t('knowledge.form.cause')}</Label><Textarea rows={2} value={f.root_cause} onChange={set('root_cause')} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">{t('knowledge.form.trigger')}</Label><Input value={f.trigger_decision} onChange={set('trigger_decision')} placeholder="예: 156g→180g, 최종 2.6T" /></div>
            <div className="space-y-1">
              <Label className="text-xs">{t('knowledge.form.stage')}</Label>
              <select className={sel} value={f.preventable_stage} onChange={set('preventable_stage')}>
                <option value="">—</option>
                {Object.entries(STAGES).map(([k, v]) => <option key={k} value={k}>{v[lang] || v.ko}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1"><Label className="text-xs">{t('knowledge.form.prevention')}</Label><Textarea rows={2} value={f.prevention} onChange={set('prevention')} placeholder="예: 괘선 폭·깊이 또는 V커팅 지정, 바뀐 종이로 접힘 더미 승인" /></div>
          <div className="space-y-1"><Label className="text-xs">{t('knowledge.form.solution')}</Label><Textarea rows={2} value={f.solution_parameter} onChange={set('solution_parameter')} /></div>
          <div className="space-y-1"><Label className="text-xs">{t('knowledge.form.tags')}</Label><Input value={f.tags} onChange={set('tags')} /></div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={!ok || save.isPending}>{save.isPending ? t('common.registering') : t('common.register')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
