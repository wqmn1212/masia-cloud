import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/lib/LanguageContext';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Clock } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import TimelineStageBar from '@/components/timeline/TimelineStageBar';

const STAGES = {
  CONTRACT: '계약 완료',
  MANUFACTURING: '제조 중',
  QC_PASS: 'QC 통과',
  SHIPPING: '해상 선적',
  CUSTOMS: '통관',
  INSTALLATION: '설치 완료'
};

export default function Timeline() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: timelines = [], isLoading } = useQuery({
    queryKey: ['timelines'],
    queryFn: () => base44.entities.ProductionTimeline.list('-created_date', 50),
  });

  const [form, setForm] = useState({
    client_name: '', factory_name: '', machine_description: '',
    current_stage: 'CONTRACT', estimated_completion: '',
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ProductionTimeline.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timelines'] });
      setOpen(false);
      setForm({ client_name: '', factory_name: '', machine_description: '', current_stage: 'CONTRACT', estimated_completion: '' });
      toast({ title: t('timeline.title') });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: ({ id, stage }) => base44.entities.ProductionTimeline.update(id, { current_stage: stage }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['timelines'] }),
  });

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('timeline.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('timeline.subtitle')}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />{t('timeline.add')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('timeline.form.title')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
              <div>
                <Label>{t('timeline.form.client')}</Label>
                <Input value={form.client_name} onChange={(e) => handleChange('client_name', e.target.value)} required />
              </div>
              <div>
                <Label>{t('timeline.form.factory')}</Label>
                <Input value={form.factory_name} onChange={(e) => handleChange('factory_name', e.target.value)} required />
              </div>
              <div>
                <Label>{t('timeline.form.machine')}</Label>
                <Input value={form.machine_description} onChange={(e) => handleChange('machine_description', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t('timeline.form.stage')}</Label>
                  <Select value={form.current_stage} onValueChange={(v) => handleChange('current_stage', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STAGES).map(([k]) => (
                        <SelectItem key={k} value={k}>{t(`stage.${k}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('timeline.form.est')}</Label>
                  <Input type="date" value={form.estimated_completion} onChange={(e) => handleChange('estimated_completion', e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
                <Button type="submit" disabled={createMutation.isPending}>{t('common.create')}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {timelines.length === 0 ? (
        <Card className="p-12 text-center">
          <Clock className="w-12 h-12 mx-auto text-muted-foreground/40" />
          <p className="mt-4 text-lg font-semibold">{t('timeline.empty')}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {timelines.map((tl) => (
            <Card key={tl.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-semibold">{tl.client_name} ← {tl.factory_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{tl.machine_description || t('timeline.noinfo')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={tl.current_stage}
                      onValueChange={(v) => updateStageMutation.mutate({ id: tl.id, stage: v })}
                    >
                      <SelectTrigger className="h-8 text-xs w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STAGES).map(([k]) => (
                          <SelectItem key={k} value={k}>{t(`stage.${k}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <TimelineStageBar currentStage={tl.current_stage} />
                {tl.estimated_completion && (
                  <p className="text-xs text-muted-foreground mt-3">{t('timeline.est')} {tl.estimated_completion}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}