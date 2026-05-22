import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/lib/LanguageContext';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Shield, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const CATEGORY_LABELS = {
  DRIP_BAG: '드립백 포장기',
  SLEEVE: '슬리브 라벨러',
  DESKTOP_LABELER: '탁상용 라벨러',
  TUBE_SEALER: '튜브 실링기'
};

const SEVERITY_MAP = {
  LOW: { label: '낮음', className: 'bg-muted text-muted-foreground' },
  MEDIUM: { label: '보통', className: 'bg-chart-3/15 text-chart-3' },
  HIGH: { label: '높음', className: 'bg-destructive/15 text-destructive' },
  CRITICAL: { label: '긴급', className: 'bg-destructive text-destructive-foreground' },
};

export default function Knowledge() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['qc-logs'],
    queryFn: () => base44.entities.QCKnowledgeLog.list('-created_date', 100),
  });

  const [form, setForm] = useState({
    target_category: '', issue_case: '', root_cause: '',
    solution_parameter: '', severity: 'MEDIUM',
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.QCKnowledgeLog.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qc-logs'] });
      setOpen(false);
      setForm({ target_category: '', issue_case: '', root_cause: '', solution_parameter: '', severity: 'MEDIUM' });
      toast({ title: t('knowledge.title') });
    },
  });

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const filtered = filter === 'ALL' ? logs : logs.filter(l => l.target_category === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('knowledge.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('knowledge.subtitle')}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />{t('knowledge.add')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('knowledge.form.title')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t('knowledge.form.category')}</Label>
                  <Select value={form.target_category} onValueChange={(v) => handleChange('target_category', v)}>
                    <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([k]) => (
                        <SelectItem key={k} value={k}>{t(`cat.${k}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('knowledge.form.severity')}</Label>
                  <Select value={form.severity} onValueChange={(v) => handleChange('severity', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(SEVERITY_MAP).map(([k]) => (
                        <SelectItem key={k} value={k}>{t(`severity.${k}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>{t('knowledge.form.issue')}</Label>
                <Input value={form.issue_case} onChange={(e) => handleChange('issue_case', e.target.value)} required />
              </div>
              <div>
                <Label>{t('knowledge.form.cause')}</Label>
                <Textarea value={form.root_cause} onChange={(e) => handleChange('root_cause', e.target.value)} rows={3} required />
              </div>
              <div>
                <Label>{t('knowledge.form.solution')}</Label>
                <Textarea value={form.solution_parameter} onChange={(e) => handleChange('solution_parameter', e.target.value)} rows={3} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
                <Button type="submit" disabled={createMutation.isPending}>{t('common.register')}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['ALL', ...Object.keys(CATEGORY_LABELS)].map(cat => (
          <Button
            key={cat}
            variant={filter === cat ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(cat)}
          >
            {cat === 'ALL' ? t('common.all') : t(`cat.${cat}`)}
          </Button>
        ))}
      </div>

      {/* Log cards */}
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
              <Card key={log.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-[10px]">{t(`cat.${log.target_category}`)}</Badge>
                        <Badge className={`${sev.className} border-0 text-[10px]`}>{t(`severity.${log.severity}`)}</Badge>
                      </div>
                      <p className="font-semibold text-sm">{log.issue_case}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{log.root_cause}</p>
                      {log.solution_parameter && (
                        <div className="mt-2 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                          <p className="text-xs text-primary font-medium">💡 {log.solution_parameter}</p>
                        </div>
                      )}
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