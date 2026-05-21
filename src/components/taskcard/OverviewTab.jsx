import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Save, Lightbulb, Plus } from 'lucide-react';
import CategorySelect from './CategorySelect';

const CATEGORY_LABELS = {
  DRIP_BAG: '드립백 포장기',
  SLEEVE: '슬리브 라벨러',
  DESKTOP_LABELER: '탁상형 라벨러',
  TUBE_SEALER: '튜브 실링기',
};

export default function OverviewTab({ card, kbAlerts }) {
  const [form, setForm] = useState({
    title: card.title || '',
    client_name: card.client_name || '',
    factory_name: card.factory_name || '',
    target_machine_category: card.target_machine_category || '',
    hq_requirements: card.hq_requirements || '',
    agent_meeting_notes: card.agent_meeting_notes || '',
    priority: card.priority || 'MEDIUM',
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.TaskCard.update(card.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-cards'] });
      toast({ title: '저장 완료' });
    },
  });

  const addKbAlert = (suggestion) => {
    setForm(p => ({
      ...p,
      hq_requirements: p.hq_requirements
        ? `${p.hq_requirements}\n\n⚠️ [권장] ${suggestion}`
        : `⚠️ [권장] ${suggestion}`,
    }));
  };

  return (
    <div className="space-y-5">
      {/* KB Alerts */}
      {kbAlerts?.length > 0 && (
        <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-3 space-y-2">
          <p className="text-xs font-bold text-yellow-700 flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5" /> 과거 노하우 자동 추천
          </p>
          {kbAlerts.map((a, i) => (
            <div key={i} className="flex items-start justify-between gap-2">
              <p className="text-xs text-yellow-800 flex-1">{a.issue_case}: {a.solution_parameter?.slice(0, 80)}...</p>
              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 shrink-0 border-yellow-400 text-yellow-700"
                onClick={() => addKbAlert(`${a.issue_case} — ${a.solution_parameter}`)}>
                <Plus className="w-2.5 h-2.5 mr-1" />추가
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">업무 제목 *</Label>
          <Input value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs">장비 카테고리</Label>
          <CategorySelect
            value={form.target_machine_category}
            onValueChange={(v) => setForm(p => ({ ...p, target_machine_category: v }))}
          />
        </div>
        <div>
          <Label className="text-xs">고객사</Label>
          <Input value={form.client_name} onChange={(e) => setForm(p => ({ ...p, client_name: e.target.value }))} placeholder="고객사명" />
        </div>
        <div>
          <Label className="text-xs">공장</Label>
          <Input value={form.factory_name} onChange={(e) => setForm(p => ({ ...p, factory_name: e.target.value }))} placeholder="공장명" />
        </div>
      </div>

      <div>
        <Label className="text-xs">HQ 요구사항</Label>
        <Textarea value={form.hq_requirements} onChange={(e) => setForm(p => ({ ...p, hq_requirements: e.target.value }))} rows={5} placeholder="고객사 특수 요구사항을 상세히 입력하세요" className="font-mono text-xs" />
      </div>

      <div>
        <Label className="text-xs">에이전트 미팅 노트 / 공장 특이사항</Label>
        <Textarea value={form.agent_meeting_notes} onChange={(e) => setForm(p => ({ ...p, agent_meeting_notes: e.target.value }))} rows={4} placeholder="공장 미팅 내용, 현장 확인 사항 등을 기록하세요" className="text-xs" />
      </div>

      <div className="flex justify-end">
        <Button onClick={() => updateMutation.mutate(form)} disabled={updateMutation.isPending} className="gap-2">
          <Save className="w-4 h-4" />{updateMutation.isPending ? '저장 중...' : '저장'}
        </Button>
      </div>
    </div>
  );
}