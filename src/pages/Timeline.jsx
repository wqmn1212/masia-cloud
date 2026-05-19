import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
      toast({ title: '타임라인 생성 완료' });
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
          <h1 className="text-2xl font-bold tracking-tight">생산 타임라인</h1>
          <p className="text-sm text-muted-foreground mt-1">주문별 제조·물류 진행 현황 추적</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />신규 타임라인</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>타임라인 생성</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
              <div>
                <Label>고객사명 *</Label>
                <Input value={form.client_name} onChange={(e) => handleChange('client_name', e.target.value)} required />
              </div>
              <div>
                <Label>공장명 *</Label>
                <Input value={form.factory_name} onChange={(e) => handleChange('factory_name', e.target.value)} required />
              </div>
              <div>
                <Label>장비 설명</Label>
                <Input value={form.machine_description} onChange={(e) => handleChange('machine_description', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>현재 단계</Label>
                  <Select value={form.current_stage} onValueChange={(v) => handleChange('current_stage', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STAGES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>예상 완료일</Label>
                  <Input type="date" value={form.estimated_completion} onChange={(e) => handleChange('estimated_completion', e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>취소</Button>
                <Button type="submit" disabled={createMutation.isPending}>생성</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {timelines.length === 0 ? (
        <Card className="p-12 text-center">
          <Clock className="w-12 h-12 mx-auto text-muted-foreground/40" />
          <p className="mt-4 text-lg font-semibold">등록된 타임라인이 없습니다</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {timelines.map((t) => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-semibold">{t.client_name} ← {t.factory_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.machine_description || '장비 정보 없음'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={t.current_stage}
                      onValueChange={(v) => updateStageMutation.mutate({ id: t.id, stage: v })}
                    >
                      <SelectTrigger className="h-8 text-xs w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STAGES).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <TimelineStageBar currentStage={t.current_stage} />
                {t.estimated_completion && (
                  <p className="text-xs text-muted-foreground mt-3">예상 완료: {t.estimated_completion}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}