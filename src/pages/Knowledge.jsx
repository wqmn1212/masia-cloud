import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/lib/LanguageContext';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Shield, AlertTriangle } from 'lucide-react';
import CaseLogDialog from '@/components/knowledge/CaseLogDialog';
import { COMPONENT_TYPES, STAGES, caseType } from '@/lib/qcPrecheck';

const SEVERITY_MAP = {
  LOW: { label: '낮음', className: 'bg-muted text-muted-foreground' },
  MEDIUM: { label: '보통', className: 'bg-chart-3/15 text-chart-3' },
  HIGH: { label: '높음', className: 'bg-destructive/15 text-destructive' },
  CRITICAL: { label: '긴급', className: 'bg-destructive text-destructive-foreground' },
};

// QC 사례 기록. 구성품 유형·태그를 붙여 두면 사전 QC 점검이 같은 유형의 카드에 근거로 띄운다.
export default function Knowledge() {
  const { t, lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('ALL');

  const { data: logs = [] } = useQuery({
    queryKey: ['qc-logs'],
    queryFn: () => base44.entities.QCKnowledgeLog.list('-created_date', 200),
  });

  const counts = logs.reduce((m, l) => ({ ...m, [caseType(l)]: (m[caseType(l)] || 0) + 1 }), {});
  const types = Object.keys(COMPONENT_TYPES).filter((k) => counts[k]);
  const filtered = filter === 'ALL' ? logs : logs.filter((l) => caseType(l) === filter);
  const typeLabel = (k) => COMPONENT_TYPES[k]?.[lang] || COMPONENT_TYPES[k]?.ko || '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('knowledge.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('knowledge.subtitle')}</p>
        </div>
        <Button onClick={() => setOpen(true)} className="shrink-0"><Plus className="w-4 h-4 mr-2" />{t('knowledge.add')}</Button>
      </div>
      <CaseLogDialog open={open} onOpenChange={setOpen} />

      <div className="flex gap-2 flex-wrap">
        {['ALL', ...types].map((k) => (
          <Button key={k} variant={filter === k ? 'default' : 'outline'} size="sm" onClick={() => setFilter(k)}>
            {k === 'ALL' ? `${t('common.all')} ${logs.length}` : `${typeLabel(k)} ${counts[k]}`}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Shield className="w-12 h-12 mx-auto text-muted-foreground/40" />
          <p className="mt-4 text-lg font-semibold">{t('knowledge.empty')}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((log) => {
            const sev = SEVERITY_MAP[log.severity] || SEVERITY_MAP.MEDIUM;
            return (
              <Card key={log.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="text-[10px]">{typeLabel(caseType(log))}</Badge>
                        {log.target_category && <Badge variant="outline" className="text-[10px]">{t(`cat.${log.target_category}`)}</Badge>}
                        <Badge className={`${sev.className} border-0 text-[10px]`}>{t(`severity.${log.severity || 'MEDIUM'}`)}</Badge>
                        {(log.tags || []).map((tag) => <span key={tag} className="rounded-md border px-1.5 text-[10px] text-muted-foreground">#{tag}</span>)}
                      </div>
                      <p className="font-semibold text-sm">{log.issue_case}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{log.root_cause}</p>
                      {(log.trigger_decision || log.preventable_stage) && (
                        <p className="text-xs text-muted-foreground">
                          {log.trigger_decision && <>{t('knowledge.trigger')}: <span className="text-foreground">{log.trigger_decision}</span></>}
                          {log.trigger_decision && log.preventable_stage && ' · '}
                          {log.preventable_stage && <>{t('knowledge.stageAt')}: <span className="text-foreground">{STAGES[log.preventable_stage]?.[lang] || STAGES[log.preventable_stage]?.ko}</span></>}
                        </p>
                      )}
                      {log.prevention && (
                        <div className="rounded-lg bg-primary/5 border border-primary/10 p-2.5">
                          <p className="text-xs text-primary font-medium">{t('knowledge.prevention')}: {log.prevention}</p>
                        </div>
                      )}
                      {log.solution_parameter && <p className="text-xs text-muted-foreground">{t('knowledge.form.solution')}: {log.solution_parameter}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
